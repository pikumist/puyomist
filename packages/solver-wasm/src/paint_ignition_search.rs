//! 塗り発火探索の探索器。
//!
//! 評価と比較は [`crate::paint_ignition`] にある。ここは「どの塗り集合を評価するか」だけを扱う。
//!
//! ## 厳密列挙は真値の基準にしか使えない
//!
//! 塗り発火探索のハード制約 (塗ったら発火すること) は**上方閉**なので、
//! 「違反したら枝ごと捨てる」という既存の塗り探索 ([`crate::paint_search`]) の枝刈りが
//! 一切効かない (`docs/research/paint-ignition-search.md` §4)。48マス・上限10マスだと
//! 約87億通りあり、全数列挙は現実的でない。
//!
//! そこで設計メモ §8-1 のとおり、厳密列挙は**小規模問題の真値を出すため**に使う:
//!
//! - 塗れるマスを12〜18程度に絞った盤面で、上限いっぱいまで全列挙する
//! - あるいは通常の48マス盤面でも、塗り上限を1〜3に落として全列挙する
//!
//! 実運用の探索 (ビームサーチ) とは**独立に実装**し、突き合わせて使うこと。
//!
//! ## 上方閉には前提がある
//!
//! 「発火する塗り集合に1マス足しても必ず発火する」(§4) が成り立つのは、
//! **初期盤面に消える連結が1つも無い場合だけ**。設計メモ §4 の論証は「塗り色は増える一方で
//! 減らない」としか言っておらず、**他色の群が塗りで割れる**経路を見落としている。
//!
//! ```text
//! 初期盤面に緑の4連結があり (= 塗らなくても消える)、塗り色は赤とする。
//!   S  = {ある赤塗り}          → 緑4連結がそのまま消えるので発火 ✅
//!   S' = S + {緑4連結の1マス}  → 緑が3個になり、赤も4連結しないので発火しない ❌
//! ```
//!
//! 実際のゲームの初期盤面にその状態は存在しない ([`crate::paint_ignition::IgnitionEvaluator::evaluate`]
//! の doc を参照) ので実害は無いが、**ビームサーチで「発火したら打ち切る」ような枝刈りを
//! 入れるならこの前提が要る**。厳密列挙は枝刈りをしないので前提なしで正しい。

use std::collections::{HashMap, HashSet};

use crate::exploration_target::PreferenceKind;
use crate::exploration_target::ExplorationTarget;
use crate::paint_search::UncertaintyParams;
use crate::paint::{bit, build_neighbor_masks, Bits, CELL_NUM, PaintFilter};
use crate::puyo::{Field, NextPuyos};
use crate::puyo_attr::PuyoAttr;
use crate::puyo_coord::PuyoCoord;
use crate::simulation_environment::SimulationEnvironment;
use crate::solution::SolutionResult;
use crate::paint_ignition::{
    better_ignition, IgnitionComparator, IgnitionEvaluator, IgnitionSetup, IgnitionSolution,
};
use crate::simulator_bb::ChainSignature;

/// 厳密列挙の結果。
#[derive(Debug)]
pub struct ExhaustiveResult {
    /// 列挙した塗り集合の数 (空集合は数えない)。
    pub enumerated: u64,
    /// そのうち発火したものの数。
    pub ignited: u64,
    /// 塗り数ごとの最良解。添字が塗り数で、長さは `max_paint_num + 1`。
    /// `[0]` は常に `None` (空集合は列挙しない)。
    ///
    /// 評価値は塗り数に対して単調とは限らない (設計メモ §4) ので、
    /// この配列は「増やせば良くなる」かどうかを実測するための材料でもある。
    pub best_by_paint_num: Vec<Option<IgnitionSolution>>,
    /// 全体の最良解。1つも発火しなければ `None`。
    pub best: Option<IgnitionSolution>,
}

/// `candidate_num` マスから `max_paint_num` マスまで選ぶ、空でない組み合わせの総数。
///
/// 全列挙に踏み切ってよい規模かを呼び出し側が判断するために使う。
/// 48マス・上限10マスだと約87億になる。
pub fn paint_set_count(candidate_num: usize, max_paint_num: usize) -> u128 {
    let mut total: u128 = 0;
    let mut combinations: u128 = 1; // C(n, 0)
    for k in 1..=max_paint_num.min(candidate_num) {
        combinations = combinations * (candidate_num - k + 1) as u128 / k as u128;
        total += combinations;
    }
    total
}

/// 空でない塗り集合をすべて列挙し、1件ごとに `visit` を呼ぶ。
///
/// 評価から切り離してあるのは、**列挙そのものをテストから総当たりと突き合わせる**ため。
/// テスト側に DFS を写して検査すると、写した方しか検証できない。
///
/// `visit` には塗るマスのインデックス列が渡される (昇順・呼び出し中のみ有効)。
/// 空集合は列挙しない。「何も塗らない」は塗り案ではないし、
/// [`IgnitionEvaluator::evaluate`] は初期盤面が既に消える状態なら空集合でも発火扱いにするので、
/// 塗り数最小として選ばれてしまうのを避ける意味もある。
pub fn for_each_paint_set<F: FnMut(&[usize])>(
    candidates: &[usize],
    max_paint_num: usize,
    visit: &mut F,
) {
    let mut stack: Vec<usize> = Vec::with_capacity(max_paint_num);
    dfs(candidates, max_paint_num, 0, &mut stack, visit);
}

fn dfs<F: FnMut(&[usize])>(
    candidates: &[usize],
    max_paint_num: usize,
    start: usize,
    stack: &mut Vec<usize>,
    visit: &mut F,
) {
    if stack.len() >= max_paint_num {
        return;
    }
    for j in start..candidates.len() {
        stack.push(candidates[j]);
        visit(stack);
        dfs(candidates, max_paint_num, j + 1, stack, visit);
        stack.pop();
    }
}

/// 空でない塗り集合をすべて列挙して評価し、最良解を返す。
///
/// 比較の優先順位は `evaluator` が握る [`crate::exploration_target::ExplorationTarget`] から取る。
/// 別経路で渡せるようにすると、設計メモ §8-2 の「選抜にも同じ優先順位を使う」を
/// 呼び出し側が破れてしまうため。
pub fn enumerate_exhaustive(
    candidates: &[usize],
    max_paint_num: usize,
    evaluator: &IgnitionEvaluator,
) -> ExhaustiveResult {
    let mut result = ExhaustiveResult {
        enumerated: 0,
        ignited: 0,
        best_by_paint_num: (0..=max_paint_num).map(|_| None).collect(),
        best: None,
    };
    let preference_priorities = evaluator.preference_priorities();
    for_each_paint_set(candidates, max_paint_num, &mut |paint_set| {
        result.enumerated += 1;
        if let Some(solution) = evaluator.evaluate(paint_set) {
            result.ignited += 1;
            let size = paint_set.len();
            keep_better(
                &mut result.best_by_paint_num[size],
                &solution,
                preference_priorities,
            );
            keep_better(&mut result.best, &solution, preference_priorities);
        }
    });
    result
}

/// `slot` と `candidate` の良い方を `slot` に残す。
fn keep_better(
    slot: &mut Option<IgnitionSolution>,
    candidate: &IgnitionSolution,
    preference_priorities: &Vec<PreferenceKind>,
) {
    let replace = match slot {
        None => true,
        Some(current) => {
            std::ptr::eq(better_ignition(preference_priorities, candidate, current), candidate)
        }
    };
    if replace {
        *slot = Some(candidate.clone());
    }
}

//
// ここからビームサーチ。
//

/// 重複排除のキー (設計メモ §7 の対策案を実測で比べるための切り替え)。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DedupMode {
    /// 塗りマスクだけで重複を落とす。既存の塗り探索 ([`crate::paint_search::expand_beam`])
    /// と同じ。A→B と B→A は潰せるが、**連鎖に一切関与しない「埋め草」マスの置き方だけが
    /// 違う解**は別物として残ってしまう。
    Mask,
    /// 発火した集合は**連鎖の消え方の指紋**で、未発火の集合は塗りマスクで重複を落とす。
    /// 同じ連鎖を生む集合が1本に潰れる。
    ///
    /// **設計メモ §7 は「その中で塗り数最小が残る」と書いているが、この実装ではそうならない。**
    /// 重複排除は深さごとにリセットする (同じ深さの候補しか同じキーに集まらない) ので、
    /// 同じキーの候補は全員ちょうど同じ塗り数になり、[`better_ignition`] の最終段
    /// (`SmallerTraceNum` = 塗り数) では決して差が付かない。実際に残るのは
    /// **同じ連鎖を生む中で評価値が最良のもの**。「同値なら塗り数最小」を実現しているのは
    /// `keep_better` が全深さを通して最良解を畳み込む側であって、重複排除ではない。
    Signature,
}

impl DedupMode {
    pub fn name(self) -> &'static str {
        match self {
            DedupMode::Mask => "mask",
            DedupMode::Signature => "signature",
        }
    }

    pub fn parse(s: &str) -> Option<DedupMode> {
        match s {
            "mask" => Some(DedupMode::Mask),
            "signature" | "sig" => Some(DedupMode::Signature),
            _ => None,
        }
    }
}

/// ビームサーチのパラメータ。
///
/// `dedup` / `stop_on_ignition` / `unignited_reserve` は設計メモ §7 が挙げた3つの
/// 対策案にそのまま対応する。**3案とも実測で却下された** (§9-2 / §9-3) ので、
/// 既定値はどれも「対策を入れない」側。ノブは計測用バイナリのために残してある。
#[derive(Debug, Clone)]
pub struct BeamParams {
    /// 塗れるマス数の上限。
    pub max_paint_num: usize,
    /// ビーム幅。
    pub beam_width: usize,
    /// 重複排除のキー。
    pub dedup: DedupMode,
    /// 発火した集合をそれ以上展開しない (§7 案2)。
    /// 「もう1マス足して連鎖が伸びる」案を捨てるので、取りこぼしの実測が要る。
    pub stop_on_ignition: bool,
    /// 未発火の集合の並べ方 (§9-1)。
    pub surrogate: SurrogateMode,
    /// 未発火の集合のために取っておくビーム枠 (§7 案3「多様性の枠取り」)。
    /// 0 だと、発火率が上がる深さでビームが発火済みで埋まり、
    /// 「まだ発火しないが伸ばすと大きい」前段が残らなくなる。
    ///
    /// `beam_width` 以上にすると**ビームから発火済みが完全に消える**
    /// (未発火を先に詰めるため)。計測で極端な設定を入れるときは承知の上で。
    pub unignited_reserve: usize,
}

impl BeamParams {
    /// 実測で決めた既定値 (設計メモ §9-5)。小規模問題・幅100・2000盤面で:
    ///
    /// - 重複排除は**マスクのみ**。結果シグネチャは症状 (ビームが同じ連鎖で埋まる) を
    ///   完全に消すのに、到達率は 42.6% → 36.9% に落ちる
    /// - 発火後の打ち切りは到達率 45.2% → 0.0%
    /// - 未発火の並べ方は [`SurrogateMode::CriticalSeeds`]。どちらの規模でも悪くならず、
    ///   未発火に枠を与えたときは小規模で 45.9% → 48.1%
    /// - 未発火のための枠取りは**しない**。小規模では50%が最良だが、
    ///   実運用サイズ (候補38.6・上限10) では増やすほど悪くなる (§9-1)
    pub fn new(max_paint_num: usize, beam_width: usize) -> BeamParams {
        BeamParams {
            max_paint_num,
            beam_width,
            dedup: DedupMode::Mask,
            surrogate: SurrogateMode::CriticalSeeds,
            stop_on_ignition: false,
            unignited_reserve: 0,
        }
    }
}

/// 深さ1段ぶんのビームの中身。
///
/// 設計メモ §7 の「深さが進むほどビームの中身が『同じ連鎖 + 違う埋め草』で埋まる」を
/// 実測するための計測値。`distinct_chains / ignited_kept` が1に近いほど、
/// ビームが**違う連鎖**で埋まっている。
#[derive(Debug, Clone, Copy)]
pub struct BeamDepthStats {
    pub depth: usize,
    /// この深さで評価した塗り集合の数。
    pub evaluated: usize,
    /// ビームに残した本数。
    pub kept: usize,
    /// そのうち発火しているものの本数。
    pub ignited_kept: usize,
    /// 残した発火済みの本数のうち、連鎖の消え方が異なるものの数。
    pub distinct_chains: usize,
}

/// ビームサーチの結果。
#[derive(Debug)]
pub struct BeamResult {
    /// 評価した塗り集合の数 (同じ深さで同じ塗りマスクは1回だけ)。
    pub evaluated: u64,
    /// そのうち発火したものの数。
    pub ignited: u64,
    /// 深さごとのビームの中身。
    pub depth_stats: Vec<BeamDepthStats>,
    /// 塗り数ごとの最良解。添字が塗り数で、長さは `max_paint_num + 1`。
    ///
    /// [`BeamParams::stop_on_ignition`] を立てた場合、これは「その塗り数の最良」ではなく
    /// **「打ち切りの下で見つかった最良」**になる (発火済みを展開しないので、
    /// 大きい塗り数の欄が実際より悪くなるか `None` になる)。
    pub best_by_paint_num: Vec<Option<IgnitionSolution>>,
    /// 全体の最良解。
    pub best: Option<IgnitionSolution>,
}

/// ビーム1本。
#[derive(Clone)]
struct BeamNode {
    /// 塗ったマス (昇順)。
    cells: Vec<usize>,
    /// 塗ったマスのビットマスク (`paint.rs` のインデックス系)。
    mask: Bits,
    /// 発火していればその解。
    solution: Option<IgnitionSolution>,
    /// 未発火のときの並べ替えスコア ([`surrogate_score`])。大きいほど良い。
    surrogate: u32,
    /// 連鎖の消え方の指紋。未発火なら既定値 (すべてゼロ)。
    signature: ChainSignature,
}

/// 未発火の塗り集合を並べるスコアの決め方 (設計メモ §9-1)。
///
/// 発火した集合は評価値で並べられるが、探索の序盤はほとんどが未発火なので、
/// ここで何を使うかが効く。設計メモはここを決めていなかったので、実測で選ぶ。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SurrogateMode {
    /// 最初に入れた仮置き。**塗り色の最大連結成分 → 塗り色の塊の総数**の辞書順。
    ///
    /// 第1キーが飽和していて解像度が無いことが実測で分かっている (§9-1)。
    /// 最大連結成分は盤面全体を見るので、初期盤面にすでに `max_component` の塊があれば
    /// 深さ0の時点から全候補で定数になる (通常盤面の42.4%が該当)。
    /// 深さ1では候補33.7個が相異なるスコア3.5通りにしか分かれない。
    LargestComponent,
    /// **「あと1個で消える連結成分」の個数 → 塗り色の塊の総数**の辞書順。
    ///
    /// 飽和せず、「発火直前の種がいくつあるか」= 多連鎖の見込みを直接数える。
    /// [`SurrogateMode::LargestComponent`] は1つの大きい塊を作る方向に誘導するが、
    /// 大きい連鎖は離れた場所の塊を順に巻き込む必要がある (§9-4) ので向きが逆になる。
    CriticalSeeds,
}

