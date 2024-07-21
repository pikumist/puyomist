use std::{
    cmp,
    collections::{HashMap, HashSet},
};

use num_traits::{FromPrimitive, ToPrimitive};
use serde::{Deserialize, Serialize};

use crate::{
    chain::{AttributeChain, Chain},
    damage::*,
    puyo::{Field, NextPuyos, Puyo},
    puyo_attr::{PuyoAttr, SPECIAL_ATTRS},
    puyo_coord::PuyoCoord,
    puyo_type::{convert_type, get_attr, is_chance_type, is_colored_type, is_plus_type, PuyoType},
    trace_mode::*,
};

// 同種ぷよの集まり
type Block = HashMap<PuyoCoord, Puyo>;

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockWithAttr {
    attr: PuyoAttr,
    block: Block,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulationEnvironment {
    pub boost_area_coord_set: HashSet<PuyoCoord>,
    pub is_chance_mode: bool,
    pub minimum_puyo_num_for_popping: u32,
    pub max_trace_num: u32,
    pub trace_mode: TraceMode,
    pub popping_leverage: f64,
    pub chain_leverage: f64,
}

#[derive(Debug)]
pub struct Simulator<'a> {
    pub environment: &'a SimulationEnvironment,
}

impl<'a> Simulator<'a> {
    /// なぞり消し(あるいは塗り替え)を実施して連鎖を発生させる。
    pub fn do_chains(
        &self,
        field: &mut Field,
        next_puyos: &mut NextPuyos,
        trace_coords: &Vec<PuyoCoord>,
    ) -> Vec<Chain> {
        let mut chains: Vec<Chain> = Vec::new();
        let mut id_counter = Self::max_id(field, next_puyos);

        if self.activate_tracing(field, trace_coords, &mut chains) {
            while self.drop_in_field(field) {
                if !self.pop_puyo_blocks(field, &mut chains) {
                    break;
                }
            }
            while self.drop_next_into_field(field, next_puyos, &mut id_counter) {
                if !self.pop_puyo_blocks(field, &mut chains) {
                    break;
                }
                while self.drop_in_field(field) {
                    if !self.pop_puyo_blocks(field, &mut chains) {
                        break;
                    }
                }
            }
        }

        return chains;
    }

