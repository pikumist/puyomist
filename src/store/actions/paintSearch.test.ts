import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaintSearchResult } from '../../logics/paint-search';
import { paintSearchSignatureOf } from '../../logics/paint-search';
import { usePuyoAppStore } from '../puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '../types';
import { paintSearchButtonClicked } from './paintSearch';

const searchMock = vi.hoisted(() => vi.fn());

vi.mock('../../logics/paint-search-worker-driver', () => ({
  searchPaintPlansByWasm: searchMock
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
