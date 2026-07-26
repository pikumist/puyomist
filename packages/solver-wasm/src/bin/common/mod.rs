//! 塗り探索の計測用バイナリで共有する小道具。

use solver::puyo::{Field, NextPuyos, Puyo};
use solver::puyo_attr::PuyoAttr;
use solver::puyo_type::PuyoType;

/// `--name value` 形式の引数を取り出す。
pub fn flag<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .map(|s| s.as_str())
}

/// 色名を属性に変換する。
pub fn parse_color(s: &str) -> Option<PuyoAttr> {
    match s.to_ascii_lowercase().as_str() {
        "red" | "r" => Some(PuyoAttr::Red),
        "blue" | "b" => Some(PuyoAttr::Blue),
        "green" | "g" => Some(PuyoAttr::Green),
        "yellow" | "y" => Some(PuyoAttr::Yellow),
        "purple" | "p" => Some(PuyoAttr::Purple),
        _ => None,
    }
}

/// 標準ベンチ盤面「なつアマ/1 (specialRule4/1)」。W=Prism, H=Heart。
/// `bench_natsuama` と同じ盤面・同じ id 採番。
pub fn natsuama_field() -> Field {
    let (r, b, g, y, p, h, w) = (
        PuyoType::Red,
        PuyoType::Blue,
        PuyoType::Green,
        PuyoType::Yellow,
        PuyoType::Purple,
        PuyoType::Heart,
        PuyoType::Prism,
    );
    let mut id = 0i32;
    [
        [b, g, y, r, b, r, p, r],
        [g, r, g, h, w, b, y, r],
        [g, g, p, p, b, p, r, y],
        [b, b, b, r, g, b, r, y],
        [r, r, g, y, r, g, p, y],
        [g, r, g, y, y, g, g, p],
    ]
    .map(|row| {
        row.map(|puyo_type| {
            id += 1;
            Some(Puyo { id, puyo_type })
        })
    })
}

/// 決定的な擬似乱数 (SplitMix64)。計測を再現可能にするため、時刻由来の乱数は使わない。
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Rng {
        Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15).wrapping_add(1))
    }

    pub fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// 0 以上 n 未満の一様乱数。
    pub fn below(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }
}

/// 通常盤面 (連鎖の仕込みが無いランダム盤面) の生成条件。
///
/// 実運用の申告に合わせた既定値:
///   - 色ぷよ5色を一様ランダム
///   - ハート 0〜3 個
///   - チャンスぷよ 0〜2 個
///   - プラスぷよ 0〜48 個
///   - プリズム / 固ぷよ / おじゃま は無し
pub struct RandomBoardSpec {
    pub max_heart: usize,
    pub max_chance: usize,
    pub max_plus: usize,
    /// 最低消し数。初期盤面にこの数以上の同色連結ができないよう棄却サンプリングする。
    pub minimum_puyo_num_for_popping: u32,
}

impl Default for RandomBoardSpec {
    fn default() -> Self {
        RandomBoardSpec {
            max_heart: 3,
            max_chance: 2,
            max_plus: 48,
            minimum_puyo_num_for_popping: 4,
        }
    }
}

/// 色ぷよの基本型 (Red/Blue/Green/Yellow/Purple)。
const BASE_COLORS: [PuyoType; 5] = [
    PuyoType::Red,
    PuyoType::Blue,
    PuyoType::Green,
    PuyoType::Yellow,
    PuyoType::Purple,
];

