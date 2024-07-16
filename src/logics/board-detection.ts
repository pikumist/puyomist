import type { Board } from './Board';
import { PuyoAttribute, isColoredPuyoAttribute } from './PuyoAttribute';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import { rgbToHsv } from './generics/rgbToHsv';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BoardMeta {
  fieldRect: Rect;
  unitWidth: number;
  unitHeight: number;
  isChanceMode: boolean;
}

export const getPixel = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) => {
  const color = ctx.getImageData(x, y, 1, 1).data;
  return [...color];
};

export const isWhite = (rgb: number[]) => {
  return rgb[0] === 255 && rgb[1] === 255 && rgb[2] === 255;
};

const detectBoardLeftRight = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { left: number; right: number } | undefined => {
  // 画像上辺から3/4の水平線を取る。通常このライン上でボードの枠と交差する。
  const q3y = Math.floor((height * 3) / 4);

  const posXList: number[] = [];

  for (let x = 0; x < width; x++) {
    if (isWhite(getPixel(ctx, x, q3y))) {
      posXList.push(x);
      break;
    }
  }

  for (let x = width - 1; x >= 0; x--) {
    if (isWhite(getPixel(ctx, x, q3y))) {
      posXList.push(x);
      break;
    }
  }

  if (posXList.length !== 2 || posXList[1] <= posXList[0]) {
    console.log('Cannot detect left/right edge points.');
    return;
  }

  let left = posXList[0];
  let right = posXList[1];

  for (let x = left + 1; x < width; x++) {
    if (!isWhite(getPixel(ctx, x, q3y))) {
      left = x - 1;
      break;
    }
  }
  for (let x = right - 1; x >= 0; x--) {
    if (!isWhite(getPixel(ctx, x, q3y))) {
      right = x + 1;
      break;
    }
  }

  if (Math.abs(width - left - right) > 1) {
    console.log('Balance of left/right edges is bad.');
    return;
  }

  return {
    left,
    right
  };
};

const detectBoardTopBottom = (
  ctx: CanvasRenderingContext2D,
  height: number,
  boardLeft: number
): { top: number; bottom: number } | undefined => {
  let bottom = 0;
  let top = 0;

  for (let y = height - 1; y >= 0; y--) {
    const rgba = getPixel(ctx, boardLeft, y);
    if (isWhite(rgba)) {
      bottom = y;
      break;
    }
  }

  for (let y = bottom - 1; y >= 0; y--) {
    const rgba = getPixel(ctx, boardLeft, y);
    if (!isWhite(rgba)) {
      top = y + 1;
      break;
    }
  }

  if (bottom - top < 100) {
    console.log('Distance of top/botom edges is too small.');
    return;
  }

  return {
    top,
    bottom
  };
};

const detectChanceMode = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  unitWidth: number
): boolean => {
  const chanceModePixelCoord = { x: width / 2 - unitWidth / 4, y: height / 2 };
  const isChanceModePixels: boolean[] = [];

  for (let i = -1; i <= 1; i++) {
    const y = chanceModePixelCoord.y + i;
    for (let j = -1; j <= 1; j++) {
      const x = chanceModePixelCoord.x + j;
      const rgba = getPixel(ctx, x, y);
      isChanceModePixels.push(
        rgba[0] === 56 && rgba[1] === 50 && rgba[2] === 117
      );
    }
  }

  return isChanceModePixels.every(Boolean);
};

/**
 * 8x6のぷよとネクストを含んだボードの枠やぷよ1つ単位の縦横長を検出する。
 * @param ctx
 * @param width 画像の幅
 * @param height 画像の高さ
 * @returns
 */
const detectBoardMeta = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): BoardMeta | undefined => {
  const boardleftRight = detectBoardLeftRight(ctx, width, height);
  if (!boardleftRight) {
    return;
  }

  const { left, right } = boardleftRight;
  const fieldWidth = right - left;
  const unitWidth = fieldWidth / PuyoCoord.XNum;

  const topBottom = detectBoardTopBottom(ctx, height, left);
  if (!topBottom) {
    return;
  }

  const { top, bottom } = topBottom;

  const unitHeight = (bottom - top) / (PuyoCoord.YNum + 0.5);
  const fieldRect = { left, top, right, bottom };
  const isChanceMode = detectChanceMode(ctx, width, height, unitWidth);

  // console.log({ fieldRect, unitWidth, unitHeight, isChanceMode });

  /*
  ctx.fillStyle = '#000';
  ctx.fillRect(left, top, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillRect(Math.round(left + unitWidth), top, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillRect(left, Math.round(top + unitHeight * 0.5), 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillRect(left, bottom, 1, 1);
  */

  return {
    fieldRect,
    unitWidth,
    unitHeight,
    isChanceMode
  };
};

