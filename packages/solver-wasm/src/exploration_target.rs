use num_derive::{FromPrimitive, ToPrimitive};
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};

use crate::puyo_attr::PuyoAttr;

/** 探索カテゴリー */
#[derive(
    Debug,
    Copy,
    Clone,
    Hash,
    PartialEq,
    Eq,
    FromPrimitive,
    ToPrimitive,
    Serialize_repr,
    Deserialize_repr,
)]
#[repr(u8)]
pub enum ExplorationCategory {
    /** ダメージ */
    Damage = 1,
    /** スキル溜めのぷよ数  */
    SkillPuyoCount = 2,
    /** ぷよ使いカウント */
    PuyotsukaiCount = 3,
}

/** 好みの種類 */
#[derive(
    Debug,
    Copy,
    Clone,
    Hash,
    PartialEq,
    Eq,
    FromPrimitive,
    ToPrimitive,
    Serialize_repr,
    Deserialize_repr,
)]
#[repr(u8)]
pub enum PreferenceKind {
    /** 探索対象の値が大きい方 */
    BiggerValue = 1,
    /** チャンスぷよ消しがある */
    ChancePop = 2,
    /** プリズム消しがある */
    PrismPop = 3,
    /** 全消し */
    AllClear = 4,
    /** なぞり数が少ない方 */
    SmallerTraceNum = 5,
    /** ハート消しがある */
    HeartPop = 6,
    /** おじゃま消しがある (固ぷよも含む) */
    OjamaPop = 7,

    //
    // 反対
    //
    /** 探索対象の値が小さい方 */
    SmallerValue = 11,
    /** チャンスぷよ消しがない */
    NoChancePop = 12,
    /** プリズム消しがない */
    NoPrismPop = 13,
    /** 全消ししない */
    NoAllClear = 14,
    /** なぞり数が多い方 */
    BiggerTraceNum = 15,
    /** ハート消しがない */
    NoHeartPop = 16,
    /** おじゃま消しがない (固ぷよも含む) */
    NoOjamaPop = 17,

    //
    // 数が多い
    //
    /** チャンスぷよ消し数が多い */
    MoreChancePop = 22,
    /** プリズム消し数が多い */
    MorePrismPop = 23,
    /** ハート消し数が多い */
    MoreHeartPop = 26,
    /** おじゃま消し数が多い (固ぷよも含む。固ぷよが完全に消えたら2個分) */
    MoreOjamaPop = 27,

    //
    // 数が少ない
    //
    /** チャンスぷよ消し数が少ない */
    LessChancePop = 32,
    /** プリズム消し数が少ない */
    LessPrismPop = 33,
    /** ハート消し数が少ない */
    LessHeartPop = 36,
    /** おじゃま消し数が少ない (固ぷよも含む。固ぷよが完全に消えたら2個分) */
    LessOjamaPop = 37,
}

/** カウントボーナスのタイプ */
#[derive(
    Debug,
    Copy,
    Clone,
    Hash,
    PartialEq,
    Eq,
    FromPrimitive,
    ToPrimitive,
    Serialize_repr,
    Deserialize_repr,
)]
#[repr(u8)]
pub enum CountingBonusType {
    /** 階段加速 */
    Step = 1,
}

/** 階段状に発生するカウントボーナス */
#[derive(Debug, Serialize, Deserialize)]
pub struct StepCountingBonus {
    /** カウントボーナスのタイプ */
    pub bonus_type: CountingBonusType,
    /** ボーナスの発生する対象属性リスト。段はリスト内の属性ごとのカウント数トータルで登る。 */
    pub target_attrs: Vec<PuyoAttr>,
    /** 段の高さ */
    pub step_height: u8,
    /** ボーナスカウント */
    pub bonus_count: u8,
    /** 同一ターン内で、一度のみ (false) か、各ステップを超えると何度も繰り返し発生するか (true) */
    pub repeat: bool,
}

/** 探索対象 */
#[derive(Debug, Serialize, Deserialize)]
pub struct ExplorationTarget {
    /** 探索カテゴリー */
    pub category: ExplorationCategory,
    /** 各好みの優先度配列。インデックスの小さい要素の方を優先する。 */
    pub preference_priorities: Vec<PreferenceKind>, // All
    /** 最適解のベスト何個までを結果に返すか */
    pub optimal_solution_count: u32,
    /** 主属性 */
    pub main_attr: Option<PuyoAttr>, // ::Damage, ::SkillPuyoCount
    /** 副属性 */
    pub sub_attr: Option<PuyoAttr>, // ::Damage
    /** 副属性 / 主属性 のダメージ率 (1/3か1)  */
    pub main_sub_ratio: Option<f64>, // ::Damage
    /** 加速ボーナス */
    pub counting_bonus: Option<StepCountingBonus>, // ::SKillPuyoCount
}
