use crate::{chain::Chain, puyo_coord::PuyoCoord};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolutionState {
    ///
    /// forbidden_field_bits と trace_coords と next_candidate_coords は互いに重ならない集合になるようにする。
    /// trace_coords と next_candidate_coords は順番が大事なのでリスト。
    ///

    /** 禁止インデックス集合 (候補から外れたなぞれないインデックスの集合)。48ビットそれぞれがフィールドの位置を表す。 */
    forbidden_field_bits: u64,

    /** なぞっている座標のリスト */
    trace_coords: Vec<PuyoCoord>,

    /** 次のなぞり候補となりうる座標のリスト。 */
    next_candidate_coords: Vec<PuyoCoord>,
}

impl SolutionState {
    /** 指定のインデックスより1少ない座標と、それより小さいインデックスの座標を全て禁止集合に入れて初期化する。 */
    pub fn new(forbidden_indexes_before: u8) -> SolutionState {
        SolutionState {
            forbidden_field_bits: (1 << forbidden_indexes_before) - 1,
            trace_coords: Vec::new(),
            next_candidate_coords: Vec::new(),
        }
    }

    pub fn __get_forbidden_field_bits(&self) -> u64 {
        return self.forbidden_field_bits;
    }

    /** なぞり座標リストを取得する */
    pub fn get_trace_coords(&self) -> &Vec<PuyoCoord> {
        return &self.trace_coords;
    }

    /** 次のなぞり候補となりうる座標のリストを取得する */
    pub fn get_next_candidate_coords(&self) -> &Vec<PuyoCoord> {
        return &self.next_candidate_coords;
    }

    /** 追加可能な座標であるかどうかを調べる */
    pub fn check_if_addable_coord(&self, coord: &PuyoCoord, max_trace_num: u32) -> bool {
        let len = self.trace_coords.len();

        if len >= max_trace_num as usize {
            return false;
        }

        let index = coord.index();

        if (self.forbidden_field_bits & (1 << index)) != 0 {
            return false;
        }
        if len == 0 {
            return true;
        }
        if self.next_candidate_coords.contains(coord) {
            return true;
        }
        return false;
    }

    pub fn add_trace_coord(&mut self, coord: PuyoCoord) {
        // 新しい座標を起点に新たに候補になる座標リストを作る
        let mut new_candidate_coords: Vec<PuyoCoord> = PuyoCoord::adjacent_coords(&coord)
            .into_iter()
            .filter(|c| {
                if self.forbidden_field_bits & (1 << c.index()) != 0 {
                    return false;
                }
                if self.next_candidate_coords.contains(c) {
                    return false;
                }
                return true;
            })
            .collect();

        let coord_index = coord.index();

        if let Some(found_index) = self.next_candidate_coords.iter().position(|c| *c == coord) {
            let former = &self.next_candidate_coords[0..found_index + 1];
            let latter = &self.next_candidate_coords[found_index + 1..];
            for c in former {
                self.forbidden_field_bits |= 1 << c.index();
            }
            new_candidate_coords.splice(0..0, latter.iter().cloned());
            self.next_candidate_coords = new_candidate_coords;
        } else {
            self.forbidden_field_bits |= 1 << coord_index;
            self.next_candidate_coords = new_candidate_coords;
        }

        self.trace_coords.push(coord);
    }
}

/** あるなぞり消し(塗り)しで発生した連鎖情報等の計算情報 */
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct SolutionResult {
    /** なぞり位置 */
    pub trace_coords: Vec<PuyoCoord>,
    /** 連鎖情報 */
    pub chains: Vec<Chain>,
    //
    // ここから下は chains から計算可能な冗長データ。
    // 結果の比較を高速化するために予め計算してある。
    //
    /**
     * 探索対象によって異なる値。
     * ダメージの量であったり、スキル溜め数だったり、ぷよ使いカウントだったりする。
     * 大きいほど良い値。
     */
    pub value: f64,
    /** 弾けたチャンスぷよの数 */
    pub popped_chance_num: u32,
    /** 弾けたハートの数 */
    pub popped_heart_num: u32,
    /** 弾けたプリズムの数 */
    pub popped_prism_num: u32,
    /** 弾けたおじゃまの数 (固ぷよからおじゃまになりそして弾けたものも含む) */
    pub popped_ojama_num: u32,
    /** 弾けた固ぷよの数 (固ぷよからおじゃまになったものの数。さらにそのおじゃまが弾けたものも含む) */
    pub popped_kata_num: u32,
    /** 全消しされたかどうか */
    pub is_all_cleared: bool,
}

