import { expose } from 'comlink';
import type { OptimizationTarget } from './OptimizationTarget';
import { PuyoCoord } from './PuyoCoord';
import { Simulator } from './Simulator';
import {
  solveAllTraces as _solveAllTraces,
  solveIncludingTraceIndex as _solveIncludingTraceIndex
} from './solution-explorer';

const fixFieldBoostAreas = (simulator: Simulator): void => {
  const boostAreaCoordSetList = (simulator as any).boostAreaCoordSetList.map(
    (boostArea: ReadonlySet<PuyoCoord>) => {
      return new Set(
        [...boostArea].map((c: any) => PuyoCoord.xyToCoord(c._x, c._y)!)
      );
    }
  );
  (simulator as any).boostAreaCoordSetList = boostAreaCoordSetList;
};

export async function solveAllTraces(
  simulator: Simulator,
  optimizationTarget: OptimizationTarget
) {
  fixFieldBoostAreas(simulator);
  return _solveAllTraces(new Simulator(simulator), optimizationTarget);
}

export async function solveIncludingTraceIndex(
  simulator: Simulator,
  optimizationTarget: OptimizationTarget,
  index: number
) {
  fixFieldBoostAreas(simulator);
  return _solveIncludingTraceIndex(simulator, optimizationTarget, index);
}

expose({
  solveAllTraces,
  solveIncludingTraceIndex
});
