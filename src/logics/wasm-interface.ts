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

type WasmAttributeChain = AttributeChain;

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

///
/// 前段「ぷよ塗り」探索
///

/** 候補マスの絞り込み方 (Rust の `PaintFilter`)。**`All` から変えないこと** */
export enum WasmPaintFilter {
  /** 絞り込みなし */
  All = 0
}

/** 探索精度 (Rust の `PaintPrecision`)。ビーム幅と検証件数はここから決まる */
export enum WasmPaintPrecision {
  /** 幅300 */
  Standard = 0,
  /** 幅1000 */
  High = 1,
  /** 幅2000。wasm では選ばせない */
  Ultra = 2
}

/** 不確定ぷよの埋め方 (Rust の `UnknownFillPolicy`) */
export enum WasmUnknownFillPolicy {
  /** 補充しない */
  Inert = 0,
  /** 補充ぷよ同士を隣り合って同色にしない */
  ChainAverse = 1,
  /** 一様ランダム */
  Random = 2
}

export interface WasmUncertaintyParams {
  policy: WasmUnknownFillPolicy;
  /** サンプル数。全候補に同じ列を当てる (共通乱数法) */
  samples: number;
  /** 補充を許す回数の上限 */
  max_refills: number;
}

export interface WasmPaintSearchParams {
  /** 塗り色 */
  target: PuyoAttr;
  /** 塗れるマス数の上限 */
  max_paint_num: number;
  /** 候補マスの絞り込み方 */
  filter: WasmPaintFilter;
  /** 探索精度 */
  precision: WasmPaintPrecision;
  /** 代理評価に使うなぞり数 */
  surrogate_trace_num: number;
  /** 返す塗り案の件数 */
  result_num: number;
  /** 期待値による並べ替え。無いなら undefined */
  uncertainty: WasmUncertaintyParams | undefined;
}

/** 塗り集合。盤面のセルインデックス (0..47) の配列 */
export type WasmPaintSet = number[];

export interface WasmPaintEvaluation {
  /** 決定論評価の値 */
  value: number;
  /** 期待値 E_s[max_t]。求めていなければ undefined */
  expected_value: number | undefined;
  /** 期待値 max_t[E_s]。求めていなければ undefined */
  expected_value_of_plan?: number | undefined;
  /** 後段の最適解。最終評価のときだけ入る */
  solution: WasmSolutionResult | undefined;
}

export interface WasmPaintPlan {
  /** 塗るマス */
  coords: WasmPuyoCoord[];
  value: number;
  expected_value: number | undefined;
  solution: WasmSolutionResult;
}
