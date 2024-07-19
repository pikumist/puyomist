import { expose } from 'comlink';
import init, {
  detect_pop_blocks
} from '../../packages/solver-wasm/pkg/solver_wasm';
import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { ExplorationResult } from './solution';
import type { WasmBlocks, WasmField, WasmSimulationEnvironment } from './wasm';

const initPromise = init();

export async function solveAllTraces(
  _simulationData: SimulationData,
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
  _simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  _index: number
) {
  await initPromise;
  return {
    explorationTarget,
    elapsedTime: 0,
    candidatesNum: 0,
    optimalSolution: undefined
  };
}

export async function detectPopBlocks(
  environment: WasmSimulationEnvironment,
  field: WasmField
): Promise<WasmBlocks> {
  await initPromise;
  return detect_pop_blocks(environment, field);
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex,
  detectPopBlocks
});
