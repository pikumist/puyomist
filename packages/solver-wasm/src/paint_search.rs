//! 前段「ぷよ塗り」のビームサーチ。
//!
//! 設計と実測の根拠は `docs/paint-search.md` を参照。要点だけ:
//!
//! - 候補マスは絞らない ([`PaintFilter::All`])。絞り込みは全数列挙が前提だった頃の名残で、
//!   ビームサーチではコストが候補総数ではなく候補マス数にしか依存しないため不要になった
//! - 空集合から1マスずつ増やし、代理評価 (なぞり数を落とした全探索) の上位K件だけ残す
//! - 全深さのビーム内容から代理上位を本番評価し、良い順に塗り案を返す
//!
//! 評価回数が**候補総数に依存しない**のが肝で、有効な塗り集合が9,600万件ある盤面でも
//! 数秒で終わる (全数列挙だと代理評価だけで2.5時間)。
//!
//! ## 並列化はこのモジュールでは行わない
//!
//! 重いのは [`evaluate_paint_sets`] だけで、そこは要素ごとに完全に独立している。
//! ネイティブ (solver-server) は rayon で、wasm は JS の Web Worker で分割する、と
//! 呼び出し側の事情が異なるため、ここでは逐次版だけを提供して分割は呼び出し側に任せる。
//! ビームの管理 ([`expand_beam`] → 評価 → [`select_top`]) は軽いので分割不要。

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};

use crate::exploration_target::ExplorationTarget;
use crate::paint::{bit, build_neighbor_masks, component_size_capped, Bits, PaintFilter, PaintSetup};
use crate::puyo::{Field, NextPuyos};
use crate::puyo_attr::PuyoAttr;
use crate::puyo_coord::PuyoCoord;
use crate::simulation_environment::SimulationEnvironment;
use crate::simulator_bb::{UnknownFill, UnknownFillPolicy};
use crate::solution::SolutionResult;
use crate::solution_explorer::{better_solution, SolutionExplorer};

/// 不確定ぷよ (ネクストより先に降ってくるぷよ) を考慮した期待値評価の設定。
///
/// 実測では**期待値での最終並べ替えは最大 +3.8%** 効くが、**期待値でビームサーチしても
/// +0.5% 以下**でコストは10倍。よって探索は決定論のまま、最終選抜だけこれを使う。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UncertaintyParams {
    pub policy: UnknownFillPolicy,
    /// サンプル数。全候補に同じサンプル列を当てる (共通乱数法) ので、順位の推定精度は
    /// サンプル数の割に良い。
    pub samples: u32,
    /// 補充を許す回数の上限。
    pub max_refills: u32,
}

impl Default for UncertaintyParams {
    fn default() -> Self {
        UncertaintyParams {
            policy: UnknownFillPolicy::ChainAverse,
            samples: 20,
            max_refills: 2,
        }
    }
}

/// 探索精度。ビーム幅と本番評価に回す件数をまとめて決める。
///
/// **バックエンドをまたいで同じマッピングにすること**。同じ精度を選べば wasm でもネイティブでも
/// 完全に同じ結果が出る (評価は決定論的で、ハードウェア PEXT の有無は速度にしか効かない)。
/// バックエンドによって結果が変わると、利用者はバグと受け取る。
///
/// 所要時間は 14 コアでの実測 (中央値)。wasm は PEXT 命令が無くソフトウェア展開になるため
/// 4.3〜4.5 倍遅い (`docs/solver-optimization.md`)。
///
/// | 精度 | 幅 | ネイティブ | wasm | 最悪ケース比 |
/// |---|---|---|---|---|
/// | `Standard` | 300 | 約4秒 | 約19秒 | 0.897 |
/// | `High` | 1000 | 約12秒 | 約53秒 | 0.974 |
/// | `Ultra` | 2000 | 約25秒 | 約107秒 (wasm では選ばせない) | 1.000 |
///
/// 最悪ケース比は `Ultra` の結果を1としたときの比。`Ultra` でもまだ収束していない
/// (幅1000→2000 で改善する組があった) ので、これは上限ではなく実測できた範囲での基準値。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize_repr, Deserialize_repr)]
#[repr(u8)]
pub enum PaintPrecision {
    /// 標準。既定。
    Standard = 0,
    /// 高精度。
    High = 1,
    /// 超高精度。wasm では所要時間が現実的でないため選択肢に出さないこと。
    Ultra = 2,
}

