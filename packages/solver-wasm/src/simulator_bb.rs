/*!
 * ビートボードを使ったぷよの表現、消えるぷよの判定、ドロップ処理等。
 * @license [crimson-tea](https://github.com/crimson-tea/PuyoQueSolver/blob/master/LICENSE.txt)
 *
 * その他部分。
 * @license [pikumist](https://github.com/pikumist/puyomist/blob/main/LICENSE)
 */

use crate::{
    chain::{AttributeChain, Chain},
    damage::*,
    puyo_attr::PuyoAttr,
    puyo_coord::PuyoCoord,
    puyo_type::{get_attr, is_chance_type, is_plus_type, PuyoType},
    simulation_environment::SimulationEnvironment,
    trace_mode::*,
};
use bitintr::{Pdep, Pext};
use num_traits::{FromPrimitive, ToPrimitive};
use std::collections::HashMap;

/**
 * 盤面の状態をビットボードで表したもの。
 * 8x6升のフィールドとネクスト8升の計56升分のぷよの有無について、64ビット整数の下位56ビットで表す。
 * ビットは0か1しか表せないので、属性ごとに64ビット整数を用意することにする。
 * プラスとチャンスは色ぷよの色に関わらずそれぞれまとめて64ビット整数で表す。
 * フィールド1列分のぷよ6個と同列のネクスト1個の7個を1セットして、下の行から上にビットの位をとり、
 * さらにセット間では右列から左列にビットを構成していくものとする。
 *
 * 例えば、ビットボードの値が、
 * 0b_xxxxxxxx_0010000_1000000_0000000_0000000_1000000_0000000_0000000_0000001
 * だとすると
 *               ↑ A2 (フィールド2行1列目)
 *                                             ↑ E0 (ネクストぷよ5列目)
 *                                                                           ↑ H6 (フィールド6行8列目)
 * にその属性のぷよがあることを表す。
 *
 * ぷよクエでは上にあるぷよを下に隙間なく落としていく処理があるので、
 * 縦にビットを構成しておくと[PEXT命令使ったビット圧縮処理](https://orlp.net/blog/extracting-depositing-bits/)で高速化できる。
 * ただ、[WASM ではまだ使えなさそう](https://github.com/WebAssembly/design/issues/1389)。
 */
#[derive(Debug, Clone, PartialEq)]
pub struct BitBoards {
    /** 色ぷよ5色分(赤,青,緑,黄,紫)のビットボード */
    colors: [u64; 5],
    /** ハートのビットボード */
    heart: u64,
    /** プリズムのビットボード */
    prism: u64,
    /** おじゃまのビットボード */
    ojama: u64,
    /** 固ぷよのビットボード */
    kata: u64,
    /** パディングのビットボード */
    question: u64,
    /** プラス属性のビットボード */
    plus: u64,
    /** チャンス属性のビットボード */
    chance: u64,
}

impl BitBoards {
    pub fn is_field_all_cleared(&self) -> bool {
        let mut occ = self.colors.iter().fold(0, |acc, c| acc | c);
        occ |= self.prism;
        occ |= self.ojama;
        occ |= self.kata;
        occ |= self.question;
        occ &= FIELD_MASK;
        return occ == 0;
    }
}

/** フィールドの幅 */
const WIDTH: usize = 8;
/** フィールドとネクストぷよを含めた高さ */
const HEIGHT: usize = 7;
/** フィールドだけにするためのマスク */
const FIELD_MASK: u64 = 0b_0111111_0111111_0111111_0111111_0111111_0111111_0111111_0111111;
/** ネクストぷよだけにするマスク */
const NEXT_MASK: u64 = 0b_1000000_1000000_1000000_1000000_1000000_1000000_1000000_1000000;
/** 列1つ分のマスク */
const COL_MASK: u64 = 0b_1111111;

/// 1 連鎖ぶんの素データ (HashMap/Vec を確保しない軽量版)。
/// `fold_chains` が各連鎖でこれを生成し、消費側(フル Chain 構築 / スカラー集約)に渡す。
#[derive(Clone, Copy)]
struct ColorPop {
    strength: f64,
    popped_count: u32,
    separated_blocks_num: u32,
}

struct PopOutcome {
    chain_num: u32,
    simultaneous_num: u32,
    boost_count: u32,
    puyo_tsukai_count: u32,
    /// 色ぷよ5色 (Red..Purple) の連鎖情報。消えなかった色は None。
    colors: [Option<ColorPop>; 5],
    heart_count: u32,
    prism_count: u32,
    ojama_count: u32,
    kata_count: u32,
    popped_chance_num: u32,
    is_all_cleared: bool,
}

/// 探索中に必要なスカラーだけを集約したもの (Vec<Chain>/HashMap を作らない)。
/// popped は属性インデックス (PuyoAttr::to_u8()-1): 0..4=色, 5=Heart,6=Prism,7=Ojama,8=Kata。
#[derive(Default, Clone, Debug, PartialEq)]
pub struct ChainsAggregate {
    pub popped: [u32; 9],
    pub color_strength: [f64; 5],
    pub prism_strength: f64,
    pub boost_count: u32,
    pub puyo_tsukai_count: u32,
    pub popped_chance_num: u32,
    pub is_all_cleared: bool,
}

/// ネクストより先に降ってくる**不確定ぷよ**の扱い方。
///
/// 既定の [`UnknownFillPolicy::Inert`] は従来どおり「空きは空きのまま」で、不確定ぷよが
/// 連鎖を伸ばす可能性を一切見ない。実際には色ぷよが降ってくるので、この評価は系統的に
/// 過小評価になる。逆に一様ランダムで埋めると補充ぷよ同士が固まって勝手に発火し、
/// 連鎖が伸び続けて過大評価になる。その中間が [`UnknownFillPolicy::ChainAverse`]。
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, serde_repr::Serialize_repr, serde_repr::Deserialize_repr,
)]
#[repr(u8)]
pub enum UnknownFillPolicy {
    /// 補充しない (従来の挙動)。
    Inert = 0,
    /// 一様ランダムな色ぷよで埋める。補充ぷよ同士が固まって自力発火し得る。
    Random = 2,
    /// ランダムだが、**補充ぷよ同士が隣り合って同色にならない**ように割り当てる。
    /// 補充だけでは発火せず、既存の塊を伸ばす効果だけが残るので、連鎖しにくい側に倒れる。
    ChainAverse = 1,
}

/// 不確定ぷよをどう埋めるかの設定。モンテカルロではサンプルごとに `seed` を変える。
///
/// 色は「マス位置」だけでなく「何回目の補充か」も混ぜて `seed` から導出する。
/// 位置だけで引くと、2回目の補充が1回目と同じ位置に同じ色を置いてしまい、
/// 「消えた場所に同じ色がまた降ってきて同じ塊を再形成する」軌道が系統的に過剰になる。
#[derive(Debug, Clone)]
pub struct UnknownFill {
    pub policy: UnknownFillPolicy,
    /// サンプルごとの乱数種。
    pub seed: u64,
    /// 補充を許す回数の上限。実際のゲームでは無制限に降ってくるが、評価を有界にするため打ち切る。
    pub max_refills: u32,
}

/// 充填専用の決定的な擬似乱数 (SplitMix64)。時刻由来の乱数は使わない。
struct FillRng(u64);

impl FillRng {
    fn new(seed: u64) -> FillRng {
        FillRng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15).wrapping_add(1))
    }

    fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// 0 以上 n 未満の一様乱数。2^64 に対する剰余の偏りは無視できる。
    fn below(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }
}

#[derive(Debug)]
/// Bitboard を使った Simulator 実装
pub struct SimulatorBB<'a> {
    pub environment: &'a SimulationEnvironment,
    pub boost_area: u64,
    /// 不確定ぷよの扱い。`None` は [`UnknownFillPolicy::Inert`] と同じ。
    pub unknown_fill: Option<&'a UnknownFill>,
    /// これまでに補充した回数。`unknown_fill` の上限判定に使う。
    pub refills_done: std::cell::Cell<u32>,
}

impl<'a> SimulatorBB<'a> {
    /// フィールドとネクストぷよからビットボードを作成する。
    pub fn create_bit_boards(
        field: &[[Option<PuyoType>; 8]; 6],
        next_puyos: &[Option<PuyoType>; 8],
    ) -> BitBoards {
        let mut boards = BitBoards {
            colors: [0, 0, 0, 0, 0],
            heart: 0,
            prism: 0,
            ojama: 0,
            kata: 0,
            question: 0,
            plus: 0,
            chance: 0,
        };

        fn distribute_bit(puyo_type: PuyoType, bit: u64, boards: &mut BitBoards) {
            if is_plus_type(puyo_type) {
                boards.plus |= bit;
            }
            if is_chance_type(puyo_type) {
                boards.chance |= bit;
            }
            let attr = get_attr(puyo_type);

            match attr {
                PuyoAttr::Red => boards.colors[0] |= bit,
                PuyoAttr::Blue => boards.colors[1] |= bit,
                PuyoAttr::Green => boards.colors[2] |= bit,
                PuyoAttr::Yellow => boards.colors[3] |= bit,
                PuyoAttr::Purple => boards.colors[4] |= bit,
                PuyoAttr::Heart => boards.heart |= bit,
                PuyoAttr::Prism => boards.prism |= bit,
                PuyoAttr::Ojama => boards.ojama |= bit,
                PuyoAttr::Kata => boards.kata |= bit,
                PuyoAttr::Question => boards.question |= bit,
            }
        }

        for y in 0..field.len() {
            let row = field[y];
            for x in 0..row.len() {
                let bit: u64 = 1 << ((7 - x) * HEIGHT + (5 - y));
                if let Some(puyo_type) = row[x] {
                    distribute_bit(puyo_type, bit, &mut boards);
                }
            }
        }

        for x in 0..next_puyos.len() {
            let bit: u64 = 1 << ((7 - x) * HEIGHT + 6);
            if let Some(puyo_type) = next_puyos[x] {
                distribute_bit(puyo_type, bit, &mut boards);
            }
        }

        return boards;
    }