/// 盤面に、いきなり消える色ぷよの連結 (`minimum_puyo_num_for_popping` 個以上) があるか。
///
/// 実際のゲームの初期盤面には存在し得ない状態。塗りのハード制約 (塗り後に1つも消えない) も、
/// 初期盤面がこの状態でないことを前提にしている。
pub fn has_initial_pop(field: &Field, minimum_puyo_num_for_popping: u32) -> bool {
    use solver::paint::{bit, build_neighbor_masks, component_size_capped, CELL_NUM};
    use solver::puyo_type::get_attr;

    let masks = build_neighbor_masks();
    let limit = minimum_puyo_num_for_popping - 1;

    for color in [
        PuyoAttr::Red,
        PuyoAttr::Blue,
        PuyoAttr::Green,
        PuyoAttr::Yellow,
        PuyoAttr::Purple,
    ] {
        let mut board = 0u64;
        for index in 0..CELL_NUM {
            if let Some(p) = field[index / 8][index % 8] {
                if get_attr(p.puyo_type) == color {
                    board |= bit(index);
                }
            }
        }
        let mut remaining = board;
        while remaining != 0 {
            let seed = remaining.trailing_zeros() as usize;
            if component_size_capped(board, seed, &masks, limit) > limit {
                return true;
            }
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
    false
}

/// シードから通常盤面とネクストを生成する。同じシードなら必ず同じ盤面になる。
///
/// **初期盤面でいきなり消えることがないよう棄却サンプリングする**。実際のゲームの盤面は
/// 必ずこの条件を満たしており、完全ランダムだとほぼ確実に消える連結を含んでしまうため。
pub fn random_board(seed: u64, spec: &RandomBoardSpec) -> (Field, NextPuyos) {
    let (field, next_puyos, _) = random_board_with_attempts(seed, spec);
    (field, next_puyos)
}

/// [`random_board`] と同じだが、棄却サンプリングの試行回数も返す (棄却率の計測用)。
pub fn random_board_with_attempts(
    seed: u64,
    spec: &RandomBoardSpec,
) -> (Field, NextPuyos, u32) {
    let mut rng = Rng::new(seed);
    let mut attempts = 0u32;
    loop {
        attempts += 1;
        let (field, next_puyos) = generate_once(&mut rng, spec);
        if !has_initial_pop(&field, spec.minimum_puyo_num_for_popping) {
            return (field, next_puyos, attempts);
        }
        if attempts > 100_000 {
            panic!("初期盤面が消えない配置を生成できなかった (seed={})", seed);
        }
    }
}

fn generate_once(rng: &mut Rng, spec: &RandomBoardSpec) -> (Field, NextPuyos) {
    use num_traits::{FromPrimitive, ToPrimitive};

    let cell_num = 48usize;

    // 1. 全マスを色ぷよで埋める。
    let mut types: Vec<PuyoType> = (0..cell_num)
        .map(|_| BASE_COLORS[rng.below(5)])
        .collect();

    // 2. ハートを置く (色ぷよを上書き)。
    let heart_num = rng.below(spec.max_heart + 1);
    let mut heart_cells: Vec<usize> = Vec::new();
    while heart_cells.len() < heart_num {
        let c = rng.below(cell_num);
        if !heart_cells.contains(&c) {
            heart_cells.push(c);
            types[c] = PuyoType::Heart;
        }
    }

    // 3. 残った色ぷよにチャンス / プラスを付ける (両方付けば ChancePlus)。
    let colored: Vec<usize> = (0..cell_num)
        .filter(|&i| types[i] != PuyoType::Heart)
        .collect();

    let mut enhance = vec![0i32; cell_num]; // +1=プラス, +2=チャンス

    let chance_num = rng.below(spec.max_chance + 1).min(colored.len());
    let mut chance_cells: Vec<usize> = Vec::new();
    while chance_cells.len() < chance_num {
        let c = colored[rng.below(colored.len())];
        if !chance_cells.contains(&c) {
            chance_cells.push(c);
            enhance[c] += 2;
        }
    }

    let plus_num = rng.below(spec.max_plus + 1).min(colored.len());
    let mut plus_cells: Vec<usize> = Vec::new();
    while plus_cells.len() < plus_num {
        let c = colored[rng.below(colored.len())];
        if !plus_cells.contains(&c) {
            plus_cells.push(c);
            enhance[c] += 1;
        }
    }

    let mut id = 0i32;
    let mut field: Field = Default::default();
    for index in 0..cell_num {
        id += 1;
        let base = types[index];
        let puyo_type = if base == PuyoType::Heart {
            base
        } else {
            PuyoType::from_i32(base.to_i32().unwrap() + enhance[index]).unwrap()
        };
        field[index / 8][index % 8] = Some(Puyo { id, puyo_type });
    }

    // 4. ネクストも色ぷよをランダムに。
    let next_puyos: NextPuyos = [0u8; 8].map(|_| {
        id += 1;
        Some(Puyo {
            id,
            puyo_type: BASE_COLORS[rng.below(5)],
        })
    });

    (field, next_puyos)
}

/// 盤面を人が読める形で1行ずつ出力する (計測ログに残して再現性を確認するため)。
pub fn format_field(field: &Field) -> String {
    field
        .iter()
        .map(|row| {
            row.iter()
                .map(|c| match c.map(|p| p.puyo_type) {
                    None => "..".to_string(),
                    Some(t) => {
                        let attr = solver::puyo_type::get_attr(t);
                        let ch = match attr {
                            PuyoAttr::Red => 'R',
                            PuyoAttr::Blue => 'B',
                            PuyoAttr::Green => 'G',
                            PuyoAttr::Yellow => 'Y',
                            PuyoAttr::Purple => 'P',
                            PuyoAttr::Heart => 'H',
                            PuyoAttr::Prism => 'W',
                            PuyoAttr::Ojama => 'O',
                            PuyoAttr::Kata => 'K',
                            PuyoAttr::Question => '?',
                        };
                        let mark = match (
                            solver::puyo_type::is_plus_type(t),
                            solver::puyo_type::is_chance_type(t),
                        ) {
                            (true, true) => '*',
                            (true, false) => '+',
                            (false, true) => 'c',
                            (false, false) => ' ',
                        };
                        format!("{}{}", ch, mark)
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// なつアマ/1 のネクスト (紫 ×8)。id は盤面の続きから採番する。
pub fn natsuama_next_puyos() -> NextPuyos {
    let mut id = 48i32;
    [PuyoType::Purple; 8].map(|puyo_type| {
        id += 1;
        Some(Puyo { id, puyo_type })
    })
}

//
// ここから下は塗り探索の評価まわりの共有処理。
//

use solver::exploration_target::{ExplorationCategory, ExplorationTarget, PreferenceKind};
use solver::puyo_coord::PuyoCoord;
use solver::simulation_environment::SimulationEnvironment;
use solver::solution::SolutionResult;
use solver::simulator_bb::{UnknownFill, UnknownFillPolicy};
use solver::solution_explorer::{better_solution, SolutionExplorer};
use solver::trace_mode::TraceMode;
use std::collections::HashSet;

/// 探索の評価条件。塗り集合ごとに使い回す。
pub struct EvalConfig {
    pub category: ExplorationCategory,
    /// ダメージ/スキル溜めのときの主属性。ぷよ使いカウントでは使われない。
    pub main_attr: PuyoAttr,
    pub priorities: Vec<PreferenceKind>,
    pub boost_area: HashSet<PuyoCoord>,
    pub minimum_puyo_num_for_popping: u32,
}

impl EvalConfig {
    /// 盤面に対し、なぞり `max_trace_num` の全探索を掛けて最良解を返す。
    pub fn best_solution(
        &self,
        field: &Field,
        next_puyos: &NextPuyos,
        max_trace_num: u32,
    ) -> Option<SolutionResult> {
        self.best_solution_with(field, next_puyos, max_trace_num, None)
    }

    /// 不確定ぷよの扱いを指定して最良解を求める。`None` なら従来どおり補充しない。
    pub fn best_solution_with(
        &self,
        field: &Field,
        next_puyos: &NextPuyos,
        max_trace_num: u32,
        unknown_fill: Option<&UnknownFill>,
    ) -> Option<SolutionResult> {
        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: self.minimum_puyo_num_for_popping,
            max_trace_num,
            trace_mode: TraceMode::Normal,
            popping_leverage: 7.5,
            chain_leverage: 10.5,
        };
        let exploration_target = ExplorationTarget {
            category: self.category,
            preference_priorities: self.priorities.clone(),
            optimal_solution_count: 1,
            main_attr: match self.category {
                ExplorationCategory::PuyotsukaiCount => None,
                _ => Some(self.main_attr),
            },
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let explorer = SolutionExplorer::new(
            &exploration_target,
            &environment,
            &self.boost_area,
            field,
            next_puyos,
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

    /// 好みの優先度に従って、解の並びから最良解を選ぶ。
    pub fn pick_best<'a>(
        &self,
        solutions: impl Iterator<Item = &'a Option<SolutionResult>>,
    ) -> Option<&'a SolutionResult> {
        solutions.flatten().fold(None, |acc, s| match acc {
            None => Some(s),
            Some(a) => Some(better_solution(&self.priorities, a, s)),
        })
    }
}

/// 表示用のスカラー。解が無いときは 0。
pub fn value_of(solution: &Option<SolutionResult>) -> f64 {
    solution.as_ref().map(|s| s.value).unwrap_or(0.0)
}

/// 好みの名前を [`PreferenceKind`] に変換する。
pub fn parse_preference(s: &str) -> PreferenceKind {
    match s {
        "chance" => PreferenceKind::ChancePop,
        "value" => PreferenceKind::BiggerValue,
        "prism" => PreferenceKind::PrismPop,
        "allclear" => PreferenceKind::AllClear,
        "tracenum" => PreferenceKind::SmallerTraceNum,
        "heart" => PreferenceKind::HeartPop,
        "ojama" => PreferenceKind::OjamaPop,
        other => panic!(
            "未知の優先度: {} (chance|value|prism|allclear|tracenum|heart|ojama)",
            other
        ),
    }
}

/// 実運用に近い既定の優先度: チャンス → 値が大きい → プリズム → 全消し → なぞり数が少ない。
pub fn default_priorities() -> Vec<PreferenceKind> {
    vec![
        PreferenceKind::ChancePop,
        PreferenceKind::BiggerValue,
        PreferenceKind::PrismPop,
        PreferenceKind::AllClear,
        PreferenceKind::SmallerTraceNum,
    ]
}

/// `--category` の値を [`ExplorationCategory`] に変換する。
pub fn parse_category(s: &str) -> ExplorationCategory {
    match s {
        "damage" => ExplorationCategory::Damage,
        "skill" => ExplorationCategory::SkillPuyoCount,
        "tsukai" | "puyotsukai" => ExplorationCategory::PuyotsukaiCount,
        other => panic!("未知の --category: {} (damage|skill|tsukai)", other),
    }
}

/// `--boost` の値をブーストエリアに変換する。`all` は全面。
pub fn parse_boost_area(s: &str) -> HashSet<PuyoCoord> {
    match s {
        "none" => HashSet::new(),
        "all" => (0..48u8).filter_map(PuyoCoord::index_to_coord).collect(),
        other => panic!("未知の --boost: {} (none|all)", other),
    }
}

/// モンテカルロ用に、シードから不確定ぷよの色割り当てを1サンプル作る。
pub fn make_unknown_fill(seed: u64, policy: UnknownFillPolicy, max_refills: u32) -> UnknownFill {
    UnknownFill {
        policy,
        seed: (seed + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15),
        max_refills,
    }
}

/// `--unknown` の値を [`UnknownFillPolicy`] に変換する。
pub fn parse_unknown_policy(s: &str) -> UnknownFillPolicy {
    match s {
        "inert" => UnknownFillPolicy::Inert,
        "averse" | "chainaverse" => UnknownFillPolicy::ChainAverse,
        "random" => UnknownFillPolicy::Random,
        other => panic!("未知の --unknown: {} (inert|averse|random)", other),
    }
}
