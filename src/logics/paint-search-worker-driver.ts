import { releaseProxy } from 'comlink';

import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { PaintSearchResult, PaintSearchSettings } from './paint-search';
import { paintSearchSignatureOf } from './paint-search';
import { createWorker } from './solution-wasm-worker-shim';
import type { WasmPaintEvaluation, WasmPaintSet } from './wasm-interface';
import { toJsPaintPlan, toWasmPaintSearchParams } from './wasm-serialize';

/**
 * @module ぷよ塗り探索 (WASM版) のワーカー分割
 *
 * 深さごとに「展開 → 評価をワーカーへ配る → 上位選抜」を回す。重いのは評価だけで、
 * そこは要素ごとに独立している。1関数で完結させると wasm の単スレッドでは幅300でも
 * 約19秒かかり、その間 UI が固まる (`docs/paint-search.md`)。
 *
 * **分割した評価は必ず元の順序で組み直すこと**。順序が崩れると同点の並びが変わり、
 * Rustネイティブバックエンドと違う結果になる。Rust 側の
 * `split_evaluation_matches_sequential_search` テストが、この手順が逐次版と
 * 完全に一致することを担保している。
 */

/** ビーム幅と、本番評価に回す件数。Rust の `PaintPrecision` と同じ値にすること */
const beamWidthOf = (precision: 0 | 1 | 2): number =>
  [300, 1000, 2000][precision];

export interface PaintSearchOptions {
  /** 中断用 */
  signal?: AbortSignal;
  /** 進捗率 (0..100) */
  onProgress?: (percent: number) => void;
  /** ワーカー数。既定は論理コア数 */
  concurrency?: number;
}

/**
 * ぷよ塗り探索を WASM ワーカーで実行する。
 *
 * 返る結果は入力の指紋を携える。探索中に盤面や設定が変わっていたら、
 * ストア側がこの指紋で古い結果と判定して取り込まない。
 */
export const searchPaintPlansByWasm = async (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  settings: PaintSearchSettings,
  options: PaintSearchOptions = {}
): Promise<PaintSearchResult> => {
  const { signal, onProgress } = options;
  const startTime = Date.now();

  const params = toWasmPaintSearchParams(settings);
  const beamWidth = beamWidthOf(params.precision);
  const verifyNum = beamWidth * 3;
  const concurrency = Math.max(
    1,
    options.concurrency ?? window.navigator.hardwareConcurrency ?? 1
  );

  const pool = [...new Array(concurrency)].map(() => createWorker());
  const exitAll = () => {
    for (const worker of pool) {
      try {
        worker.workerProxy[releaseProxy]();
      } catch (_) {}
      worker.workerInstance.terminate();
    }
  };

  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new Error('aborted');
    }
  };

  /**
   * 評価をワーカーへ均等に配り、**渡した順のまま**つなぎ直す。
   * 分割数が変わっても結果が変わらないのはこの並べ直しがあるため。
   */
  const evaluate = async (
    paintSets: WasmPaintSet[],
    maxTraceNum: number,
    withSolution: boolean,
    withUncertainty: boolean
  ): Promise<WasmPaintEvaluation[]> => {
    throwIfAborted();

    const chunkSize = Math.max(1, Math.ceil(paintSets.length / pool.length));
    const chunks: WasmPaintSet[][] = [];
    for (let i = 0; i < paintSets.length; i += chunkSize) {
      chunks.push(paintSets.slice(i, i + chunkSize));
    }

    const results = await Promise.all(
      chunks.map((chunk, i) =>
        pool[i].workerProxy.evaluatePaintSets(
          simulationData,
          explorationTarget,
          params,
          chunk,
          maxTraceNum,
          withSolution,
          withUncertainty
        )
      )
    );

    throwIfAborted();
    return results.flat();
  };

  try {
    // 添字0は「塗らない」(空集合)。代理評価は掛けず、最後に無条件で検証対象に加える。
    const all: WasmPaintSet[] = [[]];
    const allScores: number[] = [Number.NEGATIVE_INFINITY];
    let beam: WasmPaintSet[] = [[]];

    // 深さは最大 maxPaintNum 段。最後に本番評価が1段分あるので、進捗はその分も見込む。
    const totalSteps = settings.maxPaintNum + 1;

    for (let depth = 0; depth < settings.maxPaintNum; depth++) {
      throwIfAborted();

      const expanded = await pool[0].workerProxy.expandPaintBeam(
        simulationData,
        params,
        beam
      );
      if (expanded.length === 0) {
        break;
      }

      const evaluations = await evaluate(
        expanded,
        params.surrogate_trace_num,
        false,
        false
      );
      const scores = evaluations.map((e) => e.value);
      const top = await pool[0].workerProxy.selectTopPaintSets(
        scores,
        beamWidth
      );

      beam = top.map((i) => expanded[i]);
      for (const i of top) {
        all.push(expanded[i]);
        allScores.push(scores[i]);
      }

      onProgress?.(Math.round(((depth + 1) / totalSteps) * 100));
    }

    // 代理の上位を本番評価する。「塗らない」は代理スコアを持たず上位選抜に残らないが、
    // 塗りがすべて損な盤面ではこれが答えになるので無条件で加える。
    const verify = await pool[0].workerProxy.selectTopPaintSets(
      allScores,
      verifyNum
    );
    if (!verify.includes(0)) {
      verify.unshift(0);
    }
    const verifySets = verify.map((i) => all[i]);

    const evaluations = await evaluate(
      verifySets,
      simulationData.maxTraceNum,
      true,
      Boolean(params.uncertainty)
    );

    const plans = await pool[0].workerProxy.buildPaintPlans(
      explorationTarget,
      verifySets,
      evaluations,
      params.result_num
    );

    onProgress?.(100);

    return {
      plans: plans.map(toJsPaintPlan),
      elapsedTime: Date.now() - startTime,
      signature: paintSearchSignatureOf(
        simulationData,
        explorationTarget,
        settings
      )
    };
  } finally {
    exitAll();
  }
};
