import type { ColoredPuyoAttribute, PuyoAttribute } from './PuyoAttribute';

/** 最適化のカテゴリー */
export enum OptimizationCategory {
  /** ダメージ */
  Damage = 1,
  /** ぷよのカウント  */
  PuyoCount = 2,
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

/** 最適化共通設定 */
export interface OptimizationCommon {
  /** 全消し優先度 */
  allClearPreference: AllClearPreference;
  /** チャンプぷよ消し優先度 */
  chancePopPreference: ChancePopPreference;
}

/** ワイルド属性 */
export const wildAttribute = 0 as const;

/** 最適化対象がダメージの場合の詳細情報 */
export interface OptimizationDamageTarget extends OptimizationCommon {
  /** 最適化のカテゴリー */
  category: OptimizationCategory.Damage;
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

/** 最適化対象がぷよ数場合の詳細情報 */
export interface OptimizationPuyoCountTarget extends OptimizationCommon {
  /** 最適化のカテゴリー */
  category: OptimizationCategory.PuyoCount;
  /** 主属性 */
  mainAttr: PuyoAttribute;
  /** カウントボーナス */
  countingBonus?: CountingBonus;
}

/** 最適化対象がぷよ使いカウントの場合の詳細情報 */
export interface OptimizationPuyoTasukaiCountTarget extends OptimizationCommon {
  /** 最適化のカテゴリー */
  category: OptimizationCategory.PuyotsukaiCount;
}

/** 最適化対象 */
export type OptimizationTarget =
  | OptimizationDamageTarget
  | OptimizationPuyoCountTarget
  | OptimizationPuyoTasukaiCountTarget;

const optimizationCategoryMap: ReadonlyMap<OptimizationCategory, string> =
  new Map([
    [OptimizationCategory.Damage, 'ダメージ量'],
    [OptimizationCategory.PuyoCount, 'スキル溜め数'],
    [OptimizationCategory.PuyotsukaiCount, 'ぷよ使いカウント']
  ]);

/** 取りうる最適化カテゴリーのリスト */
export const possibleOptimizationCategoryList: ReadonlyArray<OptimizationCategory> =
  [...optimizationCategoryMap.keys()];

/**
 * 最適化カテゴリーの説明を取得する。
 * @param category
 * @returns
 */
export const getOptimizationCategoryDescription = (
  category: OptimizationCategory | undefined
): string | undefined => {
  return optimizationCategoryMap.get(category!);
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