    /// 座標のリストからビットボードを作成する。
    pub fn coords_to_board<'b, T: std::iter::Iterator<Item = &'b PuyoCoord>>(coord_iter: T) -> u64 {
        let mut board = 0;

        for c in coord_iter {
            let x = c.x as usize;
            let y = c.y as usize;
            let bit: u64 = 1 << ((7 - x) * HEIGHT + (5 - y));
            board |= bit;
        }
        return board;
    }

    /// なぞり消し(あるいは塗り替え)を実施して連鎖を発生させる。(フル Chain 構築版)
    pub fn do_chains(&self, boards: &mut BitBoards, trace: u64) -> Vec<Chain> {
        let mut chains: Vec<Chain> = Vec::new();
        self.fold_chains(boards, trace, &mut |o: PopOutcome| {
            chains.push(Self::chain_from_outcome(&o));
        });
        return chains;
    }

    /// なぞり消しを実施し、探索で必要なスカラーだけを集約する。
    /// HashMap / Vec<Chain> を一切確保しないので、全候補を回す探索の高速版に使う。
    pub fn do_chains_aggregate(&self, boards: &mut BitBoards, trace: u64) -> ChainsAggregate {
        let mut agg = ChainsAggregate::default();
        self.fold_chains(boards, trace, &mut |o: PopOutcome| Self::accumulate(&mut agg, o));
        return agg;
    }

    /// 連鎖1回分の `PopOutcome` を集約に足し込む。
    #[inline]
    fn accumulate(agg: &mut ChainsAggregate, o: PopOutcome) {
        for i in 0..5 {
            if let Some(cp) = o.colors[i] {
                agg.color_strength[i] += cp.strength;
                agg.popped[i] += cp.popped_count;
            }
        }
        agg.popped[5] += o.heart_count;
        agg.popped[6] += o.prism_count;
        agg.popped[7] += o.ojama_count;
        agg.popped[8] += o.kata_count;
        agg.prism_strength += 3.0 * o.prism_count as f64;
        agg.boost_count += o.boost_count;
        agg.puyo_tsukai_count += o.puyo_tsukai_count;
        agg.popped_chance_num += o.popped_chance_num;
        agg.is_all_cleared |= o.is_all_cleared;
    }

    /// なぞり消しを実施し、**決定論フェーズを1回だけ計算**して、そこから先を
    /// 補充パターンごとに分岐させた集約を返す。
    ///
    /// 乱数を使うのは [`Self::fill_unknown`] だけで、それは [`Self::drop_next_into_field`] の
    /// 末尾でしか呼ばれない。つまり「なぞり消し → フィールド内落下の連鎖 → 最初のネクスト落下の
    /// 詰め処理」までは全サンプルでビット単位に同一なので、そこまでを共有してサンプル数分の
    /// 再計算を省く。
    ///
    /// ネクスト落下の時点でフィールドに空きが無ければ補充は起きないので、その場合は
    /// **さらに先まで共有する** ([`Self::advance_to_first_refill`])。分岐するのは
    /// 「実際に不確定ぷよが盤面に入る」最初の1点。
    ///
    /// `out` の長さは `fills.len() + 1` であること。`out[0]` は補充なし (決定論)、
    /// `out[1 + i]` が `fills[i]` に対応する。`self.unknown_fill` は無視する。
    pub fn do_chains_aggregate_multi(
        &self,
        boards: &BitBoards,
        trace: u64,
        fills: &[UnknownFill],
        out: &mut [ChainsAggregate],
    ) {
        assert_eq!(
            out.len(),
            fills.len() + 1,
            "出力バッファの長さは fills.len() + 1 であること"
        );

        let mut shared_boards = boards.clone();
        let mut shared = ChainsAggregate::default();
        let chain_num = self.fold_field_phase(&mut shared_boards, trace, &mut |o: PopOutcome| {
            Self::accumulate(&mut shared, o)
        });

        // どのサンプルでも補充が起きないなら、全サンプルが同値になる。
        let any_fill_applies = fills
            .iter()
            .any(|f| f.policy != UnknownFillPolicy::Inert && f.max_refills > 0);
        let mut chain_num = match chain_num {
            Some(c) => c,
            None => {
                for slot in out.iter_mut() {
                    *slot = shared.clone();
                }
                return;
            }
        };
        let restore = self.advance_to_first_refill(
            &mut shared_boards,
            &mut chain_num,
            any_fill_applies,
            &mut |o: PopOutcome| Self::accumulate(&mut shared, o),
        );
        let Some(restore) = restore else {
            for slot in out.iter_mut() {
                *slot = shared.clone();
            }
            return;
        };

        for (i, slot) in out.iter_mut().enumerate() {
            let sim = SimulatorBB {
                environment: self.environment,
                boost_area: self.boost_area,
                unknown_fill: if i == 0 { None } else { Some(&fills[i - 1]) },
                refills_done: std::cell::Cell::new(0),
            };
            let mut boards = shared_boards.clone();
            let mut agg = shared.clone();
            sim.fill_unknown(&mut boards, restore);
            sim.fold_next_phase(&mut boards, chain_num, &mut |o: PopOutcome| {
                Self::accumulate(&mut agg, o)
            });
            *slot = agg;
        }
    }

    /// 連鎖駆動の共通ループ。各連鎖で `PopOutcome` を sink に渡す。
    /// do_chains (フル) と do_chains_aggregate (スカラー) で共有し、シミュレーション本体の二重化を防ぐ。
    fn fold_chains<F: FnMut(PopOutcome)>(&self, boards: &mut BitBoards, trace: u64, sink: &mut F) {
        let Some(chain_num) = self.fold_field_phase(boards, trace, sink) else {
            return;
        };
        if self.drop_next_into_field(boards) {
            self.fold_next_phase(boards, chain_num, sink);
        }
    }

    /// なぞり消し〜フィールド内落下だけの決定論フェーズ。不確定ぷよは一切関与しない。
    /// 戻り値はここまでの連鎖数。何も消えなければ `None` (以降のフェーズも起きない)。
    #[inline]
    fn fold_field_phase<F: FnMut(PopOutcome)>(
        &self,
        boards: &mut BitBoards,
        trace: u64,
        sink: &mut F,
    ) -> Option<u32> {
        let mut chain_num: u32 = 0;

        let popped_or_cleared = match self.environment.trace_mode {
            TraceMode::Normal => {
                let rest = !trace;
                for c in 0..boards.colors.len() {
                    boards.colors[c] &= rest;
                }
                boards.heart &= rest;
                boards.prism &= rest;
                boards.plus &= rest;
                boards.chance &= rest;
                trace != 0
            }
            TraceMode::ToRed
            | TraceMode::ToBlue
            | TraceMode::ToGreen
            | TraceMode::ToYellow
            | TraceMode::ToPurple => {
                let rest = !trace;
                for c in 0..boards.colors.len() {
                    boards.colors[c] &= rest;
                }
                boards.heart &= rest;
                boards.prism &= rest;
                let c = self.environment.trace_mode.to_usize().unwrap()
                    - TraceMode::ToRed.to_usize().unwrap();
                boards.colors[c] |= trace;
                match self.pop_puyo_blocks(boards, false, chain_num + 1) {
                    Some(o) => {
                        chain_num += 1;
                        sink(o);
                        true
                    }
                    None => false,
                }
            }
        };

        if !popped_or_cleared {
            return None;
        }

        while self.drop_in_field(boards) {
            match self.pop_puyo_blocks(boards, false, chain_num + 1) {
                Some(o) => {
                    chain_num += 1;
                    sink(o);
                }
                None => break,
            }
        }
        Some(chain_num)
    }

    /// 不確定ぷよが実際に盤面へ入る最初の地点まで、決定論のまま進める。
    /// 戻り値はその地点の `restore` ([`Self::compact_next_into_field`] の戻り値)。
    /// そこへ到達せずに連鎖が終われば `None` (= 全サンプルが同値)。
    ///
    /// ネクストが落ちてもフィールドに空きが無ければ [`Self::fill_unknown`] は何もしないので、
    /// その連鎖はまだ全サンプルで共通。「消えた数がネクストで埋まりきる」なぞりでは
    /// ここで何連鎖分も共有できる。
    #[inline]
    fn advance_to_first_refill<F: FnMut(PopOutcome)>(
        &self,
        boards: &mut BitBoards,
        chain_num: &mut u32,
        any_fill_applies: bool,
        sink: &mut F,
    ) -> Option<u64> {
        loop {
            let restore = Self::compact_next_into_field(boards)?;
            if any_fill_applies && (FIELD_MASK & !restore) != 0 {
                return Some(restore);
            }
            match self.pop_puyo_blocks(boards, true, *chain_num + 1) {
                Some(o) => {
                    *chain_num += 1;
                    sink(o);
                }
                None => return None,
            }
            while self.drop_in_field(boards) {
                match self.pop_puyo_blocks(boards, true, *chain_num + 1) {
                    Some(o) => {
                        *chain_num += 1;
                        sink(o);
                    }
                    None => break,
                }
            }
        }
    }

