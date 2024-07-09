import { type Puyo, generatePuyoId } from '../../logics/Puyo';
import type { PuyoType } from '../../logics/PuyoType';

/** ぷよの型からぷよのインスタンスを生成する */
export const createPuyo = (type: PuyoType | undefined): Puyo | undefined => {
  return type ? { id: generatePuyoId(), type } : undefined;
};
