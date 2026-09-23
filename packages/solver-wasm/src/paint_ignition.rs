//! 塗り発火探索の評価器と比較仕様。
//!
//! 設計は `docs/research/paint-ignition-search.md`。要点だけ:
//!
//! - 「ぷよ塗り」した**その時点で連鎖が発火する**塗り方を探す。後段のなぞりは無い
//! - 既存の塗り探索 ([`crate::paint_search`]) とはハード制約が正反対 (あちらは発火させない)。
//!   有効な塗り集合が上方閉になるので、制約による枝刈りは一切効かない
//! - 評価は「塗った瞬間の連鎖」1回ぶん。[`crate::simulator_bb`] の `TraceMode::To*` 分岐が
//!   「指定マスを指定色に変えて発火判定する」処理そのものなので、塗り集合を生のマスクとして
//!   渡すだけで評価できる (新しいシミュレーターは要らない)
//!
//! ## `TraceMode::To*` を評価に流用することについて
//!
//! なぞり塗り (`TraceMode::To*`) とぷよ塗りは**別機能で仕様も違う** (プリズムと?ぷよは
//! なぞり塗りでは指定色になるが、ぷよ塗りでは塗れない)。ここで流用できるのは、
//! [`crate::paint::is_paintable_attr`] が候補からプリズムと?ぷよを除いているため、
//! **渡すマスクの上では両者の仕様差が現れない**から。候補の作り方を変えるときはここも見直すこと。

use std::cell::Cell;

use crate::exploration_target::{ExplorationTarget, PreferenceKind};
use crate::paint::{bit, Bits, PaintFilter, PaintSetup, CELL_NUM, WIDTH};
use crate::puyo::{Field, NextPuyos};
use crate::puyo_attr::PuyoAttr;
use crate::puyo_coord::PuyoCoord;
use crate::simulation_environment::SimulationEnvironment;
use crate::simulator_bb::{BitBoards, ChainSignature, ChainsAggregate, SimulatorBB, UnknownFill};
use crate::solution::SolutionResult;
use crate::solution_explorer::{
    better_solution, better_solution_with_fns, calc_value, resolve_better_fns,
    solution_result_from_agg, BetterFn,
};
use crate::trace_mode::TraceMode;
use std::collections::HashSet;

/// 比較の既定の優先順位 (`docs/research/paint-ignition-search.md` §8-2)。
///
/// なぞりは行わないので、末尾の [`PreferenceKind::SmallerTraceNum`] は
/// **「塗り数が少ない方」** を意味する ([`IgnitionSolution::result`] の `trace_coords` に
/// 塗ったマスが入っているため)。「同じ評価値なら塗り数が少ない方」はこれで表現される。
pub const DEFAULT_IGNITION_PREFERENCES: [PreferenceKind; 5] = [
    PreferenceKind::ChancePop,
    PreferenceKind::BiggerValue,
    PreferenceKind::PrismPop,
    PreferenceKind::AllClear,
    PreferenceKind::SmallerTraceNum,
];

/// 塗り色に対応する `TraceMode`。色ぷよ以外は塗り色にできないので `None`。
pub fn paint_trace_mode(target: PuyoAttr) -> Option<TraceMode> {
    match target {
        PuyoAttr::Red => Some(TraceMode::ToRed),
        PuyoAttr::Blue => Some(TraceMode::ToBlue),
        PuyoAttr::Green => Some(TraceMode::ToGreen),
        PuyoAttr::Yellow => Some(TraceMode::ToYellow),
        PuyoAttr::Purple => Some(TraceMode::ToPurple),
        _ => None,
    }
}

/// 塗り発火探索の候補マス。
///
/// [`PaintSetup`] の候補算出 (塗れる属性の判定・[`PaintFilter`] による絞り込み) をそのまま使うが、
/// **単セル枝刈りを通した `PaintSetup::candidates` は使わない**。あれは「1マス塗るだけで発火する
/// マス」を落とすもので、今回はそれこそが最も欲しいマスだから。
pub struct IgnitionSetup {
    /// 塗り色。
    pub target: PuyoAttr,
    /// 塗れるマス数の上限。
    pub max_paint_num: usize,
    /// 初期盤面における塗り色のビットボード (`paint.rs` のインデックス系)。
    pub base_board: Bits,
    /// 絞り込み前の塗れるマス。
    pub raw_candidates: Vec<usize>,
    /// [`PaintFilter`] 適用後のマス。探索の分岐はこれを使う。
    pub candidates: Vec<usize>,
}

