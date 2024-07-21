import { expose } from 'comlink';
import init, {
  detect_pop_blocks,
  do_chains
} from '../../packages/solver-wasm/pkg/solver';
import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { ExplorationResult } from './solution';
import type {
  WasmBlockWithAttr,
  WasmChain,
  WasmPuyo,
  WasmPuyoCoord,
  WasmSimulationEnvironment
} from './wasm-interface';

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
  field: (WasmPuyo | undefined)[][]
): Promise<WasmBlockWithAttr[]> {
  await initPromise;
  return detect_pop_blocks(environment, field);
}

export async function doChains(
  environment: WasmSimulationEnvironment,
  field: (WasmPuyo | undefined)[][],
  nextPuyos: (WasmPuyo | undefined)[],
  traceCoords: WasmPuyoCoord[]
): Promise<WasmChain[]> {
  await initPromise;
  return do_chains(environment, field, nextPuyos, traceCoords);
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex,
  detectPopBlocks,
  doChains
});
