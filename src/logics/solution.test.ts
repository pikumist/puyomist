import { describe, expect, it } from 'vitest';
import { PuyoCoord } from './PuyoCoord';
import { SolutionState } from './solution';

const coord = (x: number, y: number) => PuyoCoord.xyToCoord(x, y)!;

describe('SolutionState', () => {
  it('addTraceCoord records the coord so it can be retrieved', () => {
    const state = new SolutionState([0, 0], new Map());
    state.addTraceCoord(coord(0, 0));
    expect(state.getTraceCoords()).toEqual([coord(0, 0)]);
  });

  it('checkIfAddableCoord accepts the very first coord', () => {
    const state = new SolutionState([0, 0], new Map());
    expect(state.checkIfAddableCoord(coord(3, 3), 5)).toBe(true);
  });

  it('checkIfAddableCoord rejects once the max trace num would be exceeded', () => {
    const state = new SolutionState([0, 0], new Map());
    state.addTraceCoord(coord(0, 0));
    expect(state.checkIfAddableCoord(coord(1, 0), 1)).toBe(false);
  });

  it('checkIfAddableCoord rejects a coord that has already become forbidden', () => {
    const state = new SolutionState([0, 0], new Map());
    state.addTraceCoord(coord(0, 0));
    // Tracing a coord forbids that same coord from being traced again.
    expect(state.checkIfAddableCoord(coord(0, 0), 5)).toBe(false);
  });

  it('checkIfAddableCoord accepts a coord that is a current candidate', () => {
    const state = new SolutionState([0, 0], new Map());
    state.addTraceCoord(coord(0, 0));
    // (1, 0) is adjacent to (0, 0), so it becomes a next-step candidate.
    expect(state.checkIfAddableCoord(coord(1, 0), 5)).toBe(true);
  });

  it('checkIfAddableCoord rejects a coord that is neither forbidden nor a candidate', () => {
    const state = new SolutionState([0, 0], new Map());
    state.addTraceCoord(coord(0, 0));
    // (7, 5) is far from (0, 0): not forbidden and not adjacent.
    expect(state.checkIfAddableCoord(coord(7, 5), 5)).toBe(false);
  });

  it('clone produces an independent copy of the state', () => {
    const state = new SolutionState([0, 0], new Map());
    state.addTraceCoord(coord(0, 0));
    const cloned = SolutionState.clone(state);
    cloned.addTraceCoord(coord(1, 0));

    expect(state.getTraceCoords()).toEqual([coord(0, 0)]);
    expect(cloned.getTraceCoords()).toEqual([coord(0, 0), coord(1, 0)]);
  });
});