/**
 * RGB色からぷよの属性を調べる
 * @param rgb
 * @returns
 */
const detectPuyoAttr = (rgb: number[]) => {
  const [r, g, b] = rgb;
  const { h, s, v } = rgbToHsv(r, g, b);

  if (h > 320 && h < 340 && v > 98 && s > 12 && s < 16) {
    return PuyoAttribute.Heart;
  }

  // チャンスが光りきっていると h=300 ぐらいになる…
  if (h > 340 || h < 10) {
    return PuyoAttribute.Red;
  }

  if (h > 30 && h < 65) {
    return PuyoAttribute.Yellow;
  }

  if (h > 95 && h < 160) {
    return PuyoAttribute.Green;
  }

  if (h > 210 && h < 250) {
    return PuyoAttribute.Blue;
  }

  if (h > 250 && h < 300) {
    return PuyoAttribute.Purple;
  }

  return PuyoAttribute.Padding;
};

const detectPrism = (rgbList: number[][]) => {
  const attrSet = new Set<PuyoAttribute>();
  rgbList.map((rgb) => {
    attrSet.add(detectPuyoAttr(rgb));
  });
  if (attrSet.size >= 5) {
    return PuyoAttribute.Prism;
  }
  return PuyoAttribute.Padding;
};

/**
 * RGB2色からフィールド内ぷよの種別を判別する。
 * @param rgbList
 * @param isChanceMode
 * @returns
 */
const detectFieldPuyoType = (rgbList: number[][], isChanceMode: boolean) => {
  const [rgb1, rgb2, rgb3, rgb4, rgb5, rgb6, rgb7] = rgbList;

  let puyoAttr = detectPuyoAttr(rgb1);

  if (puyoAttr === PuyoAttribute.Padding) {
    puyoAttr = detectPrism([rgb3, rgb4, rgb5, rgb6, rgb7]);
  }

  if (!isColoredPuyoAttribute(puyoAttr)) {
    switch (puyoAttr) {
      case PuyoAttribute.Heart:
        return PuyoType.Heart;
      case PuyoAttribute.Prism:
        return PuyoType.Prism;
      case PuyoAttribute.Padding:
        return isChanceMode ? undefined : PuyoType.Padding;
      // TODO: ojama, ojama
    }
  }

  const hsv2 = rgbToHsv(rgb2[0], rgb2[1], rgb2[2]);
  const { h, s, v } = hsv2;
  const isPlus = h >= 50 && h <= 54 && s >= 60 && s <= 85 && v >= 95;

  switch (puyoAttr) {
    case PuyoAttribute.Red:
      return isPlus ? PuyoType.RedPlus : PuyoType.Red;
    case PuyoAttribute.Blue:
      return isPlus ? PuyoType.BluePlus : PuyoType.Blue;
    case PuyoAttribute.Green:
      return isPlus ? PuyoType.GreenPlus : PuyoType.Green;
    case PuyoAttribute.Yellow:
      return isPlus ? PuyoType.YellowPlus : PuyoType.Yellow;
    case PuyoAttribute.Purple:
      return isPlus ? PuyoType.PurplePlus : PuyoType.Purple;
  }
};

/**
 * RGB色からネクストぷよの種別を判別する。
 * @returns
 */
const detectNextPuyoType = (rgbList: number[][]) => {
  const [rgb1, rgb2] = rgbList;

  const puyoAttr = detectPuyoAttr(rgb1);
  if (puyoAttr === PuyoAttribute.Padding) {
    return PuyoType.Padding;
  }
  if (puyoAttr === PuyoAttribute.Heart) {
    return PuyoType.Heart;
  }

  const hsv2 = rgbToHsv(rgb2[0], rgb2[1], rgb2[2]);
  const { h, s, v } = hsv2;
  const isPlus =
    // 通常
    !(h > 150 && h < 200 && s < 30 && v > 70) &&
    // 特別ルール
    !(h > 140 && h < 200 && s >= 45 && s <= 60 && v >= 80);

  switch (puyoAttr) {
    case PuyoAttribute.Red:
      return isPlus ? PuyoType.RedPlus : PuyoType.Red;
    case PuyoAttribute.Blue:
      return isPlus ? PuyoType.BluePlus : PuyoType.Blue;
    case PuyoAttribute.Green:
      return isPlus ? PuyoType.GreenPlus : PuyoType.Green;
    case PuyoAttribute.Yellow:
      return isPlus ? PuyoType.YellowPlus : PuyoType.Yellow;
    case PuyoAttribute.Purple:
      return isPlus ? PuyoType.PurplePlus : PuyoType.Purple;
  }
};