impl IgnitionSetup {
    /// 最低消し数は `environment` から取る。候補の算出と評価で別々の値を使えてしまうと、
    /// `docs/research/paint-ignition-search.md` §8-3 が警告している「生成器と評価器で
    /// 最低消し数が食い違う」落とし穴をそのまま踏むため。
    pub fn new(
        field: &Field,
        next_puyos: &NextPuyos,
        environment: &SimulationEnvironment,
        target: PuyoAttr,
        max_paint_num: usize,
        filter: PaintFilter,
    ) -> IgnitionSetup {
        let setup = PaintSetup::new(
            field,
            next_puyos,
            target,
            max_paint_num,
            environment.minimum_puyo_num_for_popping,
            filter,
        );
        IgnitionSetup {
            target,
            max_paint_num,
            base_board: setup.base_board,
            raw_candidates: setup.raw_candidates,
            candidates: setup.filtered_candidates,
        }
    }

    /// 塗り集合のビットマスク (`paint.rs` のインデックス系)。
    pub fn mask_of(paint_set: &[usize]) -> Bits {
        paint_set.iter().fold(0, |acc, &index| acc | bit(index))
    }

    /// 塗り集合を座標列に変換する。範囲外のインデックスはパニックする
    /// (黙って落とすと塗り数が減って [`better_ignition`] の比較が狂うため)。
    pub fn to_coords(paint_set: &[usize]) -> Vec<PuyoCoord> {
        paint_set
            .iter()
            .map(|&index| {
                PuyoCoord::index_to_coord(index as u8)
                    .unwrap_or_else(|| panic!("盤面の外を指す塗りマス: {}", index))
            })
            .collect()
    }
}

/// 塗り発火探索の解 (発火したものだけ)。
#[derive(Debug, Clone)]
pub struct IgnitionSolution {
    /// 塗ったマス (`paint.rs` のインデックス、昇順)。
    pub paint_set: Vec<usize>,
    /// 塗ったマスのビットマスク。同点時の順序固定に使う。
    pub mask: Bits,
    /// 発火した連鎖の評価結果。`trace_coords` には**塗ったマス**が入っているので、
    /// [`PreferenceKind::SmallerTraceNum`] は「塗り数が少ない方」の意味になる。
    pub result: SolutionResult,
}

/// 解決済みの比較関数列。優先度のテーブル引きを1回で済ませるための入れ物。
///
/// [`better_ignition`] は呼ぶたびに優先度の数だけ HashMap を引く。局所探索
/// ([`crate::paint_ignition_search::search_ils`]) は1歩あたり数百回比較するので、
/// そこでは必ずこちらを使うこと。
pub struct IgnitionComparator {
    fns: Vec<BetterFn>,
}

impl IgnitionComparator {
    pub fn new(preference_priorities: &[PreferenceKind]) -> IgnitionComparator {
        IgnitionComparator {
            fns: resolve_better_fns(preference_priorities),
        }
    }

    /// [`better_ignition`] と同じ比較。良い方を返す。
    pub fn better<'a>(
        &self,
        s1: &'a IgnitionSolution,
        s2: &'a IgnitionSolution,
    ) -> &'a IgnitionSolution {
        let forward = better_solution_with_fns(&self.fns, &s1.result, &s2.result);
        if std::ptr::eq(forward, &s2.result) {
            return s2;
        }
        let backward = better_solution_with_fns(&self.fns, &s2.result, &s1.result);
        if std::ptr::eq(backward, &s1.result) {
            return s1;
        }
        if s1.mask <= s2.mask {
            s1
        } else {
            s2
        }
    }

    /// `candidate` が `slot` より良ければ `slot` を置き換える。
    pub fn keep_better(&self, slot: &mut Option<IgnitionSolution>, candidate: &IgnitionSolution) {
        let replace = match slot {
            None => true,
            Some(current) => std::ptr::eq(self.better(candidate, current), candidate),
        };
        if replace {
            *slot = Some(candidate.clone());
        }
    }
}

/// [`IgnitionSolution`] の比較。良い方を返す。
///
/// [`better_solution`] は同値のとき第1引数を返す (評価順が結果を決めてしまう) ので、
/// 最後にマスクで順序を固定する。これで探索の順序に依らず結果が一意に決まる。
pub fn better_ignition<'a>(
    preference_priorities: &Vec<PreferenceKind>,
    s1: &'a IgnitionSolution,
    s2: &'a IgnitionSolution,
) -> &'a IgnitionSolution {
    let forward = better_solution(preference_priorities, &s1.result, &s2.result);
    if std::ptr::eq(forward, &s2.result) {
        return s2;
    }
    let backward = better_solution(preference_priorities, &s2.result, &s1.result);
    if std::ptr::eq(backward, &s1.result) {
        return s1;
    }
    // どちらの向きでも決着しない = 優先順位の上では同値。マスクの小さい方を優先する。
    if s1.mask <= s2.mask {
        s1
    } else {
        s2
    }
}

