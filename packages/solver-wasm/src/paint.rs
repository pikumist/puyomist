//! 前段「ぷよ塗り」の候補列挙。
//!
//! 塗りは「盤面の任意のマス(連結不要)を指定色に塗り替える」操作で、なぞり塗り
//! ([`crate::trace_mode::TraceMode`] の `To*`) とは別物。ハード制約として
//! **塗り後に1つも消えない** ことを課す。
//!
//! 塗りで増えるのは塗り色だけで、他色は減るだけなので新たに消えることはない。よって制約は
//!
//! > 塗り後、塗り色の連結成分(4近傍)がすべて `minimum_puyo_num_for_popping - 1` 個以下
//!
//! と等価。塗りマスを追加すると塗り色の集合は単調増加するため制約違反も単調で
//! (S が違反なら S の上位集合もすべて違反)、有効な塗り集合は下方閉になる。
//! これにより「全部分集合を作ってから捨てる」のではなく、増分DFSで**有効なものだけ**を
//! 1件あたりほぼ定数コストで列挙できる。

use crate::puyo::Field;
use crate::puyo_attr::PuyoAttr;
use crate::puyo_coord::PuyoCoord;
use crate::puyo_type::{convert_type, get_attr, PuyoType};

pub const WIDTH: usize = PuyoCoord::X_NUM as usize;
pub const HEIGHT: usize = PuyoCoord::Y_NUM as usize;
pub const CELL_NUM: usize = WIDTH * HEIGHT;

/// index = y * WIDTH + x のビットボード。
pub type Bits = u64;

#[inline]
pub fn bit(index: usize) -> Bits {
    1u64 << index
}

/// 4近傍(上下左右)の隣接ビットマスク表。
pub fn build_neighbor_masks() -> [Bits; CELL_NUM] {
    let mut masks = [0u64; CELL_NUM];
    for index in 0..CELL_NUM {
        let x = index % WIDTH;
        let y = index / WIDTH;
        let mut m = 0u64;
        if y > 0 {
            m |= bit(index - WIDTH);
        }
        if y + 1 < HEIGHT {
            m |= bit(index + WIDTH);
        }
        if x > 0 {
            m |= bit(index - 1);
        }
        if x + 1 < WIDTH {
            m |= bit(index + 1);
        }
        masks[index] = m;
    }
    masks
}

/// `index` を含む連結成分のサイズを数える。`limit` を超えた時点で打ち切るため、
/// 返り値は「`limit` 以下かどうか」の判定にのみ使えること。
pub fn component_size_capped(
    board: Bits,
    index: usize,
    masks: &[Bits; CELL_NUM],
    limit: u32,
) -> u32 {
    let mut seen = bit(index);
    let mut frontier = bit(index);
    let mut size = 1u32;

    while frontier != 0 {
        let mut next = 0u64;
        let mut f = frontier;
        while f != 0 {
            let i = f.trailing_zeros() as usize;
            f &= f - 1;
            next |= masks[i] & board & !seen;
        }
        if next == 0 {
            break;
        }
        size += next.count_ones();
        if size > limit {
            return size;
        }
        seen |= next;
        frontier = next;
    }

    size
}

/// 塗り替えの対象になり得る属性か。プリズムと?ぷよは塗れない。
pub fn is_paintable_attr(attr: PuyoAttr) -> bool {
    matches!(
        attr,
        PuyoAttr::Red
            | PuyoAttr::Blue
            | PuyoAttr::Green
            | PuyoAttr::Yellow
            | PuyoAttr::Purple
            | PuyoAttr::Heart
            | PuyoAttr::Ojama
            | PuyoAttr::Kata
    )
}

/// 塗ると色ぷよになる特殊ぷよ(ハート/おじゃま/固ぷよ)か。
pub fn is_special_attr(attr: PuyoAttr) -> bool {
    matches!(attr, PuyoAttr::Heart | PuyoAttr::Ojama | PuyoAttr::Kata)
}

