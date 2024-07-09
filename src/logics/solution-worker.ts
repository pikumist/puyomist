import { expose } from 'comlink';
import type { OptimizationTarget } from './OptimizationTarget';
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

export async function solveAllTraces(
  simulationData: SimulationData,
  optimizationTarget: OptimizationTarget
) {
  fixFieldBoostAreas(simulationData);
  return _solveAllTraces(new Simulator(simulationData), optimizationTarget);
}

export async function solveIncludingTraceIndex(
  simulationData: SimulationData,
  optimizationTarget: OptimizationTarget,
  index: number
) {
  fixFieldBoostAreas(simulationData);
  return _solveIncludingTraceIndex(
    new Simulator(simulationData),
    optimizationTarget,
    index
  );
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex
});
