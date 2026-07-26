import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board } from '../logics/Board';
import { boostAreaKeyMap } from '../logics/BoostArea';
import { PuyoAttr } from '../logics/PuyoAttr';
import { PuyoCoord } from '../logics/PuyoCoord';
import { PuyoType } from '../logics/PuyoType';
import { customBoardId } from '../logics/boards';
import { PaintPrecision } from '../logics/paint-search';
import { Session } from '../logics/session';
import { SolutionMethod } from '../logics/solution';
import { loadPuyoAppState } from './loadPuyoAppState';

const makeSession = () => {
  localStorage.clear();
  return new Session(localStorage);
};

describe('loadPuyoAppState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads a default special board', () => {
    const state = loadPuyoAppState(makeSession());
    expect(state.boardId).toBe('chainSeed1/1');
    expect(state.simulationData.field).toHaveLength(PuyoCoord.YNum);
    expect(state.solving).toBe(false);
    expect(state.animationSteps).toEqual([]);
  });

  it('falls back to an empty board when the boardId is invalid', () => {
    const s = makeSession();
    s.setBoardId('does-not-exist/9');
    const state = loadPuyoAppState(s);
    expect(state.boardId).toBe('does-not-exist/9');
    expect(state.simulationData.field).toHaveLength(PuyoCoord.YNum);
  });

  it('uses the last screenshot board for the custom board id', () => {
    const s = makeSession();
    s.setBoardId(customBoardId);
    const field: PuyoType[][] = [...new Array(PuyoCoord.YNum)].map(() =>
      [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Blue)
    );
    const nextPuyos: PuyoType[] = [...new Array(PuyoCoord.XNum)].map(
      () => PuyoType.Blue
    );
    s.setLastScreenshotBoard({ field, nextPuyos } as unknown as Board);
    const state = loadPuyoAppState(s);
    expect(state.boardId).toBe(customBoardId);
    expect(state.simulationData.field[0][0]?.type).toBe(PuyoType.Blue);
  });

  it('uses an empty board for custom id without a screenshot board', () => {
    const s = makeSession();
    s.setBoardId(customBoardId);
    const state = loadPuyoAppState(s);
    expect(state.boardId).toBe(customBoardId);
    expect(state.simulationData.field).toHaveLength(PuyoCoord.YNum);
  });

  it('reflects persisted boost area keys', () => {
    const s = makeSession();
    s.setBoostAreaKeyList([]);
    const state = loadPuyoAppState(s);
    expect(state.boostAreaKeyList).toEqual([]);
  });

  it('resolves the boost area coord list from persisted boost area keys', () => {
    const s = makeSession();
    const key = [...boostAreaKeyMap.keys()][0];
    s.setBoostAreaKeyList([key]);
    const state = loadPuyoAppState(s);
    expect(state.boostAreaKeyList).toEqual([key]);
    expect(state.simulationData.boostAreaCoordList.length).toBeGreaterThan(0);
    expect(state.simulationData.boostAreaCoordList[0]).toBeInstanceOf(
      PuyoCoord
    );
  });

  it('picks up the persisted paint search settings', () => {
    const s = makeSession();
    s.setPaintSearchSettings({
      color: PuyoAttr.Purple,
      maxPaintNum: 10,
      precision: PaintPrecision.High,
      showExpectedValue: true
    });

    const state = loadPuyoAppState(s);

    expect(state.paintSearchSettings).toEqual({
      color: PuyoAttr.Purple,
      maxPaintNum: 10,
      precision: PaintPrecision.High,
      showExpectedValue: true
    });
  });

  it('uses the default session when no session is given', () => {
    localStorage.clear();
    const state = loadPuyoAppState();
    expect(state.boardId).toBe('chainSeed1/1');
    expect(state.nextSelection).toBe('random');
    expect(state.simulationData.field).toHaveLength(PuyoCoord.YNum);
  });

  it('keeps a persisted Rust backend solution method on localhost', () => {
    const s = makeSession();
    s.setSolutionMethod(SolutionMethod.solveAllByRustBackend);
    const state = loadPuyoAppState(s);
    expect(state.solutionMethod).toBe(SolutionMethod.solveAllByRustBackend);
  });

  describe('off localhost', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('falls back a persisted Rust backend solution method to parallel wasm', () => {
      const s = makeSession();
      s.setSolutionMethod(SolutionMethod.solveAllByRustBackend);
      vi.stubGlobal('location', {
        ...window.location,
        hostname: 'example.com'
      });
      const state = loadPuyoAppState(s);
      expect(state.solutionMethod).toBe(
        SolutionMethod.solveAllInParallelByWasm
      );
    });
  });
});
