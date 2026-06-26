import { describe, expect, it } from 'vitest';
import { PuyoType } from './PuyoType';
import { cloneSimulationData } from './SimulationData';
import { createSimulationData } from '../store/internal/createSimulationData';

const makeData = () => {
  const field: PuyoType[][] = [...new Array(6)].map(() =>
    [...new Array(8)].map(() => PuyoType.Red)
  );
  const nextPuyos: PuyoType[] = [...new Array(8)].map(() => PuyoType.Blue);
  return createSimulationData({ field, nextPuyos });
};

describe('cloneSimulationData', () => {
  it('clones arrays while preserving values', () => {
    const data = makeData();
    const clone = cloneSimulationData(data);
    expect(clone).toEqual(data);
    expect(clone.nextPuyos).not.toBe(data.nextPuyos);
    expect(clone.field).not.toBe(data.field);
    expect(clone.field[0]).not.toBe(data.field[0]);
    expect(clone.traceCoords).not.toBe(data.traceCoords);
    expect(clone.boostAreaCoordList).toBe(data.boostAreaCoordList);
  });
});
