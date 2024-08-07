use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::puyo_attr::PuyoAttr;

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct AttributeChain {
    /// 同時消しや連鎖を考慮した属性攻撃力
    pub strength: f64,
    /// この属性の消したぷよ数。プラスぷよは2個で計算
    pub popped_count: u32,
    /// 分離消し数
    pub separated_blocks_num: u32,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Chain {
    /// 何連鎖目かを表す番号 (1-based)
    pub chain_num: u32,
    /// 同時消し数
    pub simultaneous_num: u32,
    /// ブーストカウント (ブーストエリアがあるときにダメージに影響する数。1あたり4%増し。50までで最大3倍)
    pub boost_count: u32,
    /// ぷよ使いカウント
    pub puyo_tsukai_count: u32,
    /// 各属性ごとの連鎖情報 (含まれる属性は5色とハート、プリズム、おじゃま)
    pub attributes: HashMap<PuyoAttr, AttributeChain>,
    /** 弾けたチャンスぷよの数 */
    pub popped_chance_num: u32,
    /// この連鎖で全消しを達成したかどうか
    pub is_all_cleared: bool,
}
