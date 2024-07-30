/*!
 * ビートボードを使ったぷよの表現、消えるぷよの判定、ドロップ処理等。
 * @license [crimson-tea](https://github.com/crimson-tea/PuyoQueSolver/blob/master/LICENSE.txt)
 *
 * その他部分。
 * @license [pikumist](https://github.com/pikumist/puyomist/blob/main/LICENSE)
 */

use std::collections::{HashMap, HashSet};

use bitintr::{Pdep, Pext};
use num_traits::{FromPrimitive, ToPrimitive};
use serde::{Deserialize, Serialize};

use crate::{
    chain::{AttributeChain, Chain},
    damage::*,
    puyo_attr::PuyoAttr,
    puyo_coord::PuyoCoord,
    puyo_type::{get_attr, is_chance_type, is_plus_type, PuyoType},
    trace_mode::*,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationBBEnvironment {
    pub is_chance_mode: bool,
    pub minimum_puyo_num_for_popping: u32,
    pub max_trace_num: u32,
    pub trace_mode: TraceMode,
    pub popping_leverage: f64,
    pub chain_leverage: f64,
}

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
    /** プラス属性のビットボード */
    plus: u64,
    /** チャンス属性のビットボード */
    chance: u64,
    /** ブーストエリアのビートボード */
    boost_area: u64,
}