impl PaintPrecision {
    /// ビーム幅。
    pub fn beam_width(self) -> u32 {
        match self {
            PaintPrecision::Standard => 300,
            PaintPrecision::High => 1000,
            PaintPrecision::Ultra => 2000,
        }
    }

    /// 本番評価に回す件数。**ビーム幅の3倍**。
    /// 幅だけ広げて据え置くと、代理の並びで真の最良が押し出されて逆に悪化する。
    pub fn verify_num(self) -> u32 {
        self.beam_width() * 3
    }
}

/// 塗り探索のパラメータ。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaintSearchParams {
    /// 塗り色。
    pub target: PuyoAttr,
    /// 塗れるマス数の上限。実運用では 8 か 10。
    pub max_paint_num: u32,
    /// 候補マスの絞り込み方。**既定の [`PaintFilter::All`] から変えないこと**。
    /// `Adj2` は実測で最大 22.9% 取りこぼす一方、`All` にしてもコストは 1.4 倍にしかならない。
    pub filter: PaintFilter,
    /// 探索精度。ビーム幅と検証件数はここから導出する
    /// (個別に持たせるとバックエンド間で食い違う余地が生まれるため)。
    pub precision: PaintPrecision,
    /// 代理評価に使うなぞり数。実測上は 4 が下限 (3 だと品質が頭打ちになる)。
    pub surrogate_trace_num: u32,
    /// 返す塗り案の件数。
    pub result_num: u32,
    /// 期待値による並べ替え。`None` なら決定論評価のみ。
    pub uncertainty: Option<UncertaintyParams>,
}

impl PaintSearchParams {
    /// 実測に基づく既定値 (絞り込みなし / 標準精度)。
    pub fn new(target: PuyoAttr, max_paint_num: u32) -> PaintSearchParams {
        PaintSearchParams {
            target,
            max_paint_num,
            filter: PaintFilter::All,
            precision: PaintPrecision::Standard,
            surrogate_trace_num: 4,
            result_num: 20,
            uncertainty: None,
        }
    }

    pub fn beam_width(&self) -> usize {
        self.precision.beam_width() as usize
    }

    pub fn verify_num(&self) -> usize {
        self.precision.verify_num() as usize
    }
}

/// 塗り案1件の評価結果。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaintEvaluation {
    /// 決定論評価の値。大きいほど良い。
    pub value: f64,
    /// 期待値 (不確定ぷよを考慮)。[`UncertaintyParams`] を渡したときだけ入る。
    pub expected_value: Option<f64>,
    /// 後段のなぞり消しの最適解。最終評価のときだけ入る。
    pub solution: Option<SolutionResult>,
}

/// 塗り案1件。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaintPlan {
    /// 塗るマス。
    pub coords: Vec<PuyoCoord>,
    /// 決定論評価の値。
    pub value: f64,
    /// 期待値。[`UncertaintyParams`] を渡したときだけ入る。
    pub expected_value: Option<f64>,
    /// この塗りを適用した盤面での、後段のなぞり消しの最適解。
    pub solution: SolutionResult,
}

/// 塗り探索の途中状態を保持する。
///
/// 候補マスの算出とハード制約の判定に必要な情報をまとめてあり、
/// wasm 側は深さごとにこれを作り直して [`expand_beam`] を呼ぶ。
pub struct PaintBeamContext {
    setup: PaintSetup,
    masks: [Bits; crate::paint::CELL_NUM],
}

impl PaintBeamContext {
    pub fn new(
        field: &Field,
        next_puyos: &NextPuyos,
        params: &PaintSearchParams,
        minimum_puyo_num_for_popping: u32,
    ) -> PaintBeamContext {
        let setup = PaintSetup::new(
            field,
            next_puyos,
            params.target,
            params.max_paint_num as usize,
            minimum_puyo_num_for_popping,
            params.filter,
        );
        PaintBeamContext {
            setup,
            masks: build_neighbor_masks(),
        }
    }

