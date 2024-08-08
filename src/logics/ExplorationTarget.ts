import type { ColoredPuyoAttr, PuyoAttr } from './PuyoAttr';

/** 探索カテゴリー */
export enum ExplorationCategory {
  /** ダメージ */
  Damage = 1,
  /** スキル溜めのぷよ数  */
  SkillPuyoCount = 2,
  /** ぷよ使いカウント */
  PuyotsukaiCount = 3
}

/** 好みの種類 */
export enum PreferenceKind {
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
  LessOjamaPop = 37
}

/** 好みの種類とその説明のマップ */
export const preferenceKindDescriptionMap: ReadonlyMap<PreferenceKind, string> =
  new Map([
    [PreferenceKind.BiggerValue, '探索対象の値が大きい'],
    [PreferenceKind.ChancePop, 'チャンスぷよを含む'],
    [PreferenceKind.PrismPop, 'プリズムを含む'],
    [PreferenceKind.AllClear, '全消し達成'],
    [PreferenceKind.SmallerTraceNum, 'なぞり数が少ない'],
    [PreferenceKind.HeartPop, 'ハートを含む'],
    [PreferenceKind.OjamaPop, 'おじゃまを含む'],
    [PreferenceKind.SmallerValue, '探索対象の値が小さい'],
    [PreferenceKind.NoChancePop, 'チャンスぷよを含まない'],
    [PreferenceKind.NoPrismPop, 'プリズムを含まない'],
    [PreferenceKind.NoAllClear, '全消ししない'],
    [PreferenceKind.BiggerTraceNum, 'なぞり数が多い'],
    [PreferenceKind.NoHeartPop, 'ハートを含まない'],
    [PreferenceKind.NoOjamaPop, 'おじゃまを含まない'],
    [PreferenceKind.MoreChancePop, 'チャンスぷよ消し数が多い'],
    [PreferenceKind.MorePrismPop, 'プリズム消し数が多い'],
    [PreferenceKind.MoreHeartPop, 'ハート消し数が多い'],
    [PreferenceKind.MoreOjamaPop, 'おじゃま消し数が多い'],
    [PreferenceKind.LessChancePop, 'チャンスぷよ消し数が少ない'],
    [PreferenceKind.LessPrismPop, 'プリズム消し数が少ない'],
    [PreferenceKind.LessHeartPop, 'ハート消し数が少ない'],
    [PreferenceKind.LessOjamaPop, 'おじゃま消し数が少ない']
  ]);

/** 探索共通設定 */
export interface ExplorationTargetCommon {
  /** 各好みの優先度リスト。インデックスの小さい要素の方を優先する。 */
  preference_priorities: PreferenceKind[];
  /** 求める解の数 */
  optimal_solution_count: number;
}

/** 探索対象がダメージの場合の詳細情報 */
export interface ExplorationTargetDamage extends ExplorationTargetCommon {
  /** 探索カテゴリー */
  category: ExplorationCategory.Damage;
  /** 主属性 (undefined のときワイルド扱い) */
  main_attr: ColoredPuyoAttr | undefined;
  /** 副属性 */
  sub_attr?: ColoredPuyoAttr | undefined;
  /** 副属性 / 主属性 のダメージ率 (1/3か1)  */
  main_sub_ratio?: number;
}

/** カウントボーナスのタイプ */
export enum CountingBonusType {
  /** 階段加速 */
  Step = 1
}

/** 階段状に発生するカウントボーナス */
export interface StepCountingBonus {
  /** カウントボーナスのタイプ */
  bonus_type: CountingBonusType.Step;
  /** ボーナスの発生する対象属性リスト。段はリスト内の属性ごとのカウント数トータルで登る。 */
  target_attrs: PuyoAttr[];
  /** 段の高さ */
  step_height: number;
  /** ボーナスカウント */
  bonus_count: number;
  /** 同一ターン内で、一度のみ (false) か、各ステップを超えると何度も繰り返し発生するか (true) */
  repeat: boolean;
}

export type CountingBonus = StepCountingBonus;

/** 探索対象がスキル溜めぷよ数の場合の詳細情報 */
export interface ExplorationTargetSkillPuyoCount
  extends ExplorationTargetCommon {
  /** 探索カテゴリー */
  category: ExplorationCategory.SkillPuyoCount;
  /** 主属性 */
  main_attr: PuyoAttr;
  /** カウントボーナス */
  counting_bonus?: CountingBonus;
}

/** 探索対象がぷよ使いカウントの場合の詳細情報 */
export interface ExplorationTargetPuyoTasukaiCount
  extends ExplorationTargetCommon {
  /** 探索カテゴリー */
  category: ExplorationCategory.PuyotsukaiCount;
}

/** 探索対象 */
export type ExplorationTarget =
  | ExplorationTargetDamage
  | ExplorationTargetSkillPuyoCount
  | ExplorationTargetPuyoTasukaiCount;

/** 探索カテゴリーと説明のマップ */
export const explorationCategoryDescriptionMap: ReadonlyMap<
  ExplorationCategory,
  string
> = new Map([
  [ExplorationCategory.Damage, 'ダメージ量'],
  [ExplorationCategory.SkillPuyoCount, 'スキル溜め数'],
  [ExplorationCategory.PuyotsukaiCount, 'ぷよ使いカウント']
]);
