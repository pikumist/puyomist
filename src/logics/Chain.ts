import type { PuyoAttribute } from './PuyoAttribute';

/** ある属性ある連鎖における情報 */
export interface AttributeChain {
  /** ある連鎖における同種のダメージ量 */
  strength: number;
  /** ある連鎖における消えた同種のぷよ数。プラスぷよがあればその分増える。 */
  poppedNum: number;
  /** ある連鎖における同種の分離数 */
  separatedBlocksNum: number;
}

/** ワイルドによる連鎖情報 */
export type WildChain = Omit<AttributeChain, 'poppedNum'>;

/** N 連鎖目における情報 */
export interface Chain {
  /** 何連鎖目か */
  chainNum: number;
  /** 同時消しのぷよ数(同時消しダメージに影響する数) */
  poppedPuyoNum: number;
  /** ぷよ使いイベントでカウントされるぷよ数 (ハートが含まれブーストエリアも加味される。なぞって直接消えた分は含まれない) */
  puyoTsukaiCount: number;
  /** ぷよ属性ごとの連鎖情報 */
  attributes: Record<PuyoAttribute, AttributeChain>;
  /** ワイルド状態の連鎖情報 */
  wild: WildChain;
  /** 全消しされたかどうか */
  allCleared?: boolean;
  /** チャンスぷよが弾けたかどうか */
  chancePopped?: boolean;
}