impl SurrogateMode {
    pub fn name(self) -> &'static str {
        match self {
            SurrogateMode::LargestComponent => "largest",
            SurrogateMode::CriticalSeeds => "critical",
        }
    }

    pub fn parse(s: &str) -> Option<SurrogateMode> {
        match s {
            "largest" => Some(SurrogateMode::LargestComponent),
            "critical" => Some(SurrogateMode::CriticalSeeds),
            _ => None,
        }
    }
}

/// 未発火の塗り集合を並べるスコア。大きいほど良い。
///
/// `board` は塗り後の塗り色のビットボード (`paint.rs` のインデックス系)、
/// `max_component` は `最低消し数 - 1` (= これを超えると発火する)。
pub fn surrogate_score(
    mode: SurrogateMode,
    board: Bits,
    masks: &[Bits; CELL_NUM],
    max_component: u32,
) -> u32 {
    let mut largest = 0u32;
    let mut critical = 0u32;
    let mut clustered = 0u32;
    let mut remaining = board;
    while remaining != 0 {
        let seed = remaining.trailing_zeros() as usize;
        // 連結成分を広げる。
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
        let size = component.count_ones();
        if size > largest {
            largest = size;
        }
        if size >= max_component {
            // 未発火なので size > max_component はありえない (= ちょうど「あと1個」)。
            critical += 1;
        }
        if size >= 2 {
            clustered += size;
        }
        remaining &= !component;
    }
    // 第2キー (塗り色の塊の総数) は最大48なので6ビット。そこで桁を分ける。
    let first = match mode {
        // 最大連結成分は max_component を超えないので頭打ちにする。
        SurrogateMode::LargestComponent => largest.min(max_component),
        SurrogateMode::CriticalSeeds => critical,
    };
    first * 64 + clustered.min(63)
}

/// ビーム1本の並べ替え。良い方が `Less` (先頭に来る)。
///
/// 発火済みを未発火より常に優先する。同じ発火状態の中では、発火済みは [`better_ignition`]、
/// 未発火は代理スコアで比べる。最後は塗りマスクで決着するので**全順序**になる
/// (`sort_by` に渡すので、ここが全順序でないと並びが不定になるか実行時にパニックする)。
fn node_cmp(
    preference_priorities: &Vec<PreferenceKind>,
    a: &BeamNode,
    b: &BeamNode,
) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    if a.mask == b.mask {
        return Ordering::Equal;
    }
    match (&a.solution, &b.solution) {
        (Some(sa), Some(sb)) => {
            if std::ptr::eq(better_ignition(preference_priorities, sa, sb), sa) {
                Ordering::Less
            } else {
                Ordering::Greater
            }
        }
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        // 見込みが大きい順 → 塗り数が少ない順 (§1 の「同値なら塗り数最小」と揃える)
        // → マスクの小さい順。
        (None, None) => b
            .surrogate
            .cmp(&a.surrogate)
            .then(a.cells.len().cmp(&b.cells.len()))
            .then(a.mask.cmp(&b.mask)),
    }
}

/// ビームサーチで塗り発火の解を探す。
///
/// 上方閉なので制約による枝刈りが効かない (§4)。深さごとに全候補へ1マス伸ばし、
/// 評価して上位だけ残す。評価は連鎖シミュレーション1回ぶんなので軽い (§1)。
pub fn search_beam(
    setup: &IgnitionSetup,
    evaluator: &IgnitionEvaluator,
    params: &BeamParams,
) -> BeamResult {
    let preference_priorities = evaluator.preference_priorities();
    let masks = build_neighbor_masks();
    let max_component = evaluator.minimum_puyo_num_for_popping() - 1;

    let mut result = BeamResult {
        evaluated: 0,
        ignited: 0,
        depth_stats: Vec::with_capacity(params.max_paint_num),
        best_by_paint_num: (0..=params.max_paint_num).map(|_| None).collect(),
        best: None,
    };

    // 深さ0 は空集合1本。空集合そのものは評価しない (塗り案ではない)。
    let mut beam: Vec<BeamNode> = vec![BeamNode {
        cells: Vec::new(),
        mask: 0,
        solution: None,
        surrogate: 0,
        signature: ChainSignature::default(),
    }];

    for depth in 1..=params.max_paint_num {
        // 同じ深さで一度でも作った塗りマスクは二度と作らない (A→B と B→A を潰す)。
        let mut seen_masks: HashSet<Bits> = HashSet::new();
        // 重複排除後に残す代表。キーは dedup の指定による。
        let mut representatives: Vec<BeamNode> = Vec::new();
        let mut by_key: HashMap<DedupKey, usize> = HashMap::new();
        let mut evaluated_here = 0usize;

        for node in &beam {
            if params.stop_on_ignition && node.solution.is_some() {
                continue;
            }
            for &index in &setup.candidates {
                let index_bit = bit(index);
                if node.mask & index_bit != 0 {
                    continue;
                }
                let next_mask = node.mask | index_bit;
                if !seen_masks.insert(next_mask) {
                    continue;
                }
                // 並べ替えはしない。`cells` の順序に依存する場所が1つも無いため
                // (`evaluate_with_signature` は自前で正規化する。`mask` と `len()` は順序非依存)。
                let mut cells = node.cells.clone();
                cells.push(index);

                let (solution, signature) = evaluator.evaluate_with_signature(&cells);
                result.evaluated += 1;
                evaluated_here += 1;
                if let Some(s) = &solution {
                    result.ignited += 1;
                    keep_better(&mut result.best_by_paint_num[depth], s, preference_priorities);
                    keep_better(&mut result.best, s, preference_priorities);
                }

                let surrogate = if solution.is_some() {
                    0
                } else {
                    surrogate_score(
                        params.surrogate,
                        setup.base_board | next_mask,
                        &masks,
                        max_component,
                    )
                };
                let candidate = BeamNode {
                    cells,
                    mask: next_mask,
                    solution,
                    surrogate,
                    signature,
                };

                let key = match (params.dedup, &candidate.solution) {
                    // 未発火は指紋が空なので、指紋モードでもマスクで区別する。
                    (DedupMode::Mask, _) | (DedupMode::Signature, None) => {
                        DedupKey::Mask(next_mask)
                    }
                    (DedupMode::Signature, Some(_)) => DedupKey::Signature(signature),
                };
                // キーが衝突するのは指紋モードで発火済みのときだけ
                // (マスクモードのキーは塗りマスクそのものなので、上の `seen_masks` が
                // 先に弾く)。
                //
                // **指紋が一致しても評価値は一致するとは限らない。** 指紋は消えたマスと
                // その順序しか持たず、消えたマスの「色」を持たない。塗ったマスが違えば、
                // 同じマスが消えても色の構成が変わって評価値が変わる。
                // 実測 (テスト盤面・深さ3) では、2件以上が集まった指紋グループ123個のうち
                // **6個で評価値が混ざる** (最大差1.12)。だからここは順序固定ではなく、
                // 本当に「良い方を残す」比較として要る。
                match by_key.get(&key) {
                    None => {
                        by_key.insert(key, representatives.len());
                        representatives.push(candidate);
                    }
                    Some(&at) => {
                        if node_cmp(preference_priorities, &candidate, &representatives[at])
                            == std::cmp::Ordering::Less
                        {
                            representatives[at] = candidate;
                        }
                    }
                }
            }
        }

        if representatives.is_empty() {
            break;
        }

        beam = select_beam(representatives, params, preference_priorities);

        let ignited_kept = beam.iter().filter(|n| n.solution.is_some()).count();
        let distinct_chains: HashSet<ChainSignature> = beam
            .iter()
            .filter(|n| n.solution.is_some())
            .map(|n| n.signature)
            .collect();
        result.depth_stats.push(BeamDepthStats {
            depth,
            evaluated: evaluated_here,
            kept: beam.len(),
            ignited_kept,
            distinct_chains: distinct_chains.len(),
        });
    }

    result
}

/// 重複排除の方式に応じたキー。
#[derive(PartialEq, Eq, Hash)]
enum DedupKey {
    Mask(Bits),
    Signature(ChainSignature),
}

/// ビーム幅まで絞る。`unignited_reserve` の枠だけ未発火の集合を必ず残す
/// (設計メモ §7 案3「多様性の枠取り」)。
fn select_beam(
    mut nodes: Vec<BeamNode>,
    params: &BeamParams,
    preference_priorities: &Vec<PreferenceKind>,
) -> Vec<BeamNode> {
    nodes.sort_by(|a, b| node_cmp(preference_priorities, a, b));
    if nodes.len() <= params.beam_width {
        return nodes;
    }

    let reserve = params.unignited_reserve.min(params.beam_width);
    let main = params.beam_width - reserve;

    let mut pool: Vec<Option<BeamNode>> = nodes.into_iter().map(Some).collect();
    let mut selected: Vec<BeamNode> = Vec::with_capacity(params.beam_width);

    // 1. 並び順の上位から `main` 本。
    for slot in pool.iter_mut() {
        if selected.len() >= main {
            break;
        }
        selected.push(slot.take().expect("先頭から順に取るので空にはならない"));
    }
    // 2. 残った枠は未発火を優先して埋める。
    for slot in pool.iter_mut() {
        if selected.len() >= params.beam_width {
            break;
        }
        if slot.as_ref().is_none_or(|n| n.solution.is_some()) {
            continue;
        }
        selected.push(slot.take().expect("直前で Some を確かめている"));
    }
    // 3. それでも余る枠は並び順で埋める。
    for slot in pool.iter_mut() {
        if selected.len() >= params.beam_width {
            break;
        }
        if let Some(node) = slot.take() {
            selected.push(node);
        }
    }
    selected
}

//
// ここから発火コアの列挙 (設計メモ §9-6)。
//

/// 発火コア = 「これだけ塗れば必ず発火する」最小限の塗り集合。
///
/// **任意の有効解は、`最低消し数` 以下のサイズの発火コアを部分集合として含む。**
///
/// 証明: 初期盤面に発火が無いとする。塗り集合 `S` が発火するなら、塗り後の盤面に
/// 塗り色の連結成分でサイズが `最低消し数` 以上のものがある。そこから連結した
/// `最低消し数` マスの領域 `H` を1つ取り、`A = H \ base` (元から塗り色だったマスを除く)
/// とおくと `A ⊆ S` かつ `|A| ≤ 最低消し数`。そして `A` だけを塗れば塗り色は
/// `base ∪ A ⊇ H` になり、`H` が連結しているので必ず発火する。∎
///
/// したがって**盤面の連結 `最低消し数` マス領域を全列挙すれば、発火の起点を
/// 取りこぼしなく網羅できる**。8×6盤面の連結4マス領域は553通りしかない。
///
/// これは却下した [`PaintFilter::Adj1`] などとは性質が違う (§9-4)。あちらは初期の塗り色の
/// 近傍に閉じ込めるヒューリスティックで取りこぼしがあったが、こちらは**元の塗り色が
/// 1個も無い場所の起点も含み、取りこぼしが原理的に無い**。
///
/// **ビームの種としては効かない** (§9-6 の実測で +0.0〜+2.3ポイント)。
/// [`search_ils`] の再始動プールとして使うこと。
///
/// 返すのは昇順のインデックス列で、マスクで重複排除済み。順序は決定的。
pub fn ignition_cores(setup: &IgnitionSetup, minimum_puyo_num_for_popping: u32) -> Vec<Vec<usize>> {
    let masks = build_neighbor_masks();
    let size = minimum_puyo_num_for_popping as usize;
    let candidates: Bits = setup
        .candidates
        .iter()
        .fold(0, |acc, &index| acc | bit(index));
    // 塗り色として数えてよいマス = 元から塗り色 + 塗れる候補。
    let usable = setup.base_board | candidates;

    let mut seen: HashSet<Bits> = HashSet::new();
    let mut cores: Vec<Vec<usize>> = Vec::new();
    let mut region_seen: HashSet<Bits> = HashSet::new();

    // 連結 `size` マス領域を全列挙する。最小インデックスを起点にすることで、
    // 同じ領域を (順番違いで) 何度も作っても最後に重複排除できる規模に収まる。
    for start in 0..CELL_NUM {
        if usable & bit(start) == 0 {
            continue;
        }
        let mut stack: Vec<(Bits, usize)> = vec![(bit(start), 1)];
        while let Some((region, count)) = stack.pop() {
            if count == size {
                if !region_seen.insert(region) {
                    continue;
                }
                // 塗る必要があるマス。空なら初期盤面がすでに発火している (前提違反)。
                let core_mask = region & !setup.base_board;
                if core_mask == 0 {
                    continue;
                }
                if core_mask.count_ones() as usize > setup.max_paint_num {
                    continue;
                }
                if seen.insert(core_mask) {
                    let mut cells: Vec<usize> = Vec::new();
                    let mut m = core_mask;
                    while m != 0 {
                        cells.push(m.trailing_zeros() as usize);
                        m &= m - 1;
                    }
                    cores.push(cells);
                }
                continue;
            }
            // 領域の隣接マスのうち、起点より大きいインデックスだけを足す。
            let mut frontier: Bits = 0;
            let mut r = region;
            while r != 0 {
                let i = r.trailing_zeros() as usize;
                r &= r - 1;
                frontier |= masks[i];
            }
            frontier &= usable & !region;
            // 起点より小さいインデックスを禁じる (同じ領域を起点ごとに1回だけ作るため)。
            frontier &= !((bit(start) << 1) - 1);
            while frontier != 0 {
                let i = frontier.trailing_zeros() as usize;
                frontier &= frontier - 1;
                stack.push((region | bit(i), count + 1));
            }
        }
    }

    cores.sort_by_key(|cells| cells.iter().fold(0u64, |acc, &i| acc | bit(i)));
    cores
}

//
// ここから反復局所探索 (ILS)。設計メモ §9-7 / §9-8。
//

