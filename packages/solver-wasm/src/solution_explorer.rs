use crate::simulator_bb::UnknownFill;
use crate::{
    chain::Chain,
    chain_helper::calc_boost_ratio,
    exploration_target::{
        CountingBonusType, ExplorationCategory, ExplorationTarget, PreferenceKind,
    },
    puyo::{Field, NextPuyos},
    puyo_attr::PuyoAttr,
    puyo_coord::PuyoCoord,
    puyo_type::is_traceable_type,
    simulation_environment::SimulationEnvironment,
    simulator_bb::{BitBoards, ChainsAggregate, SimulatorBB},
    solution::{ExplorationResult, SolutionResult, SolutionState},
};
use num_traits::ToPrimitive;
use std::{
    cmp,
    collections::{HashMap, HashSet},
    sync::OnceLock,
};

/// PuyoAttr を集約配列のインデックス (Red=1→0 … Kata=9→8) に変換する。
fn attr_index(attr: PuyoAttr) -> usize {
    attr.to_u8().unwrap() as usize - 1
}

fn better_solution_by_bigger_value<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.value > s1.value {
        return Some(s2);
    }
    if s2.value < s1.value {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_chance_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.popped_chance_num > 0 && s1.popped_chance_num == 0 {
        return Some(s2);
    }
    if s2.popped_chance_num == 0 && s1.popped_chance_num > 0 {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_prism_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.popped_prism_num > 0 && s1.popped_prism_num == 0 {
        return Some(s2);
    }
    if s2.popped_prism_num == 0 && s1.popped_prism_num > 0 {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_all_clear<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.is_all_cleared && !s1.is_all_cleared {
        return Some(s2);
    }
    if !s2.is_all_cleared && s1.is_all_cleared {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_smaller_trace_num<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.trace_coords.len() < s1.trace_coords.len() {
        return Some(s2);
    }
    if s2.trace_coords.len() > s1.trace_coords.len() {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_heart_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.popped_heart_num > 0 && s1.popped_heart_num == 0 {
        return Some(s2);
    }
    if s2.popped_heart_num == 0 && s1.popped_heart_num > 0 {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_ojama_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if (s2.popped_ojama_num > 0 || s2.popped_kata_num > 0)
        && (s1.popped_ojama_num == 0 && s1.popped_kata_num == 0)
    {
        return Some(s2);
    }
    if (s2.popped_ojama_num == 0 && s2.popped_kata_num == 0)
        && (s1.popped_ojama_num > 0 || s1.popped_kata_num > 0)
    {
        return Some(s1);
    }
    return None;
}

fn the_other<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
    target: Option<&'a SolutionResult>,
) -> Option<&'a SolutionResult> {
    match target {
        Some(s) => {
            if s == s1 {
                Some(s2)
            } else {
                Some(s1)
            }
        }
        None => None,
    }
}

fn better_solution_by_smaller_value<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_bigger_value(s1, s2));
}

fn better_solution_by_no_chance_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_chance_pop(s1, s2));
}

fn better_solution_by_no_prism_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_prism_pop(s1, s2));
}

fn better_solution_by_no_all_clear<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_all_clear(s1, s2));
}

fn better_solution_by_bigger_trace_num<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_smaller_trace_num(s1, s2));
}

fn better_solution_by_no_heart_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_heart_pop(s1, s2));
}

fn better_solution_by_no_ojama_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_ojama_pop(s1, s2));
}

fn better_solution_by_more_chance_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.popped_chance_num > s1.popped_chance_num {
        return Some(s2);
    }
    if s2.popped_chance_num < s1.popped_chance_num {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_more_prism_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.popped_prism_num > s1.popped_prism_num {
        return Some(s2);
    }
    if s2.popped_prism_num < s1.popped_prism_num {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_more_heart_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.popped_heart_num > s1.popped_heart_num {
        return Some(s2);
    }
    if s2.popped_heart_num < s1.popped_heart_num {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_more_ojama_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    let s2_ojama_num = s2.popped_ojama_num + s2.popped_kata_num;
    let s1_ojama_num = s1.popped_ojama_num + s1.popped_kata_num;

    if s2_ojama_num > s1_ojama_num {
        return Some(s2);
    }
    if s2_ojama_num < s1_ojama_num {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_less_chance_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_more_chance_pop(s1, s2));
}

fn better_solution_by_less_prism_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_more_prism_pop(s1, s2));
}

fn better_solution_by_less_heart_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_more_heart_pop(s1, s2));
}

fn better_solution_by_less_ojama_pop<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    return the_other(s1, s2, better_solution_by_more_ojama_pop(s1, s2));
}

type BetterFn = for<'a> fn(&'a SolutionResult, &'a SolutionResult) -> Option<&'a SolutionResult>;

static BETTER_METHOD_MAP: OnceLock<HashMap<PreferenceKind, BetterFn>> = OnceLock::new();

/// 好みの優先度リストに従って、2つの解のうち良い方を返す。
/// 好みの優先度を比較関数の列に解決する。同じ優先度で何度も比較するときは、
/// 毎回ハッシュを引き直さずに済むようこれで先に解決しておく。
fn resolve_better_fns(preference_priorities: &[PreferenceKind]) -> Vec<BetterFn> {
    let table = better_method_map();
    preference_priorities
        .iter()
        .filter_map(|pref| table.get(pref).copied())
        .collect()
}

/// [`better_solution`] の、解決済みの比較関数列を使う版。
fn better_solution_with_fns<'a>(
    fns: &[BetterFn],
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> &'a SolutionResult {
    for method in fns {
        if let Some(s) = method(s1, s2) {
            return s;
        }
    }
    return s1;
}

/// 好みの種類から比較関数を引くテーブル。
fn better_method_map() -> &'static HashMap<PreferenceKind, BetterFn> {
    BETTER_METHOD_MAP.get_or_init(|| {
        return HashMap::from([
            (
                PreferenceKind::BiggerValue,
                better_solution_by_bigger_value as BetterFn,
            ),
            (
                PreferenceKind::ChancePop,
                better_solution_by_chance_pop as BetterFn,
            ),
            (
                PreferenceKind::PrismPop,
                better_solution_by_prism_pop as BetterFn,
            ),
            (
                PreferenceKind::AllClear,
                better_solution_by_all_clear as BetterFn,
            ),
            (
                PreferenceKind::SmallerTraceNum,
                better_solution_by_smaller_trace_num as BetterFn,
            ),
            (
                PreferenceKind::HeartPop,
                better_solution_by_heart_pop as BetterFn,
            ),
            (
                PreferenceKind::OjamaPop,
                better_solution_by_ojama_pop as BetterFn,
            ),
            (
                PreferenceKind::SmallerValue,
                better_solution_by_smaller_value as BetterFn,
            ),
            (
                PreferenceKind::NoChancePop,
                better_solution_by_no_chance_pop as BetterFn,
            ),
            (
                PreferenceKind::NoPrismPop,
                better_solution_by_no_prism_pop as BetterFn,
            ),
            (
                PreferenceKind::NoAllClear,
                better_solution_by_no_all_clear as BetterFn,
            ),
            (
                PreferenceKind::BiggerTraceNum,
                better_solution_by_bigger_trace_num as BetterFn,
            ),
            (
                PreferenceKind::NoHeartPop,
                better_solution_by_no_heart_pop as BetterFn,
            ),
            (
                PreferenceKind::NoOjamaPop,
                better_solution_by_no_ojama_pop as BetterFn,
            ),
            (
                PreferenceKind::MoreChancePop,
                better_solution_by_more_chance_pop as BetterFn,
            ),
            (
                PreferenceKind::MorePrismPop,
                better_solution_by_more_prism_pop as BetterFn,
            ),
            (
                PreferenceKind::MoreHeartPop,
                better_solution_by_more_heart_pop as BetterFn,
            ),
            (
                PreferenceKind::MoreOjamaPop,
                better_solution_by_more_ojama_pop as BetterFn,
            ),
            (
                PreferenceKind::LessChancePop,
                better_solution_by_less_chance_pop as BetterFn,
            ),
            (
                PreferenceKind::LessPrismPop,
                better_solution_by_less_prism_pop as BetterFn,
            ),
            (
                PreferenceKind::LessHeartPop,
                better_solution_by_less_heart_pop as BetterFn,
            ),
            (
                PreferenceKind::LessOjamaPop,
                better_solution_by_less_ojama_pop as BetterFn,
            ),
        ]);
    })
}

pub fn better_solution<'a>(
    preference_priorities: &Vec<PreferenceKind>,
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> &'a SolutionResult {
    let table = better_method_map();

    for pref in preference_priorities {
        if let Some(method) = table.get(pref) {
            if let Some(s) = method(s1, s2) {
                return s;
            }
        }
    }
    return s1;
}

