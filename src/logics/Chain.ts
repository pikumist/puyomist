import type { PuyoAttribute } from './PuyoAttribute';

/** ある属性ある連鎖における情報 */
export interface AttributeChain {
  /** ある連鎖における同種のダメージ量 */
  strength: number;
  /** ある連鎖における消えた同種のぷよ数。プラスぷよがあればその分増える。 */
  popped_count: number;
  /** ある連鎖における同種の分離数 */
  separated_blocks_num: number;
}

/** N 連鎖目における情報 */
export interface Chain {
  /** 何連鎖目か (1から始まる数字) */
  chain_num: number;
  /** 同時消しのぷよ数(同時消しダメージに影響する数) */
  simultaneous_num: number;
  /** ブーストエリアで内で消したぷよ(色ぷよ、ハート、プリズム、おじゃま)の数 (プラスぷよは2個としてカウント) */
  boost_count: number;
  /** ぷよ使いイベントでカウントされるぷよ数 */
  puyo_tsukai_count: number;
  /** ぷよ属性ごとの連鎖情報 */
  attributes: Partial<Record<PuyoAttribute, AttributeChain>>;
  /** 全消しされたかどうか */
  is_all_cleared?: boolean;
  /** チャンスぷよが弾けたかどうか */
  is_chance_popped?: boolean;
  /** プリズムが弾けたかどうか */
  is_prism_popped?: boolean;
}
