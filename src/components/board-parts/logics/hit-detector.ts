import { PuyoCoord } from '../../../logics/PuyoCoord';
import { ch, cw, fw, gw, nch } from './measurements';

/** 座標がネクストぷよにヒットするかどうか */
export const detectHitInNext = (px: number, py: number) => {
  const rawXi = (px - fw) / (cw + gw);
  const rawYi = (py - fw) / nch;
  const xi = Math.floor(rawXi);
  const yi = Math.floor(rawYi);

  if (yi === 0 && xi >= 0 && xi < PuyoCoord.XNum) {
    return xi;
  }
  return null;
};

/** 座標がフィールドぷよにヒットするかどうか */
export const detectHitInField = (px: number, py: number) => {
  const rawXi = (px - fw) / (cw + gw);
  const rawYi = (py - fw - nch - gw) / (ch + gw);
  const xi = Math.floor(rawXi);
  const yi = Math.floor(rawYi);
  const diffCenterX = Math.abs(rawXi - xi - 0.5);
  const diffCenterY = Math.abs(rawYi - yi - 0.5);

  if (PuyoCoord.isValidXy(xi, yi)) {
    if (diffCenterX > 0.3 || diffCenterY > 0.3) {
      return null;
    }
    return PuyoCoord.xyToCoord(xi, yi);
  }
  return null;
};
