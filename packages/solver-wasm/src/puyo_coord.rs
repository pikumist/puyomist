#[derive(Debug, PartialEq, Eq, Hash, Clone, Copy)]
pub struct PuyoCoord {
    pub x: u8,
    pub y: u8,
}

impl PuyoCoord {
    pub const X_NUM: u8 = 8;
    pub const Y_NUM: u8 = 6;

    pub fn is_valid_xy(x: u8, y: u8) -> bool {
        x < PuyoCoord::X_NUM && y < PuyoCoord::Y_NUM
    }

    pub fn is_valid_index(index: u8) -> bool {
        index < PuyoCoord::X_NUM * PuyoCoord::Y_NUM
    }

    pub fn xy_to_coord(x: u8, y: u8) -> Option<PuyoCoord> {
        if PuyoCoord::is_valid_xy(x, y) {
            return Some(PuyoCoord { x, y });
        }
        return None;
    }

    pub fn index_to_coord(index: u8) -> Option<PuyoCoord> {
        if PuyoCoord::is_valid_index(index) {
            let x = index % PuyoCoord::X_NUM;
            let y = (index - x) / PuyoCoord::X_NUM;
            return Some(PuyoCoord { x, y });
        }
        return None;
    }

    pub fn index(&self) -> u8 {
        return self.y * PuyoCoord::X_NUM + self.x;
    }

    pub fn adjacent_coords(&self) -> Vec<PuyoCoord> {
        let x = self.x;
        let y = self.y;

        let v = vec![
            PuyoCoord::xy_to_coord(x.wrapping_sub(1), y.wrapping_sub(1)),
            PuyoCoord::xy_to_coord(x, y.wrapping_sub(1)),
            PuyoCoord::xy_to_coord(x + 1, y.wrapping_sub(1)),
            PuyoCoord::xy_to_coord(x.wrapping_sub(1), y),
            PuyoCoord::xy_to_coord(x + 1, y),
            PuyoCoord::xy_to_coord(x.wrapping_sub(1), y + 1),
            PuyoCoord::xy_to_coord(x, y + 1),
            PuyoCoord::xy_to_coord(x + 1, y + 1),
        ];
        return v.into_iter().flatten().collect();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_xy() {
        assert_eq!(PuyoCoord::is_valid_xy(0, 0), true);
        assert_eq!(PuyoCoord::is_valid_xy(7, 0), true);
        assert_eq!(PuyoCoord::is_valid_xy(8, 0), false);
        assert_eq!(PuyoCoord::is_valid_xy(7, 5), true);
        assert_eq!(PuyoCoord::is_valid_xy(7, 6), false);
    }

    #[test]
    fn test_is_valid_index() {
        assert_eq!(PuyoCoord::is_valid_index(0), true);
        assert_eq!(PuyoCoord::is_valid_index(47), true);
        assert_eq!(PuyoCoord::is_valid_index(48), false);
    }

    #[test]
    fn test_xy_to_coord() {
        assert_eq!(PuyoCoord::xy_to_coord(0, 0), Some(PuyoCoord { x: 0, y: 0 }));
        assert_eq!(PuyoCoord::xy_to_coord(7, 0), Some(PuyoCoord { x: 7, y: 0 }));
        assert_eq!(PuyoCoord::xy_to_coord(8, 0), None);
        assert_eq!(PuyoCoord::xy_to_coord(7, 5), Some(PuyoCoord { x: 7, y: 5 }));
        assert_eq!(PuyoCoord::xy_to_coord(7, 6), None);
        assert_eq!(PuyoCoord::xy_to_coord(0xff, 0xff), None);
    }

    #[test]
    fn test_index_to_coord() {
        assert_eq!(PuyoCoord::index_to_coord(0), Some(PuyoCoord { x: 0, y: 0 }));
        assert_eq!(PuyoCoord::index_to_coord(1), Some(PuyoCoord { x: 1, y: 0 }));
        assert_eq!(PuyoCoord::index_to_coord(8), Some(PuyoCoord { x: 0, y: 1 }));
        assert_eq!(
            PuyoCoord::index_to_coord(47),
            Some(PuyoCoord { x: 7, y: 5 })
        );
        assert_eq!(PuyoCoord::index_to_coord(48), None);
        assert_eq!(PuyoCoord::index_to_coord(0xff), None);
    }

    #[test]
    fn test_index() {
        assert_eq!(PuyoCoord { x: 0, y: 0 }.index(), 0);
        assert_eq!(PuyoCoord { x: 1, y: 0 }.index(), 1);
        assert_eq!(PuyoCoord { x: 0, y: 1 }.index(), 8);
        assert_eq!(PuyoCoord { x: 7, y: 5 }.index(), 47);
    }

    #[test]
    fn test_adjacent_coords() {
        assert_eq!(
            PuyoCoord { x: 0, y: 0 }.adjacent_coords(),
            vec![
                PuyoCoord { x: 1, y: 0 },
                PuyoCoord { x: 0, y: 1 },
                PuyoCoord { x: 1, y: 1 }
            ]
        );
        assert_eq!(
            PuyoCoord { x: 7, y: 5 }.adjacent_coords(),
            vec![
                PuyoCoord { x: 6, y: 4 },
                PuyoCoord { x: 7, y: 4 },
                PuyoCoord { x: 6, y: 5 }
            ]
        );
        assert_eq!(
            PuyoCoord { x: 2, y: 0 }.adjacent_coords(),
            vec![
                PuyoCoord { x: 1, y: 0 },
                PuyoCoord { x: 3, y: 0 },
                PuyoCoord { x: 1, y: 1 },
                PuyoCoord { x: 2, y: 1 },
                PuyoCoord { x: 3, y: 1 }
            ]
        );
        assert_eq!(
            PuyoCoord { x: 0, y: 3 }.adjacent_coords(),
            vec![
                PuyoCoord { x: 0, y: 2 },
                PuyoCoord { x: 1, y: 2 },
                PuyoCoord { x: 1, y: 3 },
                PuyoCoord { x: 0, y: 4 },
                PuyoCoord { x: 1, y: 4 }
            ]
        );
        assert_eq!(
            PuyoCoord { x: 2, y: 3 }.adjacent_coords(),
            vec![
                PuyoCoord { x: 1, y: 2 },
                PuyoCoord { x: 2, y: 2 },
                PuyoCoord { x: 3, y: 2 },
                PuyoCoord { x: 1, y: 3 },
                PuyoCoord { x: 3, y: 3 },
                PuyoCoord { x: 1, y: 4 },
                PuyoCoord { x: 2, y: 4 },
                PuyoCoord { x: 3, y: 4 },
            ]
        );
    }
}
