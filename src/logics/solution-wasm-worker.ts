import { expose } from 'comlink';
import init, {
  solve_all_traces,
  solve_traces_including_index
} from '../../packages/solver-wasm/pkg/solver';
import type {
  ExplorationTarget,
  ExplorationTargetDamage,
  ExplorationTargetSkillPuyoCount,
  StepCountingBonus
} from './ExplorationTarget';
import type { ColoredPuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import type { SimulationData } from './SimulationData';
import type { ExplorationResult, SolutionResult } from './solution';
import type {
  WasmExplorationResult,
  WasmExplorationTarget,
  WasmPuyo,
  WasmSimulationEnvironment,
  WasmSolutionResult,
  WasmStepCountingBonus
} from './wasm-interface';

const initPromise = init();

const toWasmExplorationTarget = (
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

const toWasmEnvironmentFieldNextPuyos = (simulationData: SimulationData) => {
  const environment: WasmSimulationEnvironment = {
    boost_area_coord_set: new Set(
      simulationData.boostAreaCoordList.map(({ _x, _y }: any) => ({
        x: _x,
        y: _y
      }))
    ),
    is_chance_mode: simulationData.isChanceMode,
    minimum_puyo_num_for_popping: simulationData.minimumPuyoNumForPopping,
    max_trace_num: simulationData.maxTraceNum,
    trace_mode: simulationData.traceMode,
    popping_leverage: simulationData.poppingLeverage,
    chain_leverage: simulationData.chainLeverage
  };
  const field: (WasmPuyo | undefined)[][] = simulationData.field.map((row) =>
    row.map((p) => (p ? { id: p.id, puyo_type: p.type } : undefined))
  );
  const next_puyos: (WasmPuyo | undefined)[] = simulationData.nextPuyos.map(
    (p) => (p ? { id: p.id, puyo_type: p.type } : undefined)
  );

  return {
    environment,
    field,
    next_puyos
  };
};

const toJsOptimalSolution = (s: WasmSolutionResult): SolutionResult => {
  return {
    ...s,
    trace_coords: s.trace_coords.map((p) => PuyoCoord.xyToCoord(p.x, p.y)),
    chains: s.chains.map((c) => {
      return {
        ...c,
        attributes: Object.fromEntries([...c.attributes])
      };
    })
  } as unknown as SolutionResult;
};

export async function solveAllTraces(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
): Promise<ExplorationResult> {
  await initPromise;
  const start = Date.now();

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  const solved = solve_all_traces(
    exploration_target,
    environment,
    field,
    next_puyos
  ) as WasmExplorationResult;

  const elapsedTime = Date.now() - start;
  const optimalSolutions = solved.optimal_solutions.map(toJsOptimalSolution);

  const result = {
    explorationTarget,
    elapsedTime,
    candidatesNum: solved.candidates_num,
    optimalSolution: optimalSolutions[0]
  };

  return result;
}

export async function solveIncludingTraceIndex(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  index: number
) {
  await initPromise;

  const start = Date.now();

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  const solved = solve_traces_including_index(
    exploration_target,
    environment,
    field,
    next_puyos,
    index
  ) as WasmExplorationResult;

  const elapsedTime = Date.now() - start;
  const optimalSolutions = solved.optimal_solutions.map(toJsOptimalSolution);

  const result = {
    explorationTarget,
    elapsedTime,
    candidatesNum: solved.candidates_num,
    optimalSolution: optimalSolutions[0]
  };

  return result;
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex
});
