import type { ColoredPuyoAttribute, PuyoAttribute } from './PuyoAttribute';

/** 探索カテゴリー */
export enum ExplorationCategory {
  /** ダメージ */
  Damage = 1,
  /** スキル溜めのぷよ数  */
  SkillPuyoCount = 2,
  /** ぷよ使いカウント */
  PuyotsukaiCount = 3
}

/** 全消し優先度 */
export enum AllClearPreference {
  /** 気にしない */
  NotCare = 0,
  /** 最善同値候補中にあれば選択する */
  PreferIfBestValue = 1,
  /** 全候補中にあれば選択する */
  PreferIfExists = 2
}

const allClearPreferenceMap: ReadonlyMap<AllClearPreference, string> = new Map([
  [AllClearPreference.NotCare, 'しない'],
  [AllClearPreference.PreferIfBestValue, '最善値のみ'],
  [AllClearPreference.PreferIfExists, '常に']
]);

export const possibleAllClearPreferenceList: ReadonlyArray<AllClearPreference> =
  [...allClearPreferenceMap.keys()];

export const getAllClearPreferenceDescription = (
  preference: AllClearPreference | undefined
) => {
  return allClearPreferenceMap.get(preference!);
};

/** チャンスぷよ消し優先度 */
export enum ChancePopPreference {
  /** 気にしない */
  NotCare = 0,
  /** 最善同値候補中にあれば選択する */
  PreferIfBestValue = 1,
  /** 全候補中にあれば選択する */
  PreferIfExists = 2
}

const chancePopPreferenceMap: ReadonlyMap<ChancePopPreference, string> =
  new Map([
    [ChancePopPreference.NotCare, 'しない'],
    [ChancePopPreference.PreferIfBestValue, '最善値のみ'],
    [ChancePopPreference.PreferIfExists, '常に']
  ]);

export const possibleChancePopPreferenceList: ReadonlyArray<ChancePopPreference> =
  [...chancePopPreferenceMap.keys()];

export const getChancePopPreferenceDescription = (
  preference: ChancePopPreference | undefined
) => {
  return chancePopPreferenceMap.get(preference!);
};

/** 探索共通設定 */
export interface ExplorationTargetCommon {
  /** 全消し優先度 */
  allClearPreference: AllClearPreference;
  /** チャンプぷよ消し優先度 */
  chancePopPreference: ChancePopPreference;
}

/** ワイルド属性 */
export const wildAttribute = 0 as const;

/** 探索対象がダメージの場合の詳細情報 */
export interface ExplorationTargetDamage extends ExplorationTargetCommon {
  /** 探索カテゴリー */
  category: ExplorationCategory.Damage;
  /** 主属性 */
  mainAttr: ColoredPuyoAttribute | typeof wildAttribute;
  /** 副属性 */
  subAttr?: ColoredPuyoAttribute | undefined;
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
  targetAttrs: PuyoAttribute[];
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
  mainAttr: PuyoAttribute;
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

const explorationCategoryMap: ReadonlyMap<ExplorationCategory, string> =
  new Map([
    [ExplorationCategory.Damage, 'ダメージ量'],
    [ExplorationCategory.SkillPuyoCount, 'スキル溜め数'],
    [ExplorationCategory.PuyotsukaiCount, 'ぷよ使いカウント']
  ]);

/** 取りうる探索カテゴリーのリスト */
export const possibleExplorationCategoryList: ReadonlyArray<ExplorationCategory> =
  [...explorationCategoryMap.keys()];

/**
 * 探索カテゴリーの説明を取得する。
 * @param category
 * @returns
 */
export const getExplorationCategoryDescription = (
  category: ExplorationCategory | undefined
): string | undefined => {
  return explorationCategoryMap.get(category!);
};

const countingBonusTypeMap: ReadonlyMap<CountingBonusType, string> = new Map([
  [CountingBonusType.Step, '階段加速']
]);

/** 取りうる加速ボーナスタイプのリスト */
export const possibleCountingBonusTypeList: ReadonlyArray<CountingBonusType> = [
  CountingBonusType.Step
];

/**
 * 加速ボーナスタイプの説明を取得する。
 * @param bonusType
 * @returns
 */
export const getCountingBonusTypeDescription = (
  bonusType: CountingBonusType | undefined
): string | undefined => {
  return countingBonusTypeMap.get(bonusType!);
};
