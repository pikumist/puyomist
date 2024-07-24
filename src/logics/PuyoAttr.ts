/** ぷよの属性 (色ぷよ以外の特殊なぷよも含む) */
export enum PuyoAttr {
  /** 赤 */
  Red = 1,
  /** 青 */
  Blue = 2,
  /** 緑 */
  Green = 3,
  /** 黄 */
  Yellow = 4,
  /** 紫 */
  Purple = 5,
  /** ハート */
  Heart = 6,
  /** プリズム */
  Prism = 7,
  /** おじゃま */
  Ojama = 8,
  /** 固 */
  Kata = 9,
  /** パディング */
  Padding = 10
}

/** 色付きぷよの属性 */
export type ColoredPuyoAttr =
  | PuyoAttr.Red
  | PuyoAttr.Blue
  | PuyoAttr.Green
  | PuyoAttr.Yellow
  | PuyoAttr.Purple;

const puyoAttrMap: ReadonlyMap<PuyoAttr, string> = new Map([
  [PuyoAttr.Red, '赤'],
  [PuyoAttr.Blue, '青'],
  [PuyoAttr.Green, '緑'],
  [PuyoAttr.Yellow, '黄'],
  [PuyoAttr.Purple, '紫'],
  [PuyoAttr.Heart, 'ハート'],
  [PuyoAttr.Prism, 'プリズム'],
  [PuyoAttr.Ojama, 'おじゃま'],
  [PuyoAttr.Kata, '固']
]);

/** 色ぷよの属性リスト */
export const coloredPuyoAttrList: ReadonlyArray<ColoredPuyoAttr> = [
  PuyoAttr.Red,
  PuyoAttr.Blue,
  PuyoAttr.Green,
  PuyoAttr.Yellow,
  PuyoAttr.Purple
];

/**
 * ぷよの属性名を取得する
 * @param puyoAttribute
 * @returns
 */
export const getPuyoAttrName = (
  puyoAttribute: PuyoAttr | undefined
): string => {
  return puyoAttrMap.get(puyoAttribute!) ?? '';
};

/**
 * 色ぷよかどうか (プリズムは含まない)
 * @param puyoAttr ぷよの属性
 * @returns
 */
export const isColoredPuyoAttr = (
  puyoAttr: PuyoAttr
): puyoAttr is ColoredPuyoAttr => {
  return puyoAttr >= PuyoAttr.Red && puyoAttr <= PuyoAttr.Purple;
};
