/** ぷよの属性 */
export enum PuyoAttribute {
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
  Ojyama = 8,
  /** 固 */
  Kata = 9,
  /** パディング */
  Padding = 10
}

/** 色付きぷよの属性 */
export type ColoredPuyoAttribute =
  | PuyoAttribute.Red
  | PuyoAttribute.Blue
  | PuyoAttribute.Green
  | PuyoAttribute.Yellow
  | PuyoAttribute.Purple;

const puyoAttributeMap: ReadonlyMap<PuyoAttribute, string> = new Map([
  [PuyoAttribute.Red, '赤'],
  [PuyoAttribute.Blue, '青'],
  [PuyoAttribute.Green, '緑'],
  [PuyoAttribute.Yellow, '黄'],
  [PuyoAttribute.Purple, '紫'],
  [PuyoAttribute.Heart, 'ハート'],
  [PuyoAttribute.Prism, 'プリズム'],
  [PuyoAttribute.Ojyama, 'おじゃま'],
  [PuyoAttribute.Kata, '固']
]);

/**
 * ぷよの属性名を取得する
 * @param puyoAttribute
 * @returns
 */
export const getPuyoAttributeName = (
  puyoAttribute: PuyoAttribute | undefined
): string => {
  return puyoAttributeMap.get(puyoAttribute!) ?? '';
};

/**
 * 色ぷよかどうか (プリズムは含まない)
 * @param puyoAttr ぷよの属性
 * @returns
 */
export const isColoredPuyoAttribute = (
  puyoAttr: PuyoAttribute
): puyoAttr is
  | PuyoAttribute.Red
  | PuyoAttribute.Blue
  | PuyoAttribute.Green
  | PuyoAttribute.Yellow
  | PuyoAttribute.Purple => {
  return puyoAttr >= PuyoAttribute.Red && puyoAttr <= PuyoAttribute.Purple;
};
