import type { Board } from '../../Board';
import type { PuyoType } from '../../PuyoType';
import { TraceMode } from '../../TraceMode';

/**
 * - キュアブルーム＆イーグレット
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.ToRed,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.5
} as Board;
