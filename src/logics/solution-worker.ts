import { expose } from 'comlink';
import type { ExplorationTarget } from './ExplorationTarget';
import { PuyoCoord } from './PuyoCoord';
import type { SimulationData } from './SimulationData';
import { Simulator } from './Simulator';
import {
  solveAllTraces as _solveAllTraces,
  solveIncludingTraceIndex as _solveIncludingTraceIndex
} from './solution-explorer';

const fixFieldBoostAreas = (simulationData: SimulationData): void => {
  const boostAreaCoordList = simulationData.boostAreaCoordList.map(
    (c: any) => PuyoCoord.xyToCoord(c._x, c._y) as PuyoCoord
  );
  simulationData.boostAreaCoordList = boostAreaCoordList;
};

/**
 * @deprecated Rust版に集約する
 *
 * @param simulationData
 * @param explorationTarget
 * @returns
 */
export async function solveAllTraces(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) {
  fixFieldBoostAreas(simulationData);
  return _solveAllTraces(new Simulator(simulationData), explorationTarget);
}

/**
 * @deprecated Rust版に集約する
 *
 * @param simulationData
 * @param explorationTarget
 * @param index
 * @returns
 */
export async function solveIncludingTraceIndex(
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  index: number
) {
  fixFieldBoostAreas(simulationData);
  return _solveIncludingTraceIndex(
    new Simulator(simulationData),
    explorationTarget,
    index
  );
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex
});