    /// フィールド内で繋がって消えるぷよを判定する。
    pub fn detect_pop_blocks(&self, field: &Field) -> Vec<BlockWithAttr> {
        let mut rbgyp_blocks: [Vec<Block>; 5] =
            [Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new()];
        let red_attr_value = PuyoAttr::Red.to_usize().unwrap();

        for y in 0..PuyoCoord::Y_NUM {
            for x in 0..PuyoCoord::X_NUM {
                let cell = field[y as usize][x as usize];
                let puyo = if let Some(puyo) = cell {
                    puyo
                } else {
                    continue;
                };
                if !is_colored_type(puyo.puyo_type) {
                    continue;
                }

                let coord = PuyoCoord::xy_to_coord(x, y).unwrap();
                let attr = get_attr(puyo.puyo_type);

                let same_color_blocks =
                    &mut rbgyp_blocks[attr.to_usize().unwrap() - red_attr_value];

                let block_index_option = same_color_blocks
                    .iter()
                    .position(|b| b.contains_key(&coord));

                let block_option = if let Some(block_index) = block_index_option {
                    Some(same_color_blocks.remove(block_index))
                } else {
                    None
                };

                let right_coord = PuyoCoord::xy_to_coord(x + 1, y);
                let bottom_coord = PuyoCoord::xy_to_coord(x, y + 1);

                let same_color_bigger_neighbor_coords: Vec<PuyoCoord> = [right_coord, bottom_coord]
                    .into_iter()
                    .flatten()
                    .filter(|c| {
                        let cell = field[c.y as usize][c.x as usize];
                        if let Some(p) = cell {
                            return get_attr(p.puyo_type) == attr;
                        } else {
                            return false;
                        }
                    })
                    .collect();

                let mut new_block = if let Some(block) = block_option {
                    block
                } else {
                    Block::from([(coord, puyo)])
                };

                for neighbor_coord in same_color_bigger_neighbor_coords {
                    let branched_block_index_option = same_color_blocks
                        .iter()
                        .position(|b| b.contains_key(&neighbor_coord));

                    if let Some(branched_block_index) = branched_block_index_option {
                        let branched_block = same_color_blocks.remove(branched_block_index);
                        for (coord, puyo) in branched_block {
                            new_block.insert(coord, puyo);
                        }
                    } else {
                        new_block.insert(
                            neighbor_coord,
                            field[neighbor_coord.y as usize][neighbor_coord.x as usize].unwrap(),
                        );
                    };
                }

                if new_block.len() > 1 {
                    same_color_blocks.push(new_block);
                }
            }
        }

        let mut colored_blocks_to_be_popped: Vec<BlockWithAttr> = rbgyp_blocks
            .into_iter()
            .enumerate()
            .flat_map(|(i, blocks)| {
                let attr = PuyoAttr::from_usize(red_attr_value + i).unwrap();
                return blocks
                    .into_iter()
                    .filter(|b| b.len() >= self.environment.minimum_puyo_num_for_popping as usize)
                    .map(move |b| BlockWithAttr { attr, block: b });
            })
            .collect();

        let mut special_blocks_to_be_popped: Vec<BlockWithAttr> = Vec::new();

        for y in 0..PuyoCoord::Y_NUM {
            for x in 0..PuyoCoord::X_NUM {
                let cell = field[y as usize][x as usize];
                let puyo = if let Some(p) = cell {
                    p
                } else {
                    continue;
                };
                let attr = get_attr(puyo.puyo_type);
                if !SPECIAL_ATTRS.contains(&attr) {
                    continue;
                }

                let coord = PuyoCoord::xy_to_coord(x, y).unwrap();

                let left_coord = PuyoCoord::xy_to_coord(x.wrapping_sub(1), y);
                let top_coord = PuyoCoord::xy_to_coord(x, y.wrapping_sub(1));
                let right_coord = PuyoCoord::xy_to_coord(x + 1, y);
                let bottom_coord = PuyoCoord::xy_to_coord(x, y + 1);

                let neighbor_coords: Vec<PuyoCoord> =
                    [left_coord, right_coord, top_coord, bottom_coord]
                        .into_iter()
                        .flatten()
                        .collect();

                let hit = neighbor_coords.iter().any(|c| {
                    colored_blocks_to_be_popped
                        .iter()
                        .any(|b| b.block.contains_key(c))
                });

                if hit {
                    let block_option = special_blocks_to_be_popped
                        .iter_mut()
                        .find(|b| b.attr == attr);
                    if let Some(b) = block_option {
                        b.block.insert(coord, puyo);
                    } else {
                        let b = BlockWithAttr {
                            attr,
                            block: HashMap::from([(coord, puyo)]),
                        };
                        special_blocks_to_be_popped.push(b);
                    }
                }
            }
        }

        colored_blocks_to_be_popped.append(&mut special_blocks_to_be_popped);
        let blocks_to_be_popped = colored_blocks_to_be_popped;

        return blocks_to_be_popped;
    }

    /// フィールドとネクストぷよ内で最も大きいIDを返す。
    fn max_id(field: &Field, next_puyos: &NextPuyos) -> i32 {
        let field_max_id = field.iter().fold(0, |acc, row| {
            row.iter().fold(acc, |m, cell| match cell {
                None => m,
                Some(p) => cmp::max(p.id, m),
            })
        });
        return next_puyos
            .iter()
            .fold(field_max_id, |acc, cell| match cell {
                None => acc,
                Some(p) => cmp::max(p.id, acc),
            });
    }

