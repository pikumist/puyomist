import type { Board } from '../../Board';
import { TraceMode } from '../../TraceMode';
import type { PuyoType } from '../../puyo';

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
  matrix: [] as PuyoType[][],
  traceMode: TraceMode.Normal,
  minimumPuyoNumForPopping: 4
} as Board;