/// 候補マスの絞り込み方 (ハード制約とは別の、最適解を落とし得るヒューリスティック)。
///
/// 距離は4近傍でのマンハッタン距離で、基準は**初期盤面の**塗り色の位置。
#[derive(
    Debug, Copy, Clone, PartialEq, Eq, serde_repr::Serialize_repr, serde_repr::Deserialize_repr,
)]
#[repr(u8)]
pub enum PaintFilter {
    /// 絞り込みなし。
    All = 0,
    /// 塗り色に距離1以内。
    Adj1 = 1,
    /// [`PaintFilter::Adj1`] + ハート/おじゃま/固ぷよは無条件。
    Adj1Special = 2,
    /// 塗り色に距離2以内 (1マス飛ばしの橋渡しを含む)。
    Adj2 = 3,
    /// [`PaintFilter::Adj2`] + ハート/おじゃま/固ぷよは無条件。
    Adj2Special = 4,
    /// [`dead_cells`] (そのままでは絶対に消えないマス) のみ。塗り潰しても材料を失わない
    /// マスだけに絞る。候補が激減するが、生きたマスを塗る手を全部捨てるので厳密ではない。
    Dead = 5,
    /// [`PaintFilter::Adj2`] かつ [`dead_cells`]。塗り色に届く位置にある死にマスだけ。
    Adj2Dead = 6,
}

pub const ALL_PAINT_FILTERS: [PaintFilter; 7] = [
    PaintFilter::All,
    PaintFilter::Adj1,
    PaintFilter::Adj1Special,
    PaintFilter::Adj2,
    PaintFilter::Adj2Special,
    PaintFilter::Dead,
    PaintFilter::Adj2Dead,
];

impl PaintFilter {
    pub fn name(self) -> &'static str {
        match self {
            PaintFilter::All => "all",
            PaintFilter::Adj1 => "adj1",
            PaintFilter::Adj1Special => "adj1s",
            PaintFilter::Adj2 => "adj2",
            PaintFilter::Adj2Special => "adj2s",
            PaintFilter::Dead => "dead",
            PaintFilter::Adj2Dead => "adj2dead",
        }
    }

    pub fn parse(s: &str) -> Option<PaintFilter> {
        ALL_PAINT_FILTERS.into_iter().find(|f| f.name() == s)
    }

    fn accepts(self, dist: u32, attr: PuyoAttr, is_dead: bool) -> bool {
        match self {
            PaintFilter::All => true,
            PaintFilter::Adj1 => dist <= 1,
            PaintFilter::Adj1Special => dist <= 1 || is_special_attr(attr),
            PaintFilter::Adj2 => dist <= 2,
            PaintFilter::Adj2Special => dist <= 2 || is_special_attr(attr),
            PaintFilter::Dead => is_dead,
            PaintFilter::Adj2Dead => dist <= 2 && is_dead,
        }
    }
}

/// 各マスから初期盤面の塗り色までのマンハッタン距離。塗り色が皆無なら全マス `u32::MAX`。
fn distances_to_base(base_board: Bits) -> [u32; CELL_NUM] {
    let mut dists = [u32::MAX; CELL_NUM];
    if base_board == 0 {
        return dists;
    }
    for index in 0..CELL_NUM {
        let (x, y) = ((index % WIDTH) as i32, (index / WIDTH) as i32);
        let mut b = base_board;
        while b != 0 {
            let j = b.trailing_zeros() as usize;
            b &= b - 1;
            let (bx, by) = ((j % WIDTH) as i32, (j / WIDTH) as i32);
            let d = ((x - bx).abs() + (y - by).abs()) as u32;
            if d < dists[index] {
                dists[index] = d;
            }
        }
    }
    dists
}

