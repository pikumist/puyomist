import type { Board } from '../../Board';
import { TraceMode } from '../../TraceMode';
import type { PuyoType } from '../../puyo';

/**
 * - しろいマール
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.ToBlue,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.0
} as Board;
