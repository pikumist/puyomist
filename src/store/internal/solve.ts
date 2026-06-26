import { releaseProxy } from 'comlink';
import type { ExplorationTarget } from '../../logics/ExplorationTarget';
import { PuyoCoord } from '../../logics/PuyoCoord';
import type { SimulationData } from '../../logics/SimulationData';
import type {
  ExplorationResult,
  SolutionResult,
  SolveResult
} from '../../logics/solution';
import { mergeResultIfRankedIn } from '../../logics/solution-explorer';
import { createWorker as createWasmWorker } from '../../logics/solution-wasm-worker-shim';
import { createWorker as createJsWorker } from '../../logics/solution-worker-shim';
import { traceCandidatesNumMap } from '../../logics/trace-candidates';

const createSolveAllAbortPromises = (
  factory: typeof createJsWorker | typeof createWasmWorker,
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  signal: AbortSignal
) => {
  const { workerInstance, workerProxy } = factory();

  const exitWorker = () => {
    workerProxy[releaseProxy]();
    workerInstance.terminate();
  };

  const solvePromise = new Promise<ExplorationResult>((resolve, reject) => {
    workerProxy
      .solveAllTraces(simulationData, explorationTarget)
      .then((explorationResult) => {
        fixTraceCoordsInResult(explorationResult);
        exitWorker();
        resolve(explorationResult);
      })
      .catch((ex) => {
        exitWorker();
        reject(ex);
      });
  });

  const abortPromise = new Promise((_, reject) => {
    const onAborted = () => {
      signal.removeEventListener('abort', onAborted);
      exitWorker();
      reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAborted);
  });

  return [solvePromise, abortPromise];
};

export const createSolveAllInSerial = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) => _createSolveAllInSerial(createJsWorker, simulationData, explorationTarget);

export const createSolveAllInSerialByWasm = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) =>
  _createSolveAllInSerial(createWasmWorker, simulationData, explorationTarget);

const _createSolveAllInSerial =
  (
    factory: typeof createJsWorker | typeof createWasmWorker,
    simulationData: SimulationData,
    explorationTarget: ExplorationTarget
  ) =>
  async (
    signal: AbortSignal,
    _onProgress?: (result: SolveResult, percent: number) => void
  ): Promise<SolveResult> => {
    const startTime = Date.now();

    const explorationResult = (await Promise.race(
      createSolveAllAbortPromises(
        factory,
        simulationData,
        explorationTarget,
        signal
      )
    )) as ExplorationResult;

    return {
      explorationTarget,
      elapsedTime: Date.now() - startTime,
      ...explorationResult
    };
  };

export const createSolveAllInParallel = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) =>
  _createSolveAllInParallel(createJsWorker, simulationData, explorationTarget);

export const createSolveAllInParallelByWasm = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) =>
  _createSolveAllInParallel(
    createWasmWorker,
    simulationData,
    explorationTarget
  );

