import { expose } from 'comlink';
import init from '../../packages/solver-wasm/pkg/solver_wasm';
import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { ExplorationResult } from './solution';

const initPromise = init();

export async function solveAllTraces(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
): Promise<ExplorationResult> {
  await initPromise;
  return {
    explorationTarget,
    elapsedTime: 0,
    candidatesNum: 0,
    optimalSolution: undefined
  };
}

export async function solveIncludingTraceIndex(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  index: number
) {
  await initPromise;
  return {
    explorationTarget,
    elapsedTime: 0,
    candidatesNum: 0,
    optimalSolution: undefined
  };
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex
});
