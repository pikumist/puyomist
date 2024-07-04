/** 最適化対象 */
export enum OptimizationTarget {
  /** 総ダメージ(各属性ごとの攻撃力合計が同じと仮定) */
  TotalDamage = 0,

  /** 赤ダメージ */
  RedDamage = 1,

  /** 青ダメージ */
  BlueDamage = 2,

  /** 緑ダメージ */
  GreenDamage = 3,

  /** 黄ダメージ */
  YellowDamage = 4,

  /** 紫ダメージ */
  PurpleDamage = 5,
  /**
   * ぷよ使いカウント。
   * ```
   * 色ぷよ、ハート、プリズム、おじゃまが対象。
   * プラスぷよは2倍、ブーストエリア内は3倍で計算。
   * プラスぷよがブーストエリア内で消えた場合は6倍。
   * ```
   */
  PuyoTsukaiCount = 10
}

const optimizationTargetMap: ReadonlyMap<OptimizationTarget, string> = new Map([
  [OptimizationTarget.TotalDamage, '総ダメージ'],
  [OptimizationTarget.RedDamage, '赤ダメージ'],
  [OptimizationTarget.BlueDamage, '青ダメージ'],
  [OptimizationTarget.GreenDamage, '緑ダメージ'],
  [OptimizationTarget.YellowDamage, '黄ダメージ'],
  [OptimizationTarget.PurpleDamage, '紫ダメージ'],
  [OptimizationTarget.PuyoTsukaiCount, 'ぷよ使いカウント']
]);

/** 取りうる最適化対象のリスト */
export const possibleOptimizationTargetList: ReadonlyArray<OptimizationTarget> =
  [...optimizationTargetMap.keys()];

/**
 * 最適化対象の説明を取得する。
 * @param optimizationTarget
 * @returns
 */
export const getOptimizationTargetDescription = (
  optimizationTarget: OptimizationTarget | undefined
): string | undefined => {
  return optimizationTargetMap.get(optimizationTarget!);
};
