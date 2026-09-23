import { releaseProxy } from 'comlink';

import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { PaintSearchResult, PaintSearchSettings } from './paint-search';
import { paintSearchSignatureOf } from './paint-search';
import type { PaintSearchOptions } from './paint-search-worker-driver';
import { createWorker } from './solution-wasm-worker-shim';
import { toJsIgnitionPlan, toWasmIgnitionSearchParams } from './wasm-serialize';

/**
 * @module 塗り発火探索 (WASM版)
 *
 * 「仕込み」側 (`paint-search-worker-driver`) と違い、**1呼び出しで完結する**。
 * 反復局所探索は段に分けられないし、そもそも分ける必要が無い:
 * wasm の単スレッドで標準精度 約0.5秒、超高精度でも約5.6秒
 * (`docs/research/paint-ignition-search.md` §9-11)。仕込みの標準が約16秒なのと比べて
 * 桁が2つ小さい。
 *
 * それでも UI を止めないようワーカーで回す。進捗は 0 → 100 しか出せない
 * (探索の途中経過を取り出す口が無く、待ち時間も短いので割に合わない)。
 *
 * 並列化したくなったら `params.seed` を変えて複数ワーカーで回し、Rust 側の
 * `paint_ignition_merge` で畳み込む。再始動が互いに独立なのでそれで正しく分割できる。
 */
export const searchIgnitionPlansByWasm = async (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  settings: PaintSearchSettings,
  options: PaintSearchOptions = {}
): Promise<PaintSearchResult> => {
  const { signal, onProgress } = options;
  const startTime = Date.now();

  if (signal?.aborted) {
    throw new DOMException('aborted', 'AbortError');
  }

  const worker = createWorker();
  try {
    onProgress?.(0);

    const result = await worker.workerProxy.searchIgnitionPlans(
      simulationData,
      explorationTarget,
      toWasmIgnitionSearchParams(settings)
    );

    // 中断されたあとに結果や 100% を返さない。呼び出し側は中断か完了かで
    // 扱いを変えるので、ここで必ず落とす。
    if (signal?.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    onProgress?.(100);

    return {
      plans: (result?.plans ?? []).map(toJsIgnitionPlan),
      elapsedTime: Date.now() - startTime,
      signature: paintSearchSignatureOf(
        simulationData,
        explorationTarget,
        settings
      )
    };
  } finally {
    try {
      worker.workerProxy[releaseProxy]();
    } catch (_) {}
    try {
      worker.workerInstance.terminate();
    } catch (_) {}
  }
};
