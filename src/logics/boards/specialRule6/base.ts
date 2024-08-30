import type { Board } from '../../Board';
import type { PuyoType } from '../../PuyoType';
import { TraceMode } from '../../TraceMode';

/**
 * - ロイド・フォージャー《黄昏》
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.ToGreen,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.5
} as Board;
