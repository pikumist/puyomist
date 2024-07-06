import type { Board } from '../../Board';
import type { PuyoType } from '../../PuyoType';
import { TraceMode } from '../../TraceMode';

/**
 * - あたり＆プーボ
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.ToYellow,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.5
} as Board;
