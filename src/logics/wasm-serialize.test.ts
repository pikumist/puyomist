import { describe, expect, it } from 'vitest';
import { createSimulationData } from '../store/internal/createSimulationData';
import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTargetDamage,
  type ExplorationTargetPuyoTasukaiCount,
  type ExplorationTargetSkillPuyoCount,
  PreferenceKind
} from './ExplorationTarget';
import { PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import type { WasmSolutionResult } from './wasm-interface';
import {
  toJsOptimalSolution,
  toWasmEnvironmentFieldNextPuyos,
  toWasmExplorationTarget
} from './wasm-serialize';

describe('toWasmExplorationTarget', () => {
  it('converts a damage target with main/sub attrs and ratio', () => {
    const target: ExplorationTargetDamage = {
      category: ExplorationCategory.Damage,
      preference_priorities: [PreferenceKind.BiggerValue],
      optimal_solution_count: 3,
      main_attr: PuyoAttr.Red,
      sub_attr: PuyoAttr.Blue,
      main_sub_ratio: 1 / 3
    };

    expect(toWasmExplorationTarget(target)).toEqual({
      category: ExplorationCategory.Damage,
      preference_priorities: [PreferenceKind.BiggerValue],
      optimal_solution_count: 3,
      main_attr: PuyoAttr.Red,
      sub_attr: PuyoAttr.Blue,
      main_sub_ratio: 1 / 3,
      counting_bonus: undefined
    });
  });

  it('converts a damage target without a main attr (wild) and defaults optimal_solution_count to 1', () => {
    const target: ExplorationTargetDamage = {
      category: ExplorationCategory.Damage,
      preference_priorities: [],
      optimal_solution_count: 0,
      main_attr: undefined
    };

    const result = toWasmExplorationTarget(target);
    expect(result.main_attr).toBeUndefined();
    expect(result.sub_attr).toBeUndefined();
    expect(result.main_sub_ratio).toBeUndefined();
    expect(result.optimal_solution_count).toBe(1);
  });

  it('converts a skill-puyo-count target with a counting bonus', () => {
    const target: ExplorationTargetSkillPuyoCount = {
      category: ExplorationCategory.SkillPuyoCount,
      preference_priorities: [PreferenceKind.BiggerValue],
      optimal_solution_count: 1,
      main_attr: PuyoAttr.Heart,
      counting_bonus: {
        bonus_type: CountingBonusType.Step,
        target_attrs: [PuyoAttr.Heart],
        step_height: 4,
        bonus_count: 2,
        repeat: true
      }
    };

    const result = toWasmExplorationTarget(target);
    expect(result.counting_bonus).toEqual({
      bonus_type: CountingBonusType.Step,
      target_attrs: [PuyoAttr.Heart],
      step_height: 4,
      bonus_count: 2,
      repeat: true
    });
  });

  it('converts a skill-puyo-count target without a counting bonus', () => {
    const target: ExplorationTargetSkillPuyoCount = {
      category: ExplorationCategory.SkillPuyoCount,
      preference_priorities: [],
      optimal_solution_count: 1,
      main_attr: PuyoAttr.Heart
    };

    expect(toWasmExplorationTarget(target).counting_bonus).toBeUndefined();
  });

  it('converts a puyotsukai-count target (no damage-specific fields)', () => {
    const target: ExplorationTargetPuyoTasukaiCount = {
      category: ExplorationCategory.PuyotsukaiCount,
      preference_priorities: [],
      optimal_solution_count: 1
    };

    const result = toWasmExplorationTarget(target);
    expect(result.main_attr).toBeUndefined();
    expect(result.sub_attr).toBeUndefined();
    expect(result.counting_bonus).toBeUndefined();
  });
});

describe('toWasmEnvironmentFieldNextPuyos', () => {
  it('converts environment, boost area, field and next puyos', () => {
    const boostCoord = PuyoCoord.xyToCoord(2, 3)!;
    const field: PuyoType[][] = [...new Array(6)].map(() =>
      [...new Array(8)].map(() => PuyoType.Red)
    );
    field[0][0] = undefined as unknown as PuyoType;
    const nextPuyos: PuyoType[] = [...new Array(8)].map(() => PuyoType.Blue);
    nextPuyos[0] = undefined as unknown as PuyoType;

    const simulationData = createSimulationData(
      { field, nextPuyos },
      { boostAreaCoordList: [boostCoord] }
    );

    const {
      environment,
      boost_area_coord_set,
      field: wasmField,
      next_puyos
    } = toWasmEnvironmentFieldNextPuyos(simulationData);

    expect(environment).toEqual({
      is_chance_mode: simulationData.isChanceMode,
      minimum_puyo_num_for_popping: simulationData.minimumPuyoNumForPopping,
      max_trace_num: simulationData.maxTraceNum,
      trace_mode: simulationData.traceMode,
      popping_leverage: simulationData.poppingLeverage,
      chain_leverage: simulationData.chainLeverage
    });

    expect([...boost_area_coord_set]).toEqual([{ x: 2, y: 3 }]);
    expect(wasmField[0][0]).toBeUndefined();
    expect(wasmField[1][0]).toEqual({
      id: simulationData.field[1][0]!.id,
      puyo_type: PuyoType.Red
    });
    expect(next_puyos[0]).toBeUndefined();
    expect(next_puyos[1]).toEqual({
      id: simulationData.nextPuyos[1]!.id,
      puyo_type: PuyoType.Blue
    });
  });
});

describe('toJsOptimalSolution', () => {
  const baseSolution: Omit<WasmSolutionResult, 'trace_coords' | 'chains'> = {
    value: 10,
    popped_chance_num: 0,
    popped_heart_num: 0,
    popped_prism_num: 0,
    popped_ojama_num: 0,
    popped_kata_num: 0,
    is_all_cleared: false
  };

  it('converts trace_coords and unwraps a real Map of attributes (WASM boundary)', () => {
    const wasmSolution: WasmSolutionResult = {
      ...baseSolution,
      trace_coords: [{ x: 1, y: 2 }],
      chains: [
        {
          chain_num: 1,
          simultaneous_num: 4,
          boost_count: 0,
          puyo_tsukai_count: 4,
          attributes: new Map([
            [
              PuyoAttr.Red,
              { strength: 1, popped_count: 4, separated_blocks_num: 1 }
            ]
          ]),
          popped_chance_num: 0,
          is_all_cleared: false
        }
      ]
    };

    const result = toJsOptimalSolution(wasmSolution);
    expect(result.trace_coords).toEqual([PuyoCoord.xyToCoord(1, 2)]);
    expect(result.chains[0].attributes).toEqual({
      [PuyoAttr.Red]: { strength: 1, popped_count: 4, separated_blocks_num: 1 }
    });
  });

  it('passes plain-object attributes through untouched (JSON boundary)', () => {
    const wasmSolution: WasmSolutionResult = {
      ...baseSolution,
      trace_coords: [{ x: 0, y: 0 }],
      chains: [
        {
          chain_num: 1,
          simultaneous_num: 4,
          boost_count: 0,
          puyo_tsukai_count: 4,
          // JSON.parse から届く場合はプレーンオブジェクトになる
          attributes: {
            [PuyoAttr.Red]: {
              strength: 1,
              popped_count: 4,
              separated_blocks_num: 1
            }
          } as any,
          popped_chance_num: 0,
          is_all_cleared: false
        }
      ]
    };

    const result = toJsOptimalSolution(wasmSolution);
    expect(result.trace_coords).toEqual([PuyoCoord.xyToCoord(0, 0)]);
    expect(result.chains[0].attributes).toEqual({
      [PuyoAttr.Red]: { strength: 1, popped_count: 4, separated_blocks_num: 1 }
    });
  });
});
