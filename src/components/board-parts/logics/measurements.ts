import { PuyoCoord } from '../../../logics/PuyoCoord';

/** 外枠線の幅 */
export const fw = 2;
/** グリッド線の幅 */
export const gw = 1;
/** セルの幅 */
export const cw = 48;
/** セルの高さ */
export const ch = 48;
/** ネクストセルの高さ */
export const nch = ch / 2;

/** ボードの幅 */
export const W = fw * 2 + cw * PuyoCoord.XNum + gw * (PuyoCoord.XNum - 1);

/** ボードの高さ */
export const H = fw * 2 + nch + ch * PuyoCoord.YNum + gw * PuyoCoord.YNum;
