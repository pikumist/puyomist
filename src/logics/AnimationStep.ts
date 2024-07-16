import type { Chain } from './Chain';
import type { Puyo } from './Puyo';

/** フィールドとネクスト情報 */
export interface FieldAndNext {
  /** ネクストぷよ8個分 */
  nextPuyos: (Puyo | undefined)[];
  /** フィールドぷよ8x6個分 */
  field: (Puyo | undefined)[][];
}

/** アニメーションのステップ情報 */
export interface AnimationStep extends FieldAndNext {
  /** 連鎖リスト */
  chains: Chain[];
}

/**
 * フィールドとネクスト情報を複製する。
 */
export const cloneFieldAndNext = (data: FieldAndNext): FieldAndNext => {
  const nextPuyos = [...data.nextPuyos];
  const field = data.field.map((row) => [...row]);

  return {
    nextPuyos,
    field
  };
};
