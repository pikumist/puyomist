use crate::{puyo_coord::PuyoCoord, puyo_type::PuyoType};

#[derive(Debug, PartialEq, Eq, Copy, Clone)]
pub struct Puyo {
    pub id: i32,
    pub puyo_type: PuyoType,
}

pub type Field = [[Option<Puyo>; PuyoCoord::X_NUM as usize]; PuyoCoord::Y_NUM as usize];
pub type NextPuyos = [Option<Puyo>; PuyoCoord::X_NUM as usize];
