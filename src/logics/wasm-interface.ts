/**
 * @module WASMとやりとりする型
 */

import type { AttributeChain } from './Chain';
import type {
  CountingBonusType,
  ExplorationCategory,
  PreferenceKind
} from './ExplorationTarget';
import type { PuyoAttr } from './PuyoAttr';
import type { PuyoType } from './PuyoType';
import type { TraceMode } from './TraceMode';

export interface WasmPuyoCoord {
  x: number;
  y: number;
}

export interface WasmPuyo {
  id: number;
  puyo_type: PuyoType;
}

export interface WasmSimulationEnvironment {
  is_chance_mode: boolean;
  minimum_puyo_num_for_popping: number;
  max_trace_num: number;
  trace_mode: TraceMode;
  popping_leverage: number;
  chain_leverage: number;
}

export type WasmBlock = Map<WasmPuyoCoord, WasmPuyo>;

export interface WasmBlockWithAttr {
  attr: PuyoAttr;
  block: WasmBlock;
}

export type WasmAttributeChain = AttributeChain;

export interface WasmChain {
  chain_num: number;
  simultaneous_num: number;
  boost_count: number;
  puyo_tsukai_count: number;
  // JS側のChainだとここはPartial<Record>
  attributes: Map<PuyoAttr, WasmAttributeChain>;
  popped_chance_num: number;
  is_all_cleared: boolean;
}

export interface WasmStepCountingBonus {
  bonus_type: CountingBonusType;
  target_attrs: PuyoAttr[];
  step_height: number;
  bonus_count: number;
  repeat: boolean;
}

export interface WasmExplorationTarget {
  /** 探索カテゴリー */
  category: ExplorationCategory;
  /** 各好みの優先度配列。インデックスの小さい要素の方を優先する。 */
  preference_priorities: PreferenceKind[];
  /** 最適解のベスト何個までを結果に返すか */
  optimal_solution_count: number;
  /** 主属性 */
  main_attr: PuyoAttr | undefined;
  /** 副属性 */
  sub_attr: PuyoAttr | undefined;
  /** 副属性 / 主属性 のダメージ率 (1/3か1)  */
  main_sub_ratio: number | undefined;
  /** 加速ボーナス */
  counting_bonus: WasmStepCountingBonus | undefined;
}

export type WasmSolutionResult = {
  /** なぞり位置 */
  trace_coords: WasmPuyoCoord[];
  /** 連鎖情報 */
  chains: WasmChain[];
  /**
   * 探索対象によって異なる値。
   * ダメージの量であったり、スキル溜め数だったり、ぷよ使いカウントだったりする。
   * 大きいほど良い値。
   */
  value: number;
  /** 弾けたチャンスぷよの数 */
  popped_chance_num: number;
  /** 弾けたハートの数 */
  popped_heart_num: number;
  /** 弾けたプリズムの数 */
  popped_prism_num: number;
  /** 弾けたおじゃまの数 */
  popped_ojama_num: number;
  /** 弾けた固ぷよの数 */
  popped_kata_num: number;
  /** 全消しされたかどうか */
  is_all_cleared: boolean;
};

export interface WasmExplorationResult {
  /** 探索した候補数 */
  candidates_num: number;
  /** 最適解リスト。インデックスが小さい要素ほど最善 */
  optimal_solutions: WasmSolutionResult[];
}
