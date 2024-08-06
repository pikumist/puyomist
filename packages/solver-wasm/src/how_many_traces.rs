use crate::{puyo_coord::PuyoCoord, solution::SolutionState};
use rayon::prelude::*;

const CELL_INDEXES: [u8; 48] = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
];

pub fn count_candidates_num_for_each_indexes(max_trace_num: u32) -> [u64; 48] {
    let v: [u64; 48] = CELL_INDEXES
        .par_iter()
        .map(|i| {
            let coord = PuyoCoord::index_to_coord(*i).unwrap();
            let state = SolutionState::new(*i);
            return advance_trace_for_count_up(&state, coord, max_trace_num);
        })
        .collect::<Vec<u64>>()
        .try_into()
        .unwrap();
    return v;
}

pub fn count_up_candidates_num(max_trace_num: u32) -> u64 {
    return count_candidates_num_for_each_indexes(max_trace_num)
        .iter()
        .sum();
}

fn advance_trace_for_count_up(state: &SolutionState, coord: PuyoCoord, max_trace_num: u32) -> u64 {
    let trace_len = state.get_trace_coords().len();
    if trace_len == max_trace_num as usize {
        return 0;
    }

    let mut st = state.clone();
    st.add_trace_coord(coord);

    let mut result = 1;

    if trace_len == 0 {
        result += st
            .get_next_candidate_coords()
            .par_iter()
            .map(|c| advance_trace_for_count_up(&st, *c, max_trace_num))
            .sum::<u64>();
    } else {
        for next_coord in st.get_next_candidate_coords() {
            result += advance_trace_for_count_up(&st, *next_coord, max_trace_num);
        }
    }

    return result;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_count_up_candidates_num_for_max_0() {
        assert_eq!(count_up_candidates_num(0), 0);
    }

    #[test]
    fn test_count_up_candidates_num_for_max_1() {
        assert_eq!(count_up_candidates_num(1), 48);
    }

    #[test]
    fn test_count_up_candidates_num_for_max_2() {
        assert_eq!(count_up_candidates_num(2), 200);
    }

    #[test]
    fn test_count_up_candidates_num_for_max_3() {
        assert_eq!(count_up_candidates_num(3), 804);
    }

    #[test]
    fn test_count_up_candidates_num_for_max_4() {
        assert_eq!(count_up_candidates_num(4), 3435);
    }

    #[test]
    fn test_count_up_candidates_num_for_max_5() {
        assert_eq!(count_up_candidates_num(5), 15359);
    }
}
