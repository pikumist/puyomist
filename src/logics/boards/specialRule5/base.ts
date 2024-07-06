import type { Board } from '../../Board';
import { TraceMode } from '../../TraceMode';
import type { PuyoType } from '../../puyo';

/**
 * - キュアブルーム＆イーグレット
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.ToRed,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.5
} as Board;
