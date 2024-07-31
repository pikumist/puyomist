import { PuyoCoord } from './PuyoCoord';
import type { PuyoType } from './PuyoType';
import type { TraceMode } from './TraceMode';

/** 連鎖の種やとくべつルール、SS取り込み時のボード情報 */
export interface Board {
  /** ネクストぷよリスト */
  nextPuyos?: (PuyoType | undefined)[];
  /** 盤面情報 */
  field: (PuyoType | undefined)[][];
  /** 大連鎖チャンス中かどうか */
  isChanceMode?: boolean;
  /** ぷよ消しに必要な最低数 (4 か 3) */
  minimumPuyoNumForPopping?: number;
  /** 最大なぞり数 */
  maxTraceNum?: number;
  /** なぞりモード */
  traceMode?: TraceMode;
  /** 同時消し倍率 */
  poppingLeverage?: number;
  /** 連鎖倍率 */
  chainLeverage?: number;
}

/** 盤面が特定できないときに読み込ませる空盤面 */
export const emptyBoard: Board = {
  field: [...new Array(PuyoCoord.YNum)].map((_) => {
    return [...new Array(PuyoCoord.XNum)];
  }),
  nextPuyos: [...new Array(PuyoCoord.XNum)]
};
