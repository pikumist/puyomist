import type { Board } from '../../Board';
import type { PuyoType } from '../../PuyoType';
import { TraceMode } from '../../TraceMode';

/**
 * - もっとあやしいクルーク
 * - 影冠のラフィソル
 * - 冒険の魔導師アルル
 * - 異邦の魔人フルシュ
 * - 蒸気都市のオトモ
 * - なつやすみのエリサ
 * - プリンプタウンのクルーク
 * - キュアブラック＆キュアホワイト
 */
export default {
  field: [] as PuyoType[][],
  traceMode: TraceMode.Normal,
  minimumPuyoNumForPopping: 4
} as Board;
