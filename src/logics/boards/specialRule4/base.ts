import type { Board } from '../../Board';
import type { PuyoType } from '../../PuyoType';
import { TraceMode } from '../../TraceMode';

/**
 * - なつぞらのアマノネ
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.ToPurple,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.5
} as Board;