/// 塗り集合1件を評価する。
///
/// 盤面とネクストは固定なので、ビットボードと候補マスのビット対応を1度だけ作って使い回す。
///
/// 守備範囲はここまで:
///
/// - **不確定ぷよは見ない** (`unknown_fill` は `None` 固定 = `Inert`)。設計メモ §8-3 の
///   「初回比較では確率的評価を混ぜない」に合わせてある。期待値評価を載せるなら
///   `do_chains_aggregate_multi` を使う別経路が要る
/// - [`SolutionResult::chains`] は空のまま。なぞり探索の `finalize_chains` にあたる後処理が
///   まだ無いので、UI へ連鎖の中身を出すゴールではその経路を別途用意すること
pub struct IgnitionEvaluator<'a> {
    exploration_target: &'a ExplorationTarget,
    /// `trace_mode` を塗り色の `To*` に差し替えた環境。
    environment: SimulationEnvironment,
    boost_area: u64,
    boards: BitBoards,
    /// `paint.rs` のインデックス → シミュレーターのビット。
    /// ビット並びが違う (あちらは `y * 8 + x`、シミュレーターは列優先で行が7本) ので変換が要る。
    sim_bits: [u64; CELL_NUM],
}

impl<'a> IgnitionEvaluator<'a> {
    /// 塗り色が色ぷよでなければ `None` (塗り発火探索が成立しない)。
    pub fn new(
        exploration_target: &'a ExplorationTarget,
        environment: &SimulationEnvironment,
        boost_area_coord_set: &HashSet<PuyoCoord>,
        field: &Field,
        next_puyos: &NextPuyos,
        target: PuyoAttr,
    ) -> Option<IgnitionEvaluator<'a>> {
        let trace_mode = paint_trace_mode(target)?;
        let mut environment = *environment;
        environment.trace_mode = trace_mode;

        let boards = SimulatorBB::create_bit_boards(
            &field.map(|row| row.map(|c| c.map(|p| p.puyo_type))),
            &next_puyos.map(|c| c.map(|p| p.puyo_type)),
        );

        let mut sim_bits = [0u64; CELL_NUM];
        for (index, slot) in sim_bits.iter_mut().enumerate() {
            let coord = PuyoCoord::xy_to_coord((index % WIDTH) as u8, (index / WIDTH) as u8)
                .expect("index は 0..CELL_NUM なので必ず有効な座標");
            *slot = SimulatorBB::coords_to_board(std::iter::once(&coord));
        }

