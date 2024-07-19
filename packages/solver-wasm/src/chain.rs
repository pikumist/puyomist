use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::puyo_attr::PuyoAttr;

#[derive(Debug, Serialize, Deserialize)]
pub struct AttributeChain {
    pub strength: f64,
    pub popped_num: u32,
    pub separated_blocks_num: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Chain {
    pub chain_num: u32,
    pub popped_puyo_num: u32,
    pub boost_count: u32,
    pub puyo_tsukai_count: u32,
    pub attributes: HashMap<PuyoAttr, AttributeChain>,
    pub is_all_cleared: bool,
    pub is_chance_popped: bool,
}