/// 探索精度。**評価回数**（≒所要時間）で切る。
///
/// 既存の塗り探索の `PaintPrecision` はビーム幅で切っていたが、局所探索には幅が無いので
/// 計算量そのものである評価回数で切る。**バックエンドをまたいで同じマッピングにすること**
/// （同じ精度を選べば wasm でもネイティブでも同じ結果が出る。評価は決定論的で、
/// ハードウェア PEXT の有無は速度にしか効かない）。
///
/// 実測（実運用サイズ = 全候補・上限10、200盤面 ×2区画、基準は ILS を seed 違い4本で
/// 50万評価ずつ回した和集合。ネイティブ1スレッド）:
///
/// | 精度 | 評価回数 | ネイティブ | 値/基準 | 基準と一致 |
/// |---|---|---|---|---|
/// | `Standard` | 16万 | 約0.6秒 | 0.956 / 0.960 | 62.0% / 64.0% |
/// | `High` | 50万 | 約2.0秒 | 0.981 / 0.983 | 83.0% / 83.5% |
/// | `Ultra` | 150万 | 約6.8秒 | 0.995 / 0.998 | 96.5% / 98.5% |
///
/// **上の所要時間はネイティブ1スレッド。wasm の実時間はまだ測っていない。**
/// `solver-optimization.md` の 4.30×〜4.50× は「ハードウェア PEXT の有無」の差で、
/// wasm にはさらに wasm 固有のオーバーヘッドが乗るので、掛け算した
/// 2.7秒 / 9秒 / 30秒 は**下限**であって見積りではない。
/// `Ultra` を wasm で選ばせるかどうかは実測してから決めること
/// (暫定では既存の `PaintPrecision::Ultra` と同じく選ばせない扱い)。
///
/// 再始動は互いに独立なので、シードを変えて複数ワーカーで走らせ
/// [`merge_ignition_results`] で畳み込めばそのまま並列化になる。
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde_repr::Serialize_repr, serde_repr::Deserialize_repr)]
#[repr(u8)]
pub enum IgnitionPrecision {
    /// 標準。既定。
    Standard = 0,
    /// 高精度。
    High = 1,
    /// 超高精度。wasm では所要時間が現実的でないため選択肢に出さないこと。
    Ultra = 2,
}

impl IgnitionPrecision {
    /// 評価回数の予算。
    pub fn budget(self) -> u64 {
        match self {
            IgnitionPrecision::Standard => 160_000,
            IgnitionPrecision::High => 500_000,
            IgnitionPrecision::Ultra => 1_500_000,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            IgnitionPrecision::Standard => "standard",
            IgnitionPrecision::High => "high",
            IgnitionPrecision::Ultra => "ultra",
        }
    }

    pub fn parse(s: &str) -> Option<IgnitionPrecision> {
        match s {
            "standard" | "std" => Some(IgnitionPrecision::Standard),
            "high" => Some(IgnitionPrecision::High),
            "ultra" => Some(IgnitionPrecision::Ultra),
            _ => None,
        }
    }
}

/// 反復局所探索のパラメータ。
///
/// **予算は「幅」ではなく「評価回数」で切る** (§9-7)。そうしないとビームと公平に比べられない。
///
/// **塗れるマス数の上限は [`IgnitionSetup::max_paint_num`] から取る。** ここに別途持たせると
/// 候補の作り方と探索で食い違い、上限を超えた解が返る (実際にそうなっていた)。
#[derive(Debug, Clone)]
pub struct IlsParams {
    /// 連鎖シミュレーションを呼べる回数の上限。これが計算量そのもの。
    pub budget: u64,
    /// 局所最適から揺さぶる (kick) のを、改善しないまま何回まで続けるか。
    /// 超えたら次の再始動へ移る。実測ではここは鈍感 (20/50/200 で ±2ポイント)。
    pub kick_cap: u32,
    /// 1回の kick で入れ替えるマス数。
    pub kick_strength: usize,
    /// 保持する上位解の件数。**最終選抜を期待値で並べ替えるための母集団**になる
    /// (設計メモ §9-10)。0 なら保持しない。
    pub result_num: usize,
    /// 乱数のシード。同じシードなら完全に同じ結果になる。
    pub seed: u64,
}

impl IlsParams {
    /// 精度プリセットから作る。実運用の入口はこちら。
    pub fn from_precision(precision: IgnitionPrecision) -> IlsParams {
        IlsParams::new(precision.budget())
    }

    /// 実測にもとづく既定値 (設計メモ §9-8)。
    pub fn new(budget: u64) -> IlsParams {
        IlsParams {
            budget,
            kick_cap: 20,
            kick_strength: 2,
            result_num: 20,
            seed: 1,
        }
    }
}

/// 探索中に見つけた良い解を上位 `limit` 件だけ保持する。
///
/// 期待値による最終選抜 (設計メモ §9-10) の母集団になる。探索の内側で毎回呼ばれるので、
/// **満杯かつ最下位より悪い候補は1回の比較で弾く**。
struct TopK {
    limit: usize,
    /// 良い順。
    items: Vec<IgnitionSolution>,
    /// 同じ塗り集合を二度入れないための索引。
    masks: HashSet<Bits>,
}

impl TopK {
    fn new(limit: usize) -> TopK {
        TopK {
            limit,
            items: Vec::with_capacity(limit),
            masks: HashSet::new(),
        }
    }

    fn offer(&mut self, cmp: &IgnitionComparator, candidate: &IgnitionSolution) {
        if self.limit == 0 || self.masks.contains(&candidate.mask) {
            return;
        }
        if self.items.len() == self.limit {
            let worst = self.items.last().expect("満杯なので必ずある");
            if !std::ptr::eq(cmp.better(candidate, worst), candidate) {
                return;
            }
        }
        let at = self
            .items
            .iter()
            .position(|item| std::ptr::eq(cmp.better(candidate, item), candidate))
            .unwrap_or(self.items.len());
        self.items.insert(at, candidate.clone());
        self.masks.insert(candidate.mask);
        if self.items.len() > self.limit {
            let dropped = self.items.pop().expect("溢れたので必ずある");
            self.masks.remove(&dropped.mask);
        }
    }
}

/// 反復局所探索の結果。
#[derive(Debug)]
pub struct IlsResult {
    /// 実際に呼んだ連鎖シミュレーションの回数 (キャッシュに当たった分は数えない)。
    pub evaluated: u64,
    /// 再始動した回数。**設計どおり動いているかの目印**。
    /// 1 で止まっていたら、局所最適から抜けられずに同じ起点を掘り続けている。
    pub restarts: u64,
    /// kick した回数。
    pub kicks: u64,
    /// 再始動プール (発火コア) の件数。
    pub cores: usize,
    /// 塗り数ごとの最良解。添字が塗り数で、長さは `max_paint_num + 1`。
    pub best_by_paint_num: Vec<Option<IgnitionSolution>>,
    /// 全体の最良解。[`Self::top`] の先頭と同じ。
    pub best: Option<IgnitionSolution>,
    /// 探索中に見つけた上位解 (良い順、塗り集合で重複排除済み)。
    /// **期待値による最終選抜の母集団** (設計メモ §9-10)。
    pub top: Vec<IgnitionSolution>,
}

/// 決定的な擬似乱数 (SplitMix64)。
///
/// `Rng::new` で seed を撹拌してから状態にすること。状態更新が `+G` の等差なので、
/// seed をそのまま状態にすると連続した seed の乱数列が1個ずれただけの同じ列になる
/// (計測用の盤面生成器で実際に踏んだ。docs/research/paint-ignition-search.md §9-0)。
struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Rng {
        let mut z = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        Rng(z ^ (z >> 31))
    }

    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// 0 以上 n 未満。
    fn below(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }

    fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            items.swap(i, self.below(i + 1));
        }
    }
}

/// 塗りマスク (u64) をキーにするための軽いハッシュ。
///
/// 既定の SipHash は u64 キーには重く、局所探索では**1歩あたり数百回**引くので
/// ここが支配的になる。マスクは既にビットが散っているので、乗算1回で足りる。
#[derive(Default, Clone, Copy)]
struct MaskHasher(u64);

impl std::hash::Hasher for MaskHasher {
    fn finish(&self) -> u64 {
        self.0
    }

    fn write(&mut self, bytes: &[u8]) {
        for &b in bytes {
            self.0 = (self.0 ^ b as u64).wrapping_mul(0x0100_0000_01B3);
        }
    }

    fn write_u64(&mut self, value: u64) {
        // fibonacci hashing。上位ビットに情報を集める。
        self.0 = value.wrapping_mul(0x9E37_79B9_7F4A_7C15);
        self.0 ^= self.0 >> 29;
    }
}

#[derive(Default, Clone, Copy)]
struct MaskHasherBuilder;

impl std::hash::BuildHasher for MaskHasherBuilder {
    type Hasher = MaskHasher;
    fn build_hasher(&self) -> MaskHasher {
        MaskHasher(0)
    }
}

/// 近傍の手。
#[derive(Clone, Copy)]
enum Move {
    /// 候補マスを1つ足す。
    Add(usize),
    /// いま塗っているマスを1つ外す。
    Remove(usize),
    /// 塗っているマスを候補マスに入れ替える。**ビームに欠けていた修正操作** (§9-7)。
    Swap { out_cell: usize, in_cell: usize },
}

/// 予算つきの評価器。同じ塗りマスクを二度シミュレートしない。
///
/// キャッシュに当たった分は予算を消費しない。「評価回数」はビームの `evaluated` と
/// 同じ意味 (同じ集合を二度評価しない) になるので、そのまま比べられる。
struct BudgetedEvaluator<'a, 'b> {
    evaluator: &'a IgnitionEvaluator<'b>,
    cache: HashMap<Bits, Option<IgnitionSolution>, MaskHasherBuilder>,
    remaining: u64,
    evaluated: u64,
}

impl<'a, 'b> BudgetedEvaluator<'a, 'b> {
    /// 予算が尽きていれば `None` を返す (「未発火」の `Some(None)` とは区別する)。
    fn evaluate(&mut self, cells: &[usize]) -> Option<&Option<IgnitionSolution>> {
        let mask = IgnitionSetup::mask_of(cells);
        if !self.cache.contains_key(&mask) {
            if self.remaining == 0 {
                return None;
            }
            self.remaining -= 1;
            self.evaluated += 1;
            let solution = self.evaluator.evaluate(cells);
            self.cache.insert(mask, solution);
        }
        self.cache.get(&mask)
    }

    fn exhausted(&self) -> bool {
        self.remaining == 0
    }
}