        Some(IgnitionEvaluator {
            exploration_target,
            environment,
            boost_area: SimulatorBB::coords_to_board(boost_area_coord_set.iter()),
            boards,
            sim_bits,
        })
    }

    /// 最低消し数。候補の算出と評価で同じ値を使わせるため、ここから引かせる
    /// (設計メモ §8-3)。
    pub fn minimum_puyo_num_for_popping(&self) -> u32 {
        self.environment.minimum_puyo_num_for_popping
    }

    /// 比較に使う優先順位。探索器が別経路で優先順位を持つと、設計メモ §8-2 の
    /// 「選抜にも同じ優先順位を使う」が破れるので、ここから引かせる。
    pub fn preference_priorities(&self) -> &Vec<PreferenceKind> {
        &self.exploration_target.preference_priorities
    }

    /// 塗り集合を評価する。**発火しなければ `None`** (塗り発火探索のハード制約違反)。
    ///
    /// 初期盤面に既に消える連結がある場合は、空の塗り集合でも発火扱いになる
    /// (`TraceMode::To*` はマスクが空でも消し判定まで進むため。`TraceMode::Normal` は
    /// マスクが空なら即座に打ち切るので、ここは両者で挙動が違う)。
    /// 実際のゲームの初期盤面にその状態は存在しないので、呼び出し側はそれを前提にしてよい。
    pub fn evaluate(&self, paint_set: &[usize]) -> Option<IgnitionSolution> {
        self.evaluate_with_signature(paint_set).0
    }

    /// [`Self::evaluate`] と同じ評価に、連鎖の消え方の指紋を添えて返す。
    ///
    /// 指紋はビームサーチの重複排除に使う (設計メモ §7)。未発火なら
    /// [`ChainSignature::default`] (すべてゼロ) が返る。
    pub fn evaluate_with_signature(
        &self,
        paint_set: &[usize],
    ) -> (Option<IgnitionSolution>, ChainSignature) {
        let (agg, signature) = self.aggregate_with_signature(paint_set);
        if !has_popped(&agg) {
            return (None, signature);
        }
        // 呼び出し側は「既存の集合に1マス足す」ので、足したマスが既存より小さい順序で
        // 渡ってくる。集合としての同一性を `paint_set` の等値でも見られるよう、ここで正規化する。
        let mut paint_set = paint_set.to_vec();
        paint_set.sort_unstable();
        let coords = IgnitionSetup::to_coords(&paint_set);
        (
            Some(IgnitionSolution {
                mask: IgnitionSetup::mask_of(&paint_set),
                paint_set,
                result: solution_result_from_agg(self.exploration_target, &coords, &agg),
            }),
            signature,
        )
    }

    /// 塗り集合を適用した連鎖の集約スカラー。発火しなければ全ゼロ。
    ///
    /// `paint_set` は [`IgnitionSetup::candidates`] 由来のインデックスであること
    /// (盤面の占有マスの部分集合。`fold_field_phase` の `debug_assert` がこれを前提にしている)。
    /// 範囲外のインデックスはパニックする。
    pub fn aggregate(&self, paint_set: &[usize]) -> ChainsAggregate {
        self.aggregate_with_signature(paint_set).0
    }

    /// 不確定ぷよ (ネクストより先に降ってくるぷよ) のサンプルを当てた評価値の平均と、
    /// 決定論評価を返す。発火しなければ `None`。
    ///
    /// **なぞりが無いので、既存の塗り探索にあった2種類の期待値
    /// (`E_s[max_t]` と `max_t[E_s]`) の区別が消える。** 選ぶものが塗り集合しか無く、
    /// 塗ってから補充を見て選び直す余地が無いので、期待値は1通りに定まる。
    /// あちらで「補充を見てからなぞりを選べる前提なので上振れする」と注記していた
    /// 問題が、こちらでは原理的に起きない。
    ///
    /// 決定論フェーズは1回しか計算しない ([`SimulatorBB::do_chains_aggregate_multi`]) ので、
    /// コストはサンプル数ぶんの単純倍にはならない。
    pub fn evaluate_expected(
        &self,
        paint_set: &[usize],
        fills: &[UnknownFill],
    ) -> Option<(IgnitionSolution, f64)> {
        let trace = paint_set
            .iter()
            .fold(0u64, |acc, &index| acc | self.sim_bits[index]);
        let sim = SimulatorBB {
            environment: &self.environment,
            boost_area: self.boost_area,
            unknown_fill: None,
            refills_done: Cell::new(0),
        };
        let mut aggs = vec![ChainsAggregate::default(); fills.len() + 1];
        sim.do_chains_aggregate_multi(&self.boards, trace, fills, &mut aggs);

        if !has_popped(&aggs[0]) {
            return None;
        }
        let mut sorted = paint_set.to_vec();
        sorted.sort_unstable();
        let coords = IgnitionSetup::to_coords(&sorted);
        let solution = IgnitionSolution {
            mask: IgnitionSetup::mask_of(&sorted),
            paint_set: sorted,
            result: solution_result_from_agg(self.exploration_target, &coords, &aggs[0]),
        };
        let expected = if fills.is_empty() {
            solution.result.value
        } else {
            aggs[1..]
                .iter()
                .map(|agg| calc_value(self.exploration_target, agg))
                .sum::<f64>()
                / fills.len() as f64
        };
        Some((solution, expected))
    }

    /// 塗り集合の連鎖をフル構築する。UI に連鎖の内訳を出すとき用。
    ///
    /// 探索中は使わないこと ([`SolutionResult::chains`] を空のままにしているのは、
    /// 候補ごとに `Vec<Chain>` を確保しないため)。最終的に返す解にだけ当てる。
    pub fn chains(&self, paint_set: &[usize]) -> Vec<crate::chain::Chain> {
        let trace = paint_set
            .iter()
            .fold(0u64, |acc, &index| acc | self.sim_bits[index]);
        let sim = SimulatorBB {
            environment: &self.environment,
            boost_area: self.boost_area,
            unknown_fill: None,
            refills_done: Cell::new(0),
        };
        sim.do_chains(&mut self.boards.clone(), trace)
    }

    /// [`Self::aggregate`] に連鎖の消え方の指紋を添えた版。
    pub fn aggregate_with_signature(
        &self,
        paint_set: &[usize],
    ) -> (ChainsAggregate, ChainSignature) {
        let trace = paint_set
            .iter()
            .fold(0u64, |acc, &index| acc | self.sim_bits[index]);
        let sim = SimulatorBB {
            environment: &self.environment,
            boost_area: self.boost_area,
            unknown_fill: None,
            refills_done: Cell::new(0),
        };
        sim.do_chains_signature(&mut self.boards.clone(), trace)
    }
}

