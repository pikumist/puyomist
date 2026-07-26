import { beforeEach, describe, expect, it } from 'vitest';

import type { Board } from '../logics/Board';
import { PuyoAttr } from '../logics/PuyoAttr';
import { PuyoCoord } from '../logics/PuyoCoord';
import { PuyoType } from '../logics/PuyoType';
import { customBoardId } from '../logics/boards';
import { PaintPrecision, type PaintSearchResult } from '../logics/paint-search';
import {
  paintPlanApplied,
  paintPlanHovered,
  paintSearchCleared,
  paintSearchFailed,
  paintSearchSettingsChanged,
  paintSearchStarted,
  paintSearched,
  paintUndone,
  usePuyoAppStore
} from './puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from './types';

const emptyResult = (): PaintSearchResult => ({
  plans: [
    {
      coords: [PuyoCoord.xyToCoord(0, 0)!],
      value: 240,
      solution: {
        trace_coords: [],
        chains: [],
        value: 240,
        popped_chance_num: 0,
        popped_heart_num: 0,
        popped_prism_num: 0,
        popped_ojama_num: 0,
        popped_kata_num: 0,
        is_all_cleared: false
      }
    }
  ],
  elapsedTime: 1000
});

/** 全マスが青の盤面 */
const blueBoard = (): Board => ({
  field: [...new Array(PuyoCoord.YNum)].map(() =>
    [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Blue)
  ),
  nextPuyos: [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Blue)
});

describe('paint search store actions', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('merges the changed settings and drops the stale result', () => {
    usePuyoAppStore.setState({
      paintSearchResult: emptyResult(),
      paintHighlightCoords: [PuyoCoord.xyToCoord(0, 0)!]
    });

    paintSearchSettingsChanged({
      color: PuyoAttr.Green,
      precision: PaintPrecision.High
    });

    const state = usePuyoAppStore.getState();
    expect(state.paintSearchSettings.color).toBe(PuyoAttr.Green);
    expect(state.paintSearchSettings.precision).toBe(PaintPrecision.High);
    // 触っていない設定は残る
    expect(state.paintSearchSettings.maxPaintNum).toBe(
      INITIAL_PUYO_APP_STATE.paintSearchSettings.maxPaintNum
    );
    expect(state.paintSearchResult).toBeUndefined();
    expect(state.paintHighlightCoords).toBeUndefined();
  });

  it('clears the previous result when a search starts', () => {
    usePuyoAppStore.setState({ paintSearchResult: emptyResult() });

    paintSearchStarted();

    expect(usePuyoAppStore.getState().paintSearching).toBe(true);
    expect(usePuyoAppStore.getState().paintSearchResult).toBeUndefined();
  });

  it('stores the result when the search finishes', () => {
    paintSearchStarted();
    const result = emptyResult();

    paintSearched(result);

    expect(usePuyoAppStore.getState().paintSearching).toBe(false);
    expect(usePuyoAppStore.getState().paintSearchResult).toEqual(result);
  });

  it('leaves no result behind when the search fails', () => {
    paintSearchStarted();

    paintSearchFailed();

    expect(usePuyoAppStore.getState().paintSearching).toBe(false);
    expect(usePuyoAppStore.getState().paintSearchResult).toBeUndefined();
  });

  it('drops the result and the highlight when cleared', () => {
    usePuyoAppStore.setState({
      paintSearchResult: emptyResult(),
      paintHighlightCoords: [PuyoCoord.xyToCoord(1, 1)!]
    });

    paintSearchCleared();

    expect(usePuyoAppStore.getState().paintSearchResult).toBeUndefined();
    expect(usePuyoAppStore.getState().paintHighlightCoords).toBeUndefined();
  });

  it('sets and unsets the highlighted coords', () => {
    const coords = [PuyoCoord.xyToCoord(2, 3)!];

    paintPlanHovered(coords);
    expect(usePuyoAppStore.getState().paintHighlightCoords).toEqual(coords);

    paintPlanHovered(undefined);
    expect(usePuyoAppStore.getState().paintHighlightCoords).toBeUndefined();
  });

  describe('paintPlanApplied', () => {
    beforeEach(() => {
      usePuyoAppStore.setState({
        boardId: customBoardId,
        lastScreenshotBoard: blueBoard()
      });
      paintSearchSettingsChanged({ color: PuyoAttr.Red });
    });

    it('repaints the given cells and rebuilds the simulation data', () => {
      const coords = [PuyoCoord.xyToCoord(0, 0)!, PuyoCoord.xyToCoord(3, 4)!];

      paintPlanApplied(coords);

      const state = usePuyoAppStore.getState();
      expect(state.lastScreenshotBoard!.field[0][0]).toBe(PuyoType.Red);
      expect(state.lastScreenshotBoard!.field[4][3]).toBe(PuyoType.Red);
      expect(state.lastScreenshotBoard!.field[0][1]).toBe(PuyoType.Blue);
      expect(state.simulationData.field[0][0]!.type).toBe(PuyoType.Red);
      expect(state.simulationData.field[4][3]!.type).toBe(PuyoType.Red);
    });

    it('keeps the plus marker through the repaint', () => {
      const board = blueBoard();
      board.field[0][0] = PuyoType.BluePlus;
      usePuyoAppStore.setState({ lastScreenshotBoard: board });

      paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);

      expect(usePuyoAppStore.getState().lastScreenshotBoard!.field[0][0]).toBe(
        PuyoType.RedPlus
      );
    });

    it('drops the result and the highlight after applying', () => {
      usePuyoAppStore.setState({
        paintSearchResult: emptyResult(),
        paintHighlightCoords: [PuyoCoord.xyToCoord(0, 0)!]
      });

      paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);

      const state = usePuyoAppStore.getState();
      expect(state.paintSearchResult).toBeUndefined();
      expect(state.paintHighlightCoords).toBeUndefined();
    });

    it('does nothing for the "no paint" plan', () => {
      paintPlanApplied([]);

      const state = usePuyoAppStore.getState();
      expect(state.boardBeforePaint).toBeUndefined();
      expect(state.lastScreenshotBoard!.field[0][0]).toBe(PuyoType.Blue);
    });

    it('switches a built-in board over to the custom board before painting', () => {
      usePuyoAppStore.setState({
        boardId: 'chainSeed1/1',
        lastScreenshotBoard: undefined
      });

      paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);

      const state = usePuyoAppStore.getState();
      expect(state.boardId).toBe(customBoardId);
      expect(state.lastScreenshotBoard!.field[0][0]).toBe(PuyoType.Red);
    });
  });

  describe('paintUndone', () => {
    beforeEach(() => {
      usePuyoAppStore.setState({
        boardId: customBoardId,
        lastScreenshotBoard: blueBoard()
      });
      paintSearchSettingsChanged({ color: PuyoAttr.Red });
    });

    it('restores the board as it was before the paint', () => {
      paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);
      expect(usePuyoAppStore.getState().boardBeforePaint).toBeDefined();

      paintUndone();

      const state = usePuyoAppStore.getState();
      expect(state.lastScreenshotBoard!.field[0][0]).toBe(PuyoType.Blue);
      expect(state.simulationData.field[0][0]!.type).toBe(PuyoType.Blue);
      // 取り消せるのは1手分だけなので、控えは使い切って消える
      expect(state.boardBeforePaint).toBeUndefined();
    });

    it('does nothing when there is nothing to undo', () => {
      paintUndone();

      expect(usePuyoAppStore.getState().lastScreenshotBoard!.field[0][0]).toBe(
        PuyoType.Blue
      );
    });
  });
});
