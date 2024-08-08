use crate::{
    chain::Chain,
    chain_helper::{
        sum_attr_popped_count, sum_colored_attr_damage, sum_puyo_tsukai_count, sum_wild_damage,
    },
    exploration_target::{
        CountingBonusType, ExplorationCategory, ExplorationTarget, PreferenceKind,
    },
    puyo::{Field, NextPuyos},
    puyo_attr::PuyoAttr,
    puyo_coord::PuyoCoord,
    puyo_type::is_traceable_type,
    simulation_environment::SimulationEnvironment,
    simulator_bb::{BitBoards, SimulatorBB},
    solution::{ExplorationResult, SolutionResult, SolutionState},
};
use std::{
    cmp,
    collections::{HashMap, HashSet},
    sync::OnceLock,
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

fn better_solution<'a>(
    preference_priorities: &Vec<PreferenceKind>,
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
    boost_area: u64,
    field: &'a Field,
    boards: BitBoards,
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

            let solution_result = self.calc_solution_result(st.get_trace_coords().clone());

            self.update_exploration_result(solution_result, exploration_result);

            for next_coord in st.get_next_candidate_coords() {
                self.advance_trace(&st, *next_coord, exploration_result);
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
        let chains = self.do_chains_bb(&trace_coords);
        let popped_chance_num = chains.iter().map(|c| c.popped_chance_num).sum();
        let popped_heart_num = sum_attr_popped_count(&chains, PuyoAttr::Heart);
        let popped_prism_num = sum_attr_popped_count(&chains, PuyoAttr::Prism);
        let popped_ojama_num = sum_attr_popped_count(&chains, PuyoAttr::Ojama);
        let popped_kata_num = sum_attr_popped_count(&chains, PuyoAttr::Kata);
        let is_all_cleared = chains.iter().any(|c| c.is_all_cleared);

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
            popped_chance_num,
            popped_heart_num,
            popped_prism_num,
            popped_ojama_num,
            popped_kata_num,
            is_all_cleared,
        };
    }

    /// Bitboardを使ったシミュレーターで連鎖させる。
    fn do_chains_bb(&self, trace_coords: &Vec<PuyoCoord>) -> Vec<Chain> {
        let sim = SimulatorBB {
            environment: self.environment,
            boost_area: self.boost_area,
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
}