    /// 絞り込み後の候補マス数。ビーム1段あたりの分岐数の上限にあたる。
    pub fn candidate_num(&self) -> usize {
        self.setup.candidates.len()
    }

    /// 塗り集合を盤面に適用した新しい盤面を返す。
    pub fn apply(&self, field: &Field, paint_set: &[usize]) -> Field {
        self.setup.apply(field, paint_set)
    }

    /// 塗り集合の各マスを、塗り替え後の盤面の座標に変換する。
    pub fn to_coords(paint_set: &[usize]) -> Vec<PuyoCoord> {
        paint_set
            .iter()
            .filter_map(|&index| PuyoCoord::index_to_coord(index as u8))
            .collect()
    }
}

/// ビームを1段展開する。各集合に候補マスを1つ足し、ハード制約違反と重複を落とす。
///
/// 空のビーム (= 空集合1件) を渡すと深さ1の全候補が返る。
/// 展開先が尽きたら空を返すので、呼び出し側はそこで打ち切ること。
pub fn expand_beam(context: &PaintBeamContext, beam: &[Vec<usize>]) -> Vec<Vec<usize>> {
    let setup = &context.setup;
    let mut expanded: Vec<Vec<usize>> = Vec::new();
    let mut keys: HashSet<Bits> = HashSet::new();

    for cells in beam {
        if cells.len() >= setup.max_paint_num {
            continue;
        }
        // 現在の塗り色ビットボードと、塗ったマスのビットマスク。
        let mut board = setup.base_board;
        let mut key: Bits = 0;
        for &index in cells {
            board |= bit(index);
            key |= bit(index);
        }

        for &index in &setup.candidates {
            if key & bit(index) != 0 {
                continue;
            }
            let next_board = board | bit(index);
            if component_size_capped(next_board, index, &context.masks, setup.max_component)
                > setup.max_component
            {
                // 単調性より、このマスを含む上位集合はすべて制約違反。
                continue;
            }
            if !keys.insert(key | bit(index)) {
                continue;
            }
            let mut next_cells = cells.clone();
            next_cells.push(index);
            expanded.push(next_cells);
        }
    }

    expanded
}

/// 評価に必要な条件一式。
pub struct PaintEvalContext<'a> {
    pub exploration_target: &'a ExplorationTarget,
    pub environment: &'a SimulationEnvironment,
    pub boost_area: &'a HashSet<PuyoCoord>,
    pub field: &'a Field,
    pub next_puyos: &'a NextPuyos,
}

impl<'a> PaintEvalContext<'a> {
    fn solve(
        &self,
        painted_field: &Field,
        max_trace_num: u32,
        unknown_fill: Option<&UnknownFill>,
    ) -> Option<SolutionResult> {
        let environment = SimulationEnvironment {
            max_trace_num,
            ..*self.environment
        };
        let explorer = SolutionExplorer::new(
            self.exploration_target,
            &environment,
            self.boost_area,
            painted_field,
            self.next_puyos,
        );
        let explorer = match unknown_fill {
            Some(fill) => explorer.with_unknown_fill(fill),
            None => explorer,
        };
        explorer
            .solve_all_traces()
            .optimal_solutions
            .into_iter()
            .next()
    }
}

/// 共通乱数法のためのサンプル列を作る。**全候補に同じ列を当てること**。
///
/// 1案あたりの標準偏差は ±15〜21 ある一方、隣接候補の期待値の差は 1〜3 しかない。
/// 候補ごとに違う乱数を引くと順位が雑音に埋もれるが、同じ補充パターンを当てれば
/// 運の要素が差を取ったときに打ち消し合う。
pub fn make_unknown_fills(params: &UncertaintyParams) -> Vec<UnknownFill> {
    (0..params.samples as u64)
        .map(|s| UnknownFill {
            policy: params.policy,
            seed: (s + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15),
            max_refills: params.max_refills,
        })
        .collect()
}