impl BitBoards {
    pub fn is_field_all_cleared(&self) -> bool {
        let mut occ = self.colors.iter().fold(0, |acc, c| acc | c);
        occ |= self.prism;
        occ |= self.ojama;
        occ |= self.kata;
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

#[derive(Debug)]
pub struct SimulatorBB<'a> {
    pub environment: &'a SimulationBBEnvironment,
}

impl<'a> SimulatorBB<'a> {
    /// フィールドとネクストぷよとブーストエリアからビットーボードを作成する。
    pub fn create_bit_boards(
        field: &[[Option<PuyoType>; 8]; 6],
        next_puyos: &[Option<PuyoType>; 8],
        boost_area_coord_set: &HashSet<PuyoCoord>,
    ) -> BitBoards {
        let mut boards = BitBoards {
            colors: [0, 0, 0, 0, 0],
            heart: 0,
            prism: 0,
            ojama: 0,
            kata: 0,
            plus: 0,
            chance: 0,
            boost_area: 0,
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
                PuyoAttr::Padding => {}
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

        for c in boost_area_coord_set.iter() {
            let x = c.x as usize;
            let y = c.y as usize;
            let bit: u64 = 1 << ((7 - x) * HEIGHT + (5 - y));
            boards.boost_area |= bit;
        }

        return boards;
    }

    /// なぞり位置のビットボードを作成する。
    pub fn create_trace(trace_coords: &Vec<PuyoCoord>) -> u64 {
        let mut trace = 0;

        for c in trace_coords {
            let x = c.x as usize;
            let y = c.y as usize;
            let bit: u64 = 1 << ((7 - x) * HEIGHT + (5 - y));
            trace |= bit;
        }
        return trace;
    }

    /// なぞり消し(あるいは塗り替え)を実施して連鎖を発生させる。
    pub fn do_chains(&self, boards: &mut BitBoards, trace: u64) -> Vec<Chain> {
        let mut chains: Vec<Chain> = Vec::new();

        if self.activate_tracing(boards, trace, &mut chains) {
            while self.drop_in_field(boards) {
                if !self.pop_puyo_blocks(boards, &mut chains) {
                    break;
                }
            }
            while self.drop_next_into_field(boards) {
                if !self.pop_puyo_blocks(boards, &mut chains) {
                    break;
                }
                while self.drop_in_field(boards) {
                    if !self.pop_puyo_blocks(boards, &mut chains) {
                        break;
                    }
                }
            }
        }

        return chains;
    }

    /// なぞっている箇所を発火させる。
    fn activate_tracing(
        &self,
        boards: &mut BitBoards,
        trace: u64,
        chains: &mut Vec<Chain>,
    ) -> bool {
        let trace_mode = self.environment.trace_mode;
        let popped_or_cleared: bool;

        match trace_mode {
            TraceMode::Normal => {
                let rest = !trace;
                for c in 0..boards.colors.len() {
                    boards.colors[c] &= rest;
                }
                boards.heart &= rest;
                boards.prism &= rest;
                boards.plus &= rest;
                boards.chance &= rest;
                popped_or_cleared = trace != 0;
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
                let c = trace_mode.to_usize().unwrap() - TraceMode::ToRed.to_usize().unwrap();
                boards.colors[c] |= trace;
                popped_or_cleared = self.pop_puyo_blocks(boards, chains);
            }
        }

        return popped_or_cleared;
    }

    /// 繋がったぷよを消す。
    fn pop_puyo_blocks(&self, boards: &mut BitBoards, chains: &mut Vec<Chain>) -> bool {
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
            return false;
        }

        let chain_num = (chains.len() + 1) as u32;

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

        let mut attributes: HashMap<PuyoAttr, AttributeChain> = HashMap::new();

        for i in 0..colors_connected.len() {
            let (connected, separated_blocks_num) = colors_connected[i];
            if connected == 0 {
                continue;
            }

            let attr = PuyoAttr::from_u8(PuyoAttr::Red.to_u8().unwrap() + i as u8).unwrap();
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

            attributes.insert(
                attr,
                AttributeChain {
                    strength,
                    popped_count,
                    separated_blocks_num,
                },
            );
        }

        if heart_connected != 0 {
            attributes.insert(
                PuyoAttr::Heart,
                AttributeChain {
                    strength: 0.0,
                    popped_count: heart_connected.count_ones(),
                    separated_blocks_num: 0,
                },
            );
        }
        if prism_connected != 0 {
            let popped_count = prism_connected.count_ones();
            attributes.insert(
                PuyoAttr::Prism,
                AttributeChain {
                    strength: 3.0 * popped_count as f64,
                    popped_count,
                    separated_blocks_num: 0,
                },
            );
        }
        if ojama_connected != 0 {
            attributes.insert(
                PuyoAttr::Ojama,
                AttributeChain {
                    strength: 0.0,
                    popped_count: ojama_connected.count_ones(),
                    separated_blocks_num: 0,
                },
            );
        }
        /* TODO: 固ぷよも Chain に加える。他のシミュレーターも対応する必要がある。
        if kata_connected != 0 {
            attributes.insert(
                PuyoAttr::Kata,
                AttributeChain {
                    strength: 0.0,
                    popped_count: kata_connected.count_ones(),
                    separated_blocks_num: 0,
                },
            );
        }
        */

        let poppable_connected =
            total_colored_connected | heart_connected | prism_connected | ojama_connected;
        let boost_count = Self::calc_boost_count(boards.boost_area, poppable_connected, plus);
        let puyo_tsukai_count =
            Self::calc_puyotsukai_count(boards.boost_area, poppable_connected, plus);

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

        let chain = Chain {
            chain_num: (chains.len() + 1) as u32,
            simultaneous_num,
            boost_count,
            puyo_tsukai_count,
            attributes,
            is_all_cleared: boards.is_field_all_cleared(),
            is_chance_popped: chance_connected != 0,
            is_prism_popped: prism_connected != 0,
        };

        chains.push(chain);

        return true;
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
            | boards.kata)
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
        boards.plus = Self::pext_and_pdep(boards.plus, occ, restore) | (boards.plus & NEXT_MASK);
        boards.chance =
            Self::pext_and_pdep(boards.chance, occ, restore) | (boards.chance & NEXT_MASK);

        return true;
    }

    /// ネクストをフィールドにドロップする。
    fn drop_next_into_field(&self, boards: &mut BitBoards) -> bool {
        let occ = boards.colors[0]
            | boards.colors[1]
            | boards.colors[2]
            | boards.colors[3]
            | boards.colors[4]
            | boards.heart
            | boards.prism
            | boards.ojama
            | boards.kata;

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
            return false;
        }

        for i in 0..boards.colors.len() {
            let board = boards.colors[i];
            boards.colors[i] = Self::pext_and_pdep(board, occ, restore);
        }