/// 塗り探索の設定と、そこから導かれる候補マス。
pub struct PaintSetup {
    /// 塗り色。
    pub target: PuyoAttr,
    /// 塗れるマス数の上限。
    pub max_paint_num: usize,
    /// 塗り色の連結成分に許される最大サイズ (= `minimum_puyo_num_for_popping - 1`)。
    pub max_component: u32,
    /// 初期盤面における塗り色のビットボード。
    pub base_board: Bits,
    /// 絞り込み前の塗れるマス (既に塗り色のマスは除く)。
    pub raw_candidates: Vec<usize>,
    /// [`PaintFilter`] 適用後のマス。
    pub filtered_candidates: Vec<usize>,
    /// さらに単セル枝刈りを適用した最終候補マス。こちらは厳密(最適解を落とさない)。
    pub candidates: Vec<usize>,
    masks: [Bits; CELL_NUM],
}

impl PaintSetup {
    pub fn new(
        field: &Field,
        next_puyos: &[Option<crate::puyo::Puyo>; WIDTH],
        target: PuyoAttr,
        max_paint_num: usize,
        minimum_puyo_num_for_popping: u32,
        filter: PaintFilter,
    ) -> PaintSetup {
        let masks = build_neighbor_masks();
        let max_component = minimum_puyo_num_for_popping - 1;

        let mut base_board: Bits = 0;
        let mut raw_candidates: Vec<usize> = Vec::new();
        for index in 0..CELL_NUM {
            let Some(puyo) = field[index / WIDTH][index % WIDTH] else {
                continue;
            };
            let attr = get_attr(puyo.puyo_type);
            if attr == target {
                base_board |= bit(index);
                continue; // 既に塗り色 → 塗っても盤面が変わらないので候補外
            }
            if is_paintable_attr(attr) {
                raw_candidates.push(index);
            }
        }

        let dists = distances_to_base(base_board);
        let dead: std::collections::HashSet<usize> =
            dead_cells(field, next_puyos, minimum_puyo_num_for_popping)
                .into_iter()
                .collect();
        let filtered_candidates: Vec<usize> = raw_candidates
            .iter()
            .copied()
            .filter(|&index| {
                let puyo = field[index / WIDTH][index % WIDTH].unwrap();
                filter.accepts(dists[index], get_attr(puyo.puyo_type), dead.contains(&index))
            })
            .collect();

        // 単セル枝刈り: そのマス1つを塗るだけで制約違反になるマスは、単調性より
        // どの有効集合にも現れないため恒久的に除外できる。
        let candidates: Vec<usize> = filtered_candidates
            .iter()
            .copied()
            .filter(|&index| {
                component_size_capped(base_board | bit(index), index, &masks, max_component)
                    <= max_component
            })
            .collect();

        PaintSetup {
            target,
            max_paint_num,
            max_component,
            base_board,
            raw_candidates,
            filtered_candidates,
            candidates,
            masks,
        }
    }

    /// 有効な塗り集合を増分DFSで列挙し、1件ごとに `visit` を呼ぶ。
    ///
    /// `visit` には塗るマスのインデックス列が渡される (呼び出し中のみ有効)。
    /// 空集合(塗らない)は列挙されないので、必要なら呼び出し側で別途扱うこと。
    pub fn for_each_paint_set<F: FnMut(&[usize])>(&self, visit: &mut F) {
        let mut stack: Vec<usize> = Vec::with_capacity(self.max_paint_num);
        self.dfs(0, self.base_board, &mut stack, visit);
    }

    fn dfs<F: FnMut(&[usize])>(
        &self,
        start: usize,
        board: Bits,
        stack: &mut Vec<usize>,
        visit: &mut F,
    ) {
        if stack.len() >= self.max_paint_num {
            return;
        }
        for j in start..self.candidates.len() {
            let index = self.candidates[j];
            let next_board = board | bit(index);
            if component_size_capped(next_board, index, &self.masks, self.max_component)
                > self.max_component
            {
                // 単調性より、このマスを含む上位集合はすべて違反。この分岐は丸ごと捨てる。
                continue;
            }
            stack.push(index);
            visit(stack);
            self.dfs(j + 1, next_board, stack, visit);
            stack.pop();
        }
    }

