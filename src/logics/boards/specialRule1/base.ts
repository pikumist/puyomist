import type { Board } from '../../Board';
import type { PuyoType } from '../../PuyoType';
import { TraceMode } from '../../TraceMode';

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
