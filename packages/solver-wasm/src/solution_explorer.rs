use std::{cmp, collections::HashMap, sync::OnceLock};

use crate::{
    chain_helper::{
        sum_attr_popped_count, sum_colored_attr_damage, sum_puyo_tsukai_count, sum_wild_damage,
    },
    exploration_target::{
        CountingBonusType, ExplorationCategory, ExplorationTarget, PreferenceKind,
    },
    puyo::{Field, NextPuyos},
    puyo_coord::PuyoCoord,
    puyo_type::is_traceable_type,
    simulator::{SimulationEnvironment, Simulator},
    solution::{ExplorationResult, SolutionResult, SolutionState},
};

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

fn better_solution_by_chance_popped<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.is_chance_popped && !s1.is_chance_popped {
        return Some(s2);
    }
    if !s2.is_chance_popped && s1.is_chance_popped {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_prism_popped<'a>(
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> Option<&'a SolutionResult> {
    if s2.is_prism_popped && !s1.is_prism_popped {
        return Some(s2);
    }
    if !s2.is_prism_popped && s1.is_prism_popped {
        return Some(s1);
    }
    return None;
}

fn better_solution_by_all_cleared<'a>(
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

type BetterFn = for<'a> fn(&'a SolutionResult, &'a SolutionResult) -> Option<&'a SolutionResult>;

static BETTER_METHOD_MAP: OnceLock<HashMap<PreferenceKind, BetterFn>> = OnceLock::new();

fn better_solution<'a>(
    preference_priorities: &[PreferenceKind; 5],
    s1: &'a SolutionResult,
    s2: &'a SolutionResult,
) -> &'a SolutionResult {
    let table = BETTER_METHOD_MAP.get_or_init(|| {
        return HashMap::from([
            (
                PreferenceKind::BiggerValue,
                better_solution_by_bigger_value as BetterFn,
            ),
            (
                PreferenceKind::ChancePop,
                better_solution_by_chance_popped as BetterFn,
            ),
            (
                PreferenceKind::PrismPop,
                better_solution_by_prism_popped as BetterFn,
            ),
            (
                PreferenceKind::AllClear,
                better_solution_by_all_cleared as BetterFn,
            ),
            (
                PreferenceKind::SmallerTraceNum,
                better_solution_by_smaller_trace_num as BetterFn,
            ),
        ]);
    });

    for pref in preference_priorities {
        if let Some(method) = table.get(pref) {
            if let Some(s) = method(s1, s2) {
                return s;
            }
        }
    }
    return s1;
}

pub struct SolutionExplorer<'a> {
    exploration_target: &'a ExplorationTarget,
    environment: &'a SimulationEnvironment,
    field: &'a Field,
    next_puyos: &'a NextPuyos,
}