const _createSolveAllInParallel =
  (
    factory: typeof createJsWorker | typeof createWasmWorker,
    simulationData: SimulationData,
    explorationTarget: ExplorationTarget
  ) =>
  async (
    signal: AbortSignal,
    onProgress?: (result: SolveResult, percent: number) => void
  ): Promise<SolveResult> => {
    const startTime = Date.now();
    const concurrency = Math.max(1, window.navigator.hardwareConcurrency || 1);

    const maxTraceNum = simulationData.isChanceMode
      ? 5
      : simulationData.maxTraceNum;
    const ideal_candidates_num_by_indexes =
      traceCandidatesNumMap.get(maxTraceNum);
    const ideal_total_num = ideal_candidates_num_by_indexes?.reduce(
      (m, n) => m + n
    );

    // 4-C: 1 コア当たりの公平配分を超える「重い」開始インデックスだけ、
    // solve_traces_with_prefix で [i](幹) + [i, j](葉) に分割する。
    // これにより、分割できない最重インデックスが律速になる task-bound (k>=9 で顕著) を解消する。
    // 軽いインデックスは従来どおり丸ごと 1 タスク。
    type ParallelTask =
      | { kind: 'index'; index: number; weight: number; idealShare: number }
      | {
          kind: 'prefix';
          prefix: number[];
          recurse: boolean;
          weight: number;
          idealShare: number;
        };

    const X_NUM = 8;
    const Y_NUM = 6;
    // 開始インデックス i の正準な 2 セル目候補 (8 近傍のうちインデックスが i より大きいもの)。
    // Rust 側の正準列挙の候補集合と一致する (cargo テスト test_solve_traces_with_prefix_partitions_exactly で保証)。
    const secondCellCandidates = (i: number): number[] => {
      const x = i % X_NUM;
      const y = Math.floor(i / X_NUM);
      const res: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= X_NUM || ny < 0 || ny >= Y_NUM) continue;
          const j = ny * X_NUM + nx;
          if (j > i) res.push(j);
        }
      }
      return res;
    };

    const splitThreshold =
      ideal_candidates_num_by_indexes && ideal_total_num
        ? ideal_total_num / concurrency
        : Number.POSITIVE_INFINITY;

    const tasks: ParallelTask[] = [];
    for (let i = 0; i < 48; i++) {
      const w = ideal_candidates_num_by_indexes?.[i] ?? 0;
      if (w > splitThreshold) {
        const children = secondCellCandidates(i);
        const share = children.length > 0 ? w / children.length : w;
        // 幹 {i} (1 候補のみ)
        tasks.push({
          kind: 'prefix',
          prefix: [i],
          recurse: false,
          weight: 1,
          idealShare: 0
        });
        // 葉 [i, j] (それぞれ i,j 始まりの全拡張)
        for (const j of children) {
          tasks.push({
            kind: 'prefix',
            prefix: [i, j],
            recurse: true,
            weight: share,
            idealShare: share
          });
        }
      } else {
        tasks.push({ kind: 'index', index: i, weight: w, idealShare: w });
      }
    }
    // 4-B: 重いタスクから先に流す (LPT)。空きワーカーが順次引くので動的に均される。
    tasks.sort((a, b) => b.weight - a.weight);

    const optimal_solutions: SolutionResult[] = [];
    let candidates_num = 0;
    let intermediate_ideal_candidates = 0;

    // 4-A: 永続ワーカープール。コア数ぶんのワーカーを一度だけ生成・init し、タスク間で使い回す
    // (従来は 48 タスクごとに new Worker + wasm init していた)。
    const pool = [...new Array(concurrency)].map(() => factory());
    const exitAll = () => {
      for (const w of pool) {
        try {
          w.workerProxy[releaseProxy]();
        } catch (_) {}
        w.workerInstance.terminate();
      }
    };

    // 空いたワーカーが次の(LPT順の)タスクを引いていく動的スケジューリング。
    // JS は単一スレッドなので nextTaskIndex++ に競合はない。
    let nextTaskIndex = 0;
    const runWorker = async (
      worker: (typeof pool)[number]
    ): Promise<void> => {
      while (true) {
        if (signal.aborted) {
          throw new Error('aborted');
        }
        const k = nextTaskIndex++;
        if (k >= tasks.length) {
          return;
        }
        const task = tasks[k];

        const result = (await (task.kind === 'index'
          ? worker.workerProxy.solveIncludingTraceIndex(
              simulationData,
              explorationTarget,
              task.index
            )
          : worker.workerProxy.solveWithPrefix(
              simulationData,
              explorationTarget,
              task.prefix,
              task.recurse
            ))) as ExplorationResult;
        fixTraceCoordsInResult(result);

        candidates_num += result.candidates_num;
        for (const s of result.optimal_solutions) {
          mergeResultIfRankedIn(explorationTarget, s, optimal_solutions);
        }

        if (ideal_candidates_num_by_indexes && ideal_total_num) {
          intermediate_ideal_candidates += task.idealShare;
          onProgress?.(
            {
              explorationTarget,
              elapsedTime: Date.now() - startTime,
              candidates_num,
              optimal_solutions: [...optimal_solutions]
            },
            (100 * intermediate_ideal_candidates) / ideal_total_num
          );
        }
      }
    };

    const abortPromise = new Promise<never>((_, reject) => {
      const onAborted = () => {
        signal.removeEventListener('abort', onAborted);
        reject(new Error('aborted'));
      };
      signal.addEventListener('abort', onAborted);
    });

    try {
      await Promise.race([
        Promise.all(pool.map((w) => runWorker(w))),
        abortPromise
      ]);
    } finally {
      exitAll();
    }

    return {
      explorationTarget,
      elapsedTime: Date.now() - startTime,
      candidates_num,
      optimal_solutions
    } satisfies SolveResult;
  };

/** ワーカー経由で壊れてしまう座標を修正する。*/
const fixTraceCoordsInResult = (result: ExplorationResult) => {
  for (const s of result.optimal_solutions) {
    s.trace_coords = s.trace_coords.map(
      (c: any) => PuyoCoord.xyToCoord(c._x, c._y)!
    );
  }
};
