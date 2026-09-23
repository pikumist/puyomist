import type { PuyoCoord } from '../../logics/PuyoCoord';
import { cloneSimulationData } from '../../logics/SimulationData';
import { Simulator } from '../../logics/Simulator';
import { searchIgnitionPlansByWasm } from '../../logics/ignition-search-worker-driver';
import { PaintGoal } from '../../logics/paint-search';
import { searchPaintPlansByRustBackend } from '../../logics/paint-search-rust-backend';
import { searchPaintPlansByWasm } from '../../logics/paint-search-worker-driver';
import { SolutionMethod } from '../../logics/solution';
import { usePuyoAppStore } from '../puyoAppStore';
import { doChainAnimation } from './chainAnimation';

/**
 * ぷよ塗り探索ボタンがクリックされたとき。
 *
 * 狙い ([`PaintGoal`]) と探索法で使う実装を振り分ける。
 *
 * - **仕込み**: 探索法に合わせて WASM ワーカー版 (`paint-search-worker-driver`) と
 *   Rustネイティブバックエンド版 (`paint-search-rust-backend`) を使い分ける。
 *   どちらも同じ結果を返す (精度→ビーム幅の対応は Rust の `PaintPrecision` に一本化)
 * - **発火**: 常に WASM 版 (`ignition-search-worker-driver`)。
 *   wasm の単スレッドでも標準0.5秒・超高精度5.6秒で終わるので、
 *   バックエンドへ出すほどの重さが無い (docs/research/paint-ignition-search.md §9-11)
 *
 * 仕込みは WASM では標準精度でも十数秒かかるので、中断できるように AbortController を
 * 通し、進捗を逐一ストアへ返す。
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
    paintSearchSettings.goal === PaintGoal.Ignite
      ? searchIgnitionPlansByWasm
      : state.solutionMethod === SolutionMethod.solveAllByRustBackend
        ? searchPaintPlansByRustBackend
        : searchPaintPlansByWasm;

  state.paintSearchStarted();

  // この探索の身元。中断や次の探索で差し替わったら、こちらの結果も進捗も捨てる。
  // 中断は結果の指紋を変えないので、指紋の照合だけでは弾けない。
  const controller = usePuyoAppStore.getState().abortControllerForPaintSearch!;
  const isCurrent = () =>
    !controller.signal.aborted &&
    usePuyoAppStore.getState().abortControllerForPaintSearch === controller;

  (async () => {
    try {
      const result = await search(
        simulationData,
        explorationTarget,
        paintSearchSettings,
        {
          signal: controller.signal,
          onProgress: (percent) => {
            if (isCurrent()) {
              usePuyoAppStore.getState().paintSearchProgress(percent);
            }
          }
        }
      );
      if (isCurrent()) {
        usePuyoAppStore.getState().paintSearched(result);
      }
    } catch (_) {
      if (isCurrent()) {
        usePuyoAppStore.getState().paintSearchFailed();
      }
    }
  })();
};

/**
 * 塗り案の「適用」が押されたとき。
 *
 * **発火の案は、塗ったらそのまま連鎖を再生する。** 実際のゲームで起きることと同じで、
 * 塗った時点でもう消える状態になっているため。塗るだけで止めると、盤面が
 * 「消えるはずなのに消えていない」不自然な状態で残る。
 *
 * 仕込みの案は塗るだけ。あちらは**発火させない**のがハード制約で、
 * そのあとユーザーがなぞる前提なので、ここで連鎖を起こしてはいけない。
 */
export const paintPlanApplyClicked = (coords: PuyoCoord[]): void => {
  const goal = usePuyoAppStore.getState().paintSearchSettings.goal;
  usePuyoAppStore.getState().paintPlanApplied(coords);

  if (goal !== PaintGoal.Ignite) {
    return;
  }

  // 塗った結果が候補外などで反映されなかった場合は何も起こさない
  // (paintPlanApplied は塗れるマスが1つも無ければ盤面を変えない)。
  const state = usePuyoAppStore.getState();
  const simulator = new Simulator(cloneSimulationData(state.simulationData));
  const animationSteps = simulator.doChainsWithoutTracing(true)!;

  // 消える組が無ければ初期状態の1コマしか出ない。その場合は連鎖ではないので流さない。
  if (animationSteps.length <= 1) {
    return;
  }

  usePuyoAppStore.getState().chainStarted();
  usePuyoAppStore.getState().chainEnded(animationSteps);
  doChainAnimation();
};
