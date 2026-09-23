import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Board } from '../../logics/Board';
import { PuyoAttr } from '../../logics/PuyoAttr';
import { PuyoCoord } from '../../logics/PuyoCoord';
import { PuyoType } from '../../logics/PuyoType';
import { customBoardId } from '../../logics/boards';
import type { PaintSearchResult } from '../../logics/paint-search';
import { PaintGoal, paintSearchSignatureOf } from '../../logics/paint-search';
import { SolutionMethod } from '../../logics/solution';
import { createSimulationData } from '../internal/createSimulationData';
import { usePuyoAppStore } from '../puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '../types';
import { paintPlanApplyClicked, paintSearchButtonClicked } from './paintSearch';

const searchMock = vi.hoisted(() => vi.fn());
const backendSearchMock = vi.hoisted(() => vi.fn());
const ignitionSearchMock = vi.hoisted(() => vi.fn());

vi.mock('../../logics/paint-search-worker-driver', () => ({
  searchPaintPlansByWasm: searchMock
}));
vi.mock('../../logics/paint-search-rust-backend', () => ({
  searchPaintPlansByRustBackend: backendSearchMock
}));
vi.mock('../../logics/ignition-search-worker-driver', () => ({
  searchIgnitionPlansByWasm: ignitionSearchMock
}));

/** 今の状態に対して有効な、空の結果 */
const emptyResult = (): PaintSearchResult => {
  const state = usePuyoAppStore.getState();
  return {
    plans: [],
    elapsedTime: 10,
    signature: paintSearchSignatureOf(
      state.simulationData,
      state.explorationTarget,
      state.paintSearchSettings
    )
  };
};

