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

/** 最適化対象がダメージの場合の詳細情報 */
export interface OptimizationDamageTarget {
  /** 最適化のカテゴリー */
  category: OptimizationCategory.Damage;
  /** 主属性 */
  mainAttr: ColoredPuyoAttribute;
  /** 副属性 */
  subAttr?: ColoredPuyoAttribute | undefined;
  /** 副属性 / 主属性 のダメージ率 (1/3か1)  */
  mainSubRatio?: number;
}

/** カウントボーナスのタイプ */
export enum CountingBonusType {
  /** 2色加速 */
  TwoWay = 1,
  /** 階段加速 */
  Step = 2
}

/** 2色加速ボーナス */
export interface TwoWayCountingBonus {
  /** カウントボーナスのタイプ */
  type: CountingBonusType.TwoWay;
  /** 対象属性 */
  targetAttr: PuyoAttribute;
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

export type CountingBonus = TwoWayCountingBonus | StepCountingBonus;

/** 最適化対象がぷよ数場合の詳細情報 */
export interface OptimizationPuyoCountTarget {
  /** 最適化のカテゴリー */
  category: OptimizationCategory.PuyoCount;
  /** 主属性 */
  mainAttr: PuyoAttribute;
  /** カウントボーナス */
  countingBonus?: CountingBonus;
}

/** 最適化対象がぷよ使いカウントの場合の詳細情報 */
export interface OptimizationPuyoTasukaiCountTarget {
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
  [CountingBonusType.TwoWay, '2色加速'],
  [CountingBonusType.Step, '階段加速']
]);

/** 取りうる加速ボーナスタイプのリスト */
export const possibleCountingBonusTypeList: ReadonlyArray<CountingBonusType> = [
  CountingBonusType.TwoWay,
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