/// 塗り集合を1件評価する。**呼び出し側がこれを並列に回すこと**。
///
/// - `max_trace_num`: 代理評価なら小さい値、本番評価なら環境のなぞり数
/// - `with_solution`: 後段の最適解も返すか (最終評価のときだけ true)
/// - `unknown_fills`: 空でなければ期待値 (サンプル平均) も求める
pub fn evaluate_paint_set(
    eval: &PaintEvalContext,
    context: &PaintBeamContext,
    paint_set: &[usize],
    max_trace_num: u32,
    with_solution: bool,
    unknown_fills: &[UnknownFill],
) -> PaintEvaluation {
    let painted = context.apply(eval.field, paint_set);
    let solution = eval.solve(&painted, max_trace_num, None);
    let value = solution.as_ref().map(|s| s.value).unwrap_or(0.0);

    let expected_value = if unknown_fills.is_empty() {
        None
    } else {
        let total: f64 = unknown_fills
            .iter()
            .map(|fill| {
                eval.solve(&painted, max_trace_num, Some(fill))
                    .map(|s| s.value)
                    .unwrap_or(0.0)
            })
            .sum();
        Some(total / unknown_fills.len() as f64)
    };

    PaintEvaluation {
        value,
        expected_value,
        solution: if with_solution { solution } else { None },
    }
}

/// [`evaluate_paint_set`] の逐次版バッチ。並列化したい呼び出し側は使わずに自前で回すこと。
pub fn evaluate_paint_sets(
    eval: &PaintEvalContext,
    context: &PaintBeamContext,
    paint_sets: &[Vec<usize>],
    max_trace_num: u32,
    with_solution: bool,
    unknown_fills: &[UnknownFill],
) -> Vec<PaintEvaluation> {
    paint_sets
        .iter()
        .map(|cells| {
            evaluate_paint_set(
                eval,
                context,
                cells,
                max_trace_num,
                with_solution,
                unknown_fills,
            )
        })
        .collect()
}

/// スコアの大きい順に上位 `count` 件の添字を返す。
pub fn select_top(scores: &[f64], count: usize) -> Vec<usize> {
    let mut order: Vec<usize> = (0..scores.len()).collect();
    order.sort_by(|&i, &j| scores[j].partial_cmp(&scores[i]).unwrap_or(std::cmp::Ordering::Equal));
    order.truncate(count);
    order
}

/// 評価済みの塗り案を、好みの優先度に従って良い順に並べて [`PaintPlan`] にする。
///
/// 期待値があるときは期待値を第一キーにする (実測で最大 +3.8%)。
/// 期待値が無いときは既存の探索と同じ `better_solution` の全順序で比べる。
pub fn build_plans(
    exploration_target: &ExplorationTarget,
    paint_sets: &[Vec<usize>],
    evaluations: &[PaintEvaluation],
    result_num: usize,
) -> Vec<PaintPlan> {
    let mut indexes: Vec<usize> = (0..paint_sets.len())
        .filter(|&i| evaluations[i].solution.is_some())
        .collect();

    let priorities = &exploration_target.preference_priorities;
    indexes.sort_by(|&i, &j| {
        let (a, b) = (&evaluations[i], &evaluations[j]);

        // 期待値があるときはそれを第一キーにする (実測で最大 +3.8%)。
        // NaN は順序を壊すので比較に使わない。
        if let (Some(x), Some(y)) = (a.expected_value, b.expected_value) {
            if x.is_finite() && y.is_finite() && x != y {
                return y.partial_cmp(&x).unwrap();
            }
        }

        // `better_solution` は完全同点のとき第1引数を返すので、そのまま使うと
        // cmp(a,b) と cmp(b,a) が両方 Less になり反対称性が壊れる (sort_by が panic し得る)。
        // 両方向を呼んで、どちらも自分側を返したら同点と判定する。
        let (sa, sb) = (a.solution.as_ref().unwrap(), b.solution.as_ref().unwrap());
        let a_wins = std::ptr::eq(better_solution(priorities, sa, sb), sa);
        let b_wins = std::ptr::eq(better_solution(priorities, sb, sa), sb);
        match (a_wins, b_wins) {
            (true, true) => std::cmp::Ordering::Equal,
            (true, false) => std::cmp::Ordering::Less,
            _ => std::cmp::Ordering::Greater,
        }
    });
    indexes.truncate(result_num);

    indexes
        .into_iter()
        .map(|i| PaintPlan {
            coords: PaintBeamContext::to_coords(&paint_sets[i]),
            value: evaluations[i].value,
            expected_value: evaluations[i].expected_value,
            solution: evaluations[i].solution.clone().unwrap(),
        })
        .collect()
}

