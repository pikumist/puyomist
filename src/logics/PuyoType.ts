import { type ColoredPuyoAttr, PuyoAttr, isColoredPuyoAttr } from './PuyoAttr';

/** ぷよの型 */
export enum PuyoType {
  /** 赤ぷよ */
  Red = 1,
  /** 赤ぷよプラス */
  RedPlus = 2,
  /** 赤ぷよチャンス */
  RedChance = 3,
  /** 赤ぷよチャンスプラス */
  RedChancePlus = 4,
  /** 青ぷよ */
  Blue = 5,
  /** 青ぷよプラス */
  BluePlus = 6,
  /** 青ぷよチャンス */
  BlueChance = 7,
  /** 青ぷよチャンスプラス */
  BlueChancePlus = 8,
  /** 緑ぷよ */
  Green = 9,
  /** 緑ぷよプラス */
  GreenPlus = 10,
  /** 緑ぷよチャンス */
  GreenChance = 11,
  /** 緑ぷよチャンスプラス */
  GreenChancePlus = 12,
  /** 黄ぷよ */
  Yellow = 13,
  /** 黄ぷよプラス */
  YellowPlus = 14,
  /** 黄ぷよチャンス */
  YellowChance = 15,
  /** 黄ぷよチャンスプラス */
  YellowChancePlus = 16,
  /** 紫ぷよ */
  Purple = 17,
  /** 紫ぷよプラス */
  PurplePlus = 18,
  /** 紫ぷよチャンス */
  PurpleChance = 19,
  /** 紫ぷよチャンスプラス */
  PurpleChancePlus = 20,
  /** ハートぷよ */
  Heart = 21,
  /** プリズムぷよ */
  Prism = 22,
  /** おじゃまぷよ */
  Ojama = 23,
  /** 固ぷよ */
  Kata = 24,
  /** パディングぷよ (連鎖をとめるための消せないぷよ) */
  Padding = 25
}

export const puyoTypeMap: ReadonlyMap<PuyoType, string> = new Map<
  PuyoType,
  string
>([
  [PuyoType.Red, '赤'],
  [PuyoType.RedPlus, '赤+'],
  [PuyoType.RedChance, '赤ch'],
  [PuyoType.RedChancePlus, '赤ch+'],
  [PuyoType.Blue, '青'],
  [PuyoType.BluePlus, '青+'],
  [PuyoType.BlueChance, '青ch'],
  [PuyoType.BlueChancePlus, '青ch+'],
  [PuyoType.Green, '緑'],
  [PuyoType.GreenPlus, '緑+'],
  [PuyoType.GreenChance, '緑ch'],
  [PuyoType.GreenChancePlus, '緑ch+'],
  [PuyoType.Yellow, '黄'],
  [PuyoType.YellowPlus, '黄+'],
  [PuyoType.YellowChance, '黄ch'],
  [PuyoType.YellowChancePlus, '黄ch+'],
  [PuyoType.Purple, '紫'],
  [PuyoType.PurplePlus, '紫+'],
  [PuyoType.PurpleChance, '紫ch'],
  [PuyoType.PurpleChancePlus, '紫ch+'],
  [PuyoType.Heart, 'ハート'],
  [PuyoType.Prism, 'プリズム'],
  [PuyoType.Ojama, 'おじゃま'],
  [PuyoType.Kata, '固'],
  [PuyoType.Padding, 'パティング']
]);

export const getPuyoTypeName = (puyoType: PuyoType | undefined): string => {
  return puyoTypeMap.get(puyoType!) || '';
};

/** 色ぷよの型 (プリズムは含まない) */
export type ColoredPuyoType =
  | PuyoType.Red
  | PuyoType.RedPlus
  | PuyoType.RedChance
  | PuyoType.RedChancePlus
  | PuyoType.Blue
  | PuyoType.BluePlus
  | PuyoType.BlueChance
  | PuyoType.BlueChancePlus
  | PuyoType.Green
  | PuyoType.GreenPlus
  | PuyoType.GreenChance
  | PuyoType.GreenChancePlus
  | PuyoType.Yellow
  | PuyoType.YellowPlus
  | PuyoType.YellowChance
  | PuyoType.YellowChancePlus
  | PuyoType.Purple
  | PuyoType.PurplePlus
  | PuyoType.PurpleChance
  | PuyoType.PurpleChancePlus;

/**
 * 色ぷよかどうか (プリズムは含まない)
 * @param puyoType ぷよの型
 * @returns
 */
export const isColoredPuyoType = (
  puyoType: PuyoType
): puyoType is ColoredPuyoType => {
  return puyoType >= PuyoType.Red && puyoType <= PuyoType.PurpleChancePlus;
};

/**
 * プラスぷよかどうか
 * @param puyoType ぷよの型
 * @returns
 */
