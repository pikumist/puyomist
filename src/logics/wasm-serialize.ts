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
import {
  type PaintPlan,
  PaintPrecision,
  type PaintSearchSettings
} from './paint-search';
import type { SolutionResult } from './solution';
import {
  type WasmExplorationTarget,
  type WasmIgnitionPlan,
  WasmIgnitionPrecision,
  type WasmIgnitionSearchParams,
  WasmPaintFilter,
  type WasmPaintPlan,
  WasmPaintPrecision,
  type WasmPaintSearchParams,
  type WasmPuyo,
  type WasmSimulationEnvironment,
  type WasmSolutionResult,
  type WasmStepCountingBonus,
  WasmUnknownFillPolicy
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

/** ぷよ塗り探索の設定を Rust 側のパラメータに変換する */
export const toWasmPaintSearchParams = (
  settings: PaintSearchSettings
): WasmPaintSearchParams => ({
  target: settings.color,
  max_paint_num: settings.maxPaintNum,
  // 絞り込みは実測で最大 22.9% 取りこぼす一方、コストは 1.4 倍にしかならない。
  // 変えないこと (docs/research/paint-search.md §3)。
  filter: WasmPaintFilter.All,
  precision: toWasmPaintPrecision(settings.precision),
  // 代理評価のなぞり数。3 だと品質が頭打ちになるので 4 が下限。
  surrogate_trace_num: 4,
  result_num: 20,
  // 期待値は「探索は決定論のまま、最終選抜だけ期待値」で使う (最大 +3.8%)。
  uncertainty: settings.showExpectedValue
    ? {
        policy: WasmUnknownFillPolicy.ChainAverse,
        samples: 20,
        max_refills: 2
      }
    : undefined
});

const paintPrecisionMap: Record<PaintPrecision, WasmPaintPrecision> = {
  [PaintPrecision.Standard]: WasmPaintPrecision.Standard,
  [PaintPrecision.High]: WasmPaintPrecision.High,
  [PaintPrecision.Ultra]: WasmPaintPrecision.Ultra
};

export const toWasmPaintPrecision = (
  precision: PaintPrecision
): WasmPaintPrecision => paintPrecisionMap[precision];

/** Rust 側の塗り案を JS 側の型に変換する */
export const toJsPaintPlan = (plan: WasmPaintPlan): PaintPlan => ({
  coords: plan.coords.map((c) => PuyoCoord.xyToCoord(c.x, c.y)!),
  value: plan.value,
  expectedValue: plan.expected_value,
  solution: toJsOptimalSolution(plan.solution)
});

/** 塗り発火探索の設定を Rust 側のパラメータに変換する */
export const toWasmIgnitionSearchParams = (
  settings: PaintSearchSettings,
  seed = 1
): WasmIgnitionSearchParams => ({
  target: settings.color,
  max_paint_num: settings.maxPaintNum,
  // 絞り込みは実測で大きく取りこぼす (all 42.6% に対し adj2 31.3% / adj1 3.1%)。
  // 変えないこと (docs/research/paint-ignition-search.md §9-4)。
  filter: WasmPaintFilter.All,
  precision: toWasmIgnitionPrecision(settings.precision),
  result_num: 20,
  // 探索は決定論のまま、最終選抜だけ期待値で並べ替える (§9-10)。
  uncertainty: settings.showExpectedValue
    ? {
        policy: WasmUnknownFillPolicy.ChainAverse,
        samples: 20,
        max_refills: 2
      }
    : undefined,
  seed
});

const ignitionPrecisionMap: Record<PaintPrecision, WasmIgnitionPrecision> = {
  [PaintPrecision.Standard]: WasmIgnitionPrecision.Standard,
  [PaintPrecision.High]: WasmIgnitionPrecision.High,
  [PaintPrecision.Ultra]: WasmIgnitionPrecision.Ultra
};

export const toWasmIgnitionPrecision = (
  precision: PaintPrecision
): WasmIgnitionPrecision => ignitionPrecisionMap[precision];

/**
 * Rust 側の発火塗り案を JS 側の型に変換する。
 *
 * 仕込みと発火で `PaintPlan` を共有している。発火では `solution.trace_coords` が
 * 「なぞったマス」ではなく**塗ったマス**になる点に注意 (なぞらないので)。
 */
export const toJsIgnitionPlan = (plan: WasmIgnitionPlan): PaintPlan => ({
  coords: plan.coords.map((c) => PuyoCoord.xyToCoord(c.x, c.y)!),
  value: plan.value,
  expectedValue: plan.expected_value,
  solution: toJsOptimalSolution(plan.solution)
});