/// 反復局所探索で塗り発火の解を探す (設計メモ §9-7 / §9-8)。
///
/// ビームが「足すだけ・深さで層を切る」ために早い深さの誤りを修正できないのに対し、
/// こちらは**完成した解を入替で直す**。同じ評価回数で到達率が大きく上回る
/// (小規模・3,400評価で 43.9% → 78.8%)。
///
/// 再始動の起点は [`ignition_cores`]。初手から全部が有効解になる。
pub fn search_ils(
    setup: &IgnitionSetup,
    evaluator: &IgnitionEvaluator,
    params: &IlsParams,
) -> IlsResult {
    // 比較は解決済みコンパレータで行う。1歩あたり数百回比較するので、
    // 優先度のテーブル引きが支配的になる。
    let cmp = IgnitionComparator::new(evaluator.preference_priorities());
    let max_paint_num = setup.max_paint_num;
    let mut result = IlsResult {
        evaluated: 0,
        restarts: 0,
        kicks: 0,
        cores: 0,
        best_by_paint_num: (0..=max_paint_num).map(|_| None).collect(),
        best: None,
        top: Vec::new(),
    };
    let mut top = TopK::new(params.result_num);
    if setup.candidates.is_empty() || max_paint_num == 0 {
        return result;
    }

    let mut budgeted = BudgetedEvaluator {
        evaluator,
        cache: HashMap::with_hasher(MaskHasherBuilder),
        remaining: params.budget,
        evaluated: 0,
    };
    let mut rng = Rng::new(params.seed);

    // 再始動プール: 発火コアを値の良い順に。
    let cores = ignition_cores(setup, evaluator.minimum_puyo_num_for_popping());
    let mut scored: Vec<(Vec<usize>, Option<IgnitionSolution>)> = Vec::with_capacity(cores.len());
    for core in cores {
        let Some(solution) = budgeted.evaluate(&core).cloned() else {
            break; // 予算切れ
        };
        record(&mut result, &mut top, &solution, &cmp);
        scored.push((core, solution));
    }
    // 良い順。解が無いものは後ろへ。同点はマスクで固定する。
    scored.sort_by(|a, b| match (&a.1, &b.1) {
        (Some(sa), Some(sb)) => {
            if std::ptr::eq(cmp.better(sa, sb), sa) {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
        }
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });
    result.cores = scored.len();

    // コアを一周しても予算が余っていたら、もう一周する (kick の乱数が違うので別の道を辿る)。
    // 一周まるごと予算を1回も使わなかったら、もう掘る場所が無いので打ち切る。
    while !budgeted.exhausted() {
        let before = budgeted.evaluated;
        for (core, _) in &scored {
            if budgeted.exhausted() {
                break;
            }
            result.restarts += 1;

            let mut current = core.clone();
            climb(
                setup,
                &mut budgeted,
                &mut rng,
                &cmp,
                &mut current,
                &mut result,
                &mut top,
            );

            // 局所最適から揺さぶる。改善しない kick が続いたら次の再始動へ。
            let mut stale = 0u32;
            while stale < params.kick_cap && !budgeted.exhausted() {
                let Some(mut kicked) = kick(setup, &mut budgeted, &mut rng, params, &current)
                else {
                    break;
                };
                result.kicks += 1;
                climb(
                    setup,
                    &mut budgeted,
                    &mut rng,
                    &cmp,
                    &mut kicked,
                    &mut result,
                    &mut top,
                );
                if is_better(&mut budgeted, &cmp, &kicked, &current) {
                    current = kicked;
                    stale = 0;
                } else {
                    stale += 1;
                }
            }
        }
        if budgeted.evaluated == before {
            break;
        }
    }

    result.evaluated = budgeted.evaluated;
    result.top = top.items;
    result
}

/// first-improvement の山登り。良くなる手が見つかった瞬間に移動する。
///
/// best-improvement (近傍を全部見てから一番良い手に進む) より**明確に良い** (§9-8)。
/// 予算が評価回数で決まっているとき、1歩あたりの評価が少ない方が歩数を稼げる。
fn climb(
    setup: &IgnitionSetup,
    budgeted: &mut BudgetedEvaluator,
    rng: &mut Rng,
    cmp: &IgnitionComparator,
    current: &mut Vec<usize>,
    result: &mut IlsResult,
    top: &mut TopK,
) {
    let mut moves: Vec<Move> = Vec::new();
    let mut next: Vec<usize> = Vec::new();
    loop {
        // 現在地の評価は**1歩につき1回**だけ取る。手ごとに取り直すと、
        // キャッシュに当たっても解の複製が毎回走って定数倍が10倍近く悪化する。
        let Some(current_solution) = budgeted.evaluate(current).cloned().flatten() else {
            return;
        };
        // 現在地そのものも記録する。kick が返した解は他のどこでも記録されないので、
        // ここを落とすと「探索が見た最良を返す」が崩れる。
        record(result, top, &Some(current_solution.clone()), cmp);

        neighbourhood(setup, current, &mut moves);
        rng.shuffle(&mut moves);

        let mut improved = false;
        // `moves` は読むだけなので、確保を使い回したまま借りられる。
        for &m in moves.iter() {
            if budgeted.exhausted() {
                return;
            }
            apply_into(current, m, &mut next);
            let Some(slot) = budgeted.evaluate(&next) else {
                return;
            };
            let Some(solution) = slot else {
                continue; // 未発火はハード制約違反なので動かない
            };
            let better = std::ptr::eq(cmp.better(solution, &current_solution), solution);
            // 最良解の更新は、移動するかどうかとは別に毎回行う
            // (局所最適の手前で通り過ぎた解も拾う)。
            cmp.keep_better(&mut result.best, solution);
            let size = solution.paint_set.len();
            if size < result.best_by_paint_num.len() {
                cmp.keep_better(&mut result.best_by_paint_num[size], solution);
            }
            top.offer(cmp, solution);
            if better {
                std::mem::swap(current, &mut next);
                improved = true;
                break;
            }
        }
        if !improved {
            return; // 局所最適
        }
    }
}

/// 局所最適から抜け出すための揺さぶり。`kick_strength` 個のマスを入れ替える。
/// 発火しない結果は採らない (何度か引き直す)。
fn kick(
    setup: &IgnitionSetup,
    budgeted: &mut BudgetedEvaluator,
    rng: &mut Rng,
    params: &IlsParams,
    current: &[usize],
) -> Option<Vec<usize>> {
    for _ in 0..8 {
        if budgeted.exhausted() {
            return None;
        }
        let mut next = current.to_vec();
        for _ in 0..params.kick_strength {
            if next.is_empty() {
                break;
            }
            let out_at = rng.below(next.len());
            let in_cell = setup.candidates[rng.below(setup.candidates.len())];
            if next.contains(&in_cell) {
                continue;
            }
            next[out_at] = in_cell;
        }
        next.sort_unstable();
        next.dedup();
        match budgeted.evaluate(&next) {
            None => return None,
            Some(Some(_)) => return Some(next),
            Some(None) => continue, // 未発火。引き直す
        }
    }
    None
}

/// 近傍の手を列挙する。追加 / 削除 / 入替 (§9-7)。
fn neighbourhood(setup: &IgnitionSetup, current: &[usize], out: &mut Vec<Move>) {
    let mask = IgnitionSetup::mask_of(current);
    out.clear();
    if current.len() < setup.max_paint_num {
        out.extend(
            setup
                .candidates
                .iter()
                .filter(|&&c| mask & bit(c) == 0)
                .map(|&c| Move::Add(c)),
        );
    }
    if current.len() > 1 {
        out.extend(current.iter().map(|&c| Move::Remove(c)));
    }
    for &out_cell in current {
        for &in_cell in &setup.candidates {
            if mask & bit(in_cell) == 0 {
                out.push(Move::Swap { out_cell, in_cell });
            }
        }
    }
}

/// 手を当てた結果を `next` に書く。確保を使い回すための形。
fn apply_into(current: &[usize], m: Move, next: &mut Vec<usize>) {
    next.clear();
    match m {
        Move::Add(c) => {
            next.extend_from_slice(current);
            next.push(c);
        }
        Move::Remove(c) => next.extend(current.iter().copied().filter(|&x| x != c)),
        Move::Swap { out_cell, in_cell } => next.extend(
            current
                .iter()
                .copied()
                .map(|x| if x == out_cell { in_cell } else { x }),
        ),
    }
    next.sort_unstable();
}

/// `a` が `b` より良いか。どちらも発火している必要がある。
fn is_better(
    budgeted: &mut BudgetedEvaluator,
    cmp: &IgnitionComparator,
    a: &[usize],
    b: &[usize],
) -> bool {
    let Some(sa) = budgeted.evaluate(a).cloned().flatten() else {
        return false;
    };
    let Some(sb) = budgeted.evaluate(b).cloned().flatten() else {
        return true;
    };
    // **同じ集合は改善ではない。** `cmp.better` は同値のときマスクで決着するので、
    // 同じ集合の別クローンを渡すと必ず第1引数が返る (= 改善と誤判定する)。
    // これを落とすと kick の `stale` が毎回リセットされ、再始動が一度も進まなくなる。
    if sa.mask == sb.mask {
        return false;
    }
    std::ptr::eq(cmp.better(&sa, &sb), &sa)
}

/// 見つけた解を結果に畳み込む。
fn record(
    result: &mut IlsResult,
    top: &mut TopK,
    solution: &Option<IgnitionSolution>,
    cmp: &IgnitionComparator,
) {
    let Some(s) = solution else { return };
    let size = s.paint_set.len();
    if size < result.best_by_paint_num.len() {
        cmp.keep_better(&mut result.best_by_paint_num[size], s);
    }
    cmp.keep_better(&mut result.best, s);
    top.offer(cmp, s);
}

//
// ここから実運用の入口。wasm / ネイティブの両方から呼ぶ。
//

/// 塗り発火探索のパラメータ (JS から渡ってくる形)。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IgnitionSearchParams {
    /// 塗り色。色ぷよ以外を渡すと探索は成立しない。
    pub target: PuyoAttr,
    /// 塗れるマス数の上限。実運用では 8 か 10。
    pub max_paint_num: u32,
    /// 候補マスの絞り込み方。**既定の [`PaintFilter::All`] から変えないこと**
    /// (設計メモ §9-4。`adj2` で到達率が 42.6% → 31.3% に落ちる)。
    pub filter: PaintFilter,
    /// 探索精度。評価回数はここから導く。**実運用で使うのはこちら**。
    pub precision: IgnitionPrecision,
    /// 評価回数を直接指定して [`Self::precision`] を上書きする。**計測とテスト用**。
    /// 実運用では `None` のままにして、精度プリセットで切ること
    /// (バックエンドをまたいで同じマッピングにする約束のため)。
    #[serde(default)]
    pub budget: Option<u64>,
    /// 返す塗り案の件数。期待値で並べ替えるときの母集団にもなる。
    #[serde(default = "default_result_num")]
    pub result_num: u32,
    /// 不確定ぷよ (ネクストより先に降ってくるぷよ) を考慮した並べ替え。
    ///
    /// **探索そのものは決定論のまま**で、最後の並べ替えだけこれを使う (設計メモ §9-10)。
    /// 実測では順位が変わるのは12〜15%の盤面、変わったときの改善は1.05〜1.08倍なので、
    /// 探索の内側に入れるほどの効き幅は無い。
    #[serde(default)]
    pub uncertainty: Option<UncertaintyParams>,
    /// 乱数のシード。**再始動は独立なので、シードを変えて複数回走らせて
    /// [`merge_ignition_results`] でまとめれば、そのまま並列化になる**。
    pub seed: u64,
}

fn default_result_num() -> u32 {
    20
}

impl IgnitionSearchParams {
    pub fn new(target: PuyoAttr, max_paint_num: u32) -> IgnitionSearchParams {
        IgnitionSearchParams {
            target,
            max_paint_num,
            filter: PaintFilter::All,
            precision: IgnitionPrecision::Standard,
            budget: None,
            result_num: default_result_num(),
            uncertainty: None,
            seed: 1,
        }
    }
}

/// 塗り案1件。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IgnitionPlan {
    /// 塗るマス。
    pub coords: Vec<PuyoCoord>,
    /// 決定論評価の値。
    pub value: f64,
    /// 不確定ぷよを考慮した期待値。[`IgnitionSearchParams::uncertainty`] を
    /// 指定したときだけ入る。
    ///
    /// なぞりが無いので**期待値は1通りに定まる**。既存の塗り探索のように
    /// 「補充を見てからなぞりを選べる前提の値」と「選び直せない前提の値」に
    /// 分かれない (設計メモ §9-10)。
    pub expected_value: Option<f64>,
    /// 塗った瞬間に起きる連鎖。
    pub solution: SolutionResult,
}

/// 塗り発火探索の結果。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IgnitionSearchResult {
    /// 最良の塗り案。[`Self::plans`] の先頭と同じ。発火する塗り方が無ければ `None`。
    pub best: Option<IgnitionPlan>,
    /// 良い順の塗り案。`uncertainty` を指定したときは**期待値で並べ替えてある**。
    pub plans: Vec<IgnitionPlan>,
    /// 塗り数ごとの最良。添字が塗り数。
    /// 「3マスで済ませたい」といった選び方を UI で出すため。
    pub by_paint_num: Vec<Option<IgnitionPlan>>,
    /// 実際に呼んだ連鎖シミュレーションの回数。
    pub evaluated: u64,
    /// 再始動した回数と、再始動プール (発火コア) の件数。
    /// `restarts` が 1 で止まっていたら局所最適から抜けられていない (設計メモ §9-8)。
    pub restarts: u64,
    pub cores: usize,
}

/// 塗り発火探索を1回走らせる。
///
/// 塗り色が色ぷよでなければ `None`。
pub fn search_ignition(
    exploration_target: &ExplorationTarget,
    environment: &SimulationEnvironment,
    boost_area_coord_set: &HashSet<PuyoCoord>,
    field: &Field,
    next_puyos: &NextPuyos,
    params: &IgnitionSearchParams,
) -> Option<IgnitionSearchResult> {
    let evaluator = IgnitionEvaluator::new(
        exploration_target,
        environment,
        boost_area_coord_set,
        field,
        next_puyos,
        params.target,
    )?;
    let setup = IgnitionSetup::new(
        field,
        next_puyos,
        environment,
        params.target,
        params.max_paint_num as usize,
        params.filter,
    );
    let result = search_ils(
        &setup,
        &evaluator,
        &IlsParams {
            seed: params.seed,
            budget: params.budget.unwrap_or_else(|| params.precision.budget()),
            result_num: params.result_num as usize,
            ..IlsParams::from_precision(params.precision)
        },
    );

    // 不確定ぷよを考慮するなら、**ここでだけ**期待値を計算する。
    // 探索の内側では使わない (設計メモ §9-10)。
    let fills = params
        .uncertainty
        .as_ref()
        .map(crate::paint_search::make_unknown_fills)
        .unwrap_or_default();

    let to_plan = |solution: &IgnitionSolution| {
        let expected_value = if fills.is_empty() {
            None
        } else {
            evaluator
                .evaluate_expected(&solution.paint_set, &fills)
                .map(|(_, expected)| expected)
        };
        IgnitionPlan {
            coords: solution.result.trace_coords.clone(),
            value: solution.result.value,
            expected_value,
            solution: SolutionResult {
                // 返す解にだけ連鎖をフル構築する。
                chains: evaluator.chains(&solution.paint_set),
                ..solution.result.clone()
            },
        }
    };

    let mut plans: Vec<IgnitionPlan> = result.top.iter().map(&to_plan).collect();
    sort_plans(&exploration_target.preference_priorities, &mut plans);
    plans.truncate(params.result_num as usize);

    Some(IgnitionSearchResult {
        best: plans.first().cloned(),
        plans,
        by_paint_num: result
            .best_by_paint_num
            .iter()
            .map(|s| s.as_ref().map(&to_plan))
            .collect(),
        evaluated: result.evaluated,
        restarts: result.restarts,
        cores: result.cores,
    })
}

/// 塗り案を良い順に並べる。
///
/// 期待値があるときはそれを第一キーにする (設計メモ §9-10)。
/// 既存の塗り探索の `build_plans` と同じ作法で、NaN は順序を壊すので比較に使わない。
pub fn sort_plans(preference_priorities: &[PreferenceKind], plans: &mut [IgnitionPlan]) {
    let fns = crate::solution_explorer::resolve_better_fns(preference_priorities);
    plans.sort_by(|a, b| {
        if let (Some(x), Some(y)) = (a.expected_value, b.expected_value) {
            if x.is_finite() && y.is_finite() && x != y {
                return y.partial_cmp(&x).expect("有限なので比較できる");
            }
        }
        // `better_solution_with_fns` は完全同点のとき第1引数を返すので、
        // そのまま使うと反対称性が壊れて `sort_by` がパニックしうる。両方向を見る。
        let a_wins = std::ptr::eq(
            crate::solution_explorer::better_solution_with_fns(&fns, &a.solution, &b.solution),
            &a.solution,
        );
        let b_wins = std::ptr::eq(
            crate::solution_explorer::better_solution_with_fns(&fns, &b.solution, &a.solution),
            &b.solution,
        );
        match (a_wins, b_wins) {
            (true, true) => std::cmp::Ordering::Equal,
            (true, false) => std::cmp::Ordering::Less,
            _ => std::cmp::Ordering::Greater,
        }
    });
}