export const isPlusPuyo = (
  puyoType: PuyoType | undefined
): puyoType is
  | PuyoType.RedPlus
  | PuyoType.RedChancePlus
  | PuyoType.BluePlus
  | PuyoType.BlueChancePlus
  | PuyoType.GreenPlus
  | PuyoType.GreenChancePlus
  | PuyoType.YellowPlus
  | PuyoType.YellowChancePlus
  | PuyoType.PurplePlus
  | PuyoType.PurpleChancePlus => {
  switch (puyoType) {
    case PuyoType.RedPlus:
    case PuyoType.RedChancePlus:
    case PuyoType.BluePlus:
    case PuyoType.BlueChancePlus:
    case PuyoType.GreenPlus:
    case PuyoType.GreenChancePlus:
    case PuyoType.YellowPlus:
    case PuyoType.YellowChancePlus:
    case PuyoType.PurplePlus:
    case PuyoType.PurpleChancePlus:
      return true;
  }
  return false;
};

/**
 * チャンスぷよかどうか
 * @param puyoType ぷよの型
 * @returns
 */
export const isChancePuyo = (
  puyoType: PuyoType
): puyoType is
  | PuyoType.RedChance
  | PuyoType.RedChancePlus
  | PuyoType.BlueChance
  | PuyoType.BlueChancePlus
  | PuyoType.GreenChance
  | PuyoType.GreenChancePlus
  | PuyoType.YellowChance
  | PuyoType.YellowChancePlus
  | PuyoType.PurpleChance
  | PuyoType.PurpleChancePlus => {
  switch (puyoType) {
    case PuyoType.RedChance:
    case PuyoType.RedChancePlus:
    case PuyoType.BlueChance:
    case PuyoType.BlueChancePlus:
    case PuyoType.GreenChance:
    case PuyoType.GreenChancePlus:
    case PuyoType.YellowChance:
    case PuyoType.YellowChancePlus:
    case PuyoType.PurpleChance:
    case PuyoType.PurpleChancePlus:
      return true;
  }
  return false;
};

/** なぞり可能なぷよかどうか (星魔のような塗りは考慮していない) */
export const isTraceablePuyo = (
  puyoType: PuyoType | undefined
): puyoType is ColoredPuyoType | PuyoType.Heart | PuyoType.Prism => {
  if (!puyoType) {
    return false;
  }

  switch (puyoType) {
    case PuyoType.Ojama:
    case PuyoType.Kata:
    case PuyoType.Padding:
      return false;
    default:
      return true;
  }
};

/** ぷよの属性 */
export const getPuyoAttr = (
  puyoType: PuyoType | undefined
): PuyoAttr | undefined => {
  switch (puyoType) {
    case PuyoType.Red:
    case PuyoType.RedPlus:
    case PuyoType.RedChance:
    case PuyoType.RedChancePlus:
      return PuyoAttr.Red;

    case PuyoType.Blue:
    case PuyoType.BluePlus:
    case PuyoType.BlueChance:
    case PuyoType.BlueChancePlus:
      return PuyoAttr.Blue;

    case PuyoType.Green:
    case PuyoType.GreenPlus:
    case PuyoType.GreenChance:
    case PuyoType.GreenChancePlus:
      return PuyoAttr.Green;

    case PuyoType.Yellow:
    case PuyoType.YellowPlus:
    case PuyoType.YellowChance:
    case PuyoType.YellowChancePlus:
      return PuyoAttr.Yellow;

    case PuyoType.Purple:
    case PuyoType.PurplePlus:
    case PuyoType.PurpleChance:
    case PuyoType.PurpleChancePlus:
      return PuyoAttr.Purple;

    case PuyoType.Heart:
      return PuyoAttr.Heart;

    case PuyoType.Prism:
      return PuyoAttr.Prism;

    case PuyoType.Ojama:
      return PuyoAttr.Ojama;

    case PuyoType.Kata:
      return PuyoAttr.Kata;

    case PuyoType.Padding:
      return PuyoAttr.Padding;
  }
};

/**
 * 色ぷよであればプラスもチャンスも付いていない通常の色ぷよに変換する。
 * @param puyoType
 * @returns
 */
export const toNormalColoredType = (puyoType: PuyoType) => {
  if (!isColoredPuyoType(puyoType)) {
    return puyoType;
  }
  const attr = getPuyoAttr(puyoType) as ColoredPuyoAttr;

  switch (attr) {
    case PuyoAttr.Red:
      return PuyoType.Red;
    case PuyoAttr.Blue:
      return PuyoType.Blue;
    case PuyoAttr.Green:
      return PuyoType.Green;
    case PuyoAttr.Yellow:
      return PuyoType.Yellow;
    case PuyoAttr.Purple:
      return PuyoType.Purple;
  }
};

/**
 * 色ぷよであればチャンス付与する。
 * @param puyoType
 * @returns
 */
