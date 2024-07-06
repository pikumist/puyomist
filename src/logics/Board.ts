import { PuyoCoord } from './PuyoCoord';
import type { TraceMode } from './TraceMode';
import type { PuyoType } from './puyo';

/** 連鎖の種やとくべつルール、SS取り込み時のボード情報 */
export interface Board {
  /** 盤面情報 */
  field: (PuyoType | undefined)[][];
  /** ネクストぷよリスト */
  nextPuyos?: (PuyoType | undefined)[];
  /** 大連鎖チャンス中かどうか */
  isChanceMode?: boolean;
  /** なぞりモード */
  traceMode?: TraceMode;
  /** ぷよ消しに必要な最低数 (4 か 3) */
  minimumPuyoNumForPopping?: number;
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
