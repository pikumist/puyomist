import type { Board } from '../../Board';
import { TraceMode } from '../../TraceMode';
import type { PuyoType } from '../../puyo';

/**
 * - なつぞらのアマノネ
 */
export default {
  matrix: [] as PuyoType[][],
  traceMode: TraceMode.ToPurple,
  minimumPuyoNumForPopping: 4,
  chainLeverage: 10.5
} as Board;