impl<'a> SolutionExplorer<'a> {
    pub fn new(
        exploration_target: &'a ExplorationTarget,
        environment: &'a SimulationEnvironment,
        field: &'a Field,
        next_puyos: &'a NextPuyos,
    ) -> SolutionExplorer<'a> {
        return SolutionExplorer {
            exploration_target,
            environment,
            field,
            next_puyos,
        };
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
        return result;
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
                return Some(result);
            }
        }
    }

    fn advance_trace(
        &self,
        state: &SolutionState,
        coord: PuyoCoord,
        exploration_result: &mut ExplorationResult,
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

            let solution_result = self.calc_solution_result(st.get_trace_coords());
            self.update_exploration_result(solution_result, exploration_result);

            for candidate_set in st.get_trace_coord_map().values() {
                for next_coord in candidate_set {
                    self.advance_trace(&st, *next_coord, exploration_result);
                }
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

    fn calc_solution_result(&self, trace_coords: Vec<PuyoCoord>) -> SolutionResult {
        let sim = Simulator {
            environment: self.environment,
        };
        let chains = sim.do_chains(
            &mut self.field.clone(),
            &mut self.next_puyos.clone(),
            &trace_coords,
        );
        let is_all_cleared = chains.iter().any(|c| c.is_all_cleared);
        let is_chance_popped = chains.iter().any(|c| c.is_chance_popped);
        let is_prism_popped = chains.iter().any(|c| c.is_prism_popped);

        let value: f64;

        match self.exploration_target.category {
            ExplorationCategory::Damage => {
                if let Some(main_attr) = self.exploration_target.main_attr {
                    let main_value = sum_colored_attr_damage(&chains, main_attr);
                    let main_sub_ratio = match self.exploration_target.main_sub_ratio {
                        Some(ratio) => ratio,
                        None => 0.0,
                    };
                    let sub_value = match self.exploration_target.sub_attr {
                        Some(sub_attr) => {
                            sum_colored_attr_damage(&chains, sub_attr) * main_sub_ratio
                        }
                        None => 0.0,
                    };
                    value = main_value + sub_value;
                }
                // ワイルド
                else {
                    value = sum_wild_damage(&chains);
                }
            }
            ExplorationCategory::SkillPuyoCount => {
                if let Some(main_attr) = self.exploration_target.main_attr {
                    let main_value = sum_attr_popped_count(&chains, main_attr);
                    let mut bonus_value: u32 = 0;
                    if let Some(counting_bonus) = &self.exploration_target.counting_bonus {
                        if counting_bonus.bonus_type == CountingBonusType::Step {
                            let height = counting_bonus
                                .target_attrs
                                .iter()
                                .fold(0, |acc, attr| acc + sum_attr_popped_count(&chains, *attr));
                            let mut steps = height / counting_bonus.step_height as u32;
                            if !counting_bonus.repeat {
                                steps = cmp::min(1, steps);
                            }
                            bonus_value = counting_bonus.bonus_count as u32 * steps;
                        }
                    }
                    value = (main_value + bonus_value) as f64
                } else {
                    value = 0 as f64;
                }
            }
            ExplorationCategory::PuyotsukaiCount => {
                value = sum_puyo_tsukai_count(&chains) as f64;
            }
        }

        return SolutionResult {
            trace_coords,
            chains,
            value,
            is_all_cleared,
            is_chance_popped,
            is_prism_popped,
        };
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

    #[test]
    fn test_solve_all_traces_special_rule_1_1() {
        // Arrange
        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: [
                PreferenceKind::BiggerValue,
                PreferenceKind::ChancePop,
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::SmallerTraceNum,
            ],
            optimal_solution_count: 2,
            main_attr: Some(PuyoAttr::Green),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let environment = SimulationEnvironment {
            boost_area_coord_set: HashSet::new(),
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 3,
            max_trace_num: 3,
            trace_mode: TraceMode::Normal,
            popping_leverage: 1.0,
            chain_leverage: 7.0,
        };
        let r = PuyoType::Red;
        let b = PuyoType::Blue;
        let g = PuyoType::Green;
        let y = PuyoType::Yellow;
        let p = PuyoType::Purple;
        let h = PuyoType::Heart;
        let mut id_counter = 0;
        let field = [
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
        let next_puyos = [g, g, g, g, g, g, g, g].map(|puyo_type| {
            id_counter += 1;
            Some(Puyo {
                id: id_counter,
                puyo_type,
            })
        });
        let explorer = SolutionExplorer {
            exploration_target: &exploration_target,
            environment: &environment,
            field: &field,
            next_puyos: &next_puyos,
        };

        // Act
        let actual = explorer.solve_all_traces();

        // Arrange
        assert_eq!(actual.candidates_num, 804);
        assert_eq!(actual.optimal_solutions.len(), 2);
        assert_eq!(
            actual.optimal_solutions[0],
            SolutionResult {
                trace_coords: Vec::from([PuyoCoord { x: 5, y: 2 }, PuyoCoord { x: 6, y: 2 }]),
                chains: Vec::from([
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
                    },
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
                    },
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
                    },
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
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                                separated_blocks_num: 1,
                            },
                        ),]),
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
                ]),
                value: 108.99999999999999,
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
            }
        );
        assert_eq!(
            actual.optimal_solutions[1],
            SolutionResult {
                trace_coords: Vec::from([
                    PuyoCoord { x: 4, y: 1 },
                    PuyoCoord { x: 5, y: 2 },
                    PuyoCoord { x: 6, y: 2 }
                ]),
                chains: Vec::from([
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
                    },
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
                    },
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
                    },
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
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                                separated_blocks_num: 1,
                            },
                        ),]),
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
                ]),
                value: 108.99999999999999,
                is_all_cleared: false,
                is_chance_popped: false,
                is_prism_popped: false
            }
        );
    }

    #[test]
    fn test_solve_all_traces_special_rule_2_1_preferring_prism_and_all_clear() {
        // Arrange
        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: [
                PreferenceKind::PrismPop,
                PreferenceKind::AllClear,
                PreferenceKind::BiggerValue,
                PreferenceKind::ChancePop,
                PreferenceKind::SmallerTraceNum,
            ],
            optimal_solution_count: 1,
            main_attr: Some(PuyoAttr::Blue),
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let environment = SimulationEnvironment {
            boost_area_coord_set: HashSet::new(),
            is_chance_mode: false,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 5,
            trace_mode: TraceMode::ToBlue,
            popping_leverage: 1.0,
            chain_leverage: 10.0,
        };
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
        let explorer = SolutionExplorer {
            exploration_target: &exploration_target,
            environment: &environment,
            field: &field,
            next_puyos: &next_puyos,
        };

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
        assert_eq!(
            solution.chains,
            Vec::from([
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: true
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: true,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
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
                    is_all_cleared: false,
                    is_chance_popped: false,
                    is_prism_popped: false,
                },
            ])
        );
        assert_eq!(solution.value, 68.80000000000001);
        assert_eq!(solution.is_all_cleared, true);
        assert_eq!(solution.is_chance_popped, false);
        assert_eq!(solution.is_prism_popped, true);
    }

    #[test]
    fn test_solve_all_traces_chance_mode_for_wild_preferring_all_clear() {
        // Arrange
        let exploration_target = ExplorationTarget {
            category: ExplorationCategory::Damage,
            preference_priorities: [
                PreferenceKind::AllClear,
                PreferenceKind::BiggerValue,
                PreferenceKind::ChancePop,
                PreferenceKind::PrismPop,
                PreferenceKind::SmallerTraceNum,
            ],
            optimal_solution_count: 2,
            main_attr: None,
            sub_attr: None,
            main_sub_ratio: None,
            counting_bonus: None,
        };
        let environment = SimulationEnvironment {
            boost_area_coord_set: HashSet::new(),
            is_chance_mode: true,
            minimum_puyo_num_for_popping: 4,
            max_trace_num: 48,
            trace_mode: TraceMode::Normal,
            popping_leverage: 5.0,
            chain_leverage: 1.0,
        };
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
        let explorer = SolutionExplorer {
            exploration_target: &exploration_target,
            environment: &environment,
            field: &field,
            next_puyos: &next_puyos,
        };

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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false
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
                        is_all_cleared: true,
                        is_chance_popped: false,
                        is_prism_popped: false
                    }
                ]),
                value: 66.35,
                is_all_cleared: true,
                is_chance_popped: false,
                is_prism_popped: false
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
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
                        is_all_cleared: false,
                        is_chance_popped: false,
                        is_prism_popped: false,
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
                        is_all_cleared: true,
                        is_chance_popped: false,
                        is_prism_popped: false,
                    },
                ]),
                value: 22.3,
                is_all_cleared: true,
                is_chance_popped: false,
                is_prism_popped: false
            }
        );
    }
}
