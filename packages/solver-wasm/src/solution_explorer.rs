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
                PreferenceKind::BetterValue,
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
    max_trace_num: u8,
}

impl<'a> SolutionExplorer<'a> {
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
            if !state.check_if_addable_coord(&coord, self.max_trace_num) {
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