        boards.heart = Self::pext_and_pdep(boards.heart, occ, restore);
        boards.prism = Self::pext_and_pdep(boards.prism, occ, restore);
        boards.ojama = Self::pext_and_pdep(boards.ojama, occ, restore);
        boards.kata = Self::pext_and_pdep(boards.kata, occ, restore);
        boards.plus = Self::pext_and_pdep(boards.plus, occ, restore);
        boards.chance = Self::pext_and_pdep(boards.chance, occ, restore);

        return true;
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
        let separeted_blocks_num = Self::calc_separated_blocks_num(vanishing);

        return (expanded_vanishing, separeted_blocks_num);
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

            let only_d_or_only_r = not_u & not_l & (d | r) & (not_d | not_r);
            if only_d_or_only_r != 0 {
                connection &= !only_d_or_only_r;
                Self::extract_alone(&mut connection, &mut alones);
                continue;
            }

            let only_u_or_only_l = not_d & not_r & (u | l) & (not_u | not_r);
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
        let actual = SimulatorBB::create_bit_boards(&field, &next_puyos, &HashSet::new());

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
        assert_eq!(actual.plus, 0);
        assert_eq!(actual.chance, 0);
    }

    #[test]
    fn test_create_trace() {
        // Arrange
        let trace_coords: Vec<PuyoCoord> = vec![PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }];

        // Actual
        let actual = SimulatorBB::create_trace(&trace_coords);

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

        let environment = SimulationBBEnvironment {
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
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos, &HashSet::new());
        let trace_coords: Vec<PuyoCoord> = vec![PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }];
        let trace = SimulatorBB::create_trace(&trace_coords);

        let simulator = SimulatorBB {
            environment: &environment,
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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

        let environment = SimulationBBEnvironment {
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
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos, &HashSet::new());
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 3, y: 0 },
            PuyoCoord { x: 5, y: 0 },
            PuyoCoord { x: 4, y: 1 },
            PuyoCoord { x: 4, y: 2 },
            PuyoCoord { x: 3, y: 3 },
        ];
        let trace = SimulatorBB::create_trace(&trace_coords);

        let simulator = SimulatorBB {
            environment: &environment,
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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

        let environment = SimulationBBEnvironment {
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
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos, &HashSet::new());
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 3, y: 2 },
            PuyoCoord { x: 4, y: 3 },
            PuyoCoord { x: 5, y: 4 },
            PuyoCoord { x: 3, y: 4 },
            PuyoCoord { x: 2, y: 5 },
        ];
        let trace = SimulatorBB::create_trace(&trace_coords);
        let simulator = SimulatorBB {
            environment: &environment,
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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
                is_all_cleared: true,
                is_chance_popped: false,
                is_prism_popped: false
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

        let environment = SimulationBBEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 1.0,
        };
        let simulator = SimulatorBB {
            environment: &environment,
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
        let boost_area_coord_set = HashSet::from([
            PuyoCoord { x: 4, y: 1 },
            PuyoCoord { x: 3, y: 2 },
            PuyoCoord { x: 4, y: 2 },
            PuyoCoord { x: 3, y: 3 },
            PuyoCoord { x: 4, y: 3 },
            PuyoCoord { x: 3, y: 4 },
            PuyoCoord { x: 4, y: 5 },
        ]);
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos, &boost_area_coord_set);
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 2, y: 2 },
            PuyoCoord { x: 3, y: 3 },
            PuyoCoord { x: 4, y: 3 },
            PuyoCoord { x: 4, y: 4 },
            PuyoCoord { x: 5, y: 3 },
        ];
        let trace = SimulatorBB::create_trace(&trace_coords);

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
                is_all_cleared: false,
                is_chance_popped: true,
                is_prism_popped: false
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
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

        let environment = SimulationBBEnvironment {
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 1.0,
        };
        let simulator = SimulatorBB {
            environment: &environment,
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
        let mut boards = SimulatorBB::create_bit_boards(&field, &next_puyos, &HashSet::new());
        let trace_coords: Vec<PuyoCoord> = vec![
            PuyoCoord { x: 4, y: 3 },
            PuyoCoord { x: 4, y: 4 },
            PuyoCoord { x: 4, y: 5 },
        ];
        let trace = SimulatorBB::create_trace(&trace_coords);

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
                    )
                ]),
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: true
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: true
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
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
            }
        );
    }
}
