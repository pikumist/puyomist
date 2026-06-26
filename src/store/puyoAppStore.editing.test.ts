import { beforeEach, describe, expect, it } from 'vitest';
import { HowToEditBoard } from '../logics/BoardEditMode';
import { boostAreaKeyMap } from '../logics/BoostArea';
import { customBoardId } from '../logics/boards';
import { PuyoAttr } from '../logics/PuyoAttr';
import { PuyoCoord } from '../logics/PuyoCoord';
import { getPuyoAttr, PuyoType } from '../logics/PuyoType';
import type { PuyomistJson } from '../logics/app-json';
import {
  boardDetected,
  boardIdChanged,
  puyoEdited,
  puyomistJsonDetected,
  usePuyoAppStore
} from './puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from './types';

const getState = () => usePuyoAppStore.getState();

beforeEach(() => {
  usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
});

describe('puyoAppStore - 盤面編集系', () => {
  it('boardIdChanged loads a special board and resets results', () => {
    usePuyoAppStore.setState({
      solveResult: { foo: 1 } as never,
      optimalSolutionIndex: 3,
      animationSteps: [{} as never]
    });
    boardIdChanged('chainSeed1/1');
    expect(getState().boardId).toBe('chainSeed1/1');
    expect(getState().simulationData.field).toHaveLength(PuyoCoord.YNum);
    expect(getState().solveResult).toBeUndefined();
    expect(getState().optimalSolutionIndex).toBe(-1);
    expect(getState().animationSteps).toEqual([]);
  });

  it('boardIdChanged with customBoardId uses last screenshot board', () => {
    boardIdChanged(customBoardId);
    expect(getState().boardId).toBe(customBoardId);
    expect(getState().simulationData.field).toHaveLength(PuyoCoord.YNum);
  });

  it('puyoEdited recolors a field puyo and switches to custom board', () => {
    boardIdChanged('chainSeed1/1');
    usePuyoAppStore.setState({
      boardEditMode: { howToEdit: HowToEditBoard.ToRed }
    });
    const coord = PuyoCoord.xyToCoord(0, 0)!;
    puyoEdited({ fieldCoord: coord });
    expect(getState().boardId).toBe(customBoardId);
    const cell = getState().lastScreenshotBoard?.field[0][0];
    expect(getPuyoAttr(cell as PuyoType)).toBe(PuyoAttr.Red);
  });

  it('puyoEdited edits a next puyo via nextX', () => {
    boardIdChanged('chainSeed1/1');
    usePuyoAppStore.setState({
      boardEditMode: { howToEdit: HowToEditBoard.ToBlue }
    });
    puyoEdited({ nextX: 0 });
    const next = getState().lastScreenshotBoard?.nextPuyos?.[0];
    expect(getPuyoAttr(next as PuyoType)).toBe(PuyoAttr.Blue);
  });

  it('puyoEdited ignores no-op payloads', () => {
    boardIdChanged('chainSeed1/1');
    const before = getState().boardId;
    puyoEdited({});
    expect(getState().boardId).toBe(before);
  });

  it('puyoEdited sets custom type', () => {
    boardIdChanged('chainSeed1/1');
    usePuyoAppStore.setState({
      boardEditMode: {
        howToEdit: HowToEditBoard.ToCustomType,
        customType: PuyoType.Heart
      }
    });
    puyoEdited({ fieldCoord: PuyoCoord.xyToCoord(1, 1)! });
    expect(getState().lastScreenshotBoard?.field[1][1]).toBe(PuyoType.Heart);
  });
});

describe('puyoAppStore - スクリーンショット/検出系', () => {
  it('boardDetected stores error and empties board', () => {
    boardDetected({ error: 'failed', board: undefined });
    expect(getState().screenshotErrorMessage).toBe('failed');
    expect(getState().boardId).toBe(customBoardId);
    expect(getState().isBoardEditing).toBe(false);
  });

  it('boardDetected stores a detected board', () => {
    const field: PuyoType[][] = [...new Array(PuyoCoord.YNum)].map(() =>
      [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Green)
    );
    const nextPuyos: PuyoType[] = [...new Array(PuyoCoord.XNum)].map(
      () => PuyoType.Green
    );
    boardDetected({ error: undefined, board: { field, nextPuyos } });
    expect(getState().screenshotErrorMessage).toBeUndefined();
    expect(getState().boardId).toBe(customBoardId);
  });

  it('puyomistJsonDetected applies board, boost area and target', () => {
    const field: (PuyoType | undefined)[][] = [
      ...new Array(PuyoCoord.YNum)
    ].map(() => [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Red));
    const nextPuyos: (PuyoType | undefined)[] = [
      ...new Array(PuyoCoord.XNum)
    ].map(() => PuyoType.Red);
    const boostKey = [...boostAreaKeyMap.keys()][0];
    const puyomist: PuyomistJson = {
      type: 'puyomist',
      board: {
        field,
        nextPuyos,
        isChanceMode: false,
        traceMode: 0,
        minimumPuyoNumForPopping: 3,
        poppingLeverage: 1,
        chainLeverage: 1,
        maxTraceNum: 5
      },
      boostAreaKeyList: [boostKey],
      explorationTarget: INITIAL_PUYO_APP_STATE.explorationTarget
    };
    puyomistJsonDetected(puyomist);
    expect(getState().boardId).toBe(customBoardId);
    expect(getState().boostAreaKeyList).toEqual([boostKey]);
    expect(getState().simulationData.boostAreaCoordList.length).toBeGreaterThan(
      0
    );
  });
});