    /// 塗り集合を盤面に適用した新しい盤面を返す。
    pub fn apply(&self, field: &Field, paint_set: &[usize]) -> Field {
        let mut painted = *field;
        for &index in paint_set {
            let (y, x) = (index / WIDTH, index % WIDTH);
            if let Some(puyo) = painted[y][x].as_mut() {
                puyo.puyo_type = convert_type(puyo.puyo_type, self.target);
            }
        }
        painted
    }
}

/// 列のランによる支配判定。
///
/// 落下は縦方向のみで、ぷよの列 (x座標) は永久に変わらない。よって隣接し得るのは列差1以内の
/// ぷよ同士に限られ、**連結成分は「その色が1個以上ある列の連続区間 (ラン)」の中にしか収まらない**
/// (その色が0個の列でランが切れる)。したがって
///
/// > ランに含まれるその色の総数が `minimum_puyo_num_for_popping` 未満なら、
/// > そのラン内のぷよは絶対に消えない。
///
/// 絶対に消えない位置に塗っても無駄なので、そのマスを塗らない集合の方が弱く優位になる
/// (元の色のぷよが残る分、消せる材料が減らない)。塗らない集合も列挙対象なので、
/// この判定で候補を落としても最適解は残る。
///
/// 注意: 「あるマスを中心とした横±1マスの窓」で見るのは**誤り**。連結成分は列をまたいで
/// 数珠つなぎに伸びられるため、窓の合計が4未満でもラン全体では4以上になり得る
/// (例: 列ごとの個数が 0,1,1,2 のとき、窓は2でもランは4)。
///
/// ネクストぷよは各列に1個ずつ落ちてくるので、列のカウントに算入する。
pub struct ColumnRuns {
    /// 塗る前の、列ごとの塗り色の個数 (盤面 + ネクスト)。
    base_counts: [u8; WIDTH],
    minimum_puyo_num_for_popping: u32,
}

impl ColumnRuns {
    pub fn new(
        field: &Field,
        next_puyos: &[Option<crate::puyo::Puyo>; WIDTH],
        target: PuyoAttr,
        minimum_puyo_num_for_popping: u32,
    ) -> ColumnRuns {
        let mut base_counts = [0u8; WIDTH];
        for index in 0..CELL_NUM {
            if let Some(puyo) = field[index / WIDTH][index % WIDTH] {
                if get_attr(puyo.puyo_type) == target {
                    base_counts[index % WIDTH] += 1;
                }
            }
        }
        for (x, next) in next_puyos.iter().enumerate() {
            if let Some(puyo) = next {
                if get_attr(puyo.puyo_type) == target {
                    base_counts[x] += 1;
                }
            }
        }
        ColumnRuns {
            base_counts,
            minimum_puyo_num_for_popping,
        }
    }

    /// 列 `x` が属するランの総数が `threshold` 以上か (塗りを加えない現状の盤面で判定)。
    pub fn run_total_at_column(&self, x: usize, threshold: u32) -> bool {
        if self.base_counts[x] == 0 {
            return false;
        }
        let mut start = x;
        while start > 0 && self.base_counts[start - 1] > 0 {
            start -= 1;
        }
        let mut end = x;
        while end + 1 < WIDTH && self.base_counts[end + 1] > 0 {
            end += 1;
        }
        let total: u32 = self.base_counts[start..=end].iter().map(|&c| c as u32).sum();
        total >= threshold
    }

    /// 塗り集合の全マスが「消え得る」ランに属しているか。
    /// 1マスでも絶対に消えないランに置かれていれば false (= その塗りは無駄)。
    pub fn all_painted_cells_can_pop(&self, paint_set: &[usize]) -> bool {
        if paint_set.is_empty() {
            return true;
        }

        let mut counts = self.base_counts;
        for &index in paint_set {
            counts[index % WIDTH] += 1;
        }

        // 各列について、その列が属するランの総数を求める。
        let mut run_total = [0u32; WIDTH];
        let mut x = 0usize;
        while x < WIDTH {
            if counts[x] == 0 {
                x += 1;
                continue;
            }
            let start = x;
            let mut total = 0u32;
            while x < WIDTH && counts[x] > 0 {
                total += counts[x] as u32;
                x += 1;
            }
            for t in run_total.iter_mut().take(x).skip(start) {
                *t = total;
            }
        }

        paint_set
            .iter()
            .all(|&index| run_total[index % WIDTH] >= self.minimum_puyo_num_for_popping)
    }
}