    /// ネクスト落下後のフェーズ。**呼び出し時点でネクストの落下が1回済んでいること**。
    #[inline]
    fn fold_next_phase<F: FnMut(PopOutcome)>(
        &self,
        boards: &mut BitBoards,
        mut chain_num: u32,
        sink: &mut F,
    ) {
        loop {
            match self.pop_puyo_blocks(boards, true, chain_num + 1) {
                Some(o) => {
                    chain_num += 1;
                    sink(o);
                }
                None => break,
            }
            while self.drop_in_field(boards) {
                match self.pop_puyo_blocks(boards, true, chain_num + 1) {
                    Some(o) => {
                        chain_num += 1;
                        sink(o);
                    }
                    None => break,
                }
            }
            if !self.drop_next_into_field(boards) {
                break;
            }
        }
    }

    /// PopOutcome からフルの Chain (属性 HashMap 付き) を構築する。勝者の再構築時のみ使う。
    fn chain_from_outcome(o: &PopOutcome) -> Chain {
        let mut attributes: HashMap<PuyoAttr, AttributeChain> = HashMap::new();
        for i in 0..5 {
            if let Some(cp) = o.colors[i] {
                let attr = PuyoAttr::from_u8(PuyoAttr::Red.to_u8().unwrap() + i as u8).unwrap();
                attributes.insert(
                    attr,
                    AttributeChain {
                        strength: cp.strength,
                        popped_count: cp.popped_count,
                        separated_blocks_num: cp.separated_blocks_num,
                    },
                );
            }
        }
        if o.heart_count != 0 {
            attributes.insert(
                PuyoAttr::Heart,
                AttributeChain {
                    strength: 0.0,
                    popped_count: o.heart_count,
                    separated_blocks_num: 0,
                },
            );
        }
        if o.prism_count != 0 {
            attributes.insert(
                PuyoAttr::Prism,
                AttributeChain {
                    strength: 3.0 * o.prism_count as f64,
                    popped_count: o.prism_count,
                    separated_blocks_num: 0,
                },
            );
        }
        if o.ojama_count != 0 {
            attributes.insert(
                PuyoAttr::Ojama,
                AttributeChain {
                    strength: 0.0,
                    popped_count: o.ojama_count,
                    separated_blocks_num: 0,
                },
            );
        }
        if o.kata_count != 0 {
            attributes.insert(
                PuyoAttr::Kata,
                AttributeChain {
                    strength: 0.0,
                    popped_count: o.kata_count,
                    separated_blocks_num: 0,
                },
            );
        }
        Chain {
            chain_num: o.chain_num,
            simultaneous_num: o.simultaneous_num,
            boost_count: o.boost_count,
            puyo_tsukai_count: o.puyo_tsukai_count,
            attributes,
            popped_chance_num: o.popped_chance_num,
            is_all_cleared: o.is_all_cleared,
        }
    }

    /// 繋がったぷよを消す。消えるものが無ければ None。
    fn pop_puyo_blocks(
        &self,
        boards: &mut BitBoards,
        is_next_dropped: bool,
        chain_num: u32,
    ) -> Option<PopOutcome> {
        let red = boards.colors[0] & FIELD_MASK;
        let blue = boards.colors[1] & FIELD_MASK;
        let green = boards.colors[2] & FIELD_MASK;
        let yellow = boards.colors[3] & FIELD_MASK;
        let purple = boards.colors[4] & FIELD_MASK;
        let heart = boards.heart & FIELD_MASK;
        let prism = boards.prism & FIELD_MASK;
        let ojama = boards.ojama & FIELD_MASK;
        let kata = boards.kata & FIELD_MASK;
        let plus = boards.plus & FIELD_MASK;
        let chance = boards.chance & FIELD_MASK;

        let detect_connected = if self.environment.minimum_puyo_num_for_popping == 3 {
            Self::detect_connected_min3
        } else {
            Self::detect_connected_min4
        };
        let colors_connected: [(u64, u32); 5] = [
            detect_connected(red),
            detect_connected(blue),
            detect_connected(green),
            detect_connected(yellow),
            detect_connected(purple),
        ];
        let total_colored_connected = colors_connected.iter().fold(0, |acc, c| acc | c.0);

        if total_colored_connected == 0 {
            return None;
        }

        let heart_connected = Self::expand(total_colored_connected, heart);
        let prism_connected = Self::expand(total_colored_connected, prism);
        let ojama_connected = Self::expand(total_colored_connected, ojama);
        let kata_connected = Self::expand(total_colored_connected, kata);

        let plus_connected = total_colored_connected & plus;
        let chance_connected = total_colored_connected & chance;

        let simultaneous_num = total_colored_connected.count_ones()
            + plus_connected.count_ones()
            + prism_connected.count_ones()
            + ojama_connected.count_ones();

        let mut colors: [Option<ColorPop>; 5] = [None; 5];

        for i in 0..colors_connected.len() {
            let (connected, separated_blocks_num) = colors_connected[i];
            if connected == 0 {
                continue;
            }

            let popped_count = connected.count_ones() + (connected & plus_connected).count_ones();
            let strength = calc_damage_term(
                1.0,
                calc_popping_factor(
                    simultaneous_num,
                    separated_blocks_num,
                    Some(self.environment.minimum_puyo_num_for_popping),
                    None,
                    Some(self.environment.popping_leverage),
                ),
                calc_chain_factor(chain_num, Some(self.environment.chain_leverage)).unwrap(),
            );

            colors[i] = Some(ColorPop {
                strength,
                popped_count,
                separated_blocks_num,
            });
        }

        let poppable_connected =
            total_colored_connected | heart_connected | prism_connected | ojama_connected;
        let boost_count = Self::calc_boost_count(self.boost_area, poppable_connected, plus);
        let puyo_tsukai_count =
            Self::calc_puyotsukai_count(self.boost_area, poppable_connected, plus);

        let rest = !poppable_connected;

        for i in 0..boards.colors.len() {
            boards.colors[i] &= rest;
        }
        boards.heart &= rest;
        boards.prism &= rest;
        boards.plus &= rest;
        boards.chance &= rest;
        boards.ojama &= rest;
        boards.ojama |= kata_connected;
        boards.kata &= !kata_connected;

        let is_all_cleared = if is_next_dropped {
            false
        } else {
            boards.is_field_all_cleared()
        };

        return Some(PopOutcome {
            chain_num,
            simultaneous_num,
            boost_count,
            puyo_tsukai_count,
            colors,
            heart_count: heart_connected.count_ones(),
            prism_count: prism_connected.count_ones(),
            ojama_count: ojama_connected.count_ones(),
            kata_count: kata_connected.count_ones(),
            popped_chance_num: chance_connected.count_ones(),
            is_all_cleared,
        });
    }

