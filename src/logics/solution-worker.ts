import { expose } from 'comlink';
import { Field } from './Field';
import type { OptimizationTarget } from './OptimizationTarget';
import { PuyoCoord } from './PuyoCoord';

const fixFieldBoostAreas = (field: Field): void => {
  const boostAreaCoordSetList = (field as any).boostAreaCoordSetList.map(
    (boostArea: ReadonlySet<PuyoCoord>) => {
      return new Set(
        [...boostArea].map((c: any) => PuyoCoord.xyToCoord(c._x, c._y)!)
      );
    }
  );
  (field as any).boostAreaCoordSetList = boostAreaCoordSetList;
};

export async function solve2(
  field: Field,
  optimizationTarget: OptimizationTarget
) {
  fixFieldBoostAreas(field);
  return new Field(field).solve2(optimizationTarget);
}

export async function solve3(
  field: Field,
  optimizationTarget: OptimizationTarget,
  index: number
) {
  fixFieldBoostAreas(field);
  return new Field(field).solve3(optimizationTarget, index);
}

expose({
  solve2,
  solve3
});
