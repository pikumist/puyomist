import { searchPaintPlansByRustBackend } from '../../logics/paint-search-rust-backend';
import { searchPaintPlansByWasm } from '../../logics/paint-search-worker-driver';
import { SolutionMethod } from '../../logics/solution';
import { usePuyoAppStore } from '../puyoAppStore';

/**
 * ぷよ塗り探索ボタンがクリックされたとき。
 *
 * 探索法に合わせて WASM ワーカー版 (`paint-search-worker-driver`) と
 * Rustネイティブバックエンド版 (`paint-search-rust-backend`) を使い分ける。
 * どちらも同じ結果を返す (精度→ビーム幅の対応は Rust の `PaintPrecision` に一本化)。
 * WASM では標準精度でも十数秒かかるので、中断できるように AbortController を通し、
 * 進捗を逐一ストアへ返す。
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
  const search =
    state.solutionMethod === SolutionMethod.solveAllByRustBackend
      ? searchPaintPlansByRustBackend
      : searchPaintPlansByWasm;

  state.paintSearchStarted();

  (async () => {
    try {
      const signal =
        usePuyoAppStore.getState().abortControllerForPaintSearch!.signal;
      const result = await search(
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