    /// フィールド内でぷよをドロップさせる。(ネクストは動かさない)
    fn drop_in_field(&self, boards: &mut BitBoards) -> bool {
        let occ = (boards.colors[0]
            | boards.colors[1]
            | boards.colors[2]
            | boards.colors[3]
            | boards.colors[4]
            | boards.heart
            | boards.prism
            | boards.ojama
            | boards.kata
            | boards.question)
            & FIELD_MASK;

        if occ == FIELD_MASK {
            return false;
        }

        let mut restore: u64 = 0;
        restore |= (1 << (occ & COL_MASK).count_ones()) - 1;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT)).count_ones()) - 1) << HEIGHT;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 2)).count_ones()) - 1) << HEIGHT * 2;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 3)).count_ones()) - 1) << HEIGHT * 3;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 4)).count_ones()) - 1) << HEIGHT * 4;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 5)).count_ones()) - 1) << HEIGHT * 5;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 6)).count_ones()) - 1) << HEIGHT * 6;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 7)).count_ones()) - 1) << HEIGHT * 7;

        for i in 0..boards.colors.len() {
            let board = boards.colors[i];
            boards.colors[i] = Self::pext_and_pdep(board, occ, restore) | (board & NEXT_MASK);
        }
        boards.heart = Self::pext_and_pdep(boards.heart, occ, restore) | (boards.heart & NEXT_MASK);
        boards.prism = Self::pext_and_pdep(boards.prism, occ, restore) | (boards.prism & NEXT_MASK);
        boards.ojama = Self::pext_and_pdep(boards.ojama, occ, restore) | (boards.ojama & NEXT_MASK);
        boards.kata = Self::pext_and_pdep(boards.kata, occ, restore) | (boards.kata & NEXT_MASK);
        boards.question =
            Self::pext_and_pdep(boards.question, occ, restore) | (boards.question & NEXT_MASK);
        boards.plus = Self::pext_and_pdep(boards.plus, occ, restore) | (boards.plus & NEXT_MASK);
        boards.chance =
            Self::pext_and_pdep(boards.chance, occ, restore) | (boards.chance & NEXT_MASK);

        return true;
    }

    /// ネクストをフィールドにドロップする。
    #[inline]
    fn drop_next_into_field(&self, boards: &mut BitBoards) -> bool {
        match Self::compact_next_into_field(boards) {
            Some(restore) => {
                self.fill_unknown(boards, restore);
                true
            }
            None => false,
        }
    }

    /// ネクストをフィールドに詰める処理だけ。**不確定ぷよの補充はしない**ので決定論。
    /// 戻り値は詰めたあとに占有されているビット (`restore`)。詰める余地が無ければ `None`。
    #[inline]
    fn compact_next_into_field(boards: &mut BitBoards) -> Option<u64> {
        let occ = boards.colors[0]
            | boards.colors[1]
            | boards.colors[2]
            | boards.colors[3]
            | boards.colors[4]
            | boards.heart
            | boards.prism
            | boards.ojama
            | boards.kata
            | boards.question;

        let mut restore: u64 = 0;
        restore |= (1 << (occ & COL_MASK).count_ones()) - 1;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT)).count_ones()) - 1) << HEIGHT;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 2)).count_ones()) - 1) << HEIGHT * 2;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 3)).count_ones()) - 1) << HEIGHT * 3;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 4)).count_ones()) - 1) << HEIGHT * 4;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 5)).count_ones()) - 1) << HEIGHT * 5;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 6)).count_ones()) - 1) << HEIGHT * 6;
        restore |= ((1 << (occ & (COL_MASK << HEIGHT * 7)).count_ones()) - 1) << HEIGHT * 7;

        if (restore & FIELD_MASK) == FIELD_MASK {
            return None;
        }

        for i in 0..boards.colors.len() {
            let board = boards.colors[i];
            boards.colors[i] = Self::pext_and_pdep(board, occ, restore);
        }

        boards.heart = Self::pext_and_pdep(boards.heart, occ, restore);
        boards.prism = Self::pext_and_pdep(boards.prism, occ, restore);
        boards.ojama = Self::pext_and_pdep(boards.ojama, occ, restore);
        boards.kata = Self::pext_and_pdep(boards.kata, occ, restore);
        boards.question = Self::pext_and_pdep(boards.question, occ, restore);
        boards.plus = Self::pext_and_pdep(boards.plus, occ, restore);
        boards.chance = Self::pext_and_pdep(boards.chance, occ, restore);

        return Some(restore);
    }

    /// 詰めたあとに空いたフィールドのマスを、不確定ぷよとして色ぷよで埋める。
    /// `restore` は詰めたあとに占有されているビット (列ごとの下位ビット)。
    ///
    /// 割り当て順はサンプルと補充回ごとにシャッフルする。固定順で走査すると、
    /// 先に処理されるマスほど制約が少なくて自由になり、盤面の位置によって色の決まり方が
    /// 変わってしまう (系統的なズレなのでサンプル数を増やしても消えない)。
    fn fill_unknown(&self, boards: &mut BitBoards, restore: u64) {
        let Some(fill) = self.unknown_fill else {
            return;
        };
        if fill.policy == UnknownFillPolicy::Inert {
            return;
        }
        let refill_no = self.refills_done.get();
        if refill_no >= fill.max_refills {
            return;
        }
        let empty = FIELD_MASK & !restore;
        if empty == 0 {
            return;
        }
        self.refills_done.set(refill_no + 1);

        // 補充回ごとに別の乱数列にする (同じ位置に同じ色が繰り返し降るのを防ぐ)。
        let mut rng = FillRng::new(
            fill.seed ^ (refill_no as u64 + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15),
        );

        // 対象マスを集めてシャッフルする。
        let mut cells = [0u8; 64];
        let mut cell_num = 0usize;
        let mut remaining = empty;
        while remaining != 0 {
            cells[cell_num] = remaining.trailing_zeros() as u8;
            cell_num += 1;
            remaining &= remaining - 1;
        }
        for i in (1..cell_num).rev() {
            let j = rng.below(i + 1);
            cells.swap(i, j);
        }

        // 割り当て済みの色 (-1 は未割り当て)。ChainAverse で隣接を見るのに使う。
        let mut assigned = [-1i8; 64];

        for k in 0..cell_num {
            let i = cells[k] as usize;

            let color = match fill.policy {
                UnknownFillPolicy::Inert => unreachable!(),
                UnknownFillPolicy::Random => rng.below(5),
                UnknownFillPolicy::ChainAverse => {
                    // 隣接する補充ぷよが使った色を除き、残りから**一様に**選ぶ。
                    // 「衝突したら次の色にずらす」方式だと (c, c+1) のペアが他の1.6倍出やすくなり、
                    // 全サンプルが同じ規則を共有するのでサンプル平均の収束先がずれる。
                    let mut usable = [true; 5];
                    for n in Self::filler_neighbors(i) {
                        if let Some(n) = n {
                            if assigned[n] >= 0 {
                                usable[assigned[n] as usize] = false;
                            }
                        }
                    }
                    let mut allowed = [0usize; 5];
                    let mut allowed_num = 0usize;
                    for (c, ok) in usable.iter().enumerate() {
                        if *ok {
                            allowed[allowed_num] = c;
                            allowed_num += 1;
                        }
                    }
                    // 4近傍なので最大4色しか塞がらず、必ず1色以上残る。
                    debug_assert!(allowed_num > 0);
                    allowed[rng.below(allowed_num)]
                }
            };

            assigned[i] = color as i8;
            boards.colors[color] |= 1u64 << i;
        }
    }

    /// 充填対象マスの4近傍 (フィールド内のみ。ネクスト行は対象外)。
    ///
    /// 割り当て順をシャッフルするため、前方・後方を問わず4方向すべてを見る必要がある
    /// (昇順走査なら後方2つは常に未割り当てだが、シャッフルするとそうならない)。
    fn filler_neighbors(i: usize) -> [Option<usize>; 4] {
        let row = i % HEIGHT;
        [
            if row > 0 { Some(i - 1) } else { None },
            // フィールドは各列 0..HEIGHT-1 の 6 行。HEIGHT-1 はネクスト行なので除く。
            if row + 2 < HEIGHT { Some(i + 1) } else { None },
            if i >= HEIGHT { Some(i - HEIGHT) } else { None },
            if i + HEIGHT < 8 * HEIGHT {
                Some(i + HEIGHT)
            } else {
                None
            },
        ]
    }

    /// PEXT命令とPDEP命令を使ってフィールドの隙間を埋める。
    fn pext_and_pdep(board: u64, occ: u64, restore: u64) -> u64 {
        let all = board.pext(occ);
        let new = all.pdep(restore);
        return new;
    }

    /// ある属性に関して3つ以上つながるぷよを検出する。返り値は (消える色ぷよのビットボード, 分離数)
    pub fn detect_connected_min3(board: u64) -> (u64, u32) {
        let u = Self::shift_up(board) & board;
        let d = Self::shift_down(board) & board;
        let l = Self::shift_left(board) & board;
        let r = Self::shift_right(board) & board;

        let u_and_d = u & d;
        let l_and_r = l & r;
        let u_or_d = u | d;
        let l_or_r = l | r;

        let vanishing = (u_and_d) | (l_and_r) | (u_or_d & l_or_r);

        if vanishing == 0 {
            return (0, 0);
        }

        let block_vanishing = Self::expand(vanishing, board);
        let separated_blocks_num = Self::calc_separated_blocks_num(vanishing);

        return (block_vanishing, separated_blocks_num);
    }

    /// ある属性に関して4つ以上つながるぷよを検出する。返り値は (消える色ぷよのビットボード, 分離数)
    pub fn detect_connected_min4(board: u64) -> (u64, u32) {
        let u = Self::shift_up(board) & board;
        let d = Self::shift_down(board) & board;
        let l = Self::shift_left(board) & board;
        let r = Self::shift_right(board) & board;

        let u_and_d = u & d;
        let l_and_r = l & r;
        let u_or_d = u | d;
        let l_or_r = l | r;

        let three = (u_and_d & l_or_r) | (l_and_r & u_or_d);
        let two = u_and_d | l_and_r | (u_or_d & l_or_r);

        let mut two_d = Self::shift_down(two) & two;
        two_d |= Self::shift_up(two_d);

        let mut two_l = Self::shift_left(two) & two;
        two_l |= Self::shift_right(two_l);

        let vanishing = three | two_d | two_l;

        if vanishing == 0 {
            return (0, 0);
        }

        let expanded_vanishing = Self::expand(vanishing, board);
        let separated_blocks_num = Self::calc_separated_blocks_num(vanishing);

        return (expanded_vanishing, separated_blocks_num);
    }

    /// 消えるぷよのボードから分離数を求める。
    pub fn calc_separated_blocks_num(vanishing_board: u64) -> u32 {
        let mut alones: u64 = 0;
        let mut connection = vanishing_board;

        Self::extract_alone(&mut connection, &mut alones);

        // 繋がっているぷよから少しづつ枝葉を刈り取る。
        // 刈り取った結果、孤立したぷよはalonesに集約しつつ、
        // 最終的にconnectionボードが空になるまで続ける。
        while connection != 0 {
            let u = Self::shift_up(connection) & connection;
            let d = Self::shift_down(connection) & connection;
            let l = Self::shift_left(connection) & connection;
            let r = Self::shift_right(connection) & connection;
            let not_u = !u;
            let not_d = !d;
            let not_l = !l;
            let not_r = !r;

            // 参考) 論理式を簡略化する方法
            // https://live.sympy.org/
            // u, d, l, r = symbols('u d l r')
            // only_d = And(And(And(Not(u), d), Not(l)), Not(r))
            // only_r = And(And(And(Not(u),Not(d)),Not(l)),r)
            // only_d_or_only_r = Or(only_d, only_r)
            // print(simplify(only_d_or_only_r))
            // ~l & ~u & (d | r) & (~d | ~r)

            // 刈り取る優先順位は、
            // 1. 右または下 (左か上と一か所のみ結合している)
            // 2. 上または左 (下か右と一か所のみ結合している)
            // 3. 右下 (上と左で二か所のみ結合している)
            // 一度刈り取りが発生すると結合状態が変わるので1からやり直す。

            let only_d = not_u & d & not_l & not_r;
            let only_r = not_u & not_d & not_l & r;
            let only_d_or_only_r = only_d | only_r;
            if only_d_or_only_r != 0 {
                connection &= !only_d_or_only_r;
                Self::extract_alone(&mut connection, &mut alones);
                continue;
            }

            let only_u = u & not_d & not_l & not_r;
            let only_l = not_u & not_d & l & not_r;
            let only_u_or_only_l = only_u | only_l;
            if only_u_or_only_l != 0 {
                connection &= !only_u_or_only_l;
                Self::extract_alone(&mut connection, &mut alones);
                continue;
            }

            let only_d_and_r = not_u & d & not_l & r;
            if only_d_and_r != 0 {
                connection &= !only_d_and_r;
                Self::extract_alone(&mut connection, &mut alones);
                continue;
            }
        }

        return alones.count_ones();
    }

    /// ブーストカウントを計算する。
    pub fn calc_boost_count(boost_area: u64, connected_board: u64, plus: u64) -> u32 {
        let in_boost = boost_area & connected_board;
        let plus_in_boost = in_boost & plus;
        let not_plus_in_boost = in_boost & !plus;
        return 2 * plus_in_boost.count_ones() + not_plus_in_boost.count_ones();
    }

    /// ぷよ使いカウントを計算する。
    pub fn calc_puyotsukai_count(boost_area: u64, connected_board: u64, plus: u64) -> u32 {
        let out_boost = !boost_area & connected_board;
        let plus_out_boost = out_boost & plus;
        let not_plus_out_boost = out_boost & !plus;
        let in_boost = boost_area & connected_board;
        let plus_in_boost = in_boost & plus;
        let not_plus_in_boost = in_boost & !plus;

        return 2 * plus_out_boost.count_ones()
            + not_plus_out_boost.count_ones()
            + 6 * plus_in_boost.count_ones()
            + 3 * not_plus_in_boost.count_ones();
    }

    /// ボードから孤立しているぷよを取りだしalonesに移動する。
    pub fn extract_alone(board: &mut u64, alones: &mut u64) {
        let alone = Self::detect_alone(*board);
        if alone != 0 {
            *alones |= alone;
            *board &= !alone;
        }
    }

    /// ボードから孤立ぷよを見つける。
    pub fn detect_alone(board: u64) -> u64 {
        let mut reduced = board;
        reduced &= !(Self::shift_up(reduced)
            | Self::shift_down(reduced)
            | Self::shift_left(reduced)
            | Self::shift_right(reduced));
        return reduced;
    }

    /// ボードの立っているビットの範囲を上下左右に広げてmaskで絞る。
    fn expand(board: u64, mask: u64) -> u64 {
        let u = Self::shift_up(board);
        let d = Self::shift_down(board);
        let l = Self::shift_left(board);
        let r = Self::shift_right(board);

        return (board | u | d | l | r) & mask;
    }

    /// ボードを左にシフトする。
    fn shift_left(board: u64) -> u64 {
        board << HEIGHT
    }

    /// ボードを右にシフトする。
    fn shift_right(board: u64) -> u64 {
        board >> HEIGHT
    }

    /// ボードを上にシフトする。
    fn shift_up(board: u64) -> u64 {
        (board << 1) & 0b_1111110_1111110_1111110_1111110_1111110_1111110_1111110_1111110
    }

    /// ボードを下にシフトする。
    fn shift_down(board: u64) -> u64 {
        (board >> 1) & 0b_0111111_0111111_0111111_0111111_0111111_0111111_0111111_0111111
    }

    /// 2次元配列をビットボードに詰める。(デバッグやテスト用)
    pub fn __pack_board(board78: [[u8; WIDTH]; HEIGHT]) -> u64 {
        let mut result: u64 = 0;

        for y in 0..board78.len() {
            let row = board78[y];
            for x in 0..row.len() {
                let flag = row[x];
                if flag > 0 {
                    result |= 1 << ((WIDTH - 1 - x) * HEIGHT + (HEIGHT - 1 - y));
                }
            }
        }

        return result;
    }

    /// ビットボードを2次元配列に展開する。(デバッグやテスト用)
    pub fn __unpack_board(bit_board: u64) -> [[u8; WIDTH]; HEIGHT] {
        let mut result: [[u8; WIDTH]; HEIGHT] = [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ];

        for i in 0..(WIDTH * HEIGHT) {
            if bit_board & (1 << i) > 0 {
                let rx = i / HEIGHT;
                let x = WIDTH - 1 - rx;
                let ry = i % HEIGHT;
                let y = HEIGHT - 1 - ry;
                result[y][x] = 1;
            }
        }

        return result;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 決定論プレフィックスを共有する [`SimulatorBB::do_chains_aggregate_multi`] が、
    /// サンプルごとに独立して回した従来の結果と**完全に一致**すること。
    /// (共有できるのは最初の補充より手前だけ、という前提が崩れたらここで落ちる)
    #[test]
    fn multi_matches_per_sample_runs() {
        let r = Some(PuyoType::Red);
        let b = Some(PuyoType::Blue);
        let g = Some(PuyoType::Green);
        let y = Some(PuyoType::Yellow);
        let p = Some(PuyoType::Purple);
        let h = Some(PuyoType::Heart);

        let field = [
            [r, p, h, p, y, g, y, y],
            [r, y, p, h, y, g, p, g],
            [b, y, g, b, h, y, g, p],
            [b, r, b, r, p, b, r, p],
            [y, g, p, p, r, b, g, g],
            [b, g, b, r, b, y, r, r],
        ];
        let next_puyos = [g, g, g, g, g, g, g, g];

        let seed_of = |s: u64| (s + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15);
        // policy と max_refills を混ぜる。補充が起きないサンプル (Inert / 上限0) が
        // 混ざっても、共有できる範囲の判定が壊れないことまで見る。
        let mixed: Vec<UnknownFill> = (0..6u64)
            .map(|s| UnknownFill {
                policy: match s % 3 {
                    0 => UnknownFillPolicy::ChainAverse,
                    1 => UnknownFillPolicy::Random,
                    _ => UnknownFillPolicy::Inert,
                },
                seed: seed_of(s),
                max_refills: (s % 3) as u32,
            })
            .collect();
        // 誰も補充しない一式 (共有を最後まで続ける経路) と、サンプル無し。
        let never: Vec<UnknownFill> = (0..3u64)
            .map(|s| UnknownFill {
                policy: UnknownFillPolicy::Inert,
                seed: seed_of(s),
                max_refills: 2,
            })
            .collect();
        let fill_sets: Vec<Vec<UnknownFill>> = vec![mixed, never, Vec::new()];

        for &(min_pop, trace_mode) in &[
            (3u32, TraceMode::Normal),
            (4u32, TraceMode::Normal),
            (4u32, TraceMode::ToPurple),
        ] {
            let environment = SimulationEnvironment {
                is_chance_mode: false,
                minimum_puyo_num_for_popping: min_pop,
                max_trace_num: 5,
                trace_mode,
                popping_leverage: 1.0,
                chain_leverage: 7.0,
            };
            let boards = SimulatorBB::create_bit_boards(&field, &next_puyos);

            // なぞりを横2マスずつ総当たりする (何も消えない/大連鎖する の両方を通す)。
            for (set_no, fills) in fill_sets.iter().enumerate() {
                for y0 in 0..6u8 {
                    for x0 in 0..7u8 {
                        let trace = SimulatorBB::coords_to_board(
                            [PuyoCoord { x: x0, y: y0 }, PuyoCoord { x: x0 + 1, y: y0 }].iter(),
                        );

                        let mut actual = vec![ChainsAggregate::default(); fills.len() + 1];
                        let simulator = SimulatorBB {
                            environment: &environment,
                            boost_area: 0,
                            unknown_fill: None,
                            refills_done: std::cell::Cell::new(0),
                        };
                        simulator.do_chains_aggregate_multi(&boards, trace, fills, &mut actual);

                        for i in 0..=fills.len() {
                            let sim = SimulatorBB {
                                environment: &environment,
                                boost_area: 0,
                                unknown_fill: if i == 0 { None } else { Some(&fills[i - 1]) },
                                refills_done: std::cell::Cell::new(0),
                            };
                            let expected = sim.do_chains_aggregate(&mut boards.clone(), trace);
                            assert_eq!(
                                actual[i], expected,
                                "min_pop={} mode={:?} fills={} trace=({},{}) sample={}",
                                min_pop, trace_mode, set_no, x0, y0, i
                            );
                        }
                    }
                }
            }
        }
    }

    /// ChainAverse の充填が、補充ぷよ同士を隣り合って同色にしないこと。
    /// (補充だけでは発火できない = 連鎖しにくい側に倒れていることの担保)
    #[test]
    fn chain_averse_fill_never_makes_adjacent_same_color() {
        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: crate::trace_mode::TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 1.0,
        };

        // 種を変えて何通りも試す。
        for seed in 0..200u64 {
            let fill = UnknownFill {
                policy: UnknownFillPolicy::ChainAverse,
                seed,
                max_refills: 1,
            };
            let simulator = SimulatorBB {
                environment: &environment,
                boost_area: 0,
                unknown_fill: Some(&fill),
                refills_done: std::cell::Cell::new(0),
            };

            let mut boards = BitBoards {
                colors: [0; 5],
                heart: 0,
                prism: 0,
                ojama: 0,
                kata: 0,
                question: 0,
                plus: 0,
                chance: 0,
            };
            // フィールドを全部空きにして埋めさせる。
            simulator.fill_unknown(&mut boards, 0);

            // 埋まった各マスの色を引き当て、4近傍で同色隣接が無いことを確かめる。
            let color_at = |i: usize| -> Option<usize> {
                (0..5).find(|&c| boards.colors[c] & (1u64 << i) != 0)
            };
            for i in 0..56usize {
                if i % HEIGHT >= HEIGHT - 1 {
                    continue; // ネクスト行は埋めない
                }
                let Some(c) = color_at(i) else {
                    panic!("フィールドのマス {} が埋まっていない", i);
                };
                // 上下 (同一列内)
                if i % HEIGHT + 1 < HEIGHT - 1 {
                    assert_ne!(Some(c), color_at(i + 1), "縦に同色が隣接した (i={})", i);
                }
                // 左右 (列は HEIGHT ビットずつ)
                if i + HEIGHT < 56 {
                    assert_ne!(Some(c), color_at(i + HEIGHT), "横に同色が隣接した (i={})", i);
                }
            }
        }
    }

    /// 既定 (unknown_fill: None) では一切充填されないこと。
    #[test]
    fn inert_fill_leaves_board_untouched() {
        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: crate::trace_mode::TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 1.0,
        };
        let simulator = SimulatorBB {
            environment: &environment,
            boost_area: 0,
            unknown_fill: None,
            refills_done: std::cell::Cell::new(0),
        };
        let mut boards = BitBoards {
            colors: [0; 5],
            heart: 0,
            prism: 0,
            ojama: 0,
            kata: 0,
            question: 0,
            plus: 0,
            chance: 0,
        };
        simulator.fill_unknown(&mut boards, 0);
        assert_eq!(boards.colors, [0u64; 5]);
    }

    use std::collections::HashSet;

    use super::*;

    #[test]
    fn test_pack_board() {
        assert_eq!(
            SimulatorBB::__pack_board([
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]),
            0b_00000000_0000000_0000000_0000000_0000000_0000000_0000000_0000000_0000000
        );
        assert_eq!(
            SimulatorBB::__pack_board([
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
            ]),
            0b_00000000_1111111_1111111_1111111_1111111_1111111_1111111_1111111_1111111
        );
        assert_eq!(
            SimulatorBB::__pack_board([
                [1, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 0],
            ]),
            0b_00000000_1110001_1111111_1111111_1111111_1111111_1111111_1111111_0000000
        );
    }

    #[test]
    fn test_unpack_board() {
        assert_eq!(
            SimulatorBB::__unpack_board(
                0b_00000000_0000000_0000000_0000000_0000000_0000000_0000000_0000000_0000000
            ),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ],
        );
        assert_eq!(
            SimulatorBB::__unpack_board(
                0b_00000000_1111111_1111111_1111111_1111111_1111111_1111111_1111111_1111111
            ),
            [
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
            ]
        );
        assert_eq!(
            SimulatorBB::__unpack_board(
                0b_00000000_1110001_1111111_1111111_1111111_1111111_1111111_1111111_0000000
            ),
            [
                [1, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 1, 1, 1, 1, 1, 0],
            ],
        );
    }

    #[test]
    fn test_detect_connected_min4_all_one() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
            ]
        );
        assert_eq!(s, 1);
    }

    #[test]
    fn test_detect_connected_min4_all_zero() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        );
        assert_eq!(s, 0);
    }

    #[test]
    fn test_detect_connected_min4_t_block() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 1, 1, 0, 0],
            [0, 1, 1, 0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 1, 0],
            [0, 0, 0, 0, 0, 1, 1, 1],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0, 0],
                [0, 1, 1, 0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 1, 1, 1],
            ]
        );
        assert_eq!(s, 2);
    }

    #[test]
    fn test_detect_connected_min4_i_block() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0],
            [1, 0, 1, 0, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 1, 0, 1],
            [1, 1, 1, 1, 0, 1, 1, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0, 1],
                [0, 0, 1, 0, 0, 0, 0, 1],
                [0, 0, 1, 0, 0, 0, 0, 1],
                [0, 0, 0, 0, 0, 0, 0, 1],
                [1, 1, 1, 1, 0, 0, 0, 0],
            ]
        );
        assert_eq!(s, 3);
    }

    #[test]
    fn test_detect_connected_min4_j_block() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0, 0],
            [1, 0, 1, 0, 1, 1, 0, 1],
            [1, 0, 1, 1, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [1, 1, 1, 0, 0, 1, 1, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0, 1],
                [0, 0, 1, 1, 0, 0, 0, 1],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 1, 0, 0, 0, 0, 0],
                [1, 1, 1, 0, 0, 0, 0, 0],
            ]
        );
        assert_eq!(s, 3);
    }

    #[test]
    fn test_detect_connected_min4_o_block() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 1, 0, 1, 1],
            [1, 0, 1, 1, 0, 0, 1, 1],
            [0, 0, 1, 1, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 1, 0, 1, 0, 0],
            [1, 1, 0, 1, 0, 1, 1, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 1, 1, 0, 0, 1, 1],
                [0, 0, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 0, 0, 0, 0, 0, 0],
                [1, 1, 0, 0, 0, 0, 0, 0],
            ]
        );
        assert_eq!(s, 3);
    }

    #[test]
    fn test_detect_connected_min4_z_block() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 1, 1, 0, 1],
            [0, 1, 1, 0, 1, 0, 1, 1],
            [0, 0, 0, 1, 0, 0, 1, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 1, 1, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 1, 1, 1, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 0, 0, 0, 0, 0, 1],
                [0, 1, 1, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 1, 0, 0, 0, 0, 0],
                [1, 1, 0, 0, 0, 0, 0, 0],
            ]
        );
        assert_eq!(s, 3);
    }

    #[test]
    fn test_detect_connected_min4_over_four_a() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 1, 1, 0, 0, 1],
            [0, 1, 1, 0, 1, 0, 1, 1],
            [0, 0, 1, 0, 1, 0, 1, 1],
            [1, 1, 0, 0, 1, 1, 0, 0],
            [1, 0, 1, 0, 1, 0, 1, 1],
            [1, 1, 1, 0, 1, 0, 1, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 0, 1, 1, 0, 0, 1],
                [0, 1, 1, 0, 1, 0, 1, 1],
                [0, 0, 1, 0, 1, 0, 1, 1],
                [1, 1, 0, 0, 1, 1, 0, 0],
                [1, 0, 1, 0, 1, 0, 0, 0],
                [1, 1, 1, 0, 1, 0, 0, 0],
            ]
        );
        assert_eq!(s, 4);
    }

    #[test]
    fn test_detect_connected_min4_over_four_b() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 1, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 1, 0, 0],
                [0, 0, 0, 1, 1, 1, 0, 0],
                [0, 0, 0, 1, 0, 0, 0, 0],
                [0, 0, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        );
        assert_eq!(s, 1);
    }

    #[test]
    fn test_detect_connected_min4_over_four_c() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 0],
            [0, 1, 1, 1, 0, 0, 0, 0],
            [0, 1, 0, 1, 0, 0, 0, 0],
            [0, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 1, 1, 1],
            [1, 1, 1, 0, 0, 1, 1, 1],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 1, 1, 1, 0, 0, 0, 0],
                [0, 1, 0, 1, 0, 0, 0, 0],
                [0, 1, 1, 1, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 1, 1, 1],
                [1, 1, 1, 0, 0, 1, 1, 1],
            ]
        );
        assert_eq!(s, 3);
    }

    #[test]
    fn test_detect_connected_min4_over_four_d() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 0, 1, 0, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 0, 1, 0, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 0, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 0, 0],
                [0, 1, 0, 1, 0, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 0, 0],
                [0, 1, 0, 1, 0, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 0, 0],
            ]
        );
        assert_eq!(s, 1);
    }

    #[test]
    fn test_detect_connected_min4_over_four_e() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0],
            [0, 1, 0, 1, 0, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 0, 1, 0, 1, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 0, 0, 0],
                [0, 1, 0, 1, 0, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 0, 0],
                [0, 1, 0, 1, 0, 1, 0, 0],
                [0, 0, 1, 1, 1, 0, 0, 0],
            ]
        );
        assert_eq!(s, 1);
    }

    #[test]
    fn test_detect_connected_min4_over_four_f() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0],
            [0, 1, 0, 1, 0, 1, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 0],
            [0, 1, 0, 1, 0, 1, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 0, 0, 0],
                [0, 1, 0, 1, 0, 1, 0, 0],
                [0, 1, 1, 0, 1, 1, 0, 0],
                [0, 1, 0, 1, 0, 1, 0, 0],
                [0, 0, 1, 1, 1, 0, 0, 0],
            ]
        );
        assert_eq!(s, 4);
    }

    #[test]
    fn test_detect_connected_min4_over_four_g() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 1, 1, 0],
            [0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 1],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 1, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 0, 0],
                [0, 0, 0, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        );
        assert_eq!(s, 1);
    }

    #[test]
    fn test_detect_connected_min4_over_four_h() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 0],
            [0, 0, 0, 1, 1, 0, 1, 1],
            [1, 1, 1, 1, 0, 0, 1, 1],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min4(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 1, 1, 1, 0],
                [0, 0, 0, 1, 1, 0, 1, 1],
                [1, 1, 1, 1, 0, 0, 1, 1],
            ]
        );
        assert_eq!(s, 1);
    }

    #[test]
    fn test_detect_connected_min3_all_one() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min3(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
            ]
        );
        assert_eq!(s, 1);
    }

    #[test]
    fn test_detect_connected_min3_all_zero() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min3(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        );
        assert_eq!(s, 0);
    }

    #[test]
    fn test_detect_connected_min3_complex() {
        let board = SimulatorBB::__pack_board([
            [0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 1, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 1, 1],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [1, 1, 0, 1, 0, 1, 1, 0],
            [0, 1, 0, 1, 0, 0, 0, 0],
            [1, 1, 0, 0, 1, 1, 1, 1],
        ]);
        let (b, s) = SimulatorBB::detect_connected_min3(board);
        assert_eq!(
            SimulatorBB::__unpack_board(b),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 0, 1, 1, 1, 0, 1],
                [1, 0, 0, 0, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 1, 0, 0],
                [1, 1, 0, 0, 0, 1, 1, 0],
                [0, 1, 0, 0, 0, 0, 0, 0],
                [1, 1, 0, 0, 1, 1, 1, 1],
            ]
        );
        assert_eq!(s, 6);
    }

    #[test]
    fn test_create_bit_boards() {
        // Arrange
        let r = PuyoType::Red;
        let b = PuyoType::Blue;
        let g = PuyoType::Green;
        let y = PuyoType::Yellow;
        let p = PuyoType::Purple;
        let h = PuyoType::Heart;
        let field = [
            [r, p, h, p, y, g, y, y],
            [r, y, p, h, y, g, p, g],
            [b, y, g, b, h, y, g, p],
            [b, r, b, r, p, b, r, p],
            [y, g, p, p, r, b, g, g],
            [b, g, b, r, b, y, r, r],
        ]
        .map(|row| row.map(|t| Some(t)));
        let next_puyos = [g, g, g, g, g, g, g, g].map(|t| Some(t));

        // Actual
        let actual = SimulatorBB::create_bit_boards(&field, &next_puyos);

        // Assert
        assert_eq!(
            SimulatorBB::__unpack_board(actual.colors[0]),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 0, 0, 0, 0, 0, 0, 0],
                [1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 0, 1, 0, 0, 1, 0],
                [0, 0, 0, 0, 1, 0, 0, 0],
                [0, 0, 0, 1, 0, 0, 1, 1],
            ],
        );
        assert_eq!(
            SimulatorBB::__unpack_board(actual.colors[1]),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 0, 0, 1, 0, 0, 0, 0],
                [1, 0, 1, 0, 0, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 0, 0],
                [1, 0, 1, 0, 1, 0, 0, 0],
            ],
        );
        assert_eq!(
            SimulatorBB::__unpack_board(actual.colors[2]),
            [
                [1, 1, 1, 1, 1, 1, 1, 1],
                [0, 0, 0, 0, 0, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 0, 1],
                [0, 0, 1, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 0, 0, 0, 0, 1, 1],
                [0, 1, 0, 0, 0, 0, 0, 0],
            ],
        );
        assert_eq!(
            SimulatorBB::__unpack_board(actual.colors[3]),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 1, 0, 1, 1],
                [0, 1, 0, 0, 1, 0, 0, 0],
                [0, 1, 0, 0, 0, 1, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 1, 0, 0],
            ],
        );
        assert_eq!(
            SimulatorBB::__unpack_board(actual.colors[4]),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 0, 1, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 1],
                [0, 0, 0, 0, 1, 0, 0, 1],
                [0, 0, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ],
        );
        assert_eq!(
            SimulatorBB::__unpack_board(actual.heart),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 1, 0, 0, 0, 0, 0],
                [0, 0, 0, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 1, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ],
        );
        assert_eq!(actual.prism, 0);
        assert_eq!(actual.ojama, 0);
        assert_eq!(actual.kata, 0);
        assert_eq!(actual.question, 0);
        assert_eq!(actual.plus, 0);
        assert_eq!(actual.chance, 0);
    }

    #[test]
    fn test_create_trace() {
        // Arrange
        let trace_coords: Vec<PuyoCoord> = vec![PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }];

        // Actual
        let actual = SimulatorBB::coords_to_board(trace_coords.iter());

        // Assert
        assert_eq!(
            SimulatorBB::__unpack_board(actual),
            [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0],
            ]
        );
    }

    #[test]
    fn test_do_chains_for_special_rule_1_1() {
        // Arrange
        let r = Some(PuyoType::Red);
        let b = Some(PuyoType::Blue);
        let g = Some(PuyoType::Green);
        let y = Some(PuyoType::Yellow);
        let p = Some(PuyoType::Purple);
        let h = Some(PuyoType::Heart);

        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 3,
            max_trace_num: 5,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 7.0,
        };
        let field = [
            [r, p, h, p, y, g, y, y],
            [r, y, p, h, y, g, p, g],
            [b, y, g, b, h, y, g, p],
            [b, r, b, r, p, b, r, p],
            [y, g, p, p, r, b, g, g],
            [b, g, b, r, b, y, r, r],
        ];
        let next_puyos = [g, g, g, g, g, g, g, g];
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos);
        let trace_coords: Vec<PuyoCoord> = vec![PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }];
        let trace = SimulatorBB::coords_to_board(trace_coords.iter());

        let simulator = SimulatorBB {
            environment: &environment,
            boost_area: 0,
            unknown_fill: None,
            refills_done: std::cell::Cell::new(0),
        };

        // Act
        let actual = simulator.do_chains(&mut boards, trace);

        // Assert
        assert_eq!(actual.len(), 14);
        assert_eq!(
            actual[0],
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
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            actual[1],
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
            actual[2],
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
            actual[3],
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
            actual[4],
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
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[5],
            Chain {
                chain_num: 6,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 10.799999999999999,
                            popped_count: 3,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[6],
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
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[7],
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
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[8],
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
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[9],
            Chain {
                chain_num: 10,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 16.400000000000002,
                            popped_count: 3,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[10],
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
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[11],
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
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[12],
            Chain {
                chain_num: 13,
                simultaneous_num: 3,
                boost_count: 0,
                puyo_tsukai_count: 3,
                attributes: HashMap::from([(
                    PuyoAttr::Purple,
                    AttributeChain {
                        strength: 20.599999999999998,
                        popped_count: 3,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[13],
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
                        separated_blocks_num: 2
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
    }

    #[test]
    fn test_do_chains_for_special_rule_2_1() {
        // Arrange
        let r = Some(PuyoType::Red);
        let b = Some(PuyoType::Blue);
        let g = Some(PuyoType::Green);
        let y = Some(PuyoType::Yellow);
        let p = Some(PuyoType::Purple);
        let h = Some(PuyoType::Heart);
        let w = Some(PuyoType::Prism);

        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::ToBlue,
            popping_leverage: 1.0,
            chain_leverage: 10.0,
        };
        let field = [
            [y, p, r, g, y, g, b, g],
            [p, g, p, h, w, y, r, g],
            [p, p, b, b, y, b, g, r],
            [y, y, y, g, p, y, g, r],
            [g, g, p, r, g, p, b, r],
            [p, g, p, r, r, p, p, b],
        ];
        let next_puyos = [b, b, b, b, b, b, b, b];
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos);
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 3, y: 0 },
            PuyoCoord { x: 5, y: 0 },
            PuyoCoord { x: 4, y: 1 },
            PuyoCoord { x: 4, y: 2 },
            PuyoCoord { x: 3, y: 3 },
        ];
        let trace = SimulatorBB::coords_to_board(trace_coords.iter());

        let simulator = SimulatorBB {
            environment: &environment,
            boost_area: 0,
            unknown_fill: None,
            refills_done: std::cell::Cell::new(0),
        };

        // Act
        let actual = simulator.do_chains(&mut boards, trace);

        // Assert
        assert_eq!(actual.len(), 10);
        assert_eq!(
            actual[0],
            Chain {
                chain_num: 1,
                simultaneous_num: 6,
                boost_count: 0,
                puyo_tsukai_count: 7,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 1.3,
                            popped_count: 6,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[1],
            Chain {
                chain_num: 2,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Purple,
                    AttributeChain {
                        strength: 5.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[2],
            Chain {
                chain_num: 3,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Yellow,
                    AttributeChain {
                        strength: 8.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[3],
            Chain {
                chain_num: 4,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 11.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[4],
            Chain {
                chain_num: 5,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Purple,
                    AttributeChain {
                        strength: 13.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[5],
            Chain {
                chain_num: 6,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 15.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[6],
            Chain {
                chain_num: 7,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Purple,
                    AttributeChain {
                        strength: 17.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[7],
            Chain {
                chain_num: 8,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Red,
                    AttributeChain {
                        strength: 19.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[8],
            Chain {
                chain_num: 9,
                simultaneous_num: 4,
                boost_count: 0,
                puyo_tsukai_count: 4,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 21.0,
                        popped_count: 4,
                        separated_blocks_num: 1
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[9],
            Chain {
                chain_num: 10,
                simultaneous_num: 13,
                boost_count: 0,
                puyo_tsukai_count: 13,
                attributes: HashMap::from([(
                    PuyoAttr::Blue,
                    AttributeChain {
                        strength: 108.09999999999998,
                        popped_count: 13,
                        separated_blocks_num: 2
                    }
                )]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
    }

    #[test]
    fn test_do_chains_for_chance_mode() {
        // Arrange
        let r = Some(PuyoType::Red);
        let b = Some(PuyoType::Blue);
        let g = Some(PuyoType::Green);
        let y = Some(PuyoType::Yellow);
        let p = Some(PuyoType::Purple);
        let e: Option<PuyoType> = None;

        let environment = SimulationEnvironment {
            is_chance_mode: true,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 1.0,
        };
        let field = [
            [p, b, e, g, g, g, e, e],
            [p, g, p, p, r, r, r, y],
            [g, p, g, b, p, b, y, b],
            [b, g, b, p, b, r, b, r],
            [y, b, y, b, r, p, r, r],
            [y, y, g, r, b, b, y, y],
        ];
        let next_puyos: [Option<PuyoType>; 8] = [None, None, None, None, None, None, None, None];
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos);
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 3, y: 2 },
            PuyoCoord { x: 4, y: 3 },
            PuyoCoord { x: 5, y: 4 },
            PuyoCoord { x: 3, y: 4 },
            PuyoCoord { x: 2, y: 5 },
        ];
        let trace = SimulatorBB::coords_to_board(trace_coords.iter());
        let simulator = SimulatorBB {
            environment: &environment,
            boost_area: 0,
            unknown_fill: None,
            refills_done: std::cell::Cell::new(0),
        };

        // Act
        let actual = simulator.do_chains(&mut boards, trace);

        // Assert
        assert_eq!(actual.len(), 4);
        assert_eq!(
            actual[0],
            Chain {
                chain_num: 1,
                simultaneous_num: 9,
                boost_count: 0,
                puyo_tsukai_count: 9,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 5,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 4,
                            separated_blocks_num: 1
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false,
            }
        );
        assert_eq!(
            actual[1],
            Chain {
                chain_num: 2,
                simultaneous_num: 12,
                boost_count: 0,
                puyo_tsukai_count: 12,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 3.08,
                            popped_count: 5,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 3.08,
                            popped_count: 7,
                            separated_blocks_num: 1
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[2],
            Chain {
                chain_num: 3,
                simultaneous_num: 11,
                boost_count: 0,
                puyo_tsukai_count: 11,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Green,
                        AttributeChain {
                            strength: 3.4849999999999994,
                            popped_count: 7,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 3.4849999999999994,
                            popped_count: 4,
                            separated_blocks_num: 1
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[3],
            Chain {
                chain_num: 4,
                simultaneous_num: 8,
                boost_count: 0,
                puyo_tsukai_count: 8,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 3.2,
                            popped_count: 4,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 3.2,
                            popped_count: 4,
                            separated_blocks_num: 1
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: true
            }
        );
    }

    #[test]
    fn test_do_chains_for_arle_boost_area() {
        // Arrange
        let r = Some(PuyoType::Red);
        let rp = Some(PuyoType::RedPlus);
        let b = Some(PuyoType::Blue);
        let bp = Some(PuyoType::BluePlus);
        let g = Some(PuyoType::Green);
        let gcp = Some(PuyoType::GreenChancePlus);
        let y = Some(PuyoType::Yellow);
        let yp = Some(PuyoType::YellowPlus);
        let p = Some(PuyoType::Purple);
        let pp = Some(PuyoType::PurplePlus);
        let h = Some(PuyoType::Heart);

        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 1.0,
        };
        let boost_area_coord_set = HashSet::from([
            PuyoCoord { x: 4, y: 1 },
            PuyoCoord { x: 3, y: 2 },
            PuyoCoord { x: 4, y: 2 },
            PuyoCoord { x: 3, y: 3 },
            PuyoCoord { x: 4, y: 3 },
            PuyoCoord { x: 3, y: 4 },
            PuyoCoord { x: 4, y: 5 },
        ]);
        let simulator = SimulatorBB {
            environment: &environment,
            boost_area: SimulatorBB::coords_to_board(boost_area_coord_set.iter()),
            unknown_fill: None,
            refills_done: std::cell::Cell::new(0),
        };
        let field = [
            [h, r, r, g, p, b, h, b],
            [h, p, b, b, g, r, p, g],
            [g, p, r, gcp, h, y, b, g],
            [g, p, r, r, p, b, b, y],
            [b, p, r, g, r, y, y, p],
            [p, b, p, g, p, g, p, r],
        ];
        let next_puyos = [pp, pp, pp, rp, yp, yp, pp, bp];
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos);
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 2, y: 2 },
            PuyoCoord { x: 3, y: 3 },
            PuyoCoord { x: 4, y: 3 },
            PuyoCoord { x: 4, y: 4 },
            PuyoCoord { x: 5, y: 3 },
        ];
        let trace = SimulatorBB::coords_to_board(trace_coords.iter());

        // Act
        let actual = simulator.do_chains(&mut boards, trace);

        // Assert
        assert_eq!(actual.len(), 2);
        assert_eq!(
            actual[0],
            Chain {
                chain_num: 1,
                simultaneous_num: 9,
                boost_count: 4,
                puyo_tsukai_count: 19,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Green,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 5,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 1.75,
                            popped_count: 4,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 2,
                            separated_blocks_num: 0
                        }
                    ),
                ]),
                popped_chance_num: 1,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[1],
            Chain {
                chain_num: 2,
                simultaneous_num: 10,
                boost_count: 4,
                puyo_tsukai_count: 18,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 2.6599999999999997,
                            popped_count: 5,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 2.6599999999999997,
                            popped_count: 5,
                            separated_blocks_num: 1
                        }
                    )
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
    }

    #[test]
    fn test_do_chains_for_prism_and_ojama() {
        // Arrange
        let r = Some(PuyoType::Red);
        let b = Some(PuyoType::Blue);
        let g = Some(PuyoType::Green);
        let y = Some(PuyoType::Yellow);
        let p = Some(PuyoType::Purple);
        let h = Some(PuyoType::Heart);
        let w = Some(PuyoType::Prism);
        let o = Some(PuyoType::Ojama);
        let k = Some(PuyoType::Kata);
        let e: Option<PuyoType> = None;

        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 1.0,
        };
        let simulator = SimulatorBB {
            environment: &environment,
            boost_area: 0,
            unknown_fill: None,
            refills_done: std::cell::Cell::new(0),
        };
        let field = [
            [e, e, e, y, e, e, e, e],
            [e, e, e, p, k, e, e, e],
            [y, y, y, w, b, e, e, e],
            [p, p, p, b, g, k, k, k],
            [r, w, r, b, g, h, h, h],
            [r, r, h, b, g, o, h, h],
        ];
        let next_puyos: [Option<PuyoType>; 8] = [None, None, None, None, None, None, None, None];
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos);
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 4, y: 3 },
            PuyoCoord { x: 4, y: 4 },
            PuyoCoord { x: 4, y: 5 },
        ];
        let trace = SimulatorBB::coords_to_board(trace_coords.iter());

        // Act
        let actual = simulator.do_chains(&mut boards, trace);

        // Assert
        assert_eq!(actual.len(), 3);
        assert_eq!(
            actual[0],
            Chain {
                chain_num: 1,
                simultaneous_num: 6,
                boost_count: 0,
                puyo_tsukai_count: 7,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 1.3,
                            popped_count: 4,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 3.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    ),
                    (
                        PuyoAttr::Ojama,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    ),
                    (
                        PuyoAttr::Kata,
                        AttributeChain {
                            strength: 0.0,
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
            actual[1],
            Chain {
                chain_num: 2,
                simultaneous_num: 5,
                boost_count: 0,
                puyo_tsukai_count: 5,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Red,
                        AttributeChain {
                            strength: 1.6099999999999999,
                            popped_count: 4,
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
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[2],
            Chain {
                chain_num: 3,
                simultaneous_num: 9,
                boost_count: 0,
                puyo_tsukai_count: 9,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Yellow,
                        AttributeChain {
                            strength: 2.975,
                            popped_count: 4,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Purple,
                        AttributeChain {
                            strength: 2.975,
                            popped_count: 4,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Ojama,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    ),
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
    }

    #[test]
    fn test_do_chains_for_special_rule_2_1_regression() {
        // Arrange
        let r = Some(PuyoType::Red);
        let b = Some(PuyoType::Blue);
        let g = Some(PuyoType::Green);
        let y = Some(PuyoType::Yellow);
        let p = Some(PuyoType::Purple);
        let h = Some(PuyoType::Heart);
        let w = Some(PuyoType::Prism);

        let environment = SimulationEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 9,
            trace_mode: TraceMode::ToBlue,
            popping_leverage: 5.0,
            chain_leverage: 10.0,
        };
        let simulator = SimulatorBB {
            environment: &environment,
            boost_area: 0,
            unknown_fill: None,
            refills_done: std::cell::Cell::new(0),
        };
        let field = [
            [y, p, r, g, y, g, b, g],
            [p, g, p, h, w, y, r, g],
            [p, p, b, b, y, b, g, r],
            [y, y, y, g, p, y, g, r],
            [g, g, p, r, g, p, b, r],
            [p, g, p, r, r, p, p, b],
        ];
        let next_puyos = [b, b, b, b, b, b, b, b];
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos);
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 3, y: 0 },
            PuyoCoord { x: 4, y: 0 },
            PuyoCoord { x: 2, y: 1 },
            PuyoCoord { x: 1, y: 2 },
            PuyoCoord { x: 2, y: 2 },
            PuyoCoord { x: 0, y: 1 },
            PuyoCoord { x: 0, y: 2 },
            PuyoCoord { x: 3, y: 3 },
            PuyoCoord { x: 4, y: 2 },
        ];
        let trace = SimulatorBB::coords_to_board(trace_coords.iter());

        // Act
        let actual = simulator.do_chains(&mut boards, trace);

        // Assert
        assert_eq!(actual.len(), 9);
        assert_eq!(
            actual[0],
            Chain {
                chain_num: 1,
                simultaneous_num: 10,
                boost_count: 0,
                puyo_tsukai_count: 11,
                attributes: HashMap::from([
                    (
                        PuyoAttr::Blue,
                        AttributeChain {
                            strength: 5.5,
                            popped_count: 9,
                            separated_blocks_num: 1
                        }
                    ),
                    (
                        PuyoAttr::Heart,
                        AttributeChain {
                            strength: 0.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    ),
                    (
                        PuyoAttr::Prism,
                        AttributeChain {
                            strength: 3.0,
                            popped_count: 1,
                            separated_blocks_num: 0
                        }
                    ),
                ]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[1],
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
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[2],
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
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[3],
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
            actual[4],
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
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[5],
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
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[6],
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
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[7],
            Chain {
                chain_num: 8,
                simultaneous_num: 5,
                boost_count: 0,
                puyo_tsukai_count: 5,
                attributes: HashMap::from([(
                    PuyoAttr::Green,
                    AttributeChain {
                        strength: 33.25,
                        popped_count: 5,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
        assert_eq!(
            actual[8],
            Chain {
                chain_num: 9,
                simultaneous_num: 13,
                boost_count: 0,
                puyo_tsukai_count: 13,
                attributes: HashMap::from([(
                    PuyoAttr::Blue,
                    AttributeChain {
                        strength: 162.74999999999997,
                        popped_count: 13,
                        separated_blocks_num: 1
                    }
                ),]),
                popped_chance_num: 0,
                is_all_cleared: false
            }
        );
    }
}