/** 探索結果 */
#[derive(Debug, Serialize, Deserialize)]
pub struct ExplorationResult {
    /** 探索した候補数 */
    pub candidates_num: u64,
    /** 最適解リスト。インデックスが小さい要素ほど最善 */
    pub optimal_solutions: Vec<SolutionResult>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_forbidden_field_bits() {
        assert_eq!(SolutionState::new(0).__get_forbidden_field_bits(), 0);
        assert_eq!(SolutionState::new(1).__get_forbidden_field_bits(), 1);
        assert_eq!(SolutionState::new(2).__get_forbidden_field_bits(), 3);
        assert_eq!(SolutionState::new(3).__get_forbidden_field_bits(), 7);
        assert_eq!(
            SolutionState::new(48).__get_forbidden_field_bits(),
            281474976710655
        );
    }

    #[test]
    fn test_get_trace_coords() {
        let mut s = SolutionState::new(0);
        assert_eq!(*s.get_trace_coords(), []);
        s.add_trace_coord(PuyoCoord { x: 0, y: 0 });
        assert_eq!(*s.get_trace_coords(), [PuyoCoord { x: 0, y: 0 }]);
        s.add_trace_coord(PuyoCoord { x: 1, y: 1 });
        assert_eq!(
            *s.get_trace_coords(),
            [PuyoCoord { x: 0, y: 0 }, PuyoCoord { x: 1, y: 1 }]
        );
    }

    #[test]
    fn test_check_if_addable_coord_around_1_1() {
        // Arrange
        let mut s = SolutionState::new(0);
        s.add_trace_coord(PuyoCoord { x: 1, y: 1 });

        // Act & Assert
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 0, y: 0 }, 5), true);
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 1, y: 0 }, 5), true);
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 2, y: 0 }, 5), true);
        assert_eq!(
            s.check_if_addable_coord(&PuyoCoord { x: 3, y: 0 }, 5),
            false
        );
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 0, y: 1 }, 5), true);
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 2, y: 1 }, 5), true);
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 0, y: 2 }, 5), true);
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 1, y: 2 }, 5), true);
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 2, y: 2 }, 5), true);
        assert_eq!(
            s.check_if_addable_coord(&PuyoCoord { x: 1, y: 3 }, 5),
            false
        );
    }

    #[test]
    fn test_check_if_addable_coord_by_max() {
        // Arrange
        let mut s = SolutionState::new(0);
        s.add_trace_coord(PuyoCoord { x: 1, y: 1 });
        let c = PuyoCoord { x: 0, y: 0 };

        // Act & Assert
        assert_eq!(s.check_if_addable_coord(&c, 1), false);
        assert_eq!(s.check_if_addable_coord(&c, 2), true);
    }

    #[test]
    fn test_check_if_addable_coord_by_forbidden() {
        // Arrange
        let mut s = SolutionState::new(9);
        s.add_trace_coord(PuyoCoord { x: 1, y: 1 });

        // Act & Assert
        assert_eq!(
            s.check_if_addable_coord(&PuyoCoord { x: 0, y: 0 }, 5),
            false
        );
        assert_eq!(
            s.check_if_addable_coord(&PuyoCoord { x: 0, y: 1 }, 5),
            false
        );
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 2, y: 1 }, 5), true);
    }

    #[test]
    fn test_addable_and_forbidden() {
        // Arrange
        let mut s = SolutionState::new(9);
        s.add_trace_coord(PuyoCoord { x: 1, y: 1 });
        s.add_trace_coord(PuyoCoord { x: 2, y: 2 });

        // Assert: 禁止集合に含まれているか候補集合に含まれていないものはaddableでない
        assert_eq!(
            s.check_if_addable_coord(&PuyoCoord { x: 1, y: 2 }, 5),
            false
        );
        assert_eq!(
            s.check_if_addable_coord(&PuyoCoord { x: 2, y: 1 }, 5),
            false
        );
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 3, y: 2 }, 5), true);
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 1, y: 3 }, 5), true);
        assert_eq!(s.check_if_addable_coord(&PuyoCoord { x: 2, y: 3 }, 5), true);
        assert_eq!(
            s.check_if_addable_coord(&PuyoCoord { x: 2, y: 4 }, 5),
            false
        );
        assert_eq!(
            *s.get_next_candidate_coords(),
            Vec::from([
                PuyoCoord { x: 3, y: 1 },
                PuyoCoord { x: 3, y: 2 },
                PuyoCoord { x: 1, y: 3 },
                PuyoCoord { x: 2, y: 3 },
                PuyoCoord { x: 3, y: 3 },
            ])
        );
        assert_eq!(s.__get_forbidden_field_bits(), 460799);
    }
}
