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
  /** チャンスぷよ消し */
  ChancePop = 2,
  /** プリズム消し */
  PrismPop = 3,
  /** 全消し */
  AllClear = 4,
  /** なぞり数が少ない方 */
  SmallerTraceNum = 5
}

/** 好みの種類とその説明のマップ */
export const preferenceKindDescriptionMap: ReadonlyMap<PreferenceKind, string> =
  new Map([
    [PreferenceKind.BiggerValue, '探索対象の値が大きい'],
    [PreferenceKind.ChancePop, 'チャンスぷよを含む'],
    [PreferenceKind.PrismPop, 'プリズムを含む'],
    [PreferenceKind.AllClear, '全消し達成'],
    [PreferenceKind.SmallerTraceNum, 'なぞり数が少ない']
  ]);

/** 探索共通設定 */
export interface ExplorationTargetCommon {
  /** 各好みの優先度リスト。インデックスの小さい要素の方を優先する。 */
  preferencePriorities: PreferenceKind[];
}

/** ワイルド属性 */
export const wildAttribute = 0 as const;

/** 探索対象がダメージの場合の詳細情報 */
export interface ExplorationTargetDamage extends ExplorationTargetCommon {
  /** 探索カテゴリー */
  category: ExplorationCategory.Damage;
  /** 主属性 */
  mainAttr: ColoredPuyoAttr | typeof wildAttribute;
  /** 副属性 */
  subAttr?: ColoredPuyoAttr | undefined;
  /** 副属性 / 主属性 のダメージ率 (1/3か1)  */
  mainSubRatio?: number;
}

/** カウントボーナスのタイプ */
export enum CountingBonusType {
  /** 階段加速 */
  Step = 1
}

/** 階段状に発生するカウントボーナス */
export interface StepCountingBonus {
  /** カウントボーナスのタイプ */
  type: CountingBonusType.Step;
  /** ボーナスの発生する対象属性リスト。段はリスト内の属性ごとのカウント数トータルで登る。 */
  targetAttrs: PuyoAttr[];
  /** 段の高さ */
  stepHeight: number;
  /** ボーナスカウント */
  bonusCount: number;
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
  mainAttr: PuyoAttr;
  /** カウントボーナス */
  countingBonus?: CountingBonus;
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
