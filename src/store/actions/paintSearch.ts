import { searchPaintPlansByWasm } from '../../logics/paint-search-worker-driver';
import { usePuyoAppStore } from '../puyoAppStore';

/**
 * ぷよ塗り探索ボタンがクリックされたとき。
 *
 * 探索は WASM ワーカーで走る (`paint-search-worker-driver`)。標準精度でも十数秒
 * かかるので、中断できるように AbortController を通し、進捗を逐一ストアへ返す。
 *
 * 結果が古くなっていないか (探索中に盤面や設定が変わっていないか) の判定は
 * `paintSearched` 側が結果の指紋で行うので、ここでは見ない。
 */
export const paintSearchButtonClicked = (): void => {
  const state = usePuyoAppStore.getState();
  if (state.paintSearching) {
    return;
  }

  const { simulationData, explorationTarget, paintSearchSettings } = state;

  state.paintSearchStarted();

  (async () => {
    try {
      const signal =
        usePuyoAppStore.getState().abortControllerForPaintSearch!.signal;
      const result = await searchPaintPlansByWasm(
        simulationData,
        explorationTarget,
        paintSearchSettings,
        {
          signal,
          onProgress: (percent) => {
            usePuyoAppStore.getState().paintSearchProgress(percent);
          }
        }
      );
      usePuyoAppStore.getState().paintSearched(result);
    } catch (_) {
      usePuyoAppStore.getState().paintSearchFailed();
    }
  })();
};