export const toChanceColoredType = (puyoType: PuyoType) => {
  if (!isColoredPuyoType(puyoType)) {
    return puyoType;
  }

  const isPlus = isPlusPuyo(puyoType);
  const attr = getPuyoAttr(puyoType) as ColoredPuyoAttr;

  switch (attr) {
    case PuyoAttr.Red:
      return isPlus ? PuyoType.RedChancePlus : PuyoType.RedChance;
    case PuyoAttr.Blue:
      return isPlus ? PuyoType.BlueChancePlus : PuyoType.BlueChance;
    case PuyoAttr.Green:
      return isPlus ? PuyoType.GreenChancePlus : PuyoType.GreenChance;
    case PuyoAttr.Yellow:
      return isPlus ? PuyoType.YellowChancePlus : PuyoType.YellowChance;
    case PuyoAttr.Purple:
      return isPlus ? PuyoType.PurpleChancePlus : PuyoType.PurpleChance;
  }
};

/**
 * 色ぷよであればプラスを付与する。
 * @param puyoType
 * @returns
 */
export const toPlusColoredType = (puyoType: PuyoType) => {
  if (!isColoredPuyoType(puyoType)) {
    return puyoType;
  }

  const isChance = isChancePuyo(puyoType);
  const attr = getPuyoAttr(puyoType) as ColoredPuyoAttr;

  switch (attr) {
    case PuyoAttr.Red:
      return isChance ? PuyoType.RedChancePlus : PuyoType.RedPlus;
    case PuyoAttr.Blue:
      return isChance ? PuyoType.BlueChancePlus : PuyoType.BluePlus;
    case PuyoAttr.Green:
      return isChance ? PuyoType.GreenChancePlus : PuyoType.GreenPlus;
    case PuyoAttr.Yellow:
      return isChance ? PuyoType.YellowChancePlus : PuyoType.YellowPlus;
    case PuyoAttr.Purple:
      return isChance ? PuyoType.PurpleChancePlus : PuyoType.PurplePlus;
  }
};

/**
 * ぷよの型を指定の属性に変換する。
 * @param puyoType
 * @param toAttr
 * @returns
 */
export const convertPuyoType = (
  puyoType: PuyoType,
  toAttr: PuyoAttr
): PuyoType => {
  if (puyoType === PuyoType.Padding) {
    return puyoType;
  }

  if (isColoredPuyoType(puyoType)) {
    if (isColoredPuyoAttr(toAttr)) {
      const isPlusTerm = isPlusPuyo(puyoType) ? 1 : 0;
      const isChanceTerm = isChancePuyo(puyoType) ? 2 : 0;

      let result!: PuyoType;

      switch (toAttr) {
        case PuyoAttr.Red:
          result = PuyoType.Red;
          break;
        case PuyoAttr.Blue:
          result = PuyoType.Blue;
          break;
        case PuyoAttr.Green:
          result = PuyoType.Green;
          break;
        case PuyoAttr.Yellow:
          result = PuyoType.Yellow;
          break;
        case PuyoAttr.Purple:
          result = PuyoType.Purple;
      }

      result += isPlusTerm + isChanceTerm;

      return result;
    }

    switch (toAttr) {
      case PuyoAttr.Heart:
        return PuyoType.Heart;
      case PuyoAttr.Prism:
        return PuyoType.Prism;
      case PuyoAttr.Ojama:
        return PuyoType.Ojama;
      case PuyoAttr.Kata:
        return PuyoType.Kata;
    }
  }

  switch (toAttr) {
    case PuyoAttr.Red:
      return PuyoType.Red;
    case PuyoAttr.Blue:
      return PuyoType.Blue;
    case PuyoAttr.Green:
      return PuyoType.Green;
    case PuyoAttr.Yellow:
      return PuyoType.Yellow;
    case PuyoAttr.Purple:
      return PuyoType.Purple;
    case PuyoAttr.Heart:
      return PuyoType.Heart;
    case PuyoAttr.Prism:
      return PuyoType.Prism;
    case PuyoAttr.Ojama:
      return PuyoType.Ojama;
    case PuyoAttr.Kata:
      return PuyoType.Kata;
    case PuyoAttr.Padding:
      return PuyoType.Padding;
  }
};

/** TODO: SVG化したら削除 */
export const getPuyoRgb = (type: PuyoType) => {
  const attr = getPuyoAttr(type);

  switch (attr) {
    case PuyoAttr.Red:
      return '#c00';
    case PuyoAttr.Blue:
      return '#00c';
    case PuyoAttr.Green:
      return '#0c0';
    case PuyoAttr.Yellow:
      return 'yellow';
    case PuyoAttr.Purple:
      return '#808';
    case PuyoAttr.Heart:
      return 'pink';
    case PuyoAttr.Prism:
      return '#fff';
    case PuyoAttr.Ojama:
      return '#666';
    case PuyoAttr.Kata:
      return '#333';
    case PuyoAttr.Padding:
      return '#000';
    default:
      throw new Error('The attr of puyo is unknown.');
  }
};