/// **そのままでは絶対に消えない**色ぷよのマスを列挙する。
///
/// [`ColumnRuns`] と同じ根拠 (落下は縦方向のみ = 列は不変) による。あるマスの色について、
/// そのマスが属する列のラン内の同色総数が `minimum_puyo_num_for_popping` 未満なら、
/// そのぷよはどうなぞっても消えない。
///
/// こういうマスは塗り潰しても失うものが無い (元々消せない材料なので) ため、塗り先として
/// 厳密に有利。逆に、既に消え得る色の上から塗ると材料を壊すことになる。
///
/// ハート/おじゃま/固ぷよは単独では消えず巻き込みで消えるため、ここでは対象外
/// (色ぷよだけを見る)。
pub fn dead_cells(
    field: &Field,
    next_puyos: &[Option<crate::puyo::Puyo>; WIDTH],
    minimum_puyo_num_for_popping: u32,
) -> Vec<usize> {
    use crate::puyo_attr::COLOR_ATTRS;

    // 色ごとの列カウントを一度だけ作る。
    let runs: Vec<(PuyoAttr, ColumnRuns)> = COLOR_ATTRS
        .iter()
        .map(|&attr| {
            (
                attr,
                ColumnRuns::new(field, next_puyos, attr, minimum_puyo_num_for_popping),
            )
        })
        .collect();

    (0..CELL_NUM)
        .filter(|&index| {
            let Some(puyo) = field[index / WIDTH][index % WIDTH] else {
                return false;
            };
            let attr = get_attr(puyo.puyo_type);
            let Some((_, run)) = runs.iter().find(|(a, _)| *a == attr) else {
                return false; // 色ぷよ以外は対象外
            };
            // 自分自身を「塗る」と見なさず、現状のランで判定する。
            !run.run_total_at_column(index % WIDTH, minimum_puyo_num_for_popping)
        })
        .collect()
}

