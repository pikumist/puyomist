import { beforeEach, describe, expect, it } from 'vitest';

import type { Board } from '../logics/Board';
import { PuyoAttr } from '../logics/PuyoAttr';
import { PuyoCoord } from '../logics/PuyoCoord';
import { PuyoType, getPuyoAttr } from '../logics/PuyoType';
import { customBoardId, getSpecialBoard } from '../logics/boards';
import {
  PaintPrecision,
  type PaintSearchResult,
  enumeratePaintableCoords,
  paintSearchSignatureOf
} from '../logics/paint-search';
import { SolutionMethod } from '../logics/solution';
import { createSimulationData } from './internal/createSimulationData';
import {
  paintPlanApplied,
  paintPlanHovered,
  paintSearchCleared,
  paintSearchFailed,
  paintSearchSettingsChanged,
  paintSearchStarted,
  paintSearched,
  paintUndone,
  solutionMethodItemSelected,
  usePuyoAppStore
} from './puyoAppStore';
import { selectPaintSearchResult, selectPaintUndoAvailable } from './selectors';
import { INITIAL_PUYO_APP_STATE } from './types';

/** 今のストアの状態に対して有効な指紋 */
const currentSignature = (): string => {
  const state = usePuyoAppStore.getState();
  return paintSearchSignatureOf(
    state.simulationData,
    state.explorationTarget,
    state.paintSearchSettings
  );
};

const emptyResult = (signature = currentSignature()): PaintSearchResult => ({
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
  elapsedTime: 1000,
  signature
});

/** 全マスが青の盤面 */
const blueBoard = (): Board => ({
  field: [...new Array(PuyoCoord.YNum)].map(() =>
    [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Blue)
  ),
  nextPuyos: [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Blue)
});

/** 盤面と、そこから作った simulationData を揃えてストアに置く */
const setBoard = (board: Board) => {
  usePuyoAppStore.setState({
    boardId: customBoardId,
    lastScreenshotBoard: board,
    simulationData: createSimulationData(board, {})
  });
};

