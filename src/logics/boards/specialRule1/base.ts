import type { Board } from '../../Board';
import { TraceMode } from '../../TraceMode';
import type { PuyoType } from '../../puyo';

/**
 * - あんどうりんご
 * - スペース☆エコロ
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.Normal,
  minimumPuyoNumForPopping: 3,
  chainLeverage: 7.0
} as Board;
