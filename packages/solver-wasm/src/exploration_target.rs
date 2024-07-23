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
    /** 探索対象の値が良い方(大きい方) */
    BetterValue = 1,
    /** チャンスぷよ消し */
    ChancePop = 2,
    /** プリズム消し */
    PrismPop = 3,
    /** 全消し */
    AllClear = 4,
    /** なぞり数が少ない方 */
    SmallerTraceNum = 5,
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
    pub preference_priorities: [PreferenceKind; 5], // All
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
