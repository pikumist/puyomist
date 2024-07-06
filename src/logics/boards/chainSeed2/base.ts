import type { Board } from '../../Board';
import { TraceMode } from '../../TraceMode';
import type { PuyoType } from '../../puyo';

/**
 * - チャーミードラコ
 * - 剣士アミティ
 * - 戦乙女アコール先生
 * - 星剣のレガムント
 * - ミラクルチャーミードラコ
 * - ひやくのウィッチ
 * - アナスタシア・ホーシン
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.Normal,
  minimumPuyoNumForPopping: 4
} as Board;
