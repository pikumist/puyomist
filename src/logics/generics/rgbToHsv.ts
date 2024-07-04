import { wrapNum } from './wrapNum';

/**
 * RGBの数値をHSV数値に変換する。
 * @param r 赤の数値。0以上255以下の整数。
 * @param g 緑の数値。0以上255以下の整数。
 * @param b 青の数値。0以上255以下の整数。
 * @returns HSVの値。hは0以上360未満の整数。sは0以上100以下の整数。vは0以上100以下の整数。
 */
export const rgbToHsv = (
  r: number,
  g: number,
  b: number
): { h: number; s: number; v: number } => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  // Hue (色相)
  let h: number;

  if (r === g && g === b) {
    h = 0;
  } else if (r === max) {
    h = 60 * ((g - b) / (max - min));
  } else if (g === max) {
    h = 60 * ((b - r) / (max - min)) + 120;
  } else if (b === max) {
    h = 60 * ((r - g) / (max - min)) + 240;
  }

  h = wrapNum(Math.round(h!), [0, 360]);

  // Saturation (彩度)
  const s = Math.round(
    (max === min ? 0 : min === 0 ? 1 : (max - min) / max) * 100
  );

  // Value (明るさ)
  const v = Math.round((max / 255) * 100);

  return {
    h,
    s,
    v
  };
};