    /// 繋がったぷよを消す。
    fn pop_puyo_blocks(&self, field: &mut Field, chains: &mut Vec<Chain>) -> bool {
        let blocks = self.detect_pop_blocks(field);
        if blocks.len() == 0 {
            return false;
        }

        let chain_num = (chains.len() + 1) as u32;
        let simultaneous_num = self.countup(&blocks, &Self::calc_simultaneous_num);
        let boost_count =
            self.countup(&blocks, &|attr: PuyoAttr,
                                    coord: &PuyoCoord,
                                    puyo: &Puyo| {
                self.calc_boost_count(attr, coord, puyo)
            });
        let puyo_tsukai_count =
            self.countup(&blocks, &|attr: PuyoAttr,
                                    coord: &PuyoCoord,
                                    puyo: &Puyo| {
                self.calc_puyotsukai_count(attr, coord, puyo)
            });

        let mut chain = Chain {
            chain_num,
            simultaneous_num,
            boost_count,
            puyo_tsukai_count,
            attributes: HashMap::new(),
            is_all_cleared: false,
            is_chance_popped: false,
        };

        let blocks_by_attr: HashMap<PuyoAttr, Vec<BlockWithAttr>> =
            blocks.into_iter().fold(HashMap::new(), |mut acc, b| {
                match acc.get_mut(&b.attr) {
                    Some(v) => v.push(b),
                    None => {
                        let attr = b.attr;
                        let mut v = Vec::new();
                        v.push(b);
                        acc.insert(attr, v);
                    }
                };
                return acc;
            });

        for (attr, blocks) in blocks_by_attr {
            match attr {
                PuyoAttr::Heart | PuyoAttr::Prism | PuyoAttr::Ojama => {
                    let popped_count = blocks[0].block.len() as u32;
                    chain.attributes.insert(
                        attr,
                        AttributeChain {
                            strength: if attr == PuyoAttr::Prism {
                                3.0 * popped_count as f64
                            } else {
                                0.0
                            },
                            popped_count,
                            separated_blocks_num: 0,
                        },
                    );
                    for b in blocks {
                        for (c, _puyo) in b.block {
                            field[c.y as usize][c.x as usize] = None;
                        }
                    }
                }
                PuyoAttr::Red
                | PuyoAttr::Blue
                | PuyoAttr::Green
                | PuyoAttr::Yellow
                | PuyoAttr::Purple => {
                    let separated_blocks_num = blocks.len() as u32;
                    let popped_count = self.countup(&blocks, &Self::calc_popped_count);
                    let strength = calc_damage_term(
                        1.0,
                        calc_popping_factor(
                            simultaneous_num,
                            separated_blocks_num,
                            Some(self.environment.minimum_puyo_num_for_popping),
                            None,
                            Some(self.environment.popping_leverage),
                        ),
                        calc_chain_factor(chain_num, Some(self.environment.chain_leverage))
                            .unwrap(),
                    );
                    chain.attributes.insert(
                        attr,
                        AttributeChain {
                            strength,
                            popped_count,
                            separated_blocks_num,
                        },
                    );
                    for b in blocks {
                        for (c, puyo) in b.block {
                            field[c.y as usize][c.x as usize] = None;
                            if is_chance_type(puyo.puyo_type) {
                                chain.is_chance_popped = true;
                            }
                        }
                    }
                }
                PuyoAttr::Kata => {
                    for b in blocks {
                        for (c, puyo) in b.block {
                            let id = puyo.id;
                            field[c.y as usize][c.x as usize] = Some(Puyo {
                                id,
                                puyo_type: PuyoType::Ojama,
                            })
                        }
                    }
                }
                _ => {}
            }
        }

        chain.is_all_cleared = field.iter().all(|row| row.iter().all(|p| p.is_none()));

        chains.push(chain);

        return true;
    }

    /// ブロックリストから何らかの数を数え上げる。counterで数え方を指定する。
    fn countup(
        &self,
        blocks: &Vec<BlockWithAttr>,
        counter: &dyn Fn(PuyoAttr, &PuyoCoord, &Puyo) -> u32,
    ) -> u32 {
        let result = blocks.iter().fold(0, |acc, b| {
            let addition = b.block.iter().fold(0, |m, e| {
                let (c, p) = e;
                return m + counter(b.attr, c, p);
            });
            return acc + addition;
        }) as u32;
        result
    }

