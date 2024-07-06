import type { Board } from '../../Board';
import type { PuyoType } from '../../PuyoType';
import { TraceMode } from '../../TraceMode';

/**
 * - しろいマール
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.ToBlue,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.0
} as Board;
