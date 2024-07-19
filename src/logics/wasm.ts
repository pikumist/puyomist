/**
 * @module wasm とやりとりする型
 */

import type { PuyoAttribute } from './PuyoAttribute';
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
  boost_area_coord_set: Set<WasmPuyoCoord>;
  is_chance_mode: boolean;
  minimum_puyo_num_for_popping: number;
  max_trace_num: number;
  trace_mode: TraceMode;
  popping_leverage: number;
  chain_leverage: number;
}

export type WasmField = WasmPuyo[][];
export type WasmBlock = Map<WasmPuyoCoord, WasmPuyo>;

export interface WasmBlockWithAttr {
  attr: PuyoAttribute;
  block: WasmBlock;
}

export type WasmBlocks = WasmBlockWithAttr[];
