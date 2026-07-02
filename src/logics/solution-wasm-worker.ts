import { expose } from 'comlink';
import init, {
  solve_all_traces,
  solve_traces_including_index,
  solve_traces_with_prefix
} from '../../packages/solver-wasm/pkg/solver';
import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { ExplorationResult } from './solution';
import type { WasmExplorationResult } from './wasm-interface';
import {
  toJsOptimalSolution,
  toWasmEnvironmentFieldNextPuyos,
  toWasmExplorationTarget
} from './wasm-serialize';

const initPromise = init();

export async function solveAllTraces(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
): Promise<ExplorationResult> {
  await initPromise;
  const start = Date.now();

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, boost_area_coord_set, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  const solved = solve_all_traces(
    exploration_target,
    environment,
    boost_area_coord_set,
    field,
    next_puyos
  ) as WasmExplorationResult;

  const elapsedTime = Date.now() - start;
  const optimal_solutions = solved.optimal_solutions.map(toJsOptimalSolution);

  const result = {
    explorationTarget,
    elapsedTime,
    candidates_num: solved.candidates_num,
    optimal_solutions
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
  const { environment, boost_area_coord_set, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  const solved = solve_traces_including_index(
    exploration_target,
    environment,
    boost_area_coord_set,
    field,
    next_puyos,
    index
  ) as WasmExplorationResult;

  const elapsedTime = Date.now() - start;
  const optimal_solutions = solved.optimal_solutions.map(toJsOptimalSolution);

  const result = {
    explorationTarget,
    elapsedTime,
    candidates_num: solved.candidates_num,
    optimal_solutions
  };

  return result;
}

export async function solveWithPrefix(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  prefix: number[],
  recurse: boolean
) {
  await initPromise;

  const start = Date.now();

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, boost_area_coord_set, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);

  const solved = solve_traces_with_prefix(
    exploration_target,
    environment,
    boost_area_coord_set,
    field,
    next_puyos,
    prefix,
    recurse
  ) as WasmExplorationResult;

  const elapsedTime = Date.now() - start;
  const optimal_solutions = solved.optimal_solutions.map(toJsOptimalSolution);

  const result = {
    explorationTarget,
    elapsedTime,
    candidates_num: solved.candidates_num,
    optimal_solutions
  };

  return result;
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex,
  solveWithPrefix
});