    /// 同時消し数の数え方
    fn calc_simultaneous_num(attr: PuyoAttr, _coord: &PuyoCoord, puyo: &Puyo) -> u32 {
        match attr {
            PuyoAttr::Red
            | PuyoAttr::Blue
            | PuyoAttr::Green
            | PuyoAttr::Yellow
            | PuyoAttr::Purple => {
                if is_plus_type(puyo.puyo_type) {
                    2
                } else {
                    1
                }
            }
            PuyoAttr::Prism | PuyoAttr::Ojama => 1,
            // ハートは0であることに注意
            _ => 0,
        }
    }

    /// 繋がって消えたぷよの数え方
    fn calc_popped_count(attr: PuyoAttr, _coord: &PuyoCoord, puyo: &Puyo) -> u32 {
        match attr {
            PuyoAttr::Red
            | PuyoAttr::Blue
            | PuyoAttr::Green
            | PuyoAttr::Yellow
            | PuyoAttr::Purple => {
                if is_plus_type(puyo.puyo_type) {
                    2
                } else {
                    1
                }
            }
            PuyoAttr::Heart | PuyoAttr::Prism | PuyoAttr::Ojama => 1,
            _ => 0,
        }
    }

    /// ブーストカウントの数え方
    fn calc_boost_count(&self, attr: PuyoAttr, coord: &PuyoCoord, puyo: &Puyo) -> u32 {
        match attr {
            PuyoAttr::Red
            | PuyoAttr::Blue
            | PuyoAttr::Green
            | PuyoAttr::Yellow
            | PuyoAttr::Purple => {
                if self.environment.boost_area_coord_set.contains(coord) {
                    if is_plus_type(puyo.puyo_type) {
                        2
                    } else {
                        1
                    }
                } else {
                    0
                }
            }
            PuyoAttr::Heart | PuyoAttr::Prism | PuyoAttr::Ojama => {
                if self.environment.boost_area_coord_set.contains(coord) {
                    1
                } else {
                    0
                }
            }
            _ => 0,
        }
    }

    /// ぷよ使いカウントの数え方
    fn calc_puyotsukai_count(&self, attr: PuyoAttr, coord: &PuyoCoord, puyo: &Puyo) -> u32 {
        match attr {
            PuyoAttr::Red
            | PuyoAttr::Blue
            | PuyoAttr::Green
            | PuyoAttr::Yellow
            | PuyoAttr::Purple => {
                if self.environment.boost_area_coord_set.contains(coord) {
                    if is_plus_type(puyo.puyo_type) {
                        6
                    } else {
                        3
                    }
                } else {
                    1
                }
            }
            PuyoAttr::Heart | PuyoAttr::Prism | PuyoAttr::Ojama => {
                if self.environment.boost_area_coord_set.contains(coord) {
                    3
                } else {
                    1
                }
            }
            _ => 0,
        }
    }

    /// なぞっている箇所を発火させる
    fn activate_tracing(
        &self,
        field: &mut Field,
        trace_coords: &Vec<PuyoCoord>,
        chains: &mut Vec<Chain>,
    ) -> bool {
        let trace_mode = self.environment.trace_mode;
        let mut popped_or_cleared = false;

        match trace_mode {
            TraceMode::Normal => {
                for c in trace_coords.iter() {
                    field[c.y as usize][c.x as usize] = None;
                    popped_or_cleared = true;
                }
            }
            TraceMode::ToRed
            | TraceMode::ToBlue
            | TraceMode::ToGreen
            | TraceMode::ToYellow
            | TraceMode::ToPurple => {
                let attr = PuyoAttr::from_i32(trace_mode.to_i32().unwrap()).unwrap();
                for c in trace_coords.iter() {
                    let cell = field[c.y as usize][c.x as usize];
                    match cell {
                        None => {
                            continue;
                        }
                        Some(p) => {
                            field[c.y as usize][c.x as usize] = Some(Puyo {
                                id: p.id,
                                puyo_type: convert_type(p.puyo_type, attr),
                            });
                        }
                    }
                }
                popped_or_cleared = self.pop_puyo_blocks(field, chains);
            }
        }

        return popped_or_cleared;
    }