describe('paint search selectors', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
    setBoard(blueBoard());
  });

  it('offers the result while its input is unchanged', () => {
    const result = emptyResult();
    usePuyoAppStore.setState({ paintSearchResult: result });

    expect(selectPaintSearchResult(usePuyoAppStore.getState())).toBe(result);
  });

  it('hides the result once the board has changed', () => {
    usePuyoAppStore.setState({ paintSearchResult: emptyResult() });

    const edited = blueBoard();
    edited.field[2][2] = PuyoType.Green;
    setBoard(edited);

    expect(selectPaintSearchResult(usePuyoAppStore.getState())).toBeUndefined();
  });

  it('drops the solve result because the paint changed the board', () => {
    usePuyoAppStore.setState({
      solveResult: {
        explorationTarget: usePuyoAppStore.getState().explorationTarget,
        candidates_num: 1,
        elapsedTime: 1,
        optimal_solutions: []
      },
      optimalSolutionIndex: 0
    });

    paintSearchSettingsChanged({ color: PuyoAttr.Red });
    paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);

    expect(usePuyoAppStore.getState().solveResult).toBeUndefined();
    expect(usePuyoAppStore.getState().optimalSolutionIndex).toBe(-1);
  });

  it('offers the undo only while the board is as the paint left it', () => {
    paintSearchSettingsChanged({ color: PuyoAttr.Red });
    paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);
    expect(selectPaintUndoAvailable(usePuyoAppStore.getState())).toBe(true);

    const edited = blueBoard();
    edited.field[5][7] = PuyoType.Green;
    setBoard(edited);

    expect(selectPaintUndoAvailable(usePuyoAppStore.getState())).toBe(false);
  });

  it('has nothing to undo before any paint', () => {
    expect(selectPaintUndoAvailable(usePuyoAppStore.getState())).toBe(false);
  });
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

  it('pulls the precision back into range when leaving the rust backend', () => {
    solutionMethodItemSelected(SolutionMethod.solveAllByRustBackend);
    paintSearchSettingsChanged({ precision: PaintPrecision.Ultra });

    solutionMethodItemSelected(SolutionMethod.solveAllInParallelByWasm);

    // WASM に超高精度は無いので、選べる中で一番高いものへ落とす
    expect(usePuyoAppStore.getState().paintSearchSettings.precision).toBe(
      PaintPrecision.High
    );
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

  it('ignores a result whose input no longer matches', () => {
    paintSearchStarted();
    // 探索中に塗り色を変えた ＝ 走っている探索は別の入力に対する答え
    const inFlight = emptyResult();
    paintSearchSettingsChanged({ color: PuyoAttr.Green });

    paintSearched(inFlight);

    expect(usePuyoAppStore.getState().paintSearching).toBe(false);
    expect(usePuyoAppStore.getState().paintSearchResult).toBeUndefined();
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
      setBoard(blueBoard());
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
      setBoard(board);

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
      expect(state.paintUndo).toBeUndefined();
      expect(state.lastScreenshotBoard!.field[0][0]).toBe(PuyoType.Blue);
    });

    it('skips cells that can no longer take the paint colour', () => {
      const board = blueBoard();
      board.field[0][0] = PuyoType.Prism;
      setBoard(board);

      paintPlanApplied([
        PuyoCoord.xyToCoord(0, 0)!,
        PuyoCoord.xyToCoord(1, 0)!
      ]);

      const state = usePuyoAppStore.getState();
      // プリズムは塗れないので手つかず。塗れるマスだけが塗り替わる
      expect(state.lastScreenshotBoard!.field[0][0]).toBe(PuyoType.Prism);
      expect(state.lastScreenshotBoard!.field[0][1]).toBe(PuyoType.Red);
    });

    it('does nothing when no cell of the plan can be painted', () => {
      const board = blueBoard();
      board.field[0][0] = PuyoType.Prism;
      setBoard(board);

      paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);

      expect(usePuyoAppStore.getState().paintUndo).toBeUndefined();
    });

    it('switches a built-in board over to the custom board before painting', () => {
      const builtIn = getSpecialBoard('chainSeed1/1');
      usePuyoAppStore.setState({
        boardId: 'chainSeed1/1',
        lastScreenshotBoard: undefined,
        simulationData: createSimulationData(builtIn, {})
      });

      // 組み込み盤面で実際に赤へ塗り替えられるマスを選ぶ
      const coord = enumeratePaintableCoords(
        usePuyoAppStore.getState().simulationData,
        PuyoAttr.Red
      )[0];
      paintPlanApplied([coord]);

      const state = usePuyoAppStore.getState();
      expect(state.boardId).toBe(customBoardId);
      expect(
        getPuyoAttr(state.simulationData.field[coord.y][coord.x]!.type)
      ).toBe(PuyoAttr.Red);
    });
  });

  describe('paintUndone', () => {
    beforeEach(() => {
      setBoard(blueBoard());
      paintSearchSettingsChanged({ color: PuyoAttr.Red });
    });

    it('restores the board as it was before the paint', () => {
      paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);
      expect(usePuyoAppStore.getState().paintUndo).toBeDefined();

      paintUndone();

      const state = usePuyoAppStore.getState();
      expect(state.lastScreenshotBoard!.field[0][0]).toBe(PuyoType.Blue);
      expect(state.simulationData.field[0][0]!.type).toBe(PuyoType.Blue);
      // 取り消せるのは1手分だけなので、控えは使い切って消える
      expect(state.paintUndo).toBeUndefined();
    });

    it('does not roll back changes made after the paint', () => {
      paintPlanApplied([PuyoCoord.xyToCoord(0, 0)!]);
      // 塗ったあとに別経路で盤面を変える (ここでは盤面まるごと差し替え)
      const edited = blueBoard();
      edited.field[5][7] = PuyoType.Green;
      setBoard(edited);

      paintUndone();

      const state = usePuyoAppStore.getState();
      // あとから入れた変更はそのまま。控えは使えないので捨てられる
      expect(state.simulationData.field[5][7]!.type).toBe(PuyoType.Green);
      expect(state.paintUndo).toBeUndefined();
    });

    it('does nothing when there is nothing to undo', () => {
      paintUndone();

      expect(usePuyoAppStore.getState().lastScreenshotBoard!.field[0][0]).toBe(
        PuyoType.Blue
      );
    });
  });
});
