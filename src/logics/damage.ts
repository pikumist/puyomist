import type { PuyoAttribute } from './puyo';

/** N 連鎖目におけるダメージ */
export interface ChainDamage {
  /** N 連鎖目 */
  chainNum: number;
  /** 同時消しのぷよ数(同時消しダメージに影響する数) */
  poppedPuyoNum: number;
  /** ぷよ使いイベントでカウントされるぷよ数 (ハートが含まれブーストエリアも加味される。なぞって直接消えた分は含まれない) */
  puyoTsukaiCount: number;
  /** 色ごとのダメージ項の情報。ダメージ量だけでなくその他情報も付随。 */
  damageTerms: Map<
    /** ぷよの属性 */
    PuyoAttribute,
    {
      /** N 連鎖目におけるこの色のダメージ量 */
      strength: number;
      /** N 連鎖目における消した同色のぷよ数 */
      poppedNum: number;
      /** N 連鎖目のおける同色の分離数 */
      separatedBlocksNum: number;
    }
  >;
}

/**
 * N 連鎖目のダメージ項を計算する。(ダメージは全連鎖を合計したもの)
 * @param cardAttackStrength カードの攻撃力
 * @param poppingFactor ぷよ消し項
 * @param chainFactor 連鎖項
 * @returns
 */
export const calcDamageTerm = (
  cardAttackStrength: number,
  poppingFactor: number,
  chainFactor: number
): number => {
  return cardAttackStrength * poppingFactor * chainFactor;
};

/** calcPoppintFactor() のオプション */
export interface CalcPoppingFactorOptions {
  /** ぷよが消えるのに必要な個数 */
  minimumPuyoNumForPopping?: number;
  /** 同時消し係数 (通常攻撃は 0.15, スキル砲は 0.30) */
  poppingCoefficient?: number;
  /** 同時消し係数の倍率 (童話スキルなどで倍率が上がる) */
  poppingLeverage?: number;
}

/**
 * ぷよ消し項を計算する。
 * @param poppedPuyoNum 同時消し数
 * @param separatedBlocksNum 分離数
 * @param options オプション
 */
export const calcPoppingFactor = (
  poppedPuyoNum: number,
  separatedBlocksNum: number,
  options: CalcPoppingFactorOptions = {}
): number => {
  const {
    minimumPuyoNumForPopping = 4,
    poppingCoefficient = 0.15,
    poppingLeverage = 1.0
  } = options;

  const result =
    (1 +
      (poppedPuyoNum - minimumPuyoNumForPopping) *
        poppingCoefficient *
        poppingLeverage) *
    separatedBlocksNum;

  return result;
};

const chainCoeffcientTable = [
  Number.NaN,
  0, // 1連鎖
  0.4, // 2連鎖
  0.7 // 3連鎖
  // 4連鎖は 1.0 でそれ以降 0.2 ずつ上がる
];

/**
 * 連鎖項を計算する。
 * @param chainNum 連鎖数
 * @param chainLeverage 連鎖係数の倍率
 */
export const calcChainFactor = (chainNum: number, chainLeverage = 1) => {
  if (!Number.isInteger(chainNum)) {
    throw new Error('chainNum must be an integer.');
  }
  if (!(chainNum >= 1)) {
    throw new Error('chainNum must be 1 or greater.');
  }

  const baseCoefficient =
    chainNum >= 4 ? 1.0 + (chainNum - 4) * 0.2 : chainCoeffcientTable[chainNum];

  const result = baseCoefficient * chainLeverage + 1;

  return result;
};