    /// フィールド内でぷよをドロップさせる (ネクストは動かさない)
    fn drop_in_field(&self, field: &mut Field) -> bool {
        let mut dropped = false;

        for x in 0..PuyoCoord::X_NUM {
            let mut col_from_bottom: Vec<Puyo> = Vec::new();

            for y in (0..PuyoCoord::Y_NUM).rev() {
                let cell = field[y as usize][x as usize];
                if let Some(p) = cell {
                    col_from_bottom.push(p);
                }
            }

            if col_from_bottom.len() == PuyoCoord::Y_NUM as usize {
                continue;
            }

            for y in 0..PuyoCoord::Y_NUM {
                let ry = PuyoCoord::Y_NUM as usize - 1 - y as usize;
                let cell = field[ry][x as usize];

                match col_from_bottom.get(y as usize) {
                    None => {
                        field[ry][x as usize] = None;
                        if cell.is_some() {
                            dropped = true;
                        }
                    }
                    Some(p) => {
                        field[ry][x as usize] = Some(*p);
                        match cell {
                            None => dropped = true,
                            Some(q) => {
                                if q.id != p.id {
                                    dropped = true;
                                }
                            }
                        }
                    }
                }
            }
        }

        return dropped;
    }

    /// ネクストをフィールドにドロップする
    fn drop_next_into_field(
        &self,
        field: &mut Field,
        next_puyos: &mut NextPuyos,
        id_counter: &mut i32,
    ) -> bool {
        let mut dropped = false;

        for x in 0..PuyoCoord::X_NUM {
            let mut col_from_bottom: Vec<Puyo> = Vec::new();

            for y in (0..PuyoCoord::Y_NUM).rev() {
                let cell = field[y as usize][x as usize];
                if let Some(p) = cell {
                    col_from_bottom.push(p);
                }
            }

            let puyo_num_in_col = col_from_bottom.len() as u8;

            if puyo_num_in_col == PuyoCoord::Y_NUM {
                continue;
            }

            let next = match next_puyos[x as usize] {
                None => {
                    *id_counter += 1;
                    let id = *id_counter;
                    Puyo {
                        id,
                        puyo_type: PuyoType::Padding,
                    }
                }
                Some(p) => p,
            };

            let top_y = PuyoCoord::Y_NUM - 1 - puyo_num_in_col;

            for y in (0..(top_y + 1)).rev() {
                let p = if y == top_y {
                    next
                } else {
                    *id_counter += 1;
                    let id = *id_counter;
                    Puyo {
                        id,
                        puyo_type: PuyoType::Padding,
                    }
                };
                field[y as usize][x as usize] = Some(p);
            }

            next_puyos[x as usize] = None;

            dropped = true;
        }

        return dropped;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[allow(warnings)]
    fn test_do_chains_for_special_rule_1_1() {
        // Arrange
        let r = PuyoType::Red;
        let b = PuyoType::Blue;
        let g = PuyoType::Green;
        let y = PuyoType::Yellow;
        let p = PuyoType::Purple;
        let h = PuyoType::Heart;

        let environment = SimulationEnvironment {
            boost_area_coord_set: HashSet::new(),
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 3,
            max_trace_num: 5,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 7.0,
        };
        let mut id_counter = 0;
        let mut field = [
            [r, p, h, p, y, g, y, y],
            [r, y, p, h, y, g, p, g],
            [b, y, g, b, h, y, g, p],
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
        let mut next_puyos = [g, g, g, g, g, g, g, g].map(|puyo_type| {
            id_counter += 1;
            Some(Puyo {
                id: id_counter,
                puyo_type,
            })
        });
        let trace_coords: Vec<PuyoCoord> = vec![PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }];
        let simulator = Simulator {
            environment: &environment,
        };

        // Act
        let actual = simulator.do_chains(&mut field, &mut next_puyos, &trace_coords);

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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
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
                is_chance_popped: false
            }
        );
    }
}
