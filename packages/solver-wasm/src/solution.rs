use crate::{chain::Chain, puyo_coord::PuyoCoord};
use indexmap::{IndexMap, IndexSet};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolutionState {
    /** 禁止インデックス集合 (候補から外れたなぞれないインデックスの集合)。48ビットそれぞれがフィールドの位置を表す。 */
    forbidden_field_bits: u64,
    /**
     * なぞっている座標をキー、
     * そのインデックス周辺で次に候補としてなぞれるインデックス候補の集合を値、
     * としたマッピング。
     * キーをリストアップすることで trace_coords が求まり、
     * 値をまとめあげることで、次の全候補が求まる。
     * 各値の集合同士は重複がなく、全候補と forbidden_field_bits も必ず重複がない状態を維持する。
     */
    trace_coord_map: IndexMap<PuyoCoord, IndexSet<PuyoCoord>>,
}

impl SolutionState {
    /** 指定のインデックスより1少ない座標と、それより小さいインデックスの座標を全て禁止集合に入れて初期化する。 */
    pub fn new(forbidden_indexes_before: u8) -> SolutionState {
        SolutionState {
            forbidden_field_bits: (1 << forbidden_indexes_before) - 1,
            trace_coord_map: IndexMap::new(),
        }
    }

    pub fn __get_forbidden_field_bits(&self) -> u64 {
        return self.forbidden_field_bits;
    }

    /** なぞり座標リストを取得する */
    pub fn get_trace_coords(&self) -> Vec<PuyoCoord> {
        return self.trace_coord_map.keys().cloned().collect();
    }

    pub fn get_trace_coord_map(&self) -> &IndexMap<PuyoCoord, IndexSet<PuyoCoord>> {
        return &self.trace_coord_map;
    }

    /** 追加可能な座標であるかどうかを調べる */
    pub fn check_if_addable_coord(&self, coord: &PuyoCoord, max_trace_num: u8) -> bool {
        let len = self.trace_coord_map.len();

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
        for candidate_set in self.trace_coord_map.values() {
            if candidate_set.contains(coord) {
                return true;
            }
        }
        return false;
    }

    pub fn add_trace_coord(&mut self, coord: PuyoCoord) {
        // 新しい座標を起点に新たに候補になる集合を作る
        let new_candidate_set: IndexSet<PuyoCoord> =
            IndexSet::from_iter(PuyoCoord::adjacent_coords(&coord).into_iter().filter(|c| {
                if self.forbidden_field_bits & (1 << c.index()) != 0 {
                    return false;
                }
                for candidate_set in self.trace_coord_map.values() {
                    if candidate_set.contains(c) {
                        return false;
                    }
                }
                return true;
            }));

        let coord_index = coord.index();
        let trace_coords = self.get_trace_coords();

        // 追加する座標が候補になっていたなぞり座標(キー座標)における候補集合、
        // キー座標よりインデックスが小さいなぞり座標における候補集合、
        // そして、禁止インデックス集合に関してそれぞれ更新をかける。
        for k in 0..trace_coords.len() {
            let key_coord = trace_coords[k];
            if let Some(candidate_set) = self.trace_coord_map.get(&key_coord) {
                if candidate_set.contains(&coord) {
                    // 追加する座標が候補になっていたキー座標において、
                    // 追加する座標よりindexが若いものは候補から外す。(既に探索済みのはずなので)

                    let (filtered_candidate_set, forbidden_candidate_set): (
                        IndexSet<PuyoCoord>,
                        IndexSet<PuyoCoord>,
                    ) = candidate_set
                        .into_iter()
                        .partition(|c| c.index() > coord_index);

                    self.trace_coord_map
                        .insert(key_coord, filtered_candidate_set);

                    for forbidden_coord in forbidden_candidate_set {
                        self.forbidden_field_bits |= 1 << forbidden_coord.index();
                    }

                    // 追加する座標が候補になっていたキー座標より、若いインデックスキー座標における
                    // 候補集合は全て禁止集合に移動させる。(これも既に探索済みのはずなので)
                    for kk in 0..k {
                        let kc = trace_coords[kk];
                        if let Some(forbidden_coord_set) = self.trace_coord_map.get(&kc) {
                            for forbidden_coord in forbidden_coord_set {
                                self.forbidden_field_bits |= 1 << forbidden_coord.index();
                            }
                            self.trace_coord_map.insert(kc, IndexSet::new());
                        }
                    }

                    break;
                }
            }
        }

        // 新しい座標の候補を追加する。
        self.trace_coord_map.insert(coord, new_candidate_set);
        // 追加する座標が最初のなぞりでなければ、forbidden_candidate_set 経由で既に追加されているが、
        // 最初のなぞりの場合は追加されていないので、追加しておく。
        self.forbidden_field_bits |= 1 << coord_index;
    }
}

/** あるなぞり消し(塗り)しで発生した連鎖情報等の計算情報 */
#[derive(Debug, Serialize, Deserialize)]
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
    /** 全消しされたかどうか */
    pub is_all_cleared: bool,
    /** チャンスぷよが弾けたかどうか */
    pub is_chance_popped: bool,
    /** プリズムが弾けたかどうか */
    pub is_prism_popped: bool,
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
        assert_eq!(s.get_trace_coords(), []);
        s.add_trace_coord(PuyoCoord { x: 0, y: 0 });
        assert_eq!(s.get_trace_coords(), [PuyoCoord { x: 0, y: 0 }]);
        s.add_trace_coord(PuyoCoord { x: 1, y: 1 });
        assert_eq!(
            s.get_trace_coords(),
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
        let expected: IndexMap<PuyoCoord, IndexSet<PuyoCoord>> = IndexMap::from([
            (PuyoCoord { x: 1, y: 1 }, IndexSet::from([])),
            (
                PuyoCoord { x: 2, y: 2 },
                IndexSet::from([
                    PuyoCoord { x: 3, y: 1 },
                    PuyoCoord { x: 3, y: 2 },
                    PuyoCoord { x: 1, y: 3 },
                    PuyoCoord { x: 2, y: 3 },
                    PuyoCoord { x: 3, y: 3 },
                ]),
            ),
        ]);
        assert_eq!(*s.get_trace_coord_map(), expected);
        assert_eq!(s.__get_forbidden_field_bits(), 460799);
    }
}