/// 塗り集合に含まれる各マスの、塗り替え後の型を返す (テスト・デバッグ用)。
pub fn painted_type(puyo_type: PuyoType, target: PuyoAttr) -> PuyoType {
    convert_type(puyo_type, target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::puyo::Puyo;

    /// 盤面上の塗り色の連結成分がすべて `limit` 以下かを、全成分を走査して判定する
    /// (増分DFSが前提にしている単調性を使わない独立実装)。
    fn all_components_within(board: Bits, masks: &[Bits; CELL_NUM], limit: u32) -> bool {
        let mut remaining = board;
        while remaining != 0 {
            let seed = remaining.trailing_zeros() as usize;
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
            if component.count_ones() > limit {
                return false;
            }
            remaining &= !component;
        }
        true
    }

    /// テスト用のネクスト (紫 ×8)。
    fn test_next_puyos() -> [Option<Puyo>; WIDTH] {
        let mut id = 1000;
        [PuyoType::Purple; WIDTH].map(|puyo_type| {
            id += 1;
            Some(Puyo { id, puyo_type })
        })
    }

    fn natsuama_field() -> Field {
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

    /// 総当たり: 候補マスの全部分集合を作り、独立実装で有効なものを数える。
    fn brute_force_count(setup: &PaintSetup, candidates: &[usize], k: usize) -> u64 {
        let masks = build_neighbor_masks();
        let mut count = 0u64;
        for subset in 1u64..(1u64 << candidates.len()) {
            if subset.count_ones() as usize > k {
                continue;
            }
            let mut board = setup.base_board;
            let mut s = subset;
            while s != 0 {
                let i = s.trailing_zeros() as usize;
                s &= s - 1;
                board |= bit(candidates[i]);
            }
            if all_components_within(board, &masks, setup.max_component) {
                count += 1;
            }
        }
        count
    }

    /// 増分DFSの列挙が、独立実装による総当たりと完全に一致すること。
    #[test]
    fn dfs_enumeration_matches_brute_force() {
        let field = natsuama_field();
        for target in [
            PuyoAttr::Red,
            PuyoAttr::Blue,
            PuyoAttr::Green,
            PuyoAttr::Yellow,
            PuyoAttr::Purple,
        ] {
            for k in 1..=5usize {
                let mut setup = PaintSetup::new(&field, &test_next_puyos(), target, k, 4, PaintFilter::All);
                // 総当たりは 2^n なので候補を切り詰める。単セル枝刈りはあえて外し、
                // DFS が単体で違反するマスも正しく弾けることを確かめる。
                setup.candidates = setup.raw_candidates.iter().copied().take(18).collect();

                let expected = brute_force_count(&setup, &setup.candidates.clone(), k);

                let mut actual = 0u64;
                setup.for_each_paint_set(&mut |_| actual += 1);

                assert_eq!(
                    actual, expected,
                    "target={:?} k={} で増分DFSと総当たりが不一致",
                    target, k
                );
                assert!(expected > 0, "検証が空回りしている (有効集合が0件)");
            }
        }
    }

    /// 列挙された塗り集合が、重複なく・すべて制約を満たすこと。
    #[test]
    fn enumerated_sets_are_unique_and_valid() {
        use std::collections::HashSet;

        let field = natsuama_field();
        let masks = build_neighbor_masks();
        let setup = PaintSetup::new(&field, &test_next_puyos(), PuyoAttr::Green, 4, 4, PaintFilter::Adj2);

        let mut seen: HashSet<Bits> = HashSet::new();
        setup.for_each_paint_set(&mut |paint_set| {
            let mut board = setup.base_board;
            let mut key: Bits = 0;
            for &index in paint_set {
                board |= bit(index);
                key |= bit(index);
            }
            assert!(seen.insert(key), "同じ塗り集合が2回列挙された");
            assert!(
                all_components_within(board, &masks, setup.max_component),
                "制約を満たさない塗り集合が列挙された: {:?}",
                paint_set
            );
            assert!(paint_set.len() <= setup.max_paint_num);
        });
        assert!(!seen.is_empty());
    }

    /// 塗り適用でプラス/チャンスが維持され、特殊ぷよが色ぷよになること。
    #[test]
    fn apply_preserves_plus_and_chance() {
        let mut field = natsuama_field();
        field[0][0] = Some(Puyo { id: 1, puyo_type: PuyoType::BlueChancePlus });
        field[0][1] = Some(Puyo { id: 2, puyo_type: PuyoType::Heart });
        field[0][2] = Some(Puyo { id: 3, puyo_type: PuyoType::Kata });

        let setup = PaintSetup::new(&field, &test_next_puyos(), PuyoAttr::Red, 3, 4, PaintFilter::All);
        let painted = setup.apply(&field, &[0, 1, 2]);

        assert_eq!(painted[0][0].unwrap().puyo_type, PuyoType::RedChancePlus);
        assert_eq!(painted[0][1].unwrap().puyo_type, PuyoType::Red);
        assert_eq!(painted[0][2].unwrap().puyo_type, PuyoType::Red);
        // id は保持される
        assert_eq!(painted[0][0].unwrap().id, 1);
    }

    /// 列のランによる支配判定が、ラン総数で正しく可否を分けること。
    #[test]
    fn column_runs_rejects_paints_in_dead_runs() {
        // 全マス赤の盤面を作り、そこから狙った列にだけ紫を置く。
        let mut field: Field = [[Some(Puyo { id: 0, puyo_type: PuyoType::Red }); WIDTH]; HEIGHT];
        let mut id = 0;
        for y in 0..HEIGHT {
            for x in 0..WIDTH {
                id += 1;
                field[y][x] = Some(Puyo { id, puyo_type: PuyoType::Red });
            }
        }
        let next: [Option<Puyo>; WIDTH] = [Some(Puyo { id: 99, puyo_type: PuyoType::Red }); WIDTH];

        // 列ごとの紫の数を 0,1,1,2,0,... にする (列1〜3 が1つのラン、総数4)。
        field[0][1] = Some(Puyo { id: 101, puyo_type: PuyoType::Purple });
        field[0][2] = Some(Puyo { id: 102, puyo_type: PuyoType::Purple });
        field[0][3] = Some(Puyo { id: 103, puyo_type: PuyoType::Purple });
        field[1][3] = Some(Puyo { id: 104, puyo_type: PuyoType::Purple });

        let runs = ColumnRuns::new(&field, &next, PuyoAttr::Purple, 4);

        // 列2 に塗る: ラン総数は 4+1=5 ≥ 4 なので消え得る。
        assert!(runs.all_painted_cells_can_pop(&[2 * WIDTH + 2]));

        // 列6 に1マスだけ塗る: 列5 が0でランが切れ、ラン総数1 < 4 なので絶対に消えない。
        assert!(!runs.all_painted_cells_can_pop(&[2 * WIDTH + 6]));

        // 列6と列7 に2マス塗ってもラン総数2 < 4 なので依然として消えない。
        assert!(!runs.all_painted_cells_can_pop(&[2 * WIDTH + 6, 2 * WIDTH + 7]));

        // 列5,6,7 に3マス + 列7 にもう1マスでラン総数4 → 消え得る。
        assert!(runs.all_painted_cells_can_pop(&[
            2 * WIDTH + 5,
            2 * WIDTH + 6,
            2 * WIDTH + 7,
            3 * WIDTH + 7
        ]));

        // 塗らない場合は常に true。
        assert!(runs.all_painted_cells_can_pop(&[]));
    }

    /// 「横±1マスの窓」で判定すると誤って捨ててしまう配置が、ラン判定では残ること。
    #[test]
    fn column_runs_keeps_chains_spanning_multiple_columns() {
        let mut field: Field = [[Some(Puyo { id: 0, puyo_type: PuyoType::Red }); WIDTH]; HEIGHT];
        let mut id = 0;
        for y in 0..HEIGHT {
            for x in 0..WIDTH {
                id += 1;
                field[y][x] = Some(Puyo { id, puyo_type: PuyoType::Red });
            }
        }
        let next: [Option<Puyo>; WIDTH] = [Some(Puyo { id: 99, puyo_type: PuyoType::Red }); WIDTH];

        // 列ごとの紫: 列0=0, 列1=1, 列2=1, 列3=2 (ラン総数4)。
        field[0][1] = Some(Puyo { id: 201, puyo_type: PuyoType::Purple });
        field[0][2] = Some(Puyo { id: 202, puyo_type: PuyoType::Purple });
        field[0][3] = Some(Puyo { id: 203, puyo_type: PuyoType::Purple });
        field[1][3] = Some(Puyo { id: 204, puyo_type: PuyoType::Purple });

        let runs = ColumnRuns::new(&field, &next, PuyoAttr::Purple, 4);

        // 列1 を中心とした横±1の窓は 0+1+1=2 で4未満だが、ランは総数4なので消え得る。
        assert!(runs.all_painted_cells_can_pop(&[2 * WIDTH + 1]));
    }

    /// プリズムと?ぷよが塗り候補に入らないこと。
    #[test]
    fn prism_and_question_are_not_paintable() {
        assert!(!is_paintable_attr(PuyoAttr::Prism));
        assert!(!is_paintable_attr(PuyoAttr::Question));

        let field = natsuama_field();
        let setup = PaintSetup::new(&field, &test_next_puyos(), PuyoAttr::Red, 4, 4, PaintFilter::All);
        // なつアマ/1 のプリズムは (y=1, x=4) = index 12
        assert!(!setup.raw_candidates.contains(&12));
    }
}