/// 複数回の探索結果をまとめる。**並列化の合流点**。
///
/// シードを変えた探索をワーカーごとに走らせ、戻ってきた結果をこれで畳み込む。
/// 比較は探索中とまったく同じ優先順位を使う (設計メモ §8-2)。
pub fn merge_ignition_results(
    preference_priorities: &[PreferenceKind],
    results: &[IgnitionSearchResult],
) -> Option<IgnitionSearchResult> {
    let fns = crate::solution_explorer::resolve_better_fns(preference_priorities);
    // 塗り案の比較。同値のときは塗り数が少ない方 → 座標列の小さい方で順序を固定する。
    let better = |a: &IgnitionPlan, b: &IgnitionPlan| -> bool {
        let forward = crate::solution_explorer::better_solution_with_fns(
            &fns,
            &a.solution,
            &b.solution,
        );
        if std::ptr::eq(forward, &b.solution) {
            return false;
        }
        let backward = crate::solution_explorer::better_solution_with_fns(
            &fns,
            &b.solution,
            &a.solution,
        );
        if std::ptr::eq(backward, &a.solution) {
            return true;
        }
        // 優先順位の上では同値。座標列で決着させる (結果を一意にするため)。
        let key = |p: &IgnitionPlan| -> Vec<u8> { p.coords.iter().map(|c| c.index()).collect() };
        key(a) <= key(b)
    };

    let mut merged: Option<IgnitionSearchResult> = None;
    for result in results {
        let Some(current) = merged.as_mut() else {
            merged = Some(result.clone());
            continue;
        };
        current.evaluated += result.evaluated;
        current.restarts += result.restarts;
        current.cores = current.cores.max(result.cores);
        // 塗り案は全部まとめてから並べ直す (件数は呼び出し側で切る)。
        for plan in &result.plans {
            if !current
                .plans
                .iter()
                .any(|p| p.coords == plan.coords)
            {
                current.plans.push(plan.clone());
            }
        }
        if current.by_paint_num.len() < result.by_paint_num.len() {
            current
                .by_paint_num
                .resize(result.by_paint_num.len(), None);
        }
        for (slot, candidate) in current.by_paint_num.iter_mut().zip(&result.by_paint_num) {
            let Some(candidate) = candidate else { continue };
            let replace = match slot {
                None => true,
                Some(best) => better(candidate, best),
            };
            if replace {
                *slot = Some(candidate.clone());
            }
        }
    }
    if let Some(current) = merged.as_mut() {
        sort_plans(preference_priorities, &mut current.plans);
        current.best = current.plans.first().cloned();
    }
    merged
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::exploration_target::{ExplorationCategory, ExplorationTarget};
    use crate::paint::PaintFilter;
    use crate::paint_ignition::{IgnitionSetup, DEFAULT_IGNITION_PREFERENCES};
    use crate::puyo::{Field, NextPuyos, Puyo};
    use crate::puyo_attr::PuyoAttr;
    use crate::puyo_coord::PuyoCoord;
    use crate::puyo_type::PuyoType;
    use crate::simulation_environment::SimulationEnvironment;
    use crate::simulator_bb::ChainSignature;
    use crate::trace_mode::TraceMode;
    use std::collections::{HashMap, HashSet};

    /// 連鎖の仕込みが無い盤面 ([`crate::paint_ignition`] のテストと同じもの)。
    fn plain_field() -> Field {
        let (r, b, g, y, p, h) = (
            PuyoType::Red,
            PuyoType::Blue,
            PuyoType::Green,
            PuyoType::Yellow,
            PuyoType::Purple,
            PuyoType::Heart,
        );
        let mut id = 0i32;
        [
            [b, g, y, r, b, r, p, r],
            [g, r, g, h, p, b, y, r],
            [g, g, p, p, b, p, r, y],
            [b, b, y, r, g, b, r, y],
            [r, r, g, y, r, g, p, y],
            [g, r, g, y, b, g, g, p],
        ]
        .map(|row| {
            row.map(|puyo_type| {
                id += 1;
                Some(Puyo { id, puyo_type })
            })
        })
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
            popping_leverage: 7.5,
            chain_leverage: 10.5,
        }
    }

    fn damage_target() -> ExplorationTarget {
        ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: DEFAULT_IGNITION_PREFERENCES.to_vec(),
            optimal_solution_count: 1,
            main_attr: Some(PuyoAttr::Red),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        }
    }

    /// 全数列挙を回すための小規模問題 (候補を14マスに絞る)。
    /// 候補を絞るのは 2^n の総当たりと突き合わせるためで、性質の検査には
    /// [`full_problem`] の全候補を使うこと (絞ると反例を含まない部分集合になりうる)。
    fn small_problem() -> (Field, NextPuyos, SimulationEnvironment, Vec<usize>) {
        let (field, next, env, candidates) = full_problem();
        (field, next, env, candidates.into_iter().take(14).collect())
    }

    /// 絞り込みなしの候補 (赤・36マス)。
    fn full_problem() -> (Field, NextPuyos, SimulationEnvironment, Vec<usize>) {
        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 4, PaintFilter::All);
        (field, next, env, setup.candidates)
    }

    #[test]
    fn paint_set_count_matches_binomial_sum() {
        // C(5,1)+C(5,2) = 5+10
        assert_eq!(paint_set_count(5, 2), 15);
        // C(5,1..5) = 2^5 - 1
        assert_eq!(paint_set_count(5, 5), 31);
        // 上限が候補数を超えても全部分集合で頭打ち。
        assert_eq!(paint_set_count(5, 9), 31);
        assert_eq!(paint_set_count(0, 10), 0);
        // 設計メモ §2 の「48マスから10マスで約87億」(空集合を除いた数)。
        assert_eq!(paint_set_count(48, 10), 8_682_997_470);
        // §8-1 の「上限3なら全数列挙できる」規模。
        assert_eq!(paint_set_count(48, 3), 18_472);
    }

    /// **本番の列挙** ([`for_each_paint_set`]) が、ビットマスク総当たりと
    /// 同じ集合の集まりをちょうど1回ずつ返すこと。
    /// 列挙器は探索方式と独立に正しさを担保する必要がある (設計メモ §8-1)。
    #[test]
    fn enumeration_matches_bitmask_brute_force() {
        let (field, next, env, candidates) = small_problem();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();
        let max_paint_num = 4usize;
        let n = candidates.len();
        assert!(n < 32, "総当たりが u32 のビットマスクなので候補は32未満に保つこと");

        // 本番の列挙。
        let mut enumerated: Vec<Vec<usize>> = Vec::new();
        for_each_paint_set(&candidates, max_paint_num, &mut |set| {
            assert!(set.windows(2).all(|w| w[0] < w[1]), "昇順で渡されていない");
            enumerated.push(set.to_vec());
        });

        // 独立実装: 候補数ぶんのビットマスクを全部回し、要素数が上限以下のものを採る。
        let mut brute: Vec<Vec<usize>> = Vec::new();
        for m in 1u32..(1u32 << n) {
            if m.count_ones() as usize > max_paint_num {
                continue;
            }
            brute.push(
                (0..n)
                    .filter(|&i| m & (1 << i) != 0)
                    .map(|i| candidates[i])
                    .collect(),
            );
        }

        let enumerated_keys: HashSet<Vec<usize>> = enumerated.iter().cloned().collect();
        let brute_keys: HashSet<Vec<usize>> = brute.iter().cloned().collect();
        assert_eq!(
            enumerated.len(),
            enumerated_keys.len(),
            "同じ集合を2回列挙している"
        );
        assert_eq!(enumerated_keys, brute_keys, "列挙される集合が総当たりと違う");
        assert_eq!(
            enumerated.len() as u128,
            paint_set_count(n, max_paint_num),
            "列挙数が組み合わせの総数と合わない"
        );

        // 探索器の申告も同じであること。
        let result = enumerate_exhaustive(&candidates, max_paint_num, &ev);
        assert_eq!(result.enumerated, enumerated.len() as u64);
    }

    /// 塗り上限0なら何も列挙しない (境界)。
    #[test]
    fn zero_max_paint_num_enumerates_nothing() {
        let (field, next, env, candidates) = small_problem();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();

        let mut count = 0usize;
        for_each_paint_set(&candidates, 0, &mut |_| count += 1);
        assert_eq!(count, 0);
        assert_eq!(paint_set_count(candidates.len(), 0), 0);

        let result = enumerate_exhaustive(&candidates, 0, &ev);
        assert_eq!(result.enumerated, 0);
        assert!(result.best.is_none());
        assert_eq!(result.best_by_paint_num.len(), 1);
    }

    /// 最良解が、全候補を独立に畳み込んだ結果と一致すること。
    #[test]
    fn best_matches_independent_fold_over_all_sets() {
        let (field, next, env, candidates) = small_problem();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red)
            .unwrap();
        let prefs = DEFAULT_IGNITION_PREFERENCES.to_vec();
        let max_paint_num = 4usize;
        let n = candidates.len();
        assert!(n < 32, "総当たりが u32 のビットマスクなので候補は32未満に保つこと");

        let result = enumerate_exhaustive(&candidates, max_paint_num, &ev);

        // 独立実装: ビットマスク総当たりで評価し、畳み込んで最良を採る。
        let mut all: Vec<IgnitionSolution> = Vec::new();
        for m in 1u32..(1u32 << n) {
            if m.count_ones() as usize > max_paint_num {
                continue;
            }
            let set: Vec<usize> = (0..n).filter(|&i| m & (1 << i) != 0).map(|i| candidates[i]).collect();
            if let Some(s) = ev.evaluate(&set) {
                all.push(s);
            }
        }
        assert_eq!(result.ignited, all.len() as u64, "発火した件数が合わない");
        // 実測 1,112 件 (候補14・上限4)。下限はフィクスチャが痩せたときに気づくためのもの。
        assert!(all.len() >= 1000, "発火が少なすぎて比較にならない: {}", all.len());

        let expected = all
            .iter()
            .fold(None::<&IgnitionSolution>, |best, s| match best {
                None => Some(s),
                Some(b) => Some(better_ignition(&prefs, b, s)),
            })
            .expect("発火した解があるはず");
        let got = result.best.as_ref().expect("最良解があるはず");
        assert_eq!(got.mask, expected.mask, "最良解が一致しない");
        assert_eq!(got.result.value, expected.result.value);

        // 塗り数ごとの最良も同様に突き合わせる。
        for size in 1..=max_paint_num {
            let expected_at_size = all
                .iter()
                .filter(|s| s.paint_set.len() == size)
                .fold(None::<&IgnitionSolution>, |best, s| match best {
                    None => Some(s),
                    Some(b) => Some(better_ignition(&prefs, b, s)),
                });
            match (&result.best_by_paint_num[size], expected_at_size) {
                (None, None) => {}
                (Some(g), Some(e)) => assert_eq!(g.mask, e.mask, "塗り数 {} の最良が違う", size),
                _ => panic!("塗り数 {} で片方だけ解がある", size),
            }
        }
        assert!(result.best_by_paint_num[0].is_none(), "空集合は列挙しない");

        // 全体の最良が、塗り数ごとの最良の中の最良と一致すること。
        let best_of_sizes = result
            .best_by_paint_num
            .iter()
            .flatten()
            .fold(None::<&IgnitionSolution>, |best, s| match best {
                None => Some(s),
                Some(b) => Some(better_ignition(&prefs, b, s)),
            })
            .expect("塗り数ごとの最良があるはず");
        assert_eq!(got.mask, best_of_sizes.mask);

        // 候補の順を入れ替えても同じ最良になること (keep_better が列挙順に依らない)。
        let mut reversed = candidates.clone();
        reversed.reverse();
        let reversed_result = enumerate_exhaustive(&reversed, max_paint_num, &ev);
        assert_eq!(
            reversed_result.best.as_ref().map(|s| s.mask),
            Some(got.mask),
            "候補の順で最良が変わる"
        );
        assert_eq!(reversed_result.ignited, result.ignited);
    }

    /// ハード制約が上方閉であること (設計メモ §4)。
    /// 発火する集合に1マス足しても必ず発火する。探索設計の前提そのものなので固定しておく。
    ///
    /// **これは初期盤面に消える連結が1つも無いときの話**。初期発火がある盤面では、
    /// 塗りが他色の群を割って発火しなくなりうる (モジュール doc を参照)。
    /// なので前提を先に検査してから性質を見る。
    #[test]
    fn ignition_is_upward_closed() {
        let (field, next, env, candidates) = full_problem();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red)
            .unwrap();
        assert!(ev.evaluate(&[]).is_none(), "初期発火がある盤面では上方閉にならない");

        let mut checked = 0usize;
        for i in 0..candidates.len() {
            for j in (i + 1)..candidates.len() {
                let base = [candidates[i], candidates[j]];
                if ev.evaluate(&base).is_none() {
                    continue;
                }
                for &extra in &candidates {
                    if base.contains(&extra) {
                        continue;
                    }
                    let mut grown = base.to_vec();
                    grown.push(extra);
                    assert!(
                        ev.evaluate(&grown).is_some(),
                        "発火する {:?} に {} を足したら発火しなくなった",
                        base,
                        extra
                    );
                    checked += 1;
                }
            }
        }
        assert!(checked > 0, "発火する2マスの塗りが無く、上方閉を検査できていない");
    }

    /// 評価値が塗り数に対して単調とは限らないこと (設計メモ §4)。
    /// 「良い部分集合を伸ばせば良い解になる」という保証が無いので、
    /// 制約による枝刈りでは絞れず評価値ベースの探索が要る、という設計の根拠。
    ///
    /// 実測 (この盤面・赤・絞り込みなし36マス): 2→3マスの拡張 9,690件のうち
    /// 評価値が下がるのは 34 件 (0.35%)。反例は少ないので、盤面フィクスチャを
    /// 変えるとこのテストが落ちることがある。そのときは反例が消えただけかどうかを見ること。
    #[test]
    fn value_is_not_monotone_in_paint_num() {
        let (field, next, env, candidates) = full_problem();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red)
            .unwrap();
        assert!(ev.evaluate(&[]).is_none(), "初期発火がある盤面では上方閉にならない");

        let mut extensions = 0usize;
        let mut drops = 0usize;
        for i in 0..candidates.len() {
            for j in (i + 1)..candidates.len() {
                let base = [candidates[i], candidates[j]];
                let Some(base_solution) = ev.evaluate(&base) else {
                    continue;
                };
                for &extra in &candidates {
                    if base.contains(&extra) {
                        continue;
                    }
                    let mut grown = base.to_vec();
                    grown.push(extra);
                    let grown_solution = ev
                        .evaluate(&grown)
                        .expect("初期発火が無い盤面なので上方閉。必ず発火する");
                    extensions += 1;
                    if grown_solution.result.value < base_solution.result.value {
                        drops += 1;
                    }
                }
            }
        }
        assert!(extensions > 1000, "拡張の件数が少なすぎる: {}", extensions);
        assert!(
            drops > 0,
            "マスを足すと評価値が下がる例が {} 件の拡張の中に1つも無い",
            extensions
        );
    }



    fn beam_setup() -> (Field, NextPuyos, SimulationEnvironment, IgnitionSetup) {
        let field = plain_field();
        let next = next_puyos();
        let env = environment();
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 4, PaintFilter::All);
        (field, next, env, setup)
    }

    fn all_modes() -> Vec<BeamParams> {
        let mut v = Vec::new();
        for dedup in [DedupMode::Mask, DedupMode::Signature] {
            for surrogate in [
                SurrogateMode::LargestComponent,
                SurrogateMode::CriticalSeeds,
            ] {
                for stop in [false, true] {
                    for reserve in [0usize, 20] {
                        v.push(BeamParams {
                            max_paint_num: 4,
                            beam_width: 60,
                            dedup,
                            surrogate,
                            stop_on_ignition: stop,
                            unignited_reserve: reserve,
                        });
                    }
                }
            }
        }
        v
    }

    /// ビーム幅を候補数より十分広く取れば、厳密列挙の真値に一致すること。
    /// 幅が足りている限りビームは全探索と同じものを見るので、
    /// 一致しなければビームの展開か選抜が壊れている。
    #[test]
    fn wide_beam_reaches_the_exhaustive_truth() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();

        // 候補を絞って全数列挙できる規模にする。
        let candidates: Vec<usize> = setup.candidates.iter().copied().take(12).collect();
        let narrowed = IgnitionSetup {
            candidates: candidates.clone(),
            ..setup
        };
        let truth = enumerate_exhaustive(&candidates, 4, &ev);
        assert!(truth.best.is_some(), "真値が無いとテストにならない");

        // 幅を全組み合わせより広く取る。打ち切りは真値を落とすので、ここでは無効。
        let params = BeamParams {
            max_paint_num: 4,
            beam_width: 5000,
            dedup: DedupMode::Mask,
            surrogate: SurrogateMode::LargestComponent,
            stop_on_ignition: false,
            unignited_reserve: 0,
        };
        let beam = search_beam(&narrowed, &ev, &params);
        assert_eq!(beam.evaluated, truth.enumerated, "評価した集合の数が違う");
        assert_eq!(beam.ignited, truth.ignited);
        assert_eq!(
            beam.best.as_ref().map(|s| s.mask),
            truth.best.as_ref().map(|s| s.mask),
            "幅が足りているのに真値に届いていない"
        );
        for size in 0..=4 {
            assert_eq!(
                beam.best_by_paint_num[size].as_ref().map(|s| s.mask),
                truth.best_by_paint_num[size].as_ref().map(|s| s.mask),
                "塗り数 {} の最良が真値と違う",
                size
            );
        }
    }

    /// **選抜を通したうえで**真値に届くこと。
    ///
    /// [`wide_beam_reaches_the_exhaustive_truth`] は幅が全候補より広いので
    /// `select_beam` の早期リターンで抜けてしまい、選抜のバグを検出できない。
    /// ここでは「途中の深さでは幅が効き、最終深さの手前までは真値への道が残る」幅を選ぶ。
    #[test]
    fn beam_reaches_the_truth_through_the_selection_path() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();
        let candidates: Vec<usize> = setup.candidates.iter().copied().take(12).collect();
        let narrowed = IgnitionSetup {
            candidates: candidates.clone(),
            ..setup
        };
        let truth = enumerate_exhaustive(&candidates, 4, &ev);
        let truth_best = truth.best.as_ref().expect("真値が無いとテストにならない");

        // 候補12・上限4なら各深さの代表は 12/66/220/495 本 (指紋モードだと 12/51/120/198)。
        // 幅40〜120 ならどちらのモードでも途中の深さが幅で絞られる = 選抜を必ず通り、
        // かつ実測で最良解は落ちない。
        for dedup in [DedupMode::Mask, DedupMode::Signature] {
            for beam_width in [40usize, 60, 120] {
                for reserve in [0usize, 5] {
                let params = BeamParams {
                    max_paint_num: 4,
                    beam_width,
                    dedup,
                    surrogate: SurrogateMode::LargestComponent,
                    stop_on_ignition: false,
                    unignited_reserve: reserve,
                };
                let beam = search_beam(&narrowed, &ev, &params);
                assert!(
                    beam.depth_stats.iter().any(|s| s.kept == params.beam_width),
                    "選抜が一度も効いていない: {:?}",
                    params
                );
                assert_eq!(
                    beam.best.as_ref().map(|s| s.mask),
                    Some(truth_best.mask),
                    "選抜を通すと真値に届かない: {:?}",
                    params
                );
                }
            }
        }
    }

    /// 未発火の枠取りが実際にビームへ未発火を残すこと (§7 案3 の配線の検査)。
    /// 到達率には効かなかった (§9-3) が、ノブとして残す以上、効いていることは固定する。
    #[test]
    fn unignited_reserve_keeps_unignited_nodes_in_the_beam() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();

        let base = BeamParams {
            max_paint_num: 4,
            beam_width: 40,
            dedup: DedupMode::Mask,
            surrogate: SurrogateMode::LargestComponent,
            stop_on_ignition: false,
            unignited_reserve: 0,
        };
        let without = search_beam(&setup, &ev, &base);
        let with = search_beam(
            &setup,
            &ev,
            &BeamParams {
                unignited_reserve: 10,
                ..base.clone()
            },
        );

        // 枠取り無しでは、発火率が上がる深さでビームが発火済みで埋まる。
        let filled = without
            .depth_stats
            .iter()
            .find(|s| s.kept == base.beam_width && s.ignited_kept == s.kept);
        let filled = filled.unwrap_or_else(|| {
            panic!(
                "発火済みで埋まる深さが無く、枠取りの効きを検査できない: {:?}",
                without.depth_stats
            )
        });

        let same_depth = with
            .depth_stats
            .iter()
            .find(|s| s.depth == filled.depth)
            .expect("同じ深さがあるはず");
        assert_eq!(
            same_depth.kept - same_depth.ignited_kept,
            10,
            "枠取りのぶんの未発火がビームに残っていない: {:?}",
            same_depth
        );
    }

    /// 未発火同士の並び (代理スコアが大きい方が先) が、向きどおりであること。
    /// 結果には出にくいので [`node_cmp`] を直接見る。
    #[test]
    fn unignited_nodes_are_ordered_by_surrogate_descending() {
        use crate::paint::bit;
        use std::cmp::Ordering;

        let prefs = DEFAULT_IGNITION_PREFERENCES.to_vec();
        let node = |mask: Bits, surrogate: u32| BeamNode {
            cells: vec![0],
            mask,
            solution: None,
            surrogate,
            signature: ChainSignature::default(),
        };

        // 見込みが大きい方に**大きいマスク**を持たせる。そうしないと、代理スコアを
        // 見ていない実装でもマスクの順で偶然この検査を通ってしまう。
        let high = node(bit(2), 200);
        let low = node(bit(1), 100);
        assert_eq!(node_cmp(&prefs, &high, &low), Ordering::Less, "見込みが大きい方が先");
        assert_eq!(node_cmp(&prefs, &low, &high), Ordering::Greater);

        // 同じ見込みならマスクの小さい方が先 (順序の固定)。
        let a = node(bit(1), 100);
        let b = node(bit(2), 100);
        assert_eq!(node_cmp(&prefs, &a, &b), Ordering::Less);
        assert_eq!(node_cmp(&prefs, &b, &a), Ordering::Greater);
        assert_eq!(node_cmp(&prefs, &a, &a), Ordering::Equal);
    }

    fn ils_evaluator<'a>(
        target: &'a ExplorationTarget,
        env: &SimulationEnvironment,
        boost: &HashSet<PuyoCoord>,
        field: &Field,
        next: &NextPuyos,
    ) -> IgnitionEvaluator<'a> {
        IgnitionEvaluator::new(target, env, boost, field, next, PuyoAttr::Red).unwrap()
    }

    /// [`IgnitionComparator`] が [`better_ignition`] と**完全に同じ比較**であること。
    /// ズレると探索中の選択と最終結果の基準が食い違う。
    #[test]
    fn comparator_matches_better_ignition() {
        let (mut field, next, env, _) = beam_setup();
        // **先頭の優先度 (チャンス消去) が実際に効く盤面にすること。**
        // チャンスぷよが無いと、先頭を落としても比較結果が変わらず検査にならない。
        for (y, x) in [(2usize, 2usize), (3, 3), (4, 4)] {
            if let Some(p) = field[y][x].as_mut() {
                p.puyo_type = crate::puyo_type::convert_type(
                    PuyoType::RedChance,
                    crate::puyo_type::get_attr(p.puyo_type),
                );
            }
        }
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 3, PaintFilter::All);
        let prefs = DEFAULT_IGNITION_PREFERENCES.to_vec();
        let cmp = IgnitionComparator::new(&prefs);

        // 候補を絞った全有効解で総当たり比較する。
        let candidates: Vec<usize> = setup.candidates.iter().copied().take(14).collect();
        let mut solutions: Vec<IgnitionSolution> = Vec::new();
        for_each_paint_set(&candidates, 3, &mut |paint_set| {
            if let Some(s) = ev.evaluate(paint_set) {
                solutions.push(s);
            }
        });
        assert!(solutions.len() > 200, "比較する解が少なすぎる: {}", solutions.len());
        let with_chance = solutions
            .iter()
            .filter(|s| s.result.popped_chance_num > 0)
            .count();
        assert!(
            with_chance > 0 && with_chance < solutions.len(),
            "チャンス消去の有無が割れていない ({} / {})。先頭の優先度を検査できない",
            with_chance,
            solutions.len()
        );

        for a in &solutions {
            for b in &solutions {
                assert_eq!(
                    std::ptr::eq(cmp.better(a, b), a),
                    std::ptr::eq(better_ignition(&prefs, a, b), a),
                    "比較が食い違う: {:?} vs {:?}",
                    a.paint_set,
                    b.paint_set
                );
            }
        }
    }

    /// 近傍が追加・削除・**入替**の3種類を過不足なく出すこと。
    ///
    /// 入替は「ビームに欠けていた修正操作」(§9-7) で、ILS が効く理由そのもの。
    /// 落としても到達率のテストは通ってしまうので、ここで直接固定する。
    #[test]
    fn neighbourhood_contains_add_remove_and_swap() {
        let (field, next, env, _) = beam_setup();
        let setup = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 4, PaintFilter::All);
        let current: Vec<usize> = setup.candidates.iter().copied().take(3).collect();

        let mut moves: Vec<Move> = Vec::new();
        neighbourhood(&setup, &current, &mut moves);

        let outside = setup.candidates.len() - current.len();
        let adds = moves.iter().filter(|m| matches!(m, Move::Add(_))).count();
        let removes = moves.iter().filter(|m| matches!(m, Move::Remove(_))).count();
        let swaps = moves
            .iter()
            .filter(|m| matches!(m, Move::Swap { .. }))
            .count();
        assert_eq!(adds, outside, "追加の手が足りない");
        assert_eq!(removes, current.len(), "削除の手が足りない");
        assert_eq!(swaps, current.len() * outside, "入替の手が足りない");

        // 入替を当てると、集合の大きさは変わらず中身だけ入れ替わること。
        let swap = moves
            .iter()
            .find_map(|m| match m {
                Move::Swap { out_cell, in_cell } => Some((*out_cell, *in_cell)),
                _ => None,
            })
            .expect("入替の手があるはず");
        let mut next_set = Vec::new();
        apply_into(
            &current,
            Move::Swap {
                out_cell: swap.0,
                in_cell: swap.1,
            },
            &mut next_set,
        );
        assert_eq!(next_set.len(), current.len());
        assert!(!next_set.contains(&swap.0), "外すマスが残っている");
        assert!(next_set.contains(&swap.1), "入れるマスが入っていない");
        assert!(next_set.windows(2).all(|w| w[0] < w[1]), "昇順でない");

        // 上限に達していれば追加の手は出ない。
        let full: Vec<usize> = setup.candidates.iter().copied().take(4).collect();
        neighbourhood(&setup, &full, &mut moves);
        assert_eq!(moves.iter().filter(|m| matches!(m, Move::Add(_))).count(), 0);
    }

    /// 再始動と kick が実際に走っていること。
    ///
    /// ここが 1 で止まっていると、設計 (§9-7: 全コアを値順に再始動) と実装が食い違う。
    /// 実際、`is_better` が同一集合を改善と誤判定していたときは再始動が1回で止まっていた。
    #[test]
    fn ils_actually_restarts_and_kicks() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);

        let r = search_ils(&setup, &ev, &IlsParams::new(20_000));
        assert!(r.cores > 50, "再始動プールが小さすぎる: {}", r.cores);
        assert!(
            r.restarts > 1,
            "再始動が {} 回しか起きていない (コア {} 件)。局所最適から抜けられていない",
            r.restarts,
            r.cores
        );
        assert!(r.kicks > 0, "kick が一度も走っていない");

        // kick を無効にすると探索の広がりが変わること (kick が効いている証拠)。
        let no_kick = search_ils(
            &setup,
            &ev,
            &IlsParams {
                kick_cap: 0,
                ..IlsParams::new(20_000)
            },
        );
        assert_eq!(no_kick.kicks, 0, "kick_cap=0 なのに kick している");
        assert!(
            no_kick.evaluated < r.evaluated || no_kick.restarts != r.restarts,
            "kick の有無で探索が変わらない"
        );
    }

    /// kick が**本当に集合を変える**こと。
    /// 揺さぶりが効いていないと局所最適から永久に抜けられない。
    #[test]
    fn kick_changes_the_set_and_keeps_it_ignited() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);
        let cores = ignition_cores(&setup, env.minimum_puyo_num_for_popping);
        let params = IlsParams::new(100_000);

        let mut budgeted = BudgetedEvaluator {
            evaluator: &ev,
            cache: HashMap::with_hasher(MaskHasherBuilder),
            remaining: 100_000,
            evaluated: 0,
        };
        let mut rng = Rng::new(7);

        let mut changed = 0usize;
        for core in cores.iter().take(30) {
            let Some(kicked) = kick(&setup, &mut budgeted, &mut rng, &params, core) else {
                continue;
            };
            assert_ne!(
                IgnitionSetup::mask_of(&kicked),
                IgnitionSetup::mask_of(core),
                "kick が同じ集合を返している: {:?}",
                core
            );
            assert!(
                ev.evaluate(&kicked).is_some(),
                "kick の結果が発火していない: {:?}",
                kicked
            );
            assert!(
                kicked.len() <= setup.max_paint_num,
                "kick で塗り上限を超えた: {:?}",
                kicked
            );
            changed += 1;
        }
        assert!(changed >= 10, "kick が成功した回数が少なすぎる: {}", changed);
    }

    /// 同一の塗り集合を「改善」と判定しないこと。
    ///
    /// [`IgnitionComparator::better`] は同値のときマスクで決着するので、同じ集合の
    /// 別クローンを渡すと必ず第1引数が返る。それを改善と数えると kick の打ち切りが
    /// 効かなくなり、再始動が一度も進まない。
    #[test]
    fn identical_sets_are_not_an_improvement() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);
        let cmp = IgnitionComparator::new(ev.preference_priorities());
        let cores = ignition_cores(&setup, env.minimum_puyo_num_for_popping);
        let core = cores.first().expect("コアがあるはず");

        let mut budgeted = BudgetedEvaluator {
            evaluator: &ev,
            cache: HashMap::with_hasher(MaskHasherBuilder),
            remaining: 100,
            evaluated: 0,
        };
        assert!(
            !is_better(&mut budgeted, &cmp, core, core),
            "同じ集合が改善と判定されている"
        );
    }

    /// 実運用の入口 ([`search_ignition`]) が、探索本体と同じ解を返すこと。
    /// 連鎖のフル構築と座標への変換で取り違えが起きていないかを見る。
    #[test]
    fn search_ignition_matches_the_search_result() {
        let (field, next, env, _) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);

        // **塗り上限を小さくして探索空間を絞る。** 既定精度は16万評価なので、
        // 空間が広いとテストが重くなる (掘り尽くせば予算を残して打ち切る)。
        // 検査内容 (入口と探索本体の一致) は規模に依らない。
        const TEST_MAX_PAINT: usize = 3;
        const TEST_BUDGET: u64 = 2_000;
        let setup = IgnitionSetup::new(
            &field,
            &next,
            &env,
            PuyoAttr::Red,
            TEST_MAX_PAINT,
            PaintFilter::All,
        );
        let params = IgnitionSearchParams {
            seed: 3,
            // 精度プリセットは16万評価。テストは配線の検査なので予算を絞る。
            budget: Some(TEST_BUDGET),
            ..IgnitionSearchParams::new(PuyoAttr::Red, TEST_MAX_PAINT as u32)
        };
        let result = search_ignition(&target, &env, &boost, &field, &next, &params)
            .expect("色ぷよなので探索は成立する");
        let best = result.best.as_ref().expect("解があるはず");

        // 探索本体を同じ条件で回した結果と一致すること。
        let direct = search_ils(&setup, &ev, &IlsParams { seed: 3, ..IlsParams::new(TEST_BUDGET) });
        let direct_best = direct.best.as_ref().expect("解があるはず");
        assert_eq!(best.value, direct_best.result.value);
        assert_eq!(best.coords, direct_best.result.trace_coords);
        assert_eq!(result.evaluated, direct.evaluated);

        // 塗るマスを実際に評価し直しても同じ値になること。
        let indexes: Vec<usize> = best.coords.iter().map(|c| c.index() as usize).collect();
        let again = ev.evaluate(&indexes).expect("発火するはず");
        assert_eq!(again.result.value, best.value);

        // 返す解には連鎖がフル構築されていること (探索中は空のまま)。
        assert!(
            !best.solution.chains.is_empty(),
            "連鎖の内訳が空のまま返っている"
        );
        assert!(direct_best.result.chains.is_empty(), "探索中は空のはず");

        // 塗り数ごとの最良も、その塗り数になっていること。
        for (size, plan) in result.by_paint_num.iter().enumerate() {
            let Some(plan) = plan else { continue };
            assert_eq!(plan.coords.len(), size, "塗り数 {} の欄が合っていない", size);
        }

        // 色ぷよ以外を塗り色にしたら成立しないこと。
        assert!(search_ignition(
            &target,
            &env,
            &boost,
            &field,
            &next,
            &IgnitionSearchParams::new(PuyoAttr::Heart, 4)
        )
        .is_none());
    }

    /// 上位K件の保持 ([`TopK`]) が、良い順・重複なし・件数どおりであること。
    /// 期待値による最終選抜の母集団になるので、ここが崩れると並べ替えの意味が無くなる。
    #[test]
    fn top_k_keeps_the_best_distinct_solutions() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);
        let prefs = DEFAULT_IGNITION_PREFERENCES.to_vec();

        let r = search_ils(
            &setup,
            &ev,
            &IlsParams {
                result_num: 12,
                ..IlsParams::new(20_000)
            },
        );
        assert_eq!(r.top.len(), 12, "件数どおりに保持していない");
        assert_eq!(
            r.best.as_ref().map(|s| s.mask),
            r.top.first().map(|s| s.mask),
            "最良が先頭に来ていない"
        );

        // 良い順であること。
        for pair in r.top.windows(2) {
            assert!(
                std::ptr::eq(better_ignition(&prefs, &pair[0], &pair[1]), &pair[0]),
                "並びが良い順になっていない: {:?} の次が {:?}",
                pair[0].paint_set,
                pair[1].paint_set
            );
        }

        // 塗り集合が重複していないこと。
        let masks: HashSet<Bits> = r.top.iter().map(|s| s.mask).collect();
        assert_eq!(masks.len(), r.top.len(), "同じ塗り集合が2回入っている");

        // 中身が本当に発火すること。
        for s in &r.top {
            assert!(ev.evaluate(&s.paint_set).is_some());
        }

        // 0 件なら保持しない。
        let none = search_ils(
            &setup,
            &ev,
            &IlsParams {
                result_num: 0,
                ..IlsParams::new(5_000)
            },
        );
        assert!(none.top.is_empty());
        assert!(none.best.is_some(), "上位保持を切っても最良は返ること");
    }

    /// 期待値を指定すると、それが第一キーで並ぶこと (設計メモ §9-10)。
    #[test]
    fn plans_are_sorted_by_expected_value_when_requested() {
        use crate::simulator_bb::UnknownFillPolicy;

        let (field, next, env, _) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        const TEST_MAX_PAINT: u32 = 3;
        const TEST_BUDGET: u64 = 3_000;

        let base = IgnitionSearchParams {
            budget: Some(TEST_BUDGET),
            result_num: 10,
            ..IgnitionSearchParams::new(PuyoAttr::Red, TEST_MAX_PAINT)
        };

        // 決定論のみ。期待値は入らない。
        let plain = search_ignition(&target, &env, &boost, &field, &next, &base)
            .expect("解があるはず");
        assert!(!plain.plans.is_empty());
        assert!(plain.plans.iter().all(|p| p.expected_value.is_none()));
        assert_eq!(
            plain.best.as_ref().map(|p| p.coords.clone()),
            plain.plans.first().map(|p| p.coords.clone())
        );

        // 期待値つき。
        let with_ev = search_ignition(
            &target,
            &env,
            &boost,
            &field,
            &next,
            &IgnitionSearchParams {
                uncertainty: Some(crate::paint_search::UncertaintyParams {
                    policy: UnknownFillPolicy::ChainAverse,
                    samples: 8,
                    max_refills: 2,
                }),
                ..base.clone()
            },
        )
        .expect("解があるはず");

        assert!(with_ev.plans.iter().all(|p| p.expected_value.is_some()));
        // 期待値の降順に並んでいること。
        for pair in with_ev.plans.windows(2) {
            let (x, y) = (
                pair[0].expected_value.unwrap(),
                pair[1].expected_value.unwrap(),
            );
            assert!(x >= y, "期待値の降順になっていない: {} の次が {}", x, y);
        }
        assert_eq!(
            with_ev.best.as_ref().map(|p| p.coords.clone()),
            with_ev.plans.first().map(|p| p.coords.clone()),
            "best が先頭と食い違う"
        );

        // 探索そのものは決定論なので、候補の顔ぶれ (塗り集合の集合) は変わらない。
        let plain_sets: HashSet<Vec<u8>> = plain
            .plans
            .iter()
            .map(|p| p.coords.iter().map(|c| c.index()).collect())
            .collect();
        let ev_sets: HashSet<Vec<u8>> = with_ev
            .plans
            .iter()
            .map(|p| p.coords.iter().map(|c| c.index()).collect())
            .collect();
        assert_eq!(
            plain_sets, ev_sets,
            "期待値を付けると探索の中身まで変わっている (決定論のままのはず)"
        );
    }

    /// [`merge_ignition_results`] が、分け方に依らず同じ結果になること。
    /// ワーカーへの分割で答えが変わってはいけない (設計メモ §8-2)。
    #[test]
    fn merging_is_independent_of_how_the_work_is_split() {
        let (field, next, env, _) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let prefs = DEFAULT_IGNITION_PREFERENCES.to_vec();
        // 探索空間を絞る (上のテストと同じ理由)。
        const TEST_MAX_PAINT: u32 = 3;

        let runs: Vec<IgnitionSearchResult> = (1u64..=4)
            .map(|seed| {
                search_ignition(
                    &target,
                    &env,
                    &boost,
                    &field,
                    &next,
                    &IgnitionSearchParams {
                        seed,
                        budget: Some(2_000),
                        ..IgnitionSearchParams::new(PuyoAttr::Red, TEST_MAX_PAINT)
                    },
                )
                .unwrap()
            })
            .collect();

        let merged = merge_ignition_results(&prefs, &runs).expect("結果があるはず");
        let mut reversed = runs.clone();
        reversed.reverse();
        let merged_rev = merge_ignition_results(&prefs, &reversed).expect("結果があるはず");
        assert_eq!(
            merged.best.as_ref().map(|p| p.coords.clone()),
            merged_rev.best.as_ref().map(|p| p.coords.clone()),
            "畳み込む順で結果が変わる"
        );
        assert_eq!(merged.evaluated, merged_rev.evaluated);

        // まとめた結果は、どの1本より悪くならないこと。
        let merged_best = merged.best.as_ref().expect("解があるはず");
        for run in &runs {
            let Some(best) = &run.best else { continue };
            assert!(
                merged_best.value >= best.value,
                "まとめたら悪くなっている: {} < {}",
                merged_best.value,
                best.value
            );
        }

        // 空を渡したら None。
        assert!(merge_ignition_results(&prefs, &[]).is_none());
    }

    /// 精度プリセットの対応が固定されていること。
    /// **バックエンドをまたいで同じマッピングにする**約束なので、変えるときは
    /// wasm / TS 側も一緒に直すこと。
    #[test]
    fn precision_mapping_is_fixed() {
        assert_eq!(IgnitionPrecision::Standard.budget(), 160_000);
        assert_eq!(IgnitionPrecision::High.budget(), 500_000);
        assert_eq!(IgnitionPrecision::Ultra.budget(), 1_500_000);
        assert!(
            IgnitionPrecision::Standard.budget() < IgnitionPrecision::High.budget()
                && IgnitionPrecision::High.budget() < IgnitionPrecision::Ultra.budget(),
            "精度が上がるほど予算が増えること"
        );
        for p in [
            IgnitionPrecision::Standard,
            IgnitionPrecision::High,
            IgnitionPrecision::Ultra,
        ] {
            assert_eq!(IgnitionPrecision::parse(p.name()), Some(p));
            assert_eq!(IlsParams::from_precision(p).budget, p.budget());
        }
        assert!(IgnitionPrecision::parse("なにか").is_none());
    }

    /// ILS が予算を守り、決定的で、返す解が本当に発火すること。
    #[test]
    fn ils_respects_budget_and_is_deterministic() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);

        for budget in [1u64, 10, 200, 3000] {
            let params = IlsParams::new(budget);
            let a = search_ils(&setup, &ev, &params);
            let b = search_ils(&setup, &ev, &params);

            assert!(
                a.evaluated <= budget,
                "予算 {} を超えて {} 回評価している",
                budget,
                a.evaluated
            );
            assert_eq!(
                a.best.as_ref().map(|s| s.mask),
                b.best.as_ref().map(|s| s.mask),
                "同じ設定で結果が変わる (予算 {})",
                budget
            );
            assert_eq!(a.evaluated, b.evaluated, "評価回数が揺れる (予算 {})", budget);

            if let Some(best) = &a.best {
                assert!(
                    best.paint_set.len() <= setup.max_paint_num,
                    "塗り上限を超えている: {:?}",
                    best.paint_set
                );
                let again = ev.evaluate(&best.paint_set).expect("発火するはず");
                assert_eq!(again.result.value, best.result.value);
                assert_eq!(again.mask, best.mask);
            }
        }
    }

    /// シードを変えると探索の経路が変わること (乱数が効いていること)。
    ///
    /// 予算は再始動プール (発火コア) の評価を賄える大きさにすること。コアの評価は
    /// **乱数を使わない固定費**なので、そこで予算を使い切ると経路が一切変わらない。
    #[test]
    fn ils_seed_changes_the_search_path() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);

        // 予算が縛る大きさにすること。探索し尽くすとどの seed でも同じ答えに落ち着く
        // (それは正しい挙動で、乱数が効いていないわけではない)。
        let wide = IgnitionSetup {
            max_paint_num: 10,
            ..setup
        };
        let mut masks: HashSet<Bits> = HashSet::new();
        let mut evals: HashSet<u64> = HashSet::new();
        for seed in 1u64..=8 {
            let params = IlsParams {
                seed,
                ..IlsParams::new(3000)
            };
            let r = search_ils(&wide, &ev, &params);
            if let Some(best) = r.best {
                masks.insert(best.mask);
            }
            evals.insert(r.evaluated);
        }
        assert!(
            masks.len() > 1 || evals.len() > 1,
            "シードを変えても探索が1ミリも変わっていない"
        );
    }

    /// **同じ評価回数でビームより良いこと** (設計メモ §9-8 の主張)。
    /// これが成り立たなければ ILS を入れる意味がない。
    #[test]
    fn ils_beats_beam_at_the_same_evaluation_budget() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);
        let prefs = DEFAULT_IGNITION_PREFERENCES.to_vec();

        // 真値が取れる規模に絞る。
        let candidates: Vec<usize> = setup.candidates.iter().copied().take(14).collect();
        // **塗り上限は IgnitionSetup が持つ。** ビームと ILS で食い違わないよう、ここで揃える。
        let narrowed = IgnitionSetup {
            candidates,
            max_paint_num: 5,
            ..setup
        };
        let truth = enumerate_exhaustive(&narrowed.candidates, 5, &ev);
        let truth_best = truth.best.as_ref().expect("真値が無いとテストにならない");

        // まずビームを回し、その評価回数を ILS の予算にする。
        let beam = search_beam(
            &narrowed,
            &ev,
            &BeamParams {
                max_paint_num: 5,
                beam_width: 8,
                ..BeamParams::new(5, 8)
            },
        );
        let ils = search_ils(
            &narrowed,
            &ev,
            &IlsParams::new(beam.evaluated),
        );

        assert!(
            ils.evaluated <= beam.evaluated,
            "ILS が予算を超えている: {} > {}",
            ils.evaluated,
            beam.evaluated
        );

        let beam_best = beam.best.as_ref().expect("ビームも解は出すはず");
        let ils_best = ils.best.as_ref().expect("ILS も解を出すはず");
        // 同じ評価回数で、ILS がビーム以上であること。
        assert!(
            !std::ptr::eq(better_ignition(&prefs, beam_best, ils_best), beam_best)
                || beam_best.result.value <= ils_best.result.value,
            "同じ評価回数 {} でビーム ({:.1}) が ILS ({:.1}) を上回っている",
            beam.evaluated,
            beam_best.result.value,
            ils_best.result.value
        );
        // かつ、この盤面では真値に届くこと。
        assert_eq!(
            ils_best.result.value, truth_best.result.value,
            "ILS が真値 ({:.1}) に届かない: {:.1} (評価 {} 回)",
            truth_best.result.value, ils_best.result.value, ils.evaluated
        );
    }

    /// 候補が空でも上限0でも壊れないこと (境界)。
    #[test]
    fn ils_handles_degenerate_inputs() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);

        let empty = IgnitionSetup {
            candidates: Vec::new(),
            ..setup
        };
        let r = search_ils(&empty, &ev, &IlsParams::new(1000));
        assert_eq!(r.evaluated, 0);
        assert!(r.best.is_none());

        let (_, _, _, setup2) = beam_setup();
        let zero = IgnitionSetup {
            max_paint_num: 0,
            ..setup2
        };
        let r = search_ils(&zero, &ev, &IlsParams::new(1000));
        assert!(r.best.is_none());
        assert_eq!(r.best_by_paint_num.len(), 1);
    }

    /// 発火コアの構造的性質 (設計メモ §9-6):
    /// **任意の有効解は、最低消し数以下のサイズの発火コアを部分集合として含む。**
    /// 探索の起点としての完全性はこれに乗っているので、実際の解で総当たり確認する。
    #[test]
    fn every_solution_contains_an_ignition_core() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();
        let cores = ignition_cores(&setup, env.minimum_puyo_num_for_popping);
        assert!(!cores.is_empty(), "発火コアが1つも無い");

        let core_masks: Vec<Bits> = cores.iter().map(|c| IgnitionSetup::mask_of(c)).collect();

        // コアは本当に単体で発火すること。
        for core in &cores {
            assert!(
                core.len() <= env.minimum_puyo_num_for_popping as usize,
                "コアが大きすぎる: {:?}",
                core
            );
            assert!(
                ev.evaluate(core).is_some(),
                "コア {:?} が単体で発火しない",
                core
            );
        }

        // 候補を絞った小規模問題の有効解すべてが、コアを含むこと。
        let narrowed: Vec<usize> = setup.candidates.iter().copied().take(14).collect();
        let mut checked = 0usize;
        for_each_paint_set(&narrowed, 4, &mut |paint_set| {
            if ev.evaluate(paint_set).is_none() {
                return;
            }
            let mask = IgnitionSetup::mask_of(paint_set);
            assert!(
                core_masks.iter().any(|&c| c & !mask == 0),
                "有効解 {:?} がどの発火コアも含まない",
                paint_set
            );
            checked += 1;
        });
        assert!(checked > 100, "確認した有効解が少なすぎる: {}", checked);
    }

    /// 塗り上限より大きいコアは再始動プールに入れないこと。
    ///
    /// 近傍の「追加」は上限未満のときしか出ないので、上限超過の起点から始めると
    /// **上限を超えたまま解が返る**。塗り上限は [`IgnitionSetup`] 側が持つ契約。
    #[test]
    fn cores_never_exceed_the_paint_limit() {
        let (field, next, env, _) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev = ils_evaluator(&target, &env, &boost, &field, &next);

        // 最低消し数 (4) より小さい塗り上限。4マス塗らないと届かないコアは落ちるはず。
        for limit in [1usize, 2, 3] {
            let setup =
                IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, limit, PaintFilter::All);
            let cores = ignition_cores(&setup, env.minimum_puyo_num_for_popping);
            for core in &cores {
                assert!(
                    core.len() <= limit,
                    "塗り上限 {} を超えるコア {:?} が入っている",
                    limit,
                    core
                );
            }
            // 探索の結果も上限を超えないこと。
            let r = search_ils(&setup, &ev, &IlsParams::new(5000));
            if let Some(best) = &r.best {
                assert!(
                    best.paint_set.len() <= limit,
                    "塗り上限 {} を超える解 {:?} が返っている",
                    limit,
                    best.paint_set
                );
            }
        }

        // 上限を下げると実際にコアが減ること (検査が空振りしていないこと)。
        let wide = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 4, PaintFilter::All);
        let narrow = IgnitionSetup::new(&field, &next, &env, PuyoAttr::Red, 2, PaintFilter::All);
        assert!(
            ignition_cores(&narrow, env.minimum_puyo_num_for_popping).len()
                < ignition_cores(&wide, env.minimum_puyo_num_for_popping).len(),
            "上限を下げてもコアが減っておらず、切り捨てを検査できていない"
        );
    }

    /// 連結 `最低消し数` マス領域の数。8×6盤面の連結4マス領域は553通り。
    /// コアの列挙がこの上限を超えないこと (= 重複を作っていないこと) の確認でもある。
    #[test]
    fn ignition_cores_are_bounded_by_connected_regions() {
        let (field, next, env, setup) = beam_setup();
        let cores = ignition_cores(&setup, env.minimum_puyo_num_for_popping);
        assert!(
            cores.len() <= 553,
            "連結4マス領域は553通りしかないのに、コアが {} 件ある",
            cores.len()
        );

        // マスクで重複していないこと。
        let masks: HashSet<Bits> = cores.iter().map(|c| IgnitionSetup::mask_of(c)).collect();
        assert_eq!(masks.len(), cores.len(), "同じコアが2回出ている");

        // 決定的であること。
        let again = ignition_cores(&setup, env.minimum_puyo_num_for_popping);
        let a: Vec<Bits> = cores.iter().map(|c| IgnitionSetup::mask_of(c)).collect();
        let b: Vec<Bits> = again.iter().map(|c| IgnitionSetup::mask_of(c)).collect();
        assert_eq!(a, b, "呼ぶたびに結果が変わる");

        // 盤面に塗り色が1個も無くてもコアは作れる (adj1/adj2 との決定的な違い)。
        let mut blank = field;
        for row in blank.iter_mut() {
            for cell in row.iter_mut() {
                if let Some(p) = cell.as_mut() {
                    if crate::puyo_type::get_attr(p.puyo_type) == PuyoAttr::Red {
                        p.puyo_type = PuyoType::Blue;
                    }
                }
            }
        }
        let blank_setup =
            IgnitionSetup::new(&blank, &next, &env, PuyoAttr::Red, 4, PaintFilter::All);
        assert_eq!(blank_setup.base_board, 0, "塗り色が残っている");
        let blank_cores = ignition_cores(&blank_setup, env.minimum_puyo_num_for_popping);
        assert!(
            !blank_cores.is_empty(),
            "塗り色が盤面に無いとコアが作れていない"
        );
        assert!(blank_cores.iter().all(|c| c.len() == 4), "全部4マス塗る必要があるはず");
    }

    /// 指紋が一致しても評価値が一致するとは限らないこと。
    ///
    /// 指紋は消えたマスとその順序しか持たず、消えたマスの色を持たない。
    /// 塗ったマスが違えば、同じマスが消えても色の構成が変わって評価値が変わる。
    /// 重複排除の代表選びが「順序固定」ではなく本当の比較である根拠。
    #[test]
    fn same_signature_can_have_different_values() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();

        // 深さ3の全集合を評価し、指紋ごとに評価値を集める。
        let mut by_sig: HashMap<ChainSignature, Vec<f64>> = HashMap::new();
        let c = &setup.candidates;
        for i in 0..c.len() {
            for j in (i + 1)..c.len() {
                for k in (j + 1)..c.len() {
                    let (solution, signature) =
                        ev.evaluate_with_signature(&[c[i], c[j], c[k]]);
                    if let Some(s) = solution {
                        by_sig.entry(signature).or_default().push(s.result.value);
                    }
                }
            }
        }

        let multi = by_sig.values().filter(|v| v.len() > 1).count();
        let mixed = by_sig
            .values()
            .filter(|vs| {
                let lo = vs.iter().cloned().fold(f64::INFINITY, f64::min);
                let hi = vs.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
                hi - lo > 1e-9
            })
            .count();
        // 実測: 2件以上が集まった指紋グループ123個のうち6個で評価値が混ざる (最大差1.12)。
        assert!(multi > 0, "指紋が衝突するグループが無く、検査できていない");
        assert!(
            mixed > 0,
            "指紋一致で評価値も必ず一致してしまっている ({}グループ中0件)",
            multi
        );
    }

    /// [`surrogate_score`] の連結成分の数え方と桁分け。
    /// `paint.rs` の `component_size_capped` とは別実装なので、ここで固定しておく。
    #[test]
    fn surrogate_score_counts_components() {
        use crate::paint::{bit, build_neighbor_masks};
        let masks = build_neighbor_masks();
        let max_component = 3u32;
        let mode = SurrogateMode::LargestComponent;

        // 空盤面。
        assert_eq!(surrogate_score(mode, 0, &masks, max_component), 0);

        // 孤立2個 → 最大成分1、2個以上の塊なし。
        let isolated = bit(0) | bit(40);
        assert_eq!(surrogate_score(mode, isolated, &masks, max_component), 64);

        // index 0,1,8 は L 字に繋がって3連結 (0-1 が横、0-8 が縦)。
        let l_shape = bit(0) | bit(1) | bit(8);
        assert_eq!(surrogate_score(mode, l_shape, &masks, max_component), 3 * 64 + 3);

        // 3連結 + 離れた2連結 → 最大3、塊の総数は 3+2=5。
        let two_groups = l_shape | bit(40) | bit(41);
        assert_eq!(surrogate_score(mode, two_groups, &masks, max_component), 3 * 64 + 5);

        // 全48マス → 最大成分は max_component で頭打ち、塊の総数は48。
        let full = (1u64 << CELL_NUM) - 1;
        assert_eq!(surrogate_score(mode, full, &masks, max_component), 3 * 64 + 48);

        // CriticalSeeds は「あと1個で消える成分」の個数を第1キーにする。
        let critical = SurrogateMode::CriticalSeeds;
        assert_eq!(surrogate_score(critical, 0, &masks, max_component), 0);
        // 孤立2個 → あと1個で消える成分は無い。
        assert_eq!(surrogate_score(critical, isolated, &masks, max_component), 0);
        // 3連結1つ → 1個。
        assert_eq!(surrogate_score(critical, l_shape, &masks, max_component), 64 + 3);
        // 3連結 + 2連結 → やはり1個 (2連結は「あと2個」なので数えない)。
        assert_eq!(surrogate_score(critical, two_groups, &masks, max_component), 64 + 5);
        // 3連結を2つ離して置く → 2個。ここが LargestComponent との違い
        // (あちらは塊が1つでも2つでも同じ点数になる)。
        let two_seeds = l_shape | bit(40) | bit(41) | bit(32);
        assert_eq!(
            surrogate_score(SurrogateMode::LargestComponent, two_seeds, &masks, max_component),
            surrogate_score(SurrogateMode::LargestComponent, l_shape, &masks, max_component) + 3,
            "LargestComponent は種が2つでも第1キーが変わらない"
        );
        assert_eq!(surrogate_score(critical, two_seeds, &masks, max_component), 2 * 64 + 6);

        // 桁が混ざらないこと: 最大成分が大きい方が、塊の総数で負けていても必ず勝つ。
        // 3連結1つ (塊の総数3) vs 2連結3つ (塊の総数6)。
        let three_pairs = bit(0) | bit(1) | bit(16) | bit(17) | bit(32) | bit(33);
        assert_eq!(surrogate_score(mode, three_pairs, &masks, max_component), 2 * 64 + 6);
        assert!(
            surrogate_score(mode, l_shape, &masks, max_component)
                > surrogate_score(mode, three_pairs, &masks, max_component)
        );
    }

    /// どの設定でもビーム幅を超えず、決定的で、返す解が本当に発火すること。
    #[test]
    fn beam_respects_width_and_is_deterministic() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();

        for params in all_modes() {
            let a = search_beam(&setup, &ev, &params);
            let b = search_beam(&setup, &ev, &params);
            assert_eq!(
                a.best.as_ref().map(|s| s.mask),
                b.best.as_ref().map(|s| s.mask),
                "同じ設定で結果が変わる: {:?}",
                params
            );
            assert_eq!(a.evaluated, b.evaluated, "{:?}", params);

            // ビーム幅を守っていること。深さごとの実測値を直接見る
            // (最良解の塗り数を見ても幅の検査にはならない)。
            for stats in &a.depth_stats {
                assert!(
                    stats.kept <= params.beam_width,
                    "ビーム幅を超えている: {:?} {:?}",
                    stats,
                    params
                );
            }
            assert!(
                a.depth_stats.iter().any(|s| s.kept == params.beam_width),
                "幅で絞られる深さが1つも無く、選抜を検査できていない: {:?}",
                params
            );

            let best = a.best.as_ref().expect("発火する解があるはず");
            assert!(
                best.paint_set.len() <= params.max_paint_num,
                "塗り上限を超えている: {:?}",
                params
            );
            // 返ってきた解を評価し直しても同じ値になること (解と評価の取り違えが無いこと)。
            let again = ev.evaluate(&best.paint_set).expect("発火するはず");
            assert_eq!(again.result.value, best.result.value, "{:?}", params);
            assert_eq!(again.mask, best.mask, "{:?}", params);
        }
    }

    /// ビーム幅を広げると単調に良くなる**とは限らない**が、悪くはならない範囲で
    /// 真値に近づいていくこと。幅1でも壊れずに何かは返すこと。
    #[test]
    fn narrow_beam_still_returns_a_valid_solution() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();

        let params = BeamParams {
            max_paint_num: 4,
            beam_width: 1,
            dedup: DedupMode::Signature,
            surrogate: SurrogateMode::LargestComponent,
            stop_on_ignition: false,
            unignited_reserve: 0,
        };
        let result = search_beam(&setup, &ev, &params);
        let best = result.best.as_ref().expect("幅1でも解はあるはず");
        assert!(ev.evaluate(&best.paint_set).is_some());
    }

    /// 指紋による重複排除が「同じ連鎖 + 違う埋め草」を潰すこと (設計メモ §7)。
    ///
    /// 同じ幅なら評価件数は変わらない (どちらもビームを使い切る)。効くのは**ビームの中身**で、
    /// 指紋モードならビームに残る発火済みの解が全部違う連鎖になる。
    #[test]
    fn signature_dedup_fills_the_beam_with_distinct_chains() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();

        let base = BeamParams {
            max_paint_num: 4,
            beam_width: 40,
            dedup: DedupMode::Mask,
            surrogate: SurrogateMode::LargestComponent,
            stop_on_ignition: false,
            unignited_reserve: 0,
        };
        let by_mask = search_beam(&setup, &ev, &base);
        let by_signature = search_beam(
            &setup,
            &ev,
            &BeamParams {
                dedup: DedupMode::Signature,
                ..base.clone()
            },
        );

        // 指紋モードでは、ビームに残った発火済みの解がすべて違う連鎖になる。
        for stats in &by_signature.depth_stats {
            assert_eq!(
                stats.distinct_chains, stats.ignited_kept,
                "指紋モードなのに同じ連鎖がビームに2本以上残っている: {:?}",
                stats
            );
        }

        // マスクモードでは、同じ連鎖が重複して残る深さがある (これが §7 の問題)。
        let duplicated_depth = by_mask
            .depth_stats
            .iter()
            .find(|s| s.distinct_chains < s.ignited_kept);
        let duplicated_depth = duplicated_depth.unwrap_or_else(|| {
            panic!(
                "マスクモードで重複が起きず、指紋モードの効きを比べられない: {:?}",
                by_mask.depth_stats
            )
        });
        let at_same_depth = by_signature
            .depth_stats
            .iter()
            .find(|s| s.depth == duplicated_depth.depth)
            .expect("同じ深さがあるはず");
        assert!(
            at_same_depth.distinct_chains > duplicated_depth.distinct_chains,
            "指紋モードでビームの多様性が増えていない: mask={:?} signature={:?}",
            duplicated_depth,
            at_same_depth
        );
    }

    /// 「発火後は打ち切る」(§7 案2) が取りこぼしうること。
    /// 打ち切ると「もう1マス足して連鎖が伸びる」案を捨てるので、
    /// 真値に届かなくなる場合がある、というのを実例で固定しておく。
    #[test]
    fn stopping_on_ignition_can_miss_the_truth() {
        let (field, next, env, setup) = beam_setup();
        let target = damage_target();
        let boost = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();
        let candidates: Vec<usize> = setup.candidates.iter().copied().take(12).collect();
        let narrowed = IgnitionSetup {
            candidates: candidates.clone(),
            ..setup
        };
        let truth = enumerate_exhaustive(&candidates, 4, &ev);

        let params = BeamParams {
            max_paint_num: 4,
            beam_width: 5000,
            dedup: DedupMode::Mask,
            surrogate: SurrogateMode::LargestComponent,
            stop_on_ignition: true,
            unignited_reserve: 0,
        };
        let stopped = search_beam(&narrowed, &ev, &params);

        // 幅は十分なのに、打ち切りのぶんだけ評価件数が減る。
        assert!(
            stopped.evaluated < truth.enumerated,
            "打ち切りが効いていない: {} vs {}",
            stopped.evaluated,
            truth.enumerated
        );
        // 真値に届くかどうかは盤面次第。ここでは「届かないことがある」のではなく、
        // 「解自体は必ず有効である」ことだけを固定する (取りこぼし率は計測で見る)。
        let best = stopped.best.as_ref().expect("打ち切っても解はあるはず");
        assert!(ev.evaluate(&best.paint_set).is_some());
    }

    /// 候補が空なら何も列挙せず、最良解も無いこと (境界)。
    #[test]
    fn empty_candidates_yield_no_solution() {
        let (field, next, env, _) = small_problem();
        let target = damage_target();
        let boost: HashSet<PuyoCoord> = HashSet::new();
        let ev =
            IgnitionEvaluator::new(&target, &env, &boost, &field, &next, PuyoAttr::Red).unwrap();
        let result = enumerate_exhaustive(&[], 4, &ev);
        assert_eq!(result.enumerated, 0);
        assert_eq!(result.ignited, 0);
        assert!(result.best.is_none());
    }
}

