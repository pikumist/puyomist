import type { Board } from '../../Board';
import { TraceMode } from '../../TraceMode';
import type { PuyoType } from '../../puyo';

/**
 * - あたり＆プーボ
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.ToYellow,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.5
} as Board;
