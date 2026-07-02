/**
 * @module WASM版・Rustネイティブバックエンド版で共用するシリアライズ処理
 *
 * どちらもRust側 (packages/solver-wasm) の探索器へ渡すワイヤーフォーマットが
 * 完全に一致しているため (serde の型がそのまま WasmXxx 型と対応する)、
 * このモジュールで変換処理を共有する。
 */

import type {
  ExplorationTarget,
  ExplorationTargetDamage,
  ExplorationTargetSkillPuyoCount,
  StepCountingBonus
} from './ExplorationTarget';
import type { ColoredPuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import type { SimulationData } from './SimulationData';
import type { SolutionResult } from './solution';
import type {
  WasmExplorationTarget,
  WasmPuyo,
  WasmSimulationEnvironment,
  WasmSolutionResult,
  WasmStepCountingBonus
} from './wasm-interface';

export const toWasmExplorationTarget = (
  explorationTarget: ExplorationTarget
): WasmExplorationTarget => {
  const exploration_target: WasmExplorationTarget = {
    category: explorationTarget.category,
    preference_priorities: explorationTarget.preference_priorities,
    optimal_solution_count: explorationTarget.optimal_solution_count || 1,
    main_attr: (explorationTarget as ExplorationTargetDamage).main_attr
      ? ((explorationTarget as ExplorationTargetDamage)
          .main_attr as ColoredPuyoAttr)
      : undefined,
    sub_attr: (explorationTarget as ExplorationTargetDamage).sub_attr,
    main_sub_ratio: (explorationTarget as ExplorationTargetDamage)
      .main_sub_ratio,
    counting_bonus: (explorationTarget as ExplorationTargetSkillPuyoCount)
      .counting_bonus
      ? ((b: StepCountingBonus) =>
          ({
            bonus_type: b.bonus_type,
            target_attrs: b.target_attrs,
            step_height: b.step_height,
            bonus_count: b.bonus_count,
            repeat: b.repeat
          }) satisfies WasmStepCountingBonus)(
          (explorationTarget as ExplorationTargetSkillPuyoCount).counting_bonus!
        )
      : undefined
  };
  return exploration_target;
};

export const toWasmEnvironmentFieldNextPuyos = (
  simulationData: SimulationData
) => {
  const environment: WasmSimulationEnvironment = {
    is_chance_mode: simulationData.isChanceMode,
    minimum_puyo_num_for_popping: simulationData.minimumPuyoNumForPopping,
    max_trace_num: simulationData.maxTraceNum,
    trace_mode: simulationData.traceMode,
    popping_leverage: simulationData.poppingLeverage,
    chain_leverage: simulationData.chainLeverage
  };
  const boost_area_coord_set = new Set(
    simulationData.boostAreaCoordList.map(({ _x, _y }: any) => ({
      x: _x,
      y: _y
    }))
  );
  const field: (WasmPuyo | undefined)[][] = simulationData.field.map((row) =>
    row.map((p) => (p ? { id: p.id, puyo_type: p.type } : undefined))
  );
  const next_puyos: (WasmPuyo | undefined)[] = simulationData.nextPuyos.map(
    (p) => (p ? { id: p.id, puyo_type: p.type } : undefined)
  );

  return {
    environment,
    boost_area_coord_set,
    field,
    next_puyos
  };
};

export const toJsOptimalSolution = (s: WasmSolutionResult): SolutionResult => {
  return {
    ...s,
    trace_coords: s.trace_coords.map((p) => PuyoCoord.xyToCoord(p.x, p.y)),
    chains: s.chains.map((c) => {
      return {
        ...c,
        // wasm-bindgen 経由 (WASM版) では attributes は実際の Map として届くが、
        // Rustネイティブバックエンド版 (WebSocket + JSON) では PuyoAttr がすでに
        // 文字列キーとしてシリアライズされたただのオブジェクトとして届く。
        // JS の Partial<Record<PuyoAttr, AttributeChain>> と同じ形なので変換不要。
        attributes:
          c.attributes instanceof Map
            ? Object.fromEntries(c.attributes)
            : c.attributes
      };
    })
  } as unknown as SolutionResult;
};