/// なぞり1件ごとの評価の受け手。再帰 ([`SolutionExplorer::advance_trace_with`]) を
/// 1本に保ちつつ、決定論探索と期待値探索で処理を差し替えるための抽象。
trait TraceVisitor {
    fn visit(&mut self, explorer: &SolutionExplorer, trace_coords: &[PuyoCoord]);
}

/// 従来の探索。1件評価して最良解リストを更新するだけ。
struct DeterministicVisitor<'r> {
    exploration_result: &'r mut ExplorationResult,
}

impl TraceVisitor for DeterministicVisitor<'_> {
    #[inline]
    fn visit(&mut self, explorer: &SolutionExplorer, trace_coords: &[PuyoCoord]) {
        let solution_result = explorer.calc_solution_result(trace_coords);
        explorer.update_exploration_result(solution_result, self.exploration_result);
    }
}

/// 中身を書き込んで使い回すための空の解。
fn empty_solution_result() -> SolutionResult {
    SolutionResult {
        trace_coords: Vec::new(),
        chains: Vec::new(),
        value: 0.0,
        popped_chance_num: 0,
        popped_heart_num: 0,
        popped_prism_num: 0,
        popped_ojama_num: 0,
        popped_kata_num: 0,
        is_all_cleared: false,
    }
}

/// 不確定ぷよを考慮した探索結果。**なぞりの全列挙は1回だけ**で、
/// 決定論の結果と2種類の期待値を同時に得る。
pub struct EvExplorationResult {
    /// 補充なし (決定論) の探索結果。[`SolutionExplorer::solve_all_traces`] と一致する。
    pub deterministic: ExplorationResult,
    /// サンプルごとの最良値の平均 `E_s[max_t]`。
    /// 補充を見てからなぞりを選べる前提の値なので、上振れ側に偏る。
    pub expected_of_best: f64,
    /// なぞりごとのサンプル平均の最大 `max_t[E_s]`。
    /// 補充は見えないうちになぞりを決める実際のプレイに対応する値。
    ///
    /// **こちらは値だけで最大化する** (`preference_priorities` を見ない)。
    /// 「チャンスぷよを消す」のような値以外の好みは1回のプレイの属性であって、
    /// サンプル平均に対して定義できないため。値以外を優先する設定でこれを
    /// 並べ替えに使うなら、好みの扱いを先に決めること。
    pub best_of_expected: f64,
    /// [`Self::best_of_expected`] を与えるなぞり。
    pub best_of_expected_trace: Vec<PuyoCoord>,
}

/// 期待値つきの探索。1つのなぞりについて、決定論プレフィックスを共有したまま
/// サンプル数分の尾部だけを回す ([`SimulatorBB::do_chains_aggregate_multi`])。
struct EvVisitor<'f, 'r> {
    fills: &'f [UnknownFill],
    /// 解決済みの比較関数列。なぞり×サンプルの回数だけ比較するので、
    /// 毎回ハッシュを引くと無視できないコストになる。
    better_fns: Vec<BetterFn>,
    /// 集約バッファ (なぞりごとに使い回す)。`[0]` が補充なし。
    aggs: Vec<ChainsAggregate>,
    /// 比較用の作業領域 (なぞりごとに使い回す)。`Vec` を確保し直さないために持つ。
    scratch: Vec<SolutionResult>,
    /// サンプルごとの、これまでの最良解。
    ///
    /// **値の max ではなく `better_solution` の全順序で選ぶ**こと。
    /// 「チャンスぷよを消す」を値より優先する設定では、最良解の値が最大値とは限らない。
    sample_best: Vec<Option<SolutionResult>>,
    best_of_expected: f64,
    best_of_expected_trace: Vec<PuyoCoord>,
    exploration_result: &'r mut ExplorationResult,
}

impl TraceVisitor for EvVisitor<'_, '_> {
    fn visit(&mut self, explorer: &SolutionExplorer, trace_coords: &[PuyoCoord]) {
        let simulator = SimulatorBB {
            environment: explorer.environment,
            boost_area: explorer.boost_area,
            unknown_fill: None,
            refills_done: std::cell::Cell::new(0),
        };
        simulator.do_chains_aggregate_multi(
            &explorer.boards,
            SimulatorBB::coords_to_board(trace_coords.iter()),
            self.fills,
            &mut self.aggs,
        );

        let solution_result = explorer.solution_result_from_agg(trace_coords, &self.aggs[0]);
        explorer.update_exploration_result(solution_result, self.exploration_result);

        let mut sum = 0.0;
        for i in 0..self.fills.len() {
            let candidate = &mut self.scratch[i];
            explorer.fill_solution_result(trace_coords, &self.aggs[i + 1], candidate);
            sum += candidate.value;

            // 同点なら先に見つかっていた方を残す (`update_exploration_result` と同じ扱い)。
            let wins = match &self.sample_best[i] {
                None => true,
                Some(best) => std::ptr::eq(
                    better_solution_with_fns(&self.better_fns, best, candidate),
                    candidate as &_,
                ),
            };
            if wins {
                self.sample_best[i] = Some(candidate.clone());
            }
        }
        let mean = sum / self.fills.len() as f64;
        if mean > self.best_of_expected {
            self.best_of_expected = mean;
            self.best_of_expected_trace = trace_coords.to_vec();
        }
    }
}

pub struct SolutionExplorer<'a> {
    exploration_target: &'a ExplorationTarget,
    environment: &'a SimulationEnvironment,
    boost_area: u64,
    field: &'a Field,
    boards: BitBoards,
    /// 不確定ぷよ (ネクストより先に降ってくるぷよ) の扱い。`None` は従来どおり補充しない。
    unknown_fill: Option<&'a UnknownFill>,
}