/**
 * ネクストぷよのリストを判定する。
 * @param ctx
 * @param boardMeta
 * @returns
 */
const detectNextPuyos = (
  ctx: CanvasRenderingContext2D,
  boardMeta: BoardMeta
): PuyoType[] => {
  const { fieldRect, unitWidth, unitHeight } = boardMeta;
  const { left, top } = fieldRect;
  const mainOffset = [0.34, 0.234];
  const plusOffset = [0.71, 0.34];
  const offsets = [mainOffset, plusOffset];
  const nextPuyos: PuyoType[] = [];

  for (let next_j = 0; next_j < PuyoCoord.XNum; next_j++) {
    const colors = offsets.map((offset) => {
      const x = Math.round(left + unitWidth * (next_j + offset[0]));
      const y = Math.round(top + unitHeight * offset[1]);
      const rgba = getPixel(ctx, x, y);
      const hsv = rgbToHsv(rgba[0], rgba[1], rgba[2]);

      /*
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, 1, 1);
      */

      return { rgba, hsv };
    });
    const puyoType = detectNextPuyoType(colors.map((c) => c.rgba));
    //console.log({ next_j }, colors, getPuyoTypeName(puyoType));
    nextPuyos.push(puyoType);
  }

  return nextPuyos;
};

/**
 * フィールドを判定する。
 * @param ctx
 * @param boardMeta
 * @returns
 */
const detectField = (
  ctx: CanvasRenderingContext2D,
  boardMeta: BoardMeta
): (PuyoType | undefined)[][] => {
  const { fieldRect, unitWidth, unitHeight } = boardMeta;
  const { top, left } = fieldRect;

  const offsets = [
    // main
    [0.25, 0.28],
    // plus
    [0.75, 0.72],
    // prism
    [0.5, 0.2],
    [0.75, 0.4],
    [0.65, 0.7],
    [0.35, 0.7],
    [0.25, 0.4]
  ];

  const field: (PuyoType | undefined)[][] = [[], [], [], [], [], []];

  for (let i = 0; i < PuyoCoord.YNum; i++) {
    const yList = offsets.map(([_, offsetY]) => {
      return Math.round(top + unitHeight * (0.5 + offsetY) + unitHeight * i);
    });

    for (let j = 0; j < PuyoCoord.XNum; j++) {
      const xList = offsets.map(([offsetX, _]) => {
        return Math.round(left + unitWidth * offsetX + unitWidth * j);
      });
      const rgbaList = offsets.map((_, oi) => {
        return getPixel(ctx, xList[oi], yList[oi]);
      });

      const puyoType = detectFieldPuyoType(rgbaList, boardMeta.isChanceMode);

      //const hsv2 = rgbToHsv(rgbaList[1][0], rgbaList[1][1], rgbaList[1][2]);
      //console.log({ i, j, puyoType, hsv2 });

      /*
      ctx.fillStyle = '#000';
      ctx.fillRect(xList[0], yList[0], 1, 1);
      ctx.fillRect(xList[1], yList[1], 1, 1);
      ctx.fillRect(xList[2], yList[2], 1, 1);
      ctx.fillRect(xList[3], yList[3], 1, 1);
      ctx.fillRect(xList[4], yList[4], 1, 1);
      ctx.fillRect(xList[5], yList[5], 1, 1);
      ctx.fillRect(xList[6], yList[6], 1, 1);
      */

      field[i][j] = puyoType;
    }
  }

  return field;
};

/**
 * キャンバスイメージからボード情報を検出する。
 * @param ctx
 * @param width 画像の幅
 * @param height 画像の高さ
 * @returns 検出に失敗したらエラーメッセージ。成功したらボード情報。
 */
export const detectBoard = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): string | Board => {
  const boardMeta = detectBoardMeta(ctx, width, height);
  if (!boardMeta) {
    return 'Cannot detect board rect.';
  }

  const isChanceMode = boardMeta.isChanceMode;
  const nextPuyos = boardMeta.isChanceMode
    ? [...new Array(8)].map((_) => undefined)
    : detectNextPuyos(ctx, boardMeta);

  const field = detectField(ctx, boardMeta);

  return { isChanceMode, field, nextPuyos };
};