describe('paintSearchButtonClicked', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
    searchMock.mockReset();
    backendSearchMock.mockReset();
    ignitionSearchMock.mockReset();
  });

  it('goes through the rust backend when that method is selected', async () => {
    backendSearchMock.mockResolvedValue(emptyResult());
    usePuyoAppStore.setState({
      solutionMethod: SolutionMethod.solveAllByRustBackend
    });

    paintSearchButtonClicked();

    await vi.waitFor(() => expect(backendSearchMock).toHaveBeenCalled());
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('goes through the wasm workers on the wasm method', async () => {
    searchMock.mockResolvedValue(emptyResult());
    usePuyoAppStore.setState({
      solutionMethod: SolutionMethod.solveAllInParallelByWasm
    });

    paintSearchButtonClicked();

    await vi.waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(backendSearchMock).not.toHaveBeenCalled();
  });

  // 発火は狙いで決まり、探索法には従わない。wasm でも十分速いので
  // バックエンドへ出す意味が無い (docs/research/paint-ignition-search.md §9-11)。
  it('goes through the ignition driver when the goal is to ignite', async () => {
    ignitionSearchMock.mockResolvedValue(emptyResult());
    usePuyoAppStore.setState({
      paintSearchSettings: {
        ...usePuyoAppStore.getState().paintSearchSettings,
        goal: PaintGoal.Ignite
      }
    });

    paintSearchButtonClicked();

    await vi.waitFor(() => expect(ignitionSearchMock).toHaveBeenCalled());
    expect(searchMock).not.toHaveBeenCalled();
    expect(backendSearchMock).not.toHaveBeenCalled();
  });

  it('stays on the ignition driver even on the rust backend method', async () => {
    ignitionSearchMock.mockResolvedValue(emptyResult());
    usePuyoAppStore.setState({
      solutionMethod: SolutionMethod.solveAllByRustBackend,
      paintSearchSettings: {
        ...usePuyoAppStore.getState().paintSearchSettings,
        goal: PaintGoal.Ignite
      }
    });

    paintSearchButtonClicked();

    await vi.waitFor(() => expect(ignitionSearchMock).toHaveBeenCalled());
    expect(backendSearchMock).not.toHaveBeenCalled();
  });

  it('runs the search and stores the result', async () => {
    const result = emptyResult();
    searchMock.mockResolvedValue(result);

    paintSearchButtonClicked();
    expect(usePuyoAppStore.getState().paintSearching).toBe(true);

    await vi.waitFor(() =>
      expect(usePuyoAppStore.getState().paintSearching).toBe(false)
    );
    expect(usePuyoAppStore.getState().paintSearchResult).toEqual(result);
  });

  it('passes the current board, target and settings to the driver', async () => {
    searchMock.mockResolvedValue(emptyResult());

    paintSearchButtonClicked();
    await vi.waitFor(() => expect(searchMock).toHaveBeenCalled());

    const state = usePuyoAppStore.getState();
    const [simulationData, explorationTarget, settings] =
      searchMock.mock.calls[0];
    expect(simulationData).toEqual(state.simulationData);
    expect(explorationTarget).toEqual(state.explorationTarget);
    expect(settings).toEqual(state.paintSearchSettings);
  });

  it('feeds the progress back into the store', async () => {
    searchMock.mockImplementation(
      async (
        _simulationData: unknown,
        _explorationTarget: unknown,
        _settings: unknown,
        options: { onProgress?: (percent: number) => void }
      ) => {
        options.onProgress?.(42);
        return emptyResult();
      }
    );

    paintSearchButtonClicked();
    await vi.waitFor(() =>
      expect(usePuyoAppStore.getState().paintSearchProgressPercent).toBe(42)
    );
  });

  it('gives the driver a signal that the cancel button aborts', async () => {
    let signal: AbortSignal | undefined;
    searchMock.mockImplementation(
      async (
        _simulationData: unknown,
        _explorationTarget: unknown,
        _settings: unknown,
        options: { signal?: AbortSignal }
      ) => {
        signal = options.signal;
        // 中断されるまで終わらない探索のかわり
        return new Promise<PaintSearchResult>((_, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new Error('aborted'))
          );
        });
      }
    );

    paintSearchButtonClicked();
    await vi.waitFor(() => expect(signal).toBeDefined());
    expect(signal!.aborted).toBe(false);

    usePuyoAppStore.getState().paintSearchCancelButtonClicked();

    expect(signal!.aborted).toBe(true);
    await vi.waitFor(() =>
      expect(usePuyoAppStore.getState().paintSearching).toBe(false)
    );
    expect(usePuyoAppStore.getState().paintSearchResult).toBeUndefined();
  });

  it('ignores a result that arrives after the search was cancelled', async () => {
    let finish: ((result: PaintSearchResult) => void) | undefined;
    searchMock.mockImplementation(
      () =>
        new Promise<PaintSearchResult>((resolve) => {
          finish = resolve;
        })
    );

    paintSearchButtonClicked();
    await vi.waitFor(() => expect(finish).toBeDefined());

    usePuyoAppStore.getState().paintSearchCancelButtonClicked();
    // 中断したあとに、間に合わなかった探索が結果を返してくる
    finish!(emptyResult());
    await vi.waitFor(() =>
      expect(usePuyoAppStore.getState().paintSearching).toBe(false)
    );

    expect(usePuyoAppStore.getState().paintSearchResult).toBeUndefined();
  });

  it('marks the search as failed when the driver throws', async () => {
    searchMock.mockRejectedValue(new Error('boom'));

    paintSearchButtonClicked();

    await vi.waitFor(() =>
      expect(usePuyoAppStore.getState().paintSearching).toBe(false)
    );
    expect(usePuyoAppStore.getState().paintSearchResult).toBeUndefined();
  });

  it('does not start a second search while one is running', async () => {
    searchMock.mockReturnValue(new Promise(() => {}));

    paintSearchButtonClicked();
    paintSearchButtonClicked();

    expect(searchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * 連鎖の仕込みが無い盤面。4色を斜めストライプに並べるので、
 * 縦横に隣り合う同色が1つも無い。
 */
const stripedBoard = (): Board => {
  const colors = [
    PuyoType.Blue,
    PuyoType.Green,
    PuyoType.Yellow,
    PuyoType.Purple
  ];
  return {
    field: [...new Array(PuyoCoord.YNum)].map((_, y) =>
      [...new Array(PuyoCoord.XNum)].map((_, x) => colors[(x + y) % 4])
    ),
    nextPuyos: [...new Array(PuyoCoord.XNum)].map((_, x) => colors[x % 4])
  };
};

const setStripedBoard = () => {
  const board = stripedBoard();
  usePuyoAppStore.setState({
    boardId: customBoardId,
    lastScreenshotBoard: board,
    simulationData: createSimulationData(board, {}),
    animationSteps: [],
    activeAnimationStepIndex: -1
  });
};

/** 左上の 2x2。ここを1色に塗ると4連結になって発火する。 */
const squareCoords = [
  PuyoCoord.xyToCoord(0, 0)!,
  PuyoCoord.xyToCoord(1, 0)!,
  PuyoCoord.xyToCoord(0, 1)!,
  PuyoCoord.xyToCoord(1, 1)!
];

describe('paintPlanApplyClicked', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
    setStripedBoard();
  });

  const setGoal = (goal: PaintGoal) => {
    usePuyoAppStore.setState({
      paintSearchSettings: {
        ...usePuyoAppStore.getState().paintSearchSettings,
        goal,
        color: PuyoAttr.Red
      }
    });
  };

  // 仕込みは発火させないのがハード制約。塗った時点で連鎖を起こしてはいけない。
  it('only repaints when the goal is to set up', () => {
    setGoal(PaintGoal.Setup);

    paintPlanApplyClicked(squareCoords);

    const state = usePuyoAppStore.getState();
    expect(state.simulationData.field[0][0]!.type).toBe(PuyoType.Red);
    expect(state.simulationData.field[1][1]!.type).toBe(PuyoType.Red);
    expect(state.animationSteps).toHaveLength(0);
  });

  // 発火は塗った時点でもう消える状態になっている。実際のゲームと同じく連鎖まで走らせる。
  it('plays the chain after painting when the goal is to ignite', async () => {
    setGoal(PaintGoal.Ignite);

    paintPlanApplyClicked(squareCoords);

    const state = usePuyoAppStore.getState();
    expect(state.animationSteps.length).toBeGreaterThan(1);
    // 連鎖が1つ以上記録されていること。
    const lastStep = state.animationSteps[state.animationSteps.length - 1];
    expect(lastStep.chains.length).toBeGreaterThan(0);
    // 塗った4マスは消えて盤面から無くなっている (落下で別のぷよが降りてくる)。
    expect(lastStep.field[0][0]?.type).not.toBe(PuyoType.Red);

    await vi.waitFor(() =>
      expect(usePuyoAppStore.getState().animating).toBe(false)
    );
  });

  // 塗っても発火しない盤面で、連鎖を勝手に始めないこと。
  it('does not start a chain when the paint does not ignite', () => {
    setGoal(PaintGoal.Ignite);

    // 1マスだけ塗っても4連結にはならない。
    paintPlanApplyClicked([squareCoords[0]]);

    const state = usePuyoAppStore.getState();
    expect(state.simulationData.field[0][0]!.type).toBe(PuyoType.Red);
    expect(state.animationSteps).toHaveLength(0);
  });
});