impl<'a> SolutionExplorer<'a> {
    pub fn new(
        exploration_target: &'a ExplorationTarget,
        environment: &'a SimulationEnvironment,
        boost_area_coord_set: &'a HashSet<PuyoCoord>,
        field: &'a Field,
        next_puyos: &'a NextPuyos,
    ) -> SolutionExplorer<'a> {
        let boost_area = SimulatorBB::coords_to_board(boost_area_coord_set.iter());
        let boards = SimulatorBB::create_bit_boards(
            &field.map(|row| {
                row.map(|c| match c {
                    Some(p) => Some(p.puyo_type),
                    None => None,
                })
            }),
            &next_puyos.map(|c| match c {
                Some(p) => Some(p.puyo_type),
                None => None,
            }),
        );
        return SolutionExplorer {
            exploration_target,
            environment,
            boost_area,
            field,
            boards,
            unknown_fill: None,
        };
    }

    /// 不確定ぷよの扱いを指定した探索器を返す。既定 (指定しない場合) は補充しない従来の挙動。
    pub fn with_unknown_fill(mut self, unknown_fill: &'a UnknownFill) -> SolutionExplorer<'a> {
        self.unknown_fill = Some(unknown_fill);
        self
    }

    pub fn solve_all_traces(&self) -> ExplorationResult {
        let mut result = ExplorationResult {
            candidates_num: 0,
            optimal_solutions: Vec::new(),
        };
        for y in 0..PuyoCoord::Y_NUM {
            for x in 0..PuyoCoord::X_NUM {
                let coord = PuyoCoord::xy_to_coord(x, y).unwrap();
                let state = SolutionState::new(coord.index());
                self.advance_trace(&state, coord, &mut result);
            }
        }
        self.finalize_chains(&mut result);
        return result;
    }

    /// 不確定ぷよのサンプルを当てながら全なぞりを1回だけ列挙する。
    ///
    /// サンプルごとに [`Self::solve_all_traces`] を呼び直すのに比べ、
    /// (1) なぞり木の列挙が1回で済み、(2) 各なぞりの決定論部分の連鎖計算も1回で済む。
    /// 結果はサンプルごとに回した場合と一致する (`ev_matches_per_sample_solves` で担保)。
    ///
    /// `self.unknown_fill` は無視する (補充はここで渡す `fills` で決まる)。
    pub fn solve_all_traces_ev(&self, fills: &[UnknownFill]) -> EvExplorationResult {
        // サンプルが無いなら期待値も無い。NaN を撒きながら全列挙しても意味がない。
        if fills.is_empty() {
            return EvExplorationResult {
                deterministic: self.solve_all_traces(),
                expected_of_best: 0.0,
                best_of_expected: 0.0,
                best_of_expected_trace: Vec::new(),
            };
        }

        let mut deterministic = ExplorationResult {
            candidates_num: 0,
            optimal_solutions: Vec::new(),
        };
        let mut visitor = EvVisitor {
            fills,
            better_fns: resolve_better_fns(&self.exploration_target.preference_priorities),
            aggs: vec![ChainsAggregate::default(); fills.len() + 1],
            scratch: vec![empty_solution_result(); fills.len()],
            sample_best: vec![None; fills.len()],
            best_of_expected: f64::NEG_INFINITY,
            best_of_expected_trace: Vec::new(),
            exploration_result: &mut deterministic,
        };
        for y in 0..PuyoCoord::Y_NUM {
            for x in 0..PuyoCoord::X_NUM {
                let coord = PuyoCoord::xy_to_coord(x, y).unwrap();
                let state = SolutionState::new(coord.index());
                self.advance_trace_with(&state, coord, &mut visitor);
            }
        }

        // 最適解を1件も採らない設定では、従来もサンプルごとの最良解が空になり 0 だった。
        let expected_of_best = if self.exploration_target.optimal_solution_count == 0 {
            0.0
        } else {
            visitor
                .sample_best
                .iter()
                .map(|s| s.as_ref().map(|s| s.value).unwrap_or(0.0))
                .sum::<f64>()
                / fills.len() as f64
        };
        let best_of_expected = if visitor.best_of_expected.is_finite() {
            visitor.best_of_expected
        } else {
            0.0
        };
        let best_of_expected_trace = visitor.best_of_expected_trace;

        self.finalize_chains(&mut deterministic);
        EvExplorationResult {
            deterministic,
            expected_of_best,
            best_of_expected,
            best_of_expected_trace,
        }
    }

    pub fn solve_traces_including_index(&self, coord_index: u8) -> Option<ExplorationResult> {
        match PuyoCoord::index_to_coord(coord_index) {
            None => None,
            Some(coord) => {
                let mut result = ExplorationResult {
                    candidates_num: 0,
                    optimal_solutions: Vec::new(),
                };
                let state = SolutionState::new(coord_index);
                self.advance_trace(&state, coord, &mut result);
                self.finalize_chains(&mut result);
                return Some(result);
            }
        }
    }

    fn is_traceable_at(&self, coord: PuyoCoord) -> bool {
        match self.field[coord.y as usize][coord.x as usize] {
            Some(p) => is_traceable_type(p.puyo_type),
            None => false,
        }
    }

    /// なぞりの先頭セル列 `prefix`(正準順のインデックス列)から始まる部分木を探索する。
    ///
    /// 並列探索の「深さカット」分割用プリミティブ。
    /// - `recurse=false`: `prefix` のなぞり 1 件のみ評価(深さ d 未満の「幹」タスク)。
    /// - `recurse=true` : `prefix` と、その全拡張を評価(深さ d の「葉」タスク)。
    ///
    /// 例) インデックス i を細分するには、`([i], false)` と、i の各候補 j について `([i, j], true)` を投げる。
    /// 和は `solve_traces_including_index(i)` と過不足なく一致する(正準列挙の部分木が互いに素かつ網羅的)。
    /// 無効な(連結でない/なぞれない/上限超過の)プレフィックスは空結果を返す。
    pub fn solve_traces_with_prefix(
        &self,
        prefix: &[u8],
        recurse: bool,
    ) -> Option<ExplorationResult> {
        if prefix.is_empty() {
            return None;
        }
        let mut result = ExplorationResult {
            candidates_num: 0,
            optimal_solutions: Vec::new(),
        };
        let max = self.get_actual_max_trace_num();
        if prefix.len() as u32 > max {
            return Some(result);
        }

        // 先頭セル
        let first = match PuyoCoord::index_to_coord(prefix[0]) {
            Some(c) => c,
            None => return None,
        };
        if !self.is_traceable_at(first) {
            return Some(result);
        }
        let mut state = SolutionState::new(prefix[0]);
        state.add_trace_coord(first);

        // 残りのプレフィックスを正準規則に従って replay
        for &idx in &prefix[1..] {
            let coord = match PuyoCoord::index_to_coord(idx) {
                Some(c) => c,
                None => return None,
            };
            if !self.is_traceable_at(coord) || !state.check_if_addable_coord(&coord, max) {
                return Some(result);
            }
            state.add_trace_coord(coord);
        }

        // prefix のなぞりを評価
        let sr = self.calc_solution_result(state.get_trace_coords());
        self.update_exploration_result(sr, &mut result);

        // 拡張(葉タスク)
        if recurse {
            for next_coord in state.get_next_candidate_coords() {
                self.advance_trace(&state, *next_coord, &mut result);
            }
        }

        self.finalize_chains(&mut result);
        return Some(result);
    }

    fn advance_trace(
        &self,
        state: &SolutionState,
        coord: PuyoCoord,
        exploration_result: &mut ExplorationResult,
    ) {
        self.advance_trace_with(state, coord, &mut DeterministicVisitor { exploration_result });
    }

    /// なぞり木の再帰。**訪問器はジェネリクスで単相化する**ので、
    /// 決定論探索 ([`DeterministicVisitor`]) の生成コードは訪問器を足す前と変わらない。
    fn advance_trace_with<V: TraceVisitor>(
        &self,
        state: &SolutionState,
        coord: PuyoCoord,
        visitor: &mut V,
    ) {
        if let Some(p) = self.field[coord.y as usize][coord.x as usize] {
            if !is_traceable_type(p.puyo_type) {
                return;
            }
            if !state.check_if_addable_coord(&coord, self.get_actual_max_trace_num()) {
                return;
            }

            let mut st = state.clone();
            st.add_trace_coord(coord);

            visitor.visit(self, st.get_trace_coords());

            for next_coord in st.get_next_candidate_coords() {
                self.advance_trace_with(&st, *next_coord, visitor);
            }
        }
    }

    fn get_actual_max_trace_num(&self) -> u32 {
        if self.environment.is_chance_mode {
            5
        } else {
            self.environment.max_trace_num
        }
    }

    /// 探索中の評価。HashMap/Vec<Chain> を構築せず、スカラー集約だけで SolutionResult を作る。
    /// `chains` は空のままにし、最終的な勝者についてのみ `finalize_chains` でフル構築する。
    fn calc_solution_result(&self, trace_coords: &[PuyoCoord]) -> SolutionResult {
        let agg = self.do_chains_aggregate_bb(trace_coords);
        self.solution_result_from_agg(trace_coords, &agg)
    }

    /// [`Self::solution_result_from_agg`] の、確保済みの入れ物に書き込む版。
    /// なぞり1件ごとにサンプル数分の解を作るので、`Vec` を確保し直さないために要る。
    fn fill_solution_result(
        &self,
        trace_coords: &[PuyoCoord],
        agg: &ChainsAggregate,
        out: &mut SolutionResult,
    ) {
        out.trace_coords.clear();
        out.trace_coords.extend_from_slice(trace_coords);
        out.chains.clear();
        out.value = self.calc_value(agg);
        out.popped_chance_num = agg.popped_chance_num;
        out.popped_heart_num = agg.popped[attr_index(PuyoAttr::Heart)];
        out.popped_prism_num = agg.popped[attr_index(PuyoAttr::Prism)];
        out.popped_ojama_num = agg.popped[attr_index(PuyoAttr::Ojama)];
        out.popped_kata_num = agg.popped[attr_index(PuyoAttr::Kata)];
        out.is_all_cleared = agg.is_all_cleared;
    }

    fn solution_result_from_agg(
        &self,
        trace_coords: &[PuyoCoord],
        agg: &ChainsAggregate,
    ) -> SolutionResult {
        let value = self.calc_value(agg);

        return SolutionResult {
            trace_coords: trace_coords.to_vec(),
            chains: Vec::new(),
            value,
            popped_chance_num: agg.popped_chance_num,
            popped_heart_num: agg.popped[attr_index(PuyoAttr::Heart)],
            popped_prism_num: agg.popped[attr_index(PuyoAttr::Prism)],
            popped_ojama_num: agg.popped[attr_index(PuyoAttr::Ojama)],
            popped_kata_num: agg.popped[attr_index(PuyoAttr::Kata)],
            is_all_cleared: agg.is_all_cleared,
        };
    }

    /// 集約スカラーから探索対象の値を計算する。
    /// chain_helper のフルチェーン版と数値的に一致させること。
    fn calc_value(&self, agg: &ChainsAggregate) -> f64 {
        match self.exploration_target.category {
            ExplorationCategory::Damage => {
                let boost_ratio = calc_boost_ratio(agg.boost_count);
                if let Some(main_attr) = self.exploration_target.main_attr {
                    let main_value =
                        (agg.color_strength[attr_index(main_attr)] + agg.prism_strength)
                            * boost_ratio;
                    let main_sub_ratio = self.exploration_target.main_sub_ratio.unwrap_or(0.0);
                    let sub_value = match self.exploration_target.sub_attr {
                        Some(sub_attr) => {
                            (agg.color_strength[attr_index(sub_attr)] + agg.prism_strength)
                                * boost_ratio
                                * main_sub_ratio
                        }
                        None => 0.0,
                    };
                    main_value + sub_value
                } else {
                    // ワイルド
                    let wild_pure: f64 = agg.color_strength.iter().sum();
                    (wild_pure + agg.prism_strength) * boost_ratio
                }
            }
            ExplorationCategory::SkillPuyoCount => {
                if let Some(main_attr) = self.exploration_target.main_attr {
                    let main_value = agg.popped[attr_index(main_attr)];
                    let mut bonus_value: u32 = 0;
                    if let Some(counting_bonus) = &self.exploration_target.counting_bonus {
                        if counting_bonus.bonus_type == CountingBonusType::Step {
                            let height = counting_bonus
                                .target_attrs
                                .iter()
                                .fold(0, |acc, attr| acc + agg.popped[attr_index(*attr)]);
                            let mut steps = height / counting_bonus.step_height as u32;
                            if !counting_bonus.repeat {
                                steps = cmp::min(1, steps);
                            }
                            bonus_value = counting_bonus.bonus_count as u32 * steps;
                        }
                    }
                    (main_value + bonus_value) as f64
                } else {
                    0.0
                }
            }
            ExplorationCategory::PuyotsukaiCount => agg.puyo_tsukai_count as f64,
        }
    }

    /// 最適解リストの各要素について、空だった `chains` をフル構築して埋める。
    fn finalize_chains(&self, exploration_result: &mut ExplorationResult) {
        for s in exploration_result.optimal_solutions.iter_mut() {
            s.chains = self.do_chains_bb(&s.trace_coords);
        }
    }

    /// Bitboardを使ったシミュレーターで連鎖させ、スカラーを集約する。(探索用・確保なし)
    fn do_chains_aggregate_bb(&self, trace_coords: &[PuyoCoord]) -> ChainsAggregate {
        let sim = SimulatorBB {
            environment: self.environment,
            boost_area: self.boost_area,
            unknown_fill: self.unknown_fill,
            refills_done: std::cell::Cell::new(0),
        };
        return sim.do_chains_aggregate(
            &mut self.boards.clone(),
            SimulatorBB::coords_to_board(trace_coords.iter()),
        );
    }

    /// Bitboardを使ったシミュレーターで連鎖させる。(フル Chain・勝者再構築用)
    fn do_chains_bb(&self, trace_coords: &[PuyoCoord]) -> Vec<Chain> {
        let sim = SimulatorBB {
            environment: self.environment,
            boost_area: self.boost_area,
            unknown_fill: self.unknown_fill,
            refills_done: std::cell::Cell::new(0),
        };
        return sim.do_chains(
            &mut self.boards.clone(),
            SimulatorBB::coords_to_board(trace_coords.iter()),
        );
    }

    fn update_exploration_result(
        &self,
        solution_result: SolutionResult,
        exploration_result: &mut ExplorationResult,
    ) {
        exploration_result.candidates_num += 1;

        let max = self.exploration_target.optimal_solution_count as usize;

        if max == 0 {
            return;
        }

        let len = exploration_result.optimal_solutions.len();
        let preference_priorities = &self.exploration_target.preference_priorities;

        let mut i = len;
        for s in exploration_result.optimal_solutions.iter().rev() {
            let better_s = better_solution(preference_priorities, s, &solution_result);
            if better_s as *const _ == s as *const _ {
                break;
            }
            i -= 1;
        }
        if i == max {
            return;
        }
        exploration_result
            .optimal_solutions
            .insert(i, solution_result);
        if len == max {
            exploration_result.optimal_solutions.pop();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        chain::{AttributeChain, Chain},
        puyo::Puyo,
        puyo_attr::PuyoAttr,
        puyo_type::PuyoType,
        trace_mode::TraceMode,
    };
    use std::collections::HashSet;
    use crate::simulator_bb::UnknownFillPolicy;

    /// `solve_all_traces_ev` が、サンプルごとに `solve_all_traces` を回した従来の結果と
    /// 一致すること (決定論解も `E_s[max_t]` も)。
    ///
    /// **値が第一キーでない優先度も必ず含めること**。サンプルごとの最良解は
    /// `better_solution` の全順序で選ぶ必要があり、値の max で代用すると
    /// 「チャンスぷよを消す」を優先する設定でズレる。
    #[test]
    fn ev_matches_per_sample_solves() {
        for priorities in [
            Vec::from([
                PreferenceKind::BiggerValue,
                PreferenceKind::ChancePop,
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::SmallerTraceNum,
            ]),
            // 実運用の既定の並び (チャンスぷよ優先)。
            Vec::from([
                PreferenceKind::ChancePop,
                PreferenceKind::BiggerValue,
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::SmallerTraceNum,
            ]),
        ] {
            check_ev_matches_per_sample_solves(priorities);
        }
    }

    fn check_ev_matches_per_sample_solves(priorities: Vec<PreferenceKind>) {
        let chance_first = priorities[0] == PreferenceKind::ChancePop;
        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: priorities,
            optimal_solution_count: 1,
            main_attr: Some(PuyoAttr::Green),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 4,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 7.0,
        };
        let boost_area_coord_set: HashSet<PuyoCoord> = HashSet::new();
        let r = PuyoType::Red;
        let b = PuyoType::Blue;
        let g = PuyoType::Green;
        let y = PuyoType::Yellow;
        let p = PuyoType::Purple;
        let h = PuyoType::Heart;
        let mut id_counter = 0;
        let pc = PuyoType::PurpleChance;
        let field = [
            [r, p, h, p, y, g, y, y],
            [r, y, p, h, y, g, pc, g],
            [b, y, g, b, h, y, g, pc],
            [b, r, b, r, p, b, r, pc],
            [y, g, p, p, r, b, g, g],
            [b, g, b, r, b, y, r, r],
        ]
        .map(|row| {
            row.map(|puyo_type| {
                id_counter += 1;
                Some(Puyo { id: id_counter, puyo_type })
            })
        });
        let next_puyos = [g, g, g, g, g, g, g, g].map(|puyo_type| {
            id_counter += 1;
            Some(Puyo { id: id_counter, puyo_type })
        });
        let explorer = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &boost_area_coord_set,
            &field,
            &next_puyos,
        );

        let fills: Vec<UnknownFill> = (0..4u64)
            .map(|s| UnknownFill {
                policy: UnknownFillPolicy::ChainAverse,
                seed: (s + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15),
                max_refills: 2,
            })
            .collect();

        let actual = explorer.solve_all_traces_ev(&fills);

        // 決定論部分は従来の探索と完全に一致する。
        let expected_deterministic = explorer.solve_all_traces();
        assert_eq!(
            actual.deterministic.candidates_num,
            expected_deterministic.candidates_num
        );
        assert_eq!(
            actual.deterministic.optimal_solutions[0].trace_coords,
            expected_deterministic.optimal_solutions[0].trace_coords
        );
        assert_eq!(
            actual.deterministic.optimal_solutions[0].value,
            expected_deterministic.optimal_solutions[0].value
        );

        // E_s[max_t] は、サンプルごとに探索し直した最良値の平均と一致する。
        let mut total = 0.0;
        for fill in &fills {
            let per_sample = SolutionExplorer::new(
                &exploration_target,
                &environment,
                &boost_area_coord_set,
                &field,
                &next_puyos,
            )
            .with_unknown_fill(fill)
            .solve_all_traces();
            total += per_sample
                .optimal_solutions
                .first()
                .map(|s| s.value)
                .unwrap_or(0.0);
        }
        assert_eq!(actual.expected_of_best, total / fills.len() as f64);

        // チャンスぷよ優先のときは「値の max」で代用すると答えが変わることを示す。
        // (このテストが本当にその退行を捕まえられることの担保)
        if chance_first {
            // 値だけを第一キーにした探索 = 「値の max」そのもの。
            let value_first = ExplorationTarget {
                category: exploration_target.category,
                preference_priorities: Vec::from([PreferenceKind::BiggerValue]),
                optimal_solution_count: exploration_target.optimal_solution_count,
                main_attr: exploration_target.main_attr,
                sub_attr: exploration_target.sub_attr,
                main_sub_ratio: exploration_target.main_sub_ratio,
                counting_bonus: None,
            };
            let mut naive = 0.0;
            for fill in &fills {
                naive += SolutionExplorer::new(
                    &value_first,
                    &environment,
                    &boost_area_coord_set,
                    &field,
                    &next_puyos,
                )
                .with_unknown_fill(fill)
                .solve_all_traces()
                .optimal_solutions
                .first()
                .map(|s| s.value)
                .unwrap_or(0.0);
            }
            assert_ne!(
                naive / fills.len() as f64,
                actual.expected_of_best,
                "チャンス優先でも値の max と一致してしまい、退行を検出できない盤面になっている"
            );
        }

        // 値が第一キーのときは max_t[E_s] <= E_s[max_t] (最大と平均の交換)。
        // チャンス優先だと E_s[max_t] 側が値の最大でなくなるので、この関係は成り立たない。
        if !chance_first {
            assert!(actual.best_of_expected <= actual.expected_of_best);
        }
        assert!(!actual.best_of_expected_trace.is_empty());
    }

    const S: SolutionResult = SolutionResult {
        trace_coords: Vec::new(),
        chains: Vec::new(),
        value: 0.0,
        popped_chance_num: 0,
        popped_heart_num: 0,
        popped_prism_num: 0,
        popped_ojama_num: 0,
        popped_kata_num: 0,
        is_all_cleared: false,
    };

    #[test]
    fn test_better_solution_by_bigger_value_s1() {
        let s1 = SolutionResult { value: 2.0, ..S };
        let s2 = SolutionResult { value: 1.0, ..S };
        assert_eq!(better_solution_by_bigger_value(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_bigger_value_s2() {
        let s1 = SolutionResult { value: 1.0, ..S };
        let s2 = SolutionResult { value: 2.0, ..S };
        assert_eq!(better_solution_by_bigger_value(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_bigger_value_none() {
        let s1 = SolutionResult { value: 1.0, ..S };
        let s2 = SolutionResult { value: 1.0, ..S };
        assert!(better_solution_by_bigger_value(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_chance_pop_s1() {
        let s1 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_chance_pop(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_chance_pop_s2() {
        let s1 = SolutionResult {
            popped_chance_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_chance_pop(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_chance_pop_none() {
        let s1 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        assert!(better_solution_by_chance_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_prism_pop_s1() {
        let s1 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_prism_pop(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_prism_pop_s2() {
        let s1 = SolutionResult {
            popped_prism_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_prism_pop(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_prism_pop_none() {
        let s1 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        assert!(better_solution_by_prism_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_all_clear_s1() {
        let s1 = SolutionResult {
            is_all_cleared: true,
            ..S
        };
        let s2 = SolutionResult {
            is_all_cleared: false,
            ..S
        };
        assert_eq!(better_solution_by_all_clear(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_all_clear_s2() {
        let s1 = SolutionResult {
            is_all_cleared: false,
            ..S
        };
        let s2 = SolutionResult {
            is_all_cleared: true,
            ..S
        };
        assert_eq!(better_solution_by_all_clear(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_all_clear_none() {
        let s1 = SolutionResult {
            is_all_cleared: true,
            ..S
        };
        let s2 = SolutionResult {
            is_all_cleared: true,
            ..S
        };
        assert!(better_solution_by_all_clear(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_smaller_trace_num_s1() {
        let s1 = SolutionResult {
            trace_coords: Vec::from([PuyoCoord::index_to_coord(0).unwrap()]),
            ..S
        };
        let s2 = SolutionResult {
            trace_coords: Vec::from([
                PuyoCoord::index_to_coord(0).unwrap(),
                PuyoCoord::index_to_coord(1).unwrap(),
            ]),
            ..S
        };
        assert_eq!(better_solution_by_smaller_trace_num(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_smaller_trace_num_s2() {
        let s1 = SolutionResult {
            trace_coords: Vec::from([
                PuyoCoord::index_to_coord(0).unwrap(),
                PuyoCoord::index_to_coord(1).unwrap(),
            ]),
            ..S
        };
        let s2 = SolutionResult {
            trace_coords: Vec::from([PuyoCoord::index_to_coord(0).unwrap()]),
            ..S
        };
        assert_eq!(better_solution_by_smaller_trace_num(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_smaller_trace_num_none() {
        let s1 = SolutionResult {
            trace_coords: Vec::from([
                PuyoCoord::index_to_coord(0).unwrap(),
                PuyoCoord::index_to_coord(1).unwrap(),
            ]),
            ..S
        };
        let s2 = SolutionResult {
            trace_coords: Vec::from([
                PuyoCoord::index_to_coord(1).unwrap(),
                PuyoCoord::index_to_coord(2).unwrap(),
            ]),
            ..S
        };
        assert!(better_solution_by_smaller_trace_num(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_heart_pop_s1() {
        let s1 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_heart_pop(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_heart_pop_s2() {
        let s1 = SolutionResult {
            popped_heart_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_heart_pop(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_heart_pop_none() {
        let s1 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        assert!(better_solution_by_heart_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_ojama_pop_s1() {
        let s1 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_ojama_num: 0,
            popped_kata_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_ojama_pop(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_ojama_pop_s2() {
        let s1 = SolutionResult {
            popped_ojama_num: 0,
            popped_kata_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_ojama_num: 0,
            popped_kata_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_ojama_pop(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_ojama_pop_none() {
        let s1 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_ojama_num: 0,
            popped_kata_num: 2,
            ..S
        };
        assert!(better_solution_by_ojama_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_smaller_value_s1() {
        let s1 = SolutionResult { value: 1.0, ..S };
        let s2 = SolutionResult { value: 2.0, ..S };
        assert_eq!(better_solution_by_smaller_value(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_smaller_value_s2() {
        let s1 = SolutionResult { value: 2.0, ..S };
        let s2 = SolutionResult { value: 1.0, ..S };
        assert_eq!(better_solution_by_smaller_value(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_smaller_value_none() {
        let s1 = SolutionResult { value: 1.0, ..S };
        let s2 = SolutionResult { value: 1.0, ..S };
        assert!(better_solution_by_smaller_value(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_no_chance_pop_s1() {
        let s1 = SolutionResult {
            popped_chance_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_no_chance_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_no_chance_pop_s2() {
        let s1 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_no_chance_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_no_chance_pop_none() {
        let s1 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        assert!(better_solution_by_no_chance_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_no_prism_pop_s1() {
        let s1 = SolutionResult {
            popped_prism_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_no_prism_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_no_prism_pop_s2() {
        let s1 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_no_prism_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_no_prism_pop_none() {
        let s1 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        assert!(better_solution_by_no_prism_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_no_all_clear_s1() {
        let s1 = SolutionResult {
            is_all_cleared: false,
            ..S
        };
        let s2 = SolutionResult {
            is_all_cleared: true,
            ..S
        };
        assert_eq!(better_solution_by_no_all_clear(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_no_all_clear_s2() {
        let s1 = SolutionResult {
            is_all_cleared: true,
            ..S
        };
        let s2 = SolutionResult {
            is_all_cleared: false,
            ..S
        };
        assert_eq!(better_solution_by_no_all_clear(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_no_all_clear_none() {
        let s1 = SolutionResult {
            is_all_cleared: true,
            ..S
        };
        let s2 = SolutionResult {
            is_all_cleared: true,
            ..S
        };
        assert!(better_solution_by_no_all_clear(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_bigger_trace_num_s1() {
        let s1 = SolutionResult {
            trace_coords: Vec::from([
                PuyoCoord::index_to_coord(0).unwrap(),
                PuyoCoord::index_to_coord(1).unwrap(),
            ]),
            ..S
        };
        let s2 = SolutionResult {
            trace_coords: Vec::from([PuyoCoord::index_to_coord(0).unwrap()]),
            ..S
        };
        assert_eq!(better_solution_by_bigger_trace_num(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_bigger_trace_num_s2() {
        let s1 = SolutionResult {
            trace_coords: Vec::from([PuyoCoord::index_to_coord(0).unwrap()]),
            ..S
        };
        let s2 = SolutionResult {
            trace_coords: Vec::from([
                PuyoCoord::index_to_coord(0).unwrap(),
                PuyoCoord::index_to_coord(1).unwrap(),
            ]),
            ..S
        };
        assert_eq!(better_solution_by_bigger_trace_num(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_bigger_trace_num_none() {
        let s1 = SolutionResult {
            trace_coords: Vec::from([
                PuyoCoord::index_to_coord(0).unwrap(),
                PuyoCoord::index_to_coord(1).unwrap(),
            ]),
            ..S
        };
        let s2 = SolutionResult {
            trace_coords: Vec::from([
                PuyoCoord::index_to_coord(1).unwrap(),
                PuyoCoord::index_to_coord(2).unwrap(),
            ]),
            ..S
        };
        assert!(better_solution_by_bigger_trace_num(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_no_heart_pop_s1() {
        let s1 = SolutionResult {
            popped_heart_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_no_heart_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_no_heart_pop_s2() {
        let s1 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_no_heart_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_no_heart_pop_none() {
        let s1 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        assert!(better_solution_by_no_heart_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_no_ojama_pop_s1() {
        let s1 = SolutionResult {
            popped_ojama_num: 0,
            popped_kata_num: 0,
            ..S
        };
        let s2 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_no_ojama_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_no_ojama_pop_s2() {
        let s1 = SolutionResult {
            popped_ojama_num: 0,
            popped_kata_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_ojama_num: 0,
            popped_kata_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_no_ojama_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_no_ojama_pop_none() {
        let s1 = SolutionResult {
            popped_ojama_num: 0,
            popped_kata_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_ojama_num: 2,
            popped_kata_num: 0,
            ..S
        };
        assert!(better_solution_by_no_ojama_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_more_chance_pop_s1() {
        let s1 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_more_chance_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_more_chance_pop_s2() {
        let s1 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        assert_eq!(better_solution_by_more_chance_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_more_chance_pop_none() {
        let s1 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        assert!(better_solution_by_more_chance_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_more_prism_pop_s1() {
        let s1 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_more_prism_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_more_prism_pop_s2() {
        let s1 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        assert_eq!(better_solution_by_more_prism_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_more_prism_pop_none() {
        let s1 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        assert!(better_solution_by_more_prism_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_more_heart_pop_s1() {
        let s1 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_more_heart_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_more_heart_pop_s2() {
        let s1 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        assert_eq!(better_solution_by_more_heart_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_more_heart_pop_none() {
        let s1 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        assert!(better_solution_by_more_heart_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_more_ojama_pop_s1() {
        let mut s1 = SolutionResult {
            popped_ojama_num: 2,
            ..S
        };
        let mut s2 = SolutionResult {
            popped_ojama_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_more_ojama_pop(&s1, &s2).unwrap(), &s1);
        s1 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 1,
            ..S
        };
        s2 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_more_ojama_pop(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_more_ojama_pop_s2() {
        let mut s1 = SolutionResult {
            popped_ojama_num: 1,
            ..S
        };
        let mut s2 = SolutionResult {
            popped_ojama_num: 2,
            ..S
        };
        assert_eq!(better_solution_by_more_ojama_pop(&s1, &s2).unwrap(), &s2);
        s1 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 0,
            ..S
        };
        s2 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_more_ojama_pop(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_more_ojama_pop_none() {
        let mut s1 = SolutionResult {
            popped_ojama_num: 2,
            ..S
        };
        let mut s2 = SolutionResult {
            popped_ojama_num: 2,
            ..S
        };
        assert!(better_solution_by_more_ojama_pop(&s1, &s2).is_none());
        s1 = SolutionResult {
            popped_ojama_num: 2,
            popped_kata_num: 1,
            ..S
        };
        s2 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 2,
            ..S
        };
        assert!(better_solution_by_more_ojama_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_less_chance_pop_s1() {
        let s1 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        assert_eq!(better_solution_by_less_chance_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_less_chance_pop_s2() {
        let s1 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_less_chance_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_less_chance_pop_none() {
        let s1 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_chance_num: 2,
            ..S
        };
        assert!(better_solution_by_less_chance_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_less_prism_pop_s1() {
        let s1 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        assert_eq!(better_solution_by_less_prism_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_less_prism_pop_s2() {
        let s1 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_less_prism_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_less_prism_pop_none() {
        let s1 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_prism_num: 2,
            ..S
        };
        assert!(better_solution_by_less_prism_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_less_heart_pop_s1() {
        let s1 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        assert_eq!(better_solution_by_less_heart_pop(&s1, &s2).unwrap(), &s1)
    }

    #[test]
    fn test_better_solution_by_less_heart_pop_s2() {
        let s1 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_less_heart_pop(&s1, &s2).unwrap(), &s2)
    }

    #[test]
    fn test_better_solution_by_less_heart_pop_none() {
        let s1 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        let s2 = SolutionResult {
            popped_heart_num: 2,
            ..S
        };
        assert!(better_solution_by_less_heart_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_better_solution_by_less_ojama_pop_s1() {
        let mut s1 = SolutionResult {
            popped_ojama_num: 1,
            ..S
        };
        let mut s2 = SolutionResult {
            popped_ojama_num: 2,
            ..S
        };
        assert_eq!(better_solution_by_less_ojama_pop(&s1, &s2).unwrap(), &s1);
        s1 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 0,
            ..S
        };
        s2 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_less_ojama_pop(&s1, &s2).unwrap(), &s1);
    }

    #[test]
    fn test_better_solution_by_less_ojama_pop_s2() {
        let mut s1 = SolutionResult {
            popped_ojama_num: 2,
            ..S
        };
        let mut s2 = SolutionResult {
            popped_ojama_num: 1,
            ..S
        };
        assert_eq!(better_solution_by_less_ojama_pop(&s1, &s2).unwrap(), &s2);
        s1 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 1,
            ..S
        };
        s2 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 0,
            ..S
        };
        assert_eq!(better_solution_by_less_ojama_pop(&s1, &s2).unwrap(), &s2);
    }

    #[test]
    fn test_better_solution_by_less_ojama_pop_none() {
        let mut s1 = SolutionResult {
            popped_ojama_num: 2,
            ..S
        };
        let mut s2 = SolutionResult {
            popped_ojama_num: 2,
            ..S
        };
        assert!(better_solution_by_less_ojama_pop(&s1, &s2).is_none());
        s1 = SolutionResult {
            popped_ojama_num: 2,
            popped_kata_num: 1,
            ..S
        };
        s2 = SolutionResult {
            popped_ojama_num: 1,
            popped_kata_num: 2,
            ..S
        };
        assert!(better_solution_by_less_ojama_pop(&s1, &s2).is_none());
    }

    #[test]
    fn test_solve_all_traces_special_rule_1_1_modified() {
        // Arrange
        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: Vec::from([
                PreferenceKind::BiggerValue,
                PreferenceKind::ChancePop,
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::SmallerTraceNum,
            ]),
            optimal_solution_count: 2,
            main_attr: Some(PuyoAttr::Green),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 3,
            max_trace_num: 3,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 7.0,
        };
        let boost_area_coord_set: HashSet<PuyoCoord> = HashSet::new();
        let r = PuyoType::Red;
        let b = PuyoType::Blue;
        let g = PuyoType::Green;
        let y = PuyoType::Yellow;
        let p = PuyoType::Purple;
        let pc = PuyoType::PurpleChance;
        let h = PuyoType::Heart;
        let o = PuyoType::Ojama;
        let z = PuyoType::Kata;
        let mut id_counter = 0;
        let field = [
            [r, p, z, p, y, g, y, y],
            [r, y, p, h, y, g, pc, g],
            [b, y, g, b, o, y, g, pc],
            [b, r, b, r, p, b, r, pc],
            [y, g, p, p, r, b, g, g],
            [b, g, b, r, b, y, r, r],
        ]
        .map(|row| {
            row.map(|puyo_type| {
                id_counter += 1;
                Some(Puyo {
                    id: id_counter,
                    puyo_type,
                })
            })
        });
        let next_puyos = [g, g, g, g, g, g, g, g].map(|puyo_type| {
            id_counter += 1;
            Some(Puyo {
                id: id_counter,
                puyo_type,
            })
        });
        let explorer = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &boost_area_coord_set,
            &field,
            &next_puyos,
        );

        // Act
        let actual = explorer.solve_all_traces();

        // Arrange
        assert_eq!(actual.candidates_num, 703);
        assert_eq!(actual.optimal_solutions.len(), 2);
        let s0 = &actual.optimal_solutions[0];
        assert_eq!(
            s0.trace_coords,
            Vec::from([PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }])
        );
        assert_eq!(s0.chains.len(), 14);
        assert_eq!(
            s0.chains[0],
            Chain {
                chain_num: 1,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Purple,
                    AttributeChain {
                        strength: 1.0,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 3,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[1],
            Chain {
                chain_num: 2,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 3.8000000000000003,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[2],
            Chain {
                chain_num: 3,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 5.8999999999999995,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[3],
            Chain {
                chain_num: 4,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Yellow,
                    AttributeChain {
                        strength: 8.0,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[4],
            Chain {
                chain_num: 5,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Blue,
                    AttributeChain {
                        strength: 9.4,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[5],
            Chain {
                chain_num: 6,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 12.419999999999998,
                            popped_count: 3,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Ojama,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[6],
            Chain {
                chain_num: 7,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 12.200000000000001,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[7],
            Chain {
                chain_num: 8,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 13.6,
                            popped_count: 3,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[8],
            Chain {
                chain_num: 9,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 15.0,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[9],
            Chain {
                chain_num: 10,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 16.400000000000002,
                            popped_count: 3,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Kata,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[10],
            Chain {
                chain_num: 11,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Blue,
                    AttributeChain {
                        strength: 17.800000000000004,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[11],
            Chain {
                chain_num: 12,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 19.2,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            },
        );
        assert_eq!(
            s0.chains[12],
            Chain {
                chain_num: 13,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 23.689999999999994,
                            popped_count: 3,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Ojama,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s0.chains[13],
            Chain {
                chain_num: 14,
                simultaneous_num: 10,
                boost_count: 0,
                puyo_tsukai_count: 10,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 90.19999999999999,
                        popped_count: 10,
                        separated_blocks_num: 2,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(s0.value, 108.99999999999999);
        assert_eq!(s0.popped_chance_num, 3);
        assert_eq!(s0.popped_heart_num, 1);
        assert_eq!(s0.popped_prism_num, 0);
        assert_eq!(s0.popped_ojama_num, 2);
        assert_eq!(s0.popped_kata_num, 1);
        assert_eq!(s0.is_all_cleared, false);

        let s1 = &actual.optimal_solutions[1];
        assert_eq!(
            s1.trace_coords,
            Vec::from([
                PuyoCoord { x: 4, y: 1 },
                PuyoCoord { x: 5, y: 2 },
                PuyoCoord { x: 6, y: 2 }
            ])
        );
        assert_eq!(s1.chains.len(), 14);
        assert_eq!(
            s1.chains[0],
            Chain {
                chain_num: 1,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Purple,
                    AttributeChain {
                        strength: 1.0,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 3,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[1],
            Chain {
                chain_num: 2,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 3.8000000000000003,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[2],
            Chain {
                chain_num: 3,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 5.8999999999999995,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[3],
            Chain {
                chain_num: 4,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Yellow,
                    AttributeChain {
                        strength: 8.0,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[4],
            Chain {
                chain_num: 5,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Blue,
                    AttributeChain {
                        strength: 9.4,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[5],
            Chain {
                chain_num: 6,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 12.419999999999998,
                            popped_count: 3,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Ojama,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[6],
            Chain {
                chain_num: 7,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 12.200000000000001,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[7],
            Chain {
                chain_num: 8,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 13.6,
                            popped_count: 3,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[8],
            Chain {
                chain_num: 9,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 15.0,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[9],
            Chain {
                chain_num: 10,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 16.400000000000002,
                            popped_count: 3,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Kata,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[10],
            Chain {
                chain_num: 11,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Blue,
                    AttributeChain {
                        strength: 17.800000000000004,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[11],
            Chain {
                chain_num: 12,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 19.2,
                        popped_count: 3,
                        separated_blocks_num: 1,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            },
        );
        assert_eq!(
            s1.chains[12],
            Chain {
                chain_num: 13,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 23.689999999999994,
                            popped_count: 3,
                            separated_blocks_num: 1,
                        },
                    ),
                    (
                        PuyoAttr::Ojama,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0,
                        },
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            s1.chains[13],
            Chain {
                chain_num: 14,
                simultaneous_num: 10,
                boost_count: 0,
                puyo_tsukai_count: 10,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 90.19999999999999,
                        popped_count: 10,
                        separated_blocks_num: 2,
                    },
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(s0.value, 108.99999999999999);
        assert_eq!(s0.popped_chance_num, 3);
        assert_eq!(s0.popped_heart_num, 1);
        assert_eq!(s0.popped_prism_num, 0);
        assert_eq!(s0.popped_ojama_num, 2);
        assert_eq!(s0.popped_kata_num, 1);
        assert_eq!(s0.is_all_cleared, false);
    }

    #[test]
    fn test_solve_all_traces_special_rule_2_1_preferring_prism_and_all_clear() {
        // Arrange
        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: Vec::from([
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::BiggerValue,
                PreferenceKind::ChancePop,
                PreferenceKind::SmallerTraceNum,
            ]),
            optimal_solution_count: 1,
            main_attr: Some(PuyoAttr::Blue),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::ToBlue,
            popping_leverage: 1.0,
            chain_leverage: 10.0,
        };
        let boost_area_coord_set: HashSet<PuyoCoord> = HashSet::new();
        let r = PuyoType::Red;
        let b = PuyoType::Blue;
        let g = PuyoType::Green;
        let y = PuyoType::Yellow;
        let p = PuyoType::Purple;
        let h = PuyoType::Heart;
        let w = PuyoType::Prism;
        let mut id_counter = 0;
        let field = [
            [y, p, r, g, y, g, b, g],
            [p, g, p, h, w, y, r, g],
            [p, p, b, b, y, b, g, r],
            [y, y, y, g, p, y, g, r],
            [g, g, p, r, g, p, b, r],
            [p, g, p, r, r, p, p, b],
        ]
        .map(|row| {
            row.map(|puyo_type| {
                id_counter += 1;
                Some(Puyo {
                    id: id_counter,
                    puyo_type,
                })
            })
        });
        let next_puyos = [b, b, b, b, b, b, b, b].map(|puyo_type| {
            id_counter += 1;
            Some(Puyo {
                id: id_counter,
                puyo_type,
            })
        });
        let explorer = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &boost_area_coord_set,
            &field,
            &next_puyos,
        );

        // Act
        let actual = explorer.solve_all_traces();

        // Arrange
        assert_eq!(actual.candidates_num, 15359);
        assert_eq!(actual.optimal_solutions.len(), 1);

        let solution = &actual.optimal_solutions[0];
        assert_eq!(
            solution.trace_coords,
            Vec::from([
                PuyoCoord { x: 0, y: 1 },
                PuyoCoord { x: 0, y: 2 },
                PuyoCoord { x: 1, y: 2 },
                PuyoCoord { x: 2, y: 1 },
                PuyoCoord { x: 3, y: 1 },
            ])
        );
        assert_eq!(solution.chains.len(), 12);
        assert_eq!(
            solution.chains[0],
            Chain {
                chain_num: 1,
                simultaneous_num: 8,
                boost_count: 0,
                puyo_tsukai_count: 8,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 1.6,
                            popped_count: 7,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 3.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[1],
            Chain {
                chain_num: 2,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Yellow,
                    AttributeChain {
                        strength: 5.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[2],
            Chain {
                chain_num: 3,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 8.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[3],
            Chain {
                chain_num: 4,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Purple,
                    AttributeChain {
                        strength: 11.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[4],
            Chain {
                chain_num: 5,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 13.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[5],
            Chain {
                chain_num: 6,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Purple,
                    AttributeChain {
                        strength: 15.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[6],
            Chain {
                chain_num: 7,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 17.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[7],
            Chain {
                chain_num: 8,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 19.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[8],
            Chain {
                chain_num: 9,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Blue,
                    AttributeChain {
                        strength: 21.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[9],
            Chain {
                chain_num: 10,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Yellow,
                    AttributeChain {
                        strength: 23.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            solution.chains[10],
            Chain {
                chain_num: 11,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 25.000000000000004,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: true,
            }
        );
        assert_eq!(
            solution.chains[11],
            Chain {
                chain_num: 12,
                simultaneous_num: 8,
                boost_count: 0,
                puyo_tsukai_count: 8,
                attributes: HashMap::from([(
                    PuyoAttr::Blue,
                    AttributeChain {
                        strength: 43.2,
                        popped_count: 8,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(solution.value, 68.80000000000001);
        assert_eq!(solution.popped_chance_num, 0);
        assert_eq!(solution.popped_heart_num, 0);
        assert_eq!(solution.popped_prism_num, 1);
        assert_eq!(solution.popped_ojama_num, 0);
        assert_eq!(solution.popped_kata_num, 0);
        assert_eq!(solution.is_all_cleared, true);
    }

    #[test]
    fn test_solve_all_traces_chance_mode_for_wild_preferring_all_clear() {
        // Arrange
        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: Vec::from([
                PreferenceKind::AllClear,
                PreferenceKind::BiggerValue,
                PreferenceKind::ChancePop,
                PreferenceKind::PrismPop,
                PreferenceKind::SmallerTraceNum,
            ]),
            optimal_solution_count: 2,
            main_attr: None,
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let environment = SimulationEnvironment {
            is_chance_mode: true,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 48,
            trace_mode: TraceMode::Normal,
            popping_leverage: 5.0,
            chain_leverage: 1.0,
        };
        let boost_area_coord_set: HashSet<PuyoCoord> = HashSet::new();
        let r = Some(PuyoType::Red);
        let b = Some(PuyoType::Blue);
        let g = Some(PuyoType::Green);
        let y = Some(PuyoType::Yellow);
        let p = Some(PuyoType::Purple);
        let e: Option<PuyoType> = None;
        let mut id_counter = 0;

        let field = [
            [p, b, e, g, g, g, e, e],
            [p, g, p, p, r, r, r, y],
            [g, p, g, b, p, b, y, b],
            [b, g, b, p, b, r, b, r],
            [y, b, y, b, r, p, r, r],
            [y, y, g, r, b, b, y, y],
        ]
        .map(|row| {
            row.map(|option| {
                if let Some(puyo_type) = option {
                    id_counter += 1;
                    return Some(Puyo {
                        id: id_counter,
                        puyo_type,
                    });
                } else {
                    return None;
                }
            })
        });
        let next_puyos: [Option<Puyo>; 8] = [None, None, None, None, None, None, None, None];
        let explorer = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &boost_area_coord_set,
            &field,
            &next_puyos,
        );

        // Act
        let actual = explorer.solve_all_traces();

        // Arrange
        assert_eq!(actual.candidates_num, 13507);
        assert_eq!(actual.optimal_solutions.len(), 2);
        assert_eq!(
            actual.optimal_solutions[0],
            SolutionResult {
                trace_coords: Vec::from([
                    PuyoCoord { x: 3, y: 2 },
                    PuyoCoord { x: 4, y: 3 },
                    PuyoCoord { x: 3, y: 4 },
                    PuyoCoord { x: 5, y: 4 },
                    PuyoCoord { x: 2, y: 5 },
                ]),
                chains: Vec::from([
                    Chain {
                        chain_num: 1,
                        simultaneous_num: 9,
                        boost_count: 0,
                        puyo_tsukai_count: 9,
                        attributes: HashMap::from([
                            (
                                PuyoAttr::Red,
                                AttributeChain {
                                    strength: 4.75,
                                    popped_count: 5,
                                    separated_blocks_num: 1
                                }
                            ),
                            (
                                PuyoAttr::Yellow,
                                AttributeChain {
                                    strength: 4.75,
                                    popped_count: 4,
                                    separated_blocks_num: 1
                                }
                            )
                        ]),
                        popped_chance_num: 0,
                        is_all_cleared: false,
                    },
                    Chain {
                        chain_num: 2,
                        simultaneous_num: 12,
                        boost_count: 0,
                        puyo_tsukai_count: 12,
                        attributes: HashMap::from([
                            (
                                PuyoAttr::Blue,
                                AttributeChain {
                                    strength: 9.799999999999999,
                                    popped_count: 5,
                                    separated_blocks_num: 1
                                }
                            ),
                            (
                                PuyoAttr::Purple,
                                AttributeChain {
                                    strength: 9.799999999999999,
                                    popped_count: 7,
                                    separated_blocks_num: 1
                                }
                            )
                        ]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 3,
                        simultaneous_num: 11,
                        boost_count: 0,
                        puyo_tsukai_count: 11,
                        attributes: HashMap::from([
                            (
                                PuyoAttr::Green,
                                AttributeChain {
                                    strength: 10.625,
                                    popped_count: 7,
                                    separated_blocks_num: 1
                                }
                            ),
                            (
                                PuyoAttr::Yellow,
                                AttributeChain {
                                    strength: 10.625,
                                    popped_count: 4,
                                    separated_blocks_num: 1
                                }
                            )
                        ]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 4,
                        simultaneous_num: 8,
                        boost_count: 0,
                        puyo_tsukai_count: 8,
                        attributes: HashMap::from([
                            (
                                PuyoAttr::Red,
                                AttributeChain {
                                    strength: 8.0,
                                    popped_count: 4,
                                    separated_blocks_num: 1
                                }
                            ),
                            (
                                PuyoAttr::Blue,
                                AttributeChain {
                                    strength: 8.0,
                                    popped_count: 4,
                                    separated_blocks_num: 1
                                }
                            )
                        ]),
                        popped_chance_num: 0,
                        is_all_cleared: true
                    }
                ]),
                value: 66.35,
                popped_chance_num: 0,
                popped_heart_num: 0,
                popped_prism_num: 0,
                popped_ojama_num: 0,
                popped_kata_num: 0,
                is_all_cleared: true,
            }
        );
        assert_eq!(
            actual.optimal_solutions[1],
            SolutionResult {
                trace_coords: Vec::from([
                    PuyoCoord { x: 4, y: 1 },
                    PuyoCoord { x: 3, y: 2 },
                    PuyoCoord { x: 4, y: 3 },
                    PuyoCoord { x: 3, y: 4 },
                    PuyoCoord { x: 4, y: 5 },
                ]),
                chains: Vec::from([
                    Chain {
                        chain_num: 1,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Purple,
                            AttributeChain {
                                strength: 1.0,
                                popped_count: 4,
                                separated_blocks_num: 1
                            }
                        )]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 2,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Red,
                            AttributeChain {
                                strength: 1.4,
                                popped_count: 4,
                                separated_blocks_num: 1
                            }
                        )]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 3,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Blue,
                            AttributeChain {
                                strength: 1.7,
                                popped_count: 4,
                                separated_blocks_num: 1
                            }
                        )]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 4,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Yellow,
                            AttributeChain {
                                strength: 2.0,
                                popped_count: 4,
                                separated_blocks_num: 1
                            }
                        )]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 5,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Red,
                            AttributeChain {
                                strength: 2.2,
                                popped_count: 4,
                                separated_blocks_num: 1,
                            }
                        )]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 6,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Green,
                            AttributeChain {
                                strength: 2.4,
                                popped_count: 4,
                                separated_blocks_num: 1,
                            },
                        )]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 7,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Yellow,
                            AttributeChain {
                                strength: 2.6,
                                popped_count: 4,
                                separated_blocks_num: 1,
                            },
                        ),]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 8,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Purple,
                            AttributeChain {
                                strength: 2.8,
                                popped_count: 4,
                                separated_blocks_num: 1,
                            },
                        )]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 9,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Green,
                            AttributeChain {
                                strength: 3.0,
                                popped_count: 4,
                                separated_blocks_num: 1,
                            },
                        ),]),
                        popped_chance_num: 0,
                        is_all_cleared: false
                    },
                    Chain {
                        chain_num: 10,
                        simultaneous_num: 4,
                        boost_count: 0,
                        puyo_tsukai_count: 4,
                        attributes: HashMap::from([(
                            PuyoAttr::Blue,
                            AttributeChain {
                                strength: 3.2,
                                popped_count: 4,
                                separated_blocks_num: 1,
                            },
                        ),]),
                        popped_chance_num: 0,
                        is_all_cleared: true
                    },
                ]),
                value: 22.3,
                popped_chance_num: 0,
                popped_heart_num: 0,
                popped_prism_num: 0,
                popped_ojama_num: 0,
                popped_kata_num: 0,
                is_all_cleared: true
            }
        );
    }

    #[test]
    fn test_solve_traces_with_prefix_partitions_exactly() {
        // Arrange
        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: Vec::from([
                PreferenceKind::BiggerValue,
                PreferenceKind::SmallerTraceNum,
            ]),
            optimal_solution_count: 1,
            main_attr: Some(PuyoAttr::Green),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 3,
            max_trace_num: 4,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 7.0,
        };
        let boost_area_coord_set: HashSet<PuyoCoord> = HashSet::new();
        let r = PuyoType::Red;
        let b = PuyoType::Blue;
        let g = PuyoType::Green;
        let y = PuyoType::Yellow;
        let p = PuyoType::Purple;
        let mut id_counter = 0;
        let field = [
            [r, p, b, p, y, g, y, y],
            [r, y, p, b, y, g, p, g],
            [b, y, g, b, r, y, g, p],
            [b, r, b, r, p, b, r, p],
            [y, g, p, p, r, b, g, g],
            [b, g, b, r, b, y, r, r],
        ]
        .map(|row| {
            row.map(|puyo_type| {
                id_counter += 1;
                Some(Puyo {
                    id: id_counter,
                    puyo_type,
                })
            })
        });
        let next_puyos = [g, g, g, g, g, g, g, g].map(|puyo_type| {
            id_counter += 1;
            Some(Puyo {
                id: id_counter,
                puyo_type,
            })
        });
        let explorer = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &boost_area_coord_set,
            &field,
            &next_puyos,
        );

        // Act & Assert: 各開始インデックスについて、深さ2カットの分割が
        // solve_traces_including_index と過不足なく一致すること。
        let mut total_whole: u64 = 0;
        let mut total_parts: u64 = 0;
        for i in 0..(PuyoCoord::X_NUM * PuyoCoord::Y_NUM) {
            let whole = explorer.solve_traces_including_index(i).unwrap();

            // 幹 [i] (再帰なし) + 各2セルプレフィックス [i, j] (再帰あり)
            let mut sum = explorer
                .solve_traces_with_prefix(&[i], false)
                .unwrap()
                .candidates_num;
            let ci = PuyoCoord::index_to_coord(i).unwrap();
            for nb in ci.adjacent_coords() {
                let j = nb.index();
                if j > i {
                    sum += explorer
                        .solve_traces_with_prefix(&[i, j], true)
                        .unwrap()
                        .candidates_num;
                }
            }
            assert_eq!(sum, whole.candidates_num, "index {} の分割が不一致", i);

            total_whole += whole.candidates_num;
            total_parts += sum;
        }
        // 全体としても一致 (max_trace_num=4 の総数 3435)
        assert_eq!(total_whole, 3435);
        assert_eq!(total_parts, 3435);
    }
}