/// 塗り探索を最後まで通す逐次版。
///
/// ネイティブ (solver-server) は rayon で、wasm は JS の Web Worker で
/// [`evaluate_paint_set`] を分割するため、この関数はテストと参照実装のためにある。
pub fn search_paint_plans(
    eval: &PaintEvalContext,
    params: &PaintSearchParams,
) -> Vec<PaintPlan> {
    search_paint_plans_with(eval, params, params.beam_width(), params.verify_num())
}

/// ビーム幅と検証件数を直接指定する版。
///
/// **本番の呼び出し側は使わないこと**。[`PaintPrecision`] を経由しないと
/// バックエンド間で幅が食い違い、同じ入力でも違う結果が出る。
/// 計測ハーネスとテスト (既定の幅300では遅すぎる) のためだけにある。
pub fn search_paint_plans_with(
    eval: &PaintEvalContext,
    params: &PaintSearchParams,
    beam_width: usize,
    verify_num: usize,
) -> Vec<PaintPlan> {
    let context = PaintBeamContext::new(
        eval.field,
        eval.next_puyos,
        params,
        eval.environment.minimum_puyo_num_for_popping,
    );

    // 添字0は「塗らない」(空集合)。代理評価は掛けず、最後に無条件で検証対象に加える。
    let mut all: Vec<Vec<usize>> = vec![Vec::new()];
    let mut all_scores: Vec<f64> = vec![f64::NEG_INFINITY];
    let mut beam: Vec<Vec<usize>> = vec![Vec::new()];

    for _ in 0..params.max_paint_num {
        let expanded = expand_beam(&context, &beam);
        if expanded.is_empty() {
            break;
        }
        let evaluations = evaluate_paint_sets(
            eval,
            &context,
            &expanded,
            params.surrogate_trace_num,
            false,
            &[],
        );
        let scores: Vec<f64> = evaluations.iter().map(|e| e.value).collect();
        let top = select_top(&scores, beam_width);

        beam = top.iter().map(|&i| expanded[i].clone()).collect();
        for &i in &top {
            all.push(expanded[i].clone());
            all_scores.push(scores[i]);
        }
    }

    // 代理の上位を本番評価する。
    // 「塗らない」(添字0の空集合) は代理スコアを持たないので上位選抜には残らない。
    // 塗りがすべて損な盤面ではこれが答えになるため、無条件で検証対象に加える。
    let mut verify = select_top(&all_scores, verify_num);
    if !verify.contains(&0) {
        verify.insert(0, 0);
    }
    let verify_sets: Vec<Vec<usize>> = verify.iter().map(|&i| all[i].clone()).collect();
    let unknown_fills = params
        .uncertainty
        .as_ref()
        .map(make_unknown_fills)
        .unwrap_or_default();
    let evaluations = evaluate_paint_sets(
        eval,
        &context,
        &verify_sets,
        eval.environment.max_trace_num,
        true,
        &unknown_fills,
    );

    build_plans(
        eval.exploration_target,
        &verify_sets,
        &evaluations,
        params.result_num as usize,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::exploration_target::{ExplorationCategory, PreferenceKind};
    use crate::puyo::Puyo;
    use crate::puyo_type::PuyoType;
    use crate::trace_mode::TraceMode;

    /// 連鎖の仕込まれていない通常盤面。塗りの価値が出る条件で試す。
    fn plain_field() -> Field {
        let (r, b, g, y, p) = (
            PuyoType::Red,
            PuyoType::Blue,
            PuyoType::Green,
            PuyoType::Yellow,
            PuyoType::Purple,
        );
        let mut id = 0i32;
        [
            [r, b, g, y, p, r, b, g],
            [b, g, y, p, r, b, g, y],
            [g, y, p, r, b, g, y, p],
            [y, p, r, b, g, y, p, r],
            [p, r, b, g, y, p, r, b],
            [r, b, g, y, p, r, b, g],
        ]
        .map(|row| {
            row.map(|puyo_type| {
                id += 1;
                Some(Puyo { id, puyo_type })
            })
        })
    }

    fn next_puyos() -> NextPuyos {
        let mut id = 100i32;
        [PuyoType::Red; 8].map(|puyo_type| {
            id += 1;
            Some(Puyo { id, puyo_type })
        })
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

    fn exploration_target() -> ExplorationTarget {
        ExplorationTarget {
            category: ExplorationCategory::PuyotsukaiCount,
            preference_priorities: Vec::from([
                PreferenceKind::ChancePop,
                PreferenceKind::BiggerValue,
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::SmallerTraceNum,
            ]),
            optimal_solution_count: 1,
            main_attr: None,
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        }
    }

    /// 塗り探索が「塗らない」より良い塗り案を返すこと。
    #[test]
    fn search_finds_plans_better_than_no_paint() {
        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let target = exploration_target();
        let boost_area: HashSet<PuyoCoord> = HashSet::new();

        let eval = PaintEvalContext {
            exploration_target: &target,
            environment: &env,
            boost_area: &boost_area,
            field: &field,
            next_puyos: &next,
        };

        // 塗らない場合の値。
        let mut params = PaintSearchParams::new(PuyoAttr::Red, 6);
        params.result_num = 5;
        let context = PaintBeamContext::new(&field, &next, &params, 4);
        let no_paint = evaluate_paint_set(&eval, &context, &[], env.max_trace_num, true, &[]);

        let plans = search_paint_plans_with(&eval, &params, 20, 60);

        assert!(!plans.is_empty(), "塗り案が1件も返らなかった");
        assert!(plans.len() <= params.result_num as usize);
        assert!(
            plans[0].value > no_paint.value,
            "塗り案の最良 {} が塗らない場合 {} を上回らなかった",
            plans[0].value,
            no_paint.value
        );
        // 良い順に並んでいること。
        for w in plans.windows(2) {
            assert!(w[0].value >= w[1].value, "塗り案が良い順に並んでいない");
        }
    }

    /// 返る塗り案がハード制約 (塗り後に1つも消えない) を満たすこと。
    #[test]
    fn returned_plans_satisfy_hard_constraint() {
        use crate::paint::{bit, build_neighbor_masks, component_size_capped, CELL_NUM};
        use crate::puyo_type::get_attr;

        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let target = exploration_target();
        let boost_area: HashSet<PuyoCoord> = HashSet::new();
        let eval = PaintEvalContext {
            exploration_target: &target,
            environment: &env,
            boost_area: &boost_area,
            field: &field,
            next_puyos: &next,
        };

        let mut params = PaintSearchParams::new(PuyoAttr::Blue, 8);
        let plans = search_paint_plans_with(&eval, &params, 20, 60);
        assert!(!plans.is_empty());

        let masks = build_neighbor_masks();
        for plan in &plans {
            assert!(plan.coords.len() <= params.max_paint_num as usize);

            // 塗り適用後の盤面で、塗り色の連結成分がすべて3個以下であること。
            let context = PaintBeamContext::new(&field, &next, &params, 4);
            let cells: Vec<usize> = plan.coords.iter().map(|c| c.index() as usize).collect();
            let painted = context.apply(&field, &cells);

            let mut board = 0u64;
            for index in 0..CELL_NUM {
                if let Some(puyo) = painted[index / 8][index % 8] {
                    if get_attr(puyo.puyo_type) == PuyoAttr::Blue {
                        board |= bit(index);
                    }
                }
            }
            let mut remaining = board;
            while remaining != 0 {
                let seed = remaining.trailing_zeros() as usize;
                assert!(
                    component_size_capped(board, seed, &masks, 3) <= 3,
                    "塗り後に消えてしまう塗り案が返った: {:?}",
                    plan.coords
                );
                let mut component = bit(seed);
                loop {
                    let mut grown = component;
                    let mut c = component;
                    while c != 0 {
                        let i = c.trailing_zeros() as usize;
                        c &= c - 1;
                        grown |= masks[i] & board;
                    }
                    if grown == component {
                        break;
                    }
                    component = grown;
                }
                remaining &= !component;
            }
        }
    }

    /// 期待値を指定したときだけ `expected_value` が入り、並び順の基準になること。
    #[test]
    fn uncertainty_fills_expected_value_and_drives_order() {
        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let target = exploration_target();
        let boost_area: HashSet<PuyoCoord> = HashSet::new();
        let eval = PaintEvalContext {
            exploration_target: &target,
            environment: &env,
            boost_area: &boost_area,
            field: &field,
            next_puyos: &next,
        };

        let mut params = PaintSearchParams::new(PuyoAttr::Red, 5);
        params.result_num = 5;

        let without = search_paint_plans_with(&eval, &params, 10, 30);
        assert!(without.iter().all(|p| p.expected_value.is_none()));

        params.uncertainty = Some(UncertaintyParams {
            policy: UnknownFillPolicy::ChainAverse,
            samples: 4,
            max_refills: 1,
        });
        let with = search_paint_plans_with(&eval, &params, 10, 30);
        assert!(with.iter().all(|p| p.expected_value.is_some()));
        // 期待値の降順に並んでいること。
        for w in with.windows(2) {
            assert!(w[0].expected_value.unwrap() >= w[1].expected_value.unwrap());
        }
        // 補充を入れると値は伸びる (連鎖が伸びる分)。
        assert!(with[0].expected_value.unwrap() >= with[0].value);
    }

    /// 共通乱数法: 同じパラメータなら毎回同じサンプル列になること (再現性)。
    #[test]
    fn unknown_fills_are_deterministic() {
        let params = UncertaintyParams {
            policy: UnknownFillPolicy::ChainAverse,
            samples: 5,
            max_refills: 2,
        };
        let a = make_unknown_fills(&params);
        let b = make_unknown_fills(&params);
        assert_eq!(a.len(), 5);
        for (x, y) in a.iter().zip(b.iter()) {
            assert_eq!(x.seed, y.seed);
        }
        // サンプルどうしは違う乱数種であること。
        assert_ne!(a[0].seed, a[1].seed);
    }

    /// 塗り上限0のとき「塗らない」案が返ること。
    /// 代理スコアを持たない空集合が選抜から漏れないことの担保。
    #[test]
    fn no_paint_plan_is_always_verified() {
        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let target = exploration_target();
        let boost_area: HashSet<PuyoCoord> = HashSet::new();
        let eval = PaintEvalContext {
            exploration_target: &target,
            environment: &env,
            boost_area: &boost_area,
            field: &field,
            next_puyos: &next,
        };

        // 塗り上限0なので展開が起きず即終わる。精度経由の本来の入口を通しておく。
        let params = PaintSearchParams::new(PuyoAttr::Red, 0);
        let plans = search_paint_plans(&eval, &params);

        assert_eq!(plans.len(), 1, "「塗らない」案が返らなかった");
        assert!(plans[0].coords.is_empty());
        assert!(plans[0].value > 0.0);
    }

    /// `build_plans` の比較関数が全順序であること。
    ///
    /// `better_solution` は完全同点のとき第1引数を返すため、素朴に使うと
    /// cmp(a,b) と cmp(b,a) が両方 Less になり、`sort_by` が
    /// "comparison function does not correctly implement a total order" で panic し得る。
    /// 値が実質整数 (ぷよ使いカウント等) なので同点は普通に発生する。
    #[test]
    fn build_plans_comparator_is_a_total_order() {
        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let target = exploration_target();
        let boost_area: HashSet<PuyoCoord> = HashSet::new();
        let eval = PaintEvalContext {
            exploration_target: &target,
            environment: &env,
            boost_area: &boost_area,
            field: &field,
            next_puyos: &next,
        };
        let params = PaintSearchParams::new(PuyoAttr::Red, 2);
        let context = PaintBeamContext::new(&field, &next, &params, 4);

        // 同一の塗り集合を大量に評価し、完全同点だけからなる集合を作る。
        let one = evaluate_paint_set(&eval, &context, &[], env.max_trace_num, true, &[]);
        let paint_sets: Vec<Vec<usize>> = (0..64).map(|_| Vec::new()).collect();
        let evaluations: Vec<PaintEvaluation> = (0..64)
            .map(|_| PaintEvaluation {
                value: one.value,
                expected_value: None,
                solution: one.solution.clone(),
            })
            .collect();

        // 比較関数が壊れていれば、ここで panic する可能性がある。
        let plans = build_plans(&target, &paint_sets, &evaluations, 10);
        assert_eq!(plans.len(), 10);

        // 期待値付きで同点の場合も同様に確かめる。
        let evaluations: Vec<PaintEvaluation> = (0..64)
            .map(|_| PaintEvaluation {
                value: one.value,
                expected_value: Some(123.0),
                solution: one.solution.clone(),
            })
            .collect();
        let plans = build_plans(&target, &paint_sets, &evaluations, 10);
        assert_eq!(plans.len(), 10);
    }

    /// 精度のマッピングが固定であること。
    ///
    /// バックエンドをまたいで同じ結果を出すための前提なので、変えるときは
    /// wasm 側・Rust バックエンド側・UI の選択肢をすべて揃えて変えること。
    #[test]
    fn precision_mapping_is_fixed() {
        assert_eq!(PaintPrecision::Standard.beam_width(), 300);
        assert_eq!(PaintPrecision::High.beam_width(), 1000);
        assert_eq!(PaintPrecision::Ultra.beam_width(), 2000);
        for p in [
            PaintPrecision::Standard,
            PaintPrecision::High,
            PaintPrecision::Ultra,
        ] {
            assert_eq!(p.verify_num(), p.beam_width() * 3, "検証件数は幅の3倍");
        }
        // 既定は標準。wasm でもネイティブでも同じ既定にする。
        assert_eq!(
            PaintSearchParams::new(PuyoAttr::Red, 8).precision,
            PaintPrecision::Standard
        );
    }

    /// 同じ入力・同じ精度なら何度呼んでも完全に同じ結果になること。
    ///
    /// wasm はワーカーに評価を分割するため、**結果を元の順序で組み直さないと**
    /// 同点の並びが変わってネイティブと食い違う。その前提が成り立つことの担保。
    #[test]
    fn search_is_deterministic() {
        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let target = exploration_target();
        let boost_area: HashSet<PuyoCoord> = HashSet::new();
        let eval = PaintEvalContext {
            exploration_target: &target,
            environment: &env,
            boost_area: &boost_area,
            field: &field,
            next_puyos: &next,
        };
        let mut params = PaintSearchParams::new(PuyoAttr::Red, 4);
        params.result_num = 8;

        let a = search_paint_plans_with(&eval, &params, 20, 60);
        let b = search_paint_plans_with(&eval, &params, 20, 60);

        assert_eq!(a.len(), b.len());
        for (x, y) in a.iter().zip(b.iter()) {
            assert_eq!(x.coords, y.coords, "塗り案が一致しない");
            assert_eq!(x.value, y.value);
        }
    }

    /// ビーム展開が重複を出さず、上限マス数を超えないこと。
    #[test]
    fn expand_beam_is_unique_and_bounded() {
        let field = plain_field();
        let next = next_puyos();
        let mut params = PaintSearchParams::new(PuyoAttr::Green, 3);
        params.filter = PaintFilter::Adj2;
        let context = PaintBeamContext::new(&field, &next, &params, 4);

        let mut beam: Vec<Vec<usize>> = vec![Vec::new()];
        for depth in 1..=4 {
            let expanded = expand_beam(&context, &beam);
            if depth > params.max_paint_num as usize {
                assert!(expanded.is_empty(), "上限を超えて展開された");
                break;
            }
            assert!(!expanded.is_empty());

            let mut seen: HashSet<u64> = HashSet::new();
            for cells in &expanded {
                assert_eq!(cells.len(), depth);
                let key = cells.iter().fold(0u64, |m, &i| m | (1u64 << i));
                assert!(seen.insert(key), "同じ塗り集合が重複して展開された");
            }
            beam = expanded.into_iter().take(10).collect();
        }
    }
}