/// 連鎖が1つでも起きたか。`fold_field_phase` は何も消えなければ即座に打ち切るので、
/// 発火しなかった塗り集合の集約は全ゼロになる。
fn has_popped(agg: &ChainsAggregate) -> bool {
    agg.popped.iter().any(|&n| n > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::exploration_target::ExplorationCategory;
    use crate::puyo::Puyo;
    use crate::puyo_type::PuyoType;

    fn field_from(rows: [[PuyoType; 8]; 6]) -> Field {
        let mut id = 0i32;
        rows.map(|row| {
            row.map(|puyo_type| {
                id += 1;
                Some(Puyo { id, puyo_type })
            })
        })
    }

    /// 連鎖の仕込みが無い盤面 (どの色も4連結しない)。
    fn plain_field() -> Field {
        let (r, b, g, y, p, h) = (
            PuyoType::Red,
            PuyoType::Blue,
            PuyoType::Green,
            PuyoType::Yellow,
            PuyoType::Purple,
            PuyoType::Heart,
        );
        field_from([
            [b, g, y, r, b, r, p, r],
            [g, r, g, h, p, b, y, r],
            [g, g, p, p, b, p, r, y],
            [b, b, y, r, g, b, r, y],
            [r, r, g, y, r, g, p, y],
            [g, r, g, y, b, g, g, p],
        ])
    }

    fn next_puyos() -> NextPuyos {
        [None; 8]
    }

    fn environment() -> SimulationEnvironment {
        SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 1.0,
        }
    }

    fn damage_target(main_attr: PuyoAttr) -> ExplorationTarget {
        ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: DEFAULT_IGNITION_PREFERENCES.to_vec(),
            optimal_solution_count: 1,
            main_attr: Some(main_attr),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        }
    }

    fn evaluator<'a>(
        target: &'a ExplorationTarget,
        env: &SimulationEnvironment,
        boost: &HashSet<PuyoCoord>,
        field: &Field,
        next: &NextPuyos,
        color: PuyoAttr,
    ) -> IgnitionEvaluator<'a> {
        IgnitionEvaluator::new(target, env, boost, field, next, color).unwrap()
    }

    #[test]
    fn non_color_target_has_no_trace_mode() {
        assert_eq!(paint_trace_mode(PuyoAttr::Red), Some(TraceMode::ToRed));
        assert_eq!(paint_trace_mode(PuyoAttr::Purple), Some(TraceMode::ToPurple));
        assert!(paint_trace_mode(PuyoAttr::Heart).is_none());
        assert!(paint_trace_mode(PuyoAttr::Ojama).is_none());

        let target = damage_target(PuyoAttr::Red);
        let env = environment();
        let boost = HashSet::new();
        assert!(IgnitionEvaluator::new(
            &target,
            &env,
            &boost,
            &plain_field(),
            &next_puyos(),
            PuyoAttr::Heart
        )
        .is_none());
    }

    /// テスト盤面に連鎖の仕込みが無いこと (= 空の塗り集合では発火しないこと) を全色で確かめる。
    /// 以降のテストはすべてこの前提の上に立つ。
    #[test]
    fn empty_paint_set_does_not_ignite() {
        let env = environment();
        let boost = HashSet::new();
        let field = plain_field();
        for color in crate::puyo_attr::COLOR_ATTRS {
            let target = damage_target(color);
            let ev = evaluator(&target, &env, &boost, &field, &next_puyos(), color);
            assert!(
                ev.evaluate(&[]).is_none(),
                "{:?} で初期盤面がいきなり発火している",
                color
            );
        }
    }

    /// 塗り集合が発火するかどうかが、塗り色の連結成分の大きさと一致すること。
    /// (ハード制約が既存の塗り探索と正反対であることの確認でもある)
    #[test]
    fn ignition_matches_component_growth() {
        use crate::paint::{build_neighbor_masks, component_size_capped};

        let field = plain_field();
        let target = damage_target(PuyoAttr::Red);
        let env = environment();
        let boost = HashSet::new();
        let setup =
            IgnitionSetup::new(&field, &next_puyos(), &env, PuyoAttr::Red, 2, PaintFilter::All);
        let ev = evaluator(&target, &env, &boost, &field, &next_puyos(), PuyoAttr::Red);
        let masks = build_neighbor_masks();

        let mut fired = 0usize;
        for i in 0..setup.candidates.len() {
            for j in (i + 1)..setup.candidates.len() {
                let set = [setup.candidates[i], setup.candidates[j]];
                let board = setup.base_board | bit(set[0]) | bit(set[1]);
                let popped = set.iter().any(|&index| {
                    component_size_capped(
                        board,
                        index,
                        &masks,
                        env.minimum_puyo_num_for_popping - 1,
                    ) >= env.minimum_puyo_num_for_popping
                });
                assert_eq!(
                    ev.evaluate(&set).is_some(),
                    popped,
                    "塗り集合 {:?} の発火判定が連結成分と食い違う",
                    set
                );
                if popped {
                    fired += 1;
                }
            }
        }
        assert!(fired > 0, "発火する2マスの塗りが1件も無い盤面ではテストにならない");
    }

    /// マスクで渡す評価と、盤面を実際に塗ってから残り1マスを塗る評価が一致すること。
    ///
    /// ぷよ塗りの盤面反映 (`PaintSetup::apply` → `convert_type`) と、評価器が使う
    /// `TraceMode::To*` のビットボード変換が同じ意味であることを担保する。
    /// プラス・チャンス属性が塗っても残ることもここで効いてくる。
    #[test]
    fn mask_evaluation_matches_painting_the_field() {
        let mut field = plain_field();
        // プラス・チャンスを混ぜて、塗り替えで属性が落ちないことも一緒に見る。
        field[0][0] = Some(Puyo {
            id: 100,
            puyo_type: PuyoType::BlueChancePlus,
        });
        field[5][7] = Some(Puyo {
            id: 101,
            puyo_type: PuyoType::PurplePlus,
        });
        field[2][4] = Some(Puyo {
            id: 102,
            puyo_type: PuyoType::Ojama,
        });
        field[3][5] = Some(Puyo {
            id: 103,
            puyo_type: PuyoType::Kata,
        });
        field[1][3] = Some(Puyo {
            id: 104,
            puyo_type: PuyoType::Heart,
        });

        let target = damage_target(PuyoAttr::Red);
        let env = environment();
        let boost: HashSet<PuyoCoord> = [PuyoCoord::xy_to_coord(2, 2).unwrap()]
            .into_iter()
            .collect();
        let next = next_puyos();
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 4, PaintFilter::All);
        let paint_setup = PaintSetup::new(
            &field,
            &next,
            PuyoAttr::Red,
            4,
            env.minimum_puyo_num_for_popping,
            PaintFilter::All,
        );
        let ev = evaluator(&target, &env, &boost, &field, &next, PuyoAttr::Red);

        let mut compared = 0usize;
        // 4マスの塗り集合を決定的に作り、最後の1マスだけをマスクで渡す形に分解して比べる。
        let c = &setup.candidates;
        for i in 0..c.len().min(12) {
            let set: Vec<usize> = vec![c[i], c[(i + 5) % c.len()], c[(i + 11) % c.len()]];
            if set[0] == set[1] || set[1] == set[2] || set[0] == set[2] {
                continue;
            }
            let whole = ev.evaluate(&set);

            let (last, prefix) = set.split_last().unwrap();
            let painted = paint_setup.apply(&field, prefix);
            let painted_ev =
                evaluator(&target, &env, &boost, &painted, &next, PuyoAttr::Red);
            let partial = painted_ev.evaluate(&[*last]);

            assert_eq!(whole.is_some(), partial.is_some(), "発火判定が食い違う: {:?}", set);
            if let (Some(w), Some(p)) = (&whole, &partial) {
                assert_eq!(w.result.value, p.result.value, "評価値が食い違う: {:?}", set);
                assert_eq!(w.result.popped_chance_num, p.result.popped_chance_num);
                assert_eq!(w.result.popped_heart_num, p.result.popped_heart_num);
                assert_eq!(w.result.popped_prism_num, p.result.popped_prism_num);
                assert_eq!(w.result.popped_ojama_num, p.result.popped_ojama_num);
                assert_eq!(w.result.popped_kata_num, p.result.popped_kata_num);
                assert_eq!(w.result.is_all_cleared, p.result.is_all_cleared);
            }
            compared += 1;
        }
        assert!(compared >= 8, "比較した塗り集合が少なすぎる: {}", compared);
    }

    /// 単セル枝刈りを通した候補は使わないこと。1マスで発火するマスこそ欲しい。
    #[test]
    fn candidates_keep_single_cell_igniters() {
        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let paint_setup = PaintSetup::new(&field, &next, PuyoAttr::Red, 4, 4, PaintFilter::All);
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 4, PaintFilter::All);

        assert_eq!(setup.candidates.len(), paint_setup.filtered_candidates.len());
        assert!(
            setup.candidates.len() > paint_setup.candidates.len(),
            "この盤面には1マスで発火するマスが無く、枝刈りの差が出ない"
        );

        let target = damage_target(PuyoAttr::Red);
        let boost = HashSet::new();
        let ev = evaluator(&target, &env, &boost, &field, &next, PuyoAttr::Red);
        let pruned: HashSet<usize> = paint_setup.candidates.iter().copied().collect();
        for &index in &setup.candidates {
            if pruned.contains(&index) {
                continue;
            }
            assert!(
                ev.evaluate(&[index]).is_some(),
                "枝刈りで落ちたマス {} は1マスで発火するはず",
                index
            );
        }
    }

    /// `evaluate` が塗り集合の並び順を正規化すること。
    /// ビーム探索は「既存の集合に1マス足す」ので、足すマスが既存より小さい順序で渡ってくる。
    #[test]
    fn evaluate_normalizes_paint_set_order() {
        let field = plain_field();
        let next = next_puyos();
        let target = damage_target(PuyoAttr::Red);
        let env = environment();
        let boost = HashSet::new();
        let ev = evaluator(&target, &env, &boost, &field, &next, PuyoAttr::Red);
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 3, PaintFilter::All);

        let mut compared = 0usize;
        for i in 0..setup.candidates.len() {
            for j in (i + 1)..setup.candidates.len() {
                let (a, b) = (setup.candidates[i], setup.candidates[j]);
                let Some(asc) = ev.evaluate(&[a, b]) else {
                    continue;
                };
                let desc = ev.evaluate(&[b, a]).expect("同じ集合なので発火も同じはず");
                assert_eq!(asc.paint_set, desc.paint_set, "並び順が正規化されていない");
                assert!(asc.paint_set.windows(2).all(|w| w[0] < w[1]), "昇順でない");
                assert_eq!(asc.mask, desc.mask);
                assert_eq!(asc.result.trace_coords, desc.result.trace_coords);
                compared += 1;
            }
        }
        assert!(compared > 0, "発火する2マスの塗りが1件も無い盤面ではテストにならない");
    }

    /// 不確定ぷよを考慮した評価 ([`IgnitionEvaluator::evaluate_expected`])。
    ///
    /// なぞりが無いので期待値は1通りに定まる (既存の塗り探索のような
    /// `E_s[max_t]` / `max_t[E_s]` の区別が無い)。
    #[test]
    fn expected_value_averages_the_samples() {
        use crate::simulator_bb::{UnknownFill, UnknownFillPolicy};

        let field = plain_field();
        // ネクストを埋める。空きが無いと補充は起きない。
        let next: NextPuyos = [0u8; 8].map(|_| {
            Some(Puyo {
                id: 200,
                puyo_type: PuyoType::Blue,
            })
        });
        let target = damage_target(PuyoAttr::Red);
        let env = environment();
        let boost = HashSet::new();
        let ev = evaluator(&target, &env, &boost, &field, &next, PuyoAttr::Red);
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 4, PaintFilter::All);

        let fills: Vec<UnknownFill> = (0..8u64)
            .map(|s| UnknownFill {
                policy: UnknownFillPolicy::ChainAverse,
                seed: (s + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15),
                max_refills: 2,
            })
            .collect();

        // 発火しない集合は None。
        assert!(ev.evaluate_expected(&[], &fills).is_none());

        let mut checked = 0usize;
        for i in 0..setup.candidates.len() {
            for j in (i + 1)..setup.candidates.len() {
                let set = [setup.candidates[i], setup.candidates[j]];
                let deterministic = ev.evaluate(&set);
                let with_fills = ev.evaluate_expected(&set, &fills);
                // 発火判定は補充の有無で変わらない (決定論フェーズで決まるため)。
                assert_eq!(deterministic.is_some(), with_fills.is_some());
                let (Some(d), Some((s, expected))) = (deterministic, with_fills) else {
                    continue;
                };
                // 決定論の部分は完全に一致すること。
                assert_eq!(s.result.value, d.result.value, "決定論評価がずれている");
                assert_eq!(s.mask, d.mask);
                assert!(expected.is_finite(), "期待値が数値でない");
                checked += 1;
            }
        }
        assert!(checked > 20, "検査した塗り集合が少なすぎる: {}", checked);

        // サンプルが空なら期待値は決定論値そのもの。
        let set = [setup.candidates[0], setup.candidates[1]];
        if let Some((s, expected)) = ev.evaluate_expected(&set, &[]) {
            assert_eq!(expected, s.result.value);
        }
    }

    /// 比較が全順序で、かつ同値なら塗り数の少ない方・マスクの小さい方に決まること。
    #[test]
    fn better_ignition_is_deterministic_total_order() {
        let field = plain_field();
        let next = next_puyos();
        let target = damage_target(PuyoAttr::Red);
        let env = environment();
        let boost = HashSet::new();
        let ev = evaluator(&target, &env, &boost, &field, &next, PuyoAttr::Red);
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 3, PaintFilter::All);
        let prefs = DEFAULT_IGNITION_PREFERENCES.to_vec();

        let mut solutions: Vec<IgnitionSolution> = Vec::new();
        for i in 0..setup.candidates.len() {
            for j in (i + 1)..setup.candidates.len() {
                if let Some(s) = ev.evaluate(&[setup.candidates[i], setup.candidates[j]]) {
                    solutions.push(s);
                }
                if solutions.len() >= 40 {
                    break;
                }
            }
            if solutions.len() >= 40 {
                break;
            }
        }
        assert!(solutions.len() >= 2, "比較する解が足りない");

        // 内容が同じ別インスタンス同士でも、順序が一意に決まること
        // (自分自身と比べても実装によらず自分が返るので、それでは検査にならない)。
        for a in &solutions {
            let twin = a.clone();
            assert!(
                std::ptr::eq(better_ignition(&prefs, a, &twin), a),
                "同内容の2件で第1引数が返らない"
            );
            assert!(
                std::ptr::eq(better_ignition(&prefs, &twin, a), &twin),
                "同内容の2件で第1引数が返らない"
            );
        }

        // 反対称性 (引数を入れ替えても同じ解が勝つ)。
        for a in &solutions {
            for b in &solutions {
                let ab = better_ignition(&prefs, a, b);
                let ba = better_ignition(&prefs, b, a);
                assert_eq!(
                    std::ptr::eq(ab, a),
                    std::ptr::eq(ba, a),
                    "比較が引数の順番で変わる"
                );
            }
        }

        // 推移律。a ≽ b かつ b ≽ c なら a ≽ c。
        let wins = |x: &IgnitionSolution, y: &IgnitionSolution| {
            std::ptr::eq(better_ignition(&prefs, x, y), x)
        };
        for a in &solutions {
            for b in &solutions {
                if !wins(a, b) {
                    continue;
                }
                for c in &solutions {
                    if wins(b, c) {
                        assert!(wins(a, c), "推移律が崩れている");
                    }
                }
            }
        }

        // 畳み込みの順序に依らず同じ勝者になる。
        let forward = solutions
            .iter()
            .fold(None::<&IgnitionSolution>, |best, s| match best {
                None => Some(s),
                Some(b) => Some(better_ignition(&prefs, b, s)),
            })
            .unwrap();
        let backward = solutions
            .iter()
            .rev()
            .fold(None::<&IgnitionSolution>, |best, s| match best {
                None => Some(s),
                Some(b) => Some(better_ignition(&prefs, b, s)),
            })
            .unwrap();
        assert_eq!(forward.mask, backward.mask);
    }

    /// 同じ評価値なら塗り数が少ない方が勝つ (§8-2 の比較キー `(評価値, -塗り数)`)。
    #[test]
    fn fewer_painted_cells_win_on_equal_value() {
        let field = plain_field();
        let next = next_puyos();
        let target = damage_target(PuyoAttr::Red);
        let env = environment();
        let boost = HashSet::new();
        let ev = evaluator(&target, &env, &boost, &field, &next, PuyoAttr::Red);
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 10, PaintFilter::All);
        let prefs = DEFAULT_IGNITION_PREFERENCES.to_vec();

        // 発火する最小の塗り集合を1つ見つけ、そこに連鎖へ絡まない「埋め草」を足す。
        let mut base: Option<IgnitionSolution> = None;
        'outer: for i in 0..setup.candidates.len() {
            for j in (i + 1)..setup.candidates.len() {
                if let Some(s) = ev.evaluate(&[setup.candidates[i], setup.candidates[j]]) {
                    base = Some(s);
                    break 'outer;
                }
            }
        }
        let base = base.expect("発火する2マスの塗りが見つからない");

        // 同じ評価結果になる上位集合 (埋め草つき) を探す。
        for &filler in &setup.candidates {
            if base.paint_set.contains(&filler) {
                continue;
            }
            let mut padded_set = base.paint_set.clone();
            padded_set.push(filler);
            padded_set.sort_unstable();
            let Some(padded) = ev.evaluate(&padded_set) else {
                continue;
            };
            if padded.result.value != base.result.value {
                continue;
            }
            for (x, y) in [(&padded, &base), (&base, &padded)] {
                let winner = better_ignition(&prefs, x, y);
                assert_eq!(
                    winner.paint_set.len(),
                    base.paint_set.len(),
                    "同値なら塗り数の少ない方が勝つはず"
                );
            }
            return;
        }
        panic!("評価値が変わらない埋め草が1つも見つからない");
    }
}
