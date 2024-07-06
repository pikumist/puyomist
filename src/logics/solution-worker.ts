import { expose } from 'comlink';
import type { OptimizationTarget } from './OptimizationTarget';
import { PuyoCoord } from './PuyoCoord';
import { Simulator } from './Simulator';

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

export async function solve2(
  simulator: Simulator,
  optimizationTarget: OptimizationTarget
) {
  fixFieldBoostAreas(simulator);
  return new Simulator(simulator).solve2(optimizationTarget);
}

export async function solve3(
  simulator: Simulator,
  optimizationTarget: OptimizationTarget,
  index: number
) {
  fixFieldBoostAreas(simulator);
  return new Simulator(simulator).solve3(optimizationTarget, index);
}

expose({
  solve2,
  solve3
});
