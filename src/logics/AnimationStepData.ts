import type { Puyo } from './Puyo';

/** アニメーションステップ・データ */
export interface AnimationStepData {
  /** ネクストぷよ8個分 */
  nextPuyos: (Puyo | undefined)[];
  /** フィールドぷよ8x6個分 */
  field: (Puyo | undefined)[][];
}

/**
 * アニメーションステップデータを複製する。
 */
export const cloneAnimationStepData = (
  data: AnimationStepData
): AnimationStepData => {
  const nextPuyos = [...data.nextPuyos];
  const field = data.field.map((row) => [...row]);

  return {
    nextPuyos,
    field
  };
};
