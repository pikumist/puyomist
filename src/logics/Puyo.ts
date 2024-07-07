import type { PuyoType } from './PuyoType';

let count = 0;

/** ぷよ */
export interface Puyo {
  /** ぷよの個体を識別するためのID */
  id: number;
  /** ぷよの型 */
  type: PuyoType;
}

/** ぷよIDを生成する。 */
export const generatePuyoId = () => ++count;

/** ぷよIDのカウントをリセットする。(テストでのみ用いる) */
export const __resetPuyoIdCount = () => {
  count = 0;
};
