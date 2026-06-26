import { beforeEach, describe, expect, it } from 'vitest';
import type { Board } from '../logics/Board';
import { PuyoCoord } from '../logics/PuyoCoord';
import { PuyoType } from '../logics/PuyoType';
import { customBoardId } from '../logics/boards';
import { Session } from '../logics/session';
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
});
