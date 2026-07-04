/**
 * @module localhost限定のRustネイティブバックエンド (WebSocket) 経由の探索
 *
 * WASM版の並列探索 (src/store/internal/solve.ts の _createSolveAllInParallel) と同じ
 * ストリーミングモデルを踏襲する。ただしタスク分割自体はサーバー側 (solver-server) が
 * 担い、フロントエンドは1回の solve リクエストを送るだけで、完了タスクごとの部分結果を
 * 逐次受け取ってマージ・進捗計算する。
 *
 * README の「外部通信なし」を維持するため、このモジュールは
 * window.location.hostname === 'localhost' の場合にのみ呼び出される想定
 * (呼び出し側の localhost 判定は ExplorationPanel / session 側で行う)。
 * 通信先は常に localhost であり、すべてこのマシン内で完結する。
 */

import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { SolutionResult, SolveResult } from './solution';
import { mergeResultIfRankedIn } from './solution-explorer';
import { traceCandidatesNumMap } from './trace-candidates';
import type { WasmSolutionResult } from './wasm-interface';
import {
  toJsOptimalSolution,
  toWasmEnvironmentFieldNextPuyos,
  toWasmExplorationTarget
} from './wasm-serialize';

/** Rustネイティブバックエンド (solver-server) のデフォルト待受先。 */
const DEFAULT_RUST_BACKEND_URL = 'ws://localhost:3011';

/** サーバーからの部分結果通知 (完了タスクごと)。 */
interface ServerPartialMessage {
  type: 'partial';
  candidates_num: number;
  optimal_solutions: WasmSolutionResult[];
  ideal_share: number;
}

/** サーバーからの探索完了通知。 */
interface ServerDoneMessage {
  type: 'done';
}

/** サーバーからのエラー通知。 */
interface ServerErrorMessage {
  type: 'error';
  message: string;
}

type ServerMessage =
  | ServerPartialMessage
  | ServerDoneMessage
  | ServerErrorMessage;

/**
 * Rustネイティブバックエンド (solver-server) へWebSocket経由で1回の探索を依頼するファクトリー。
 * createSolveAllInParallel / createSolveAllInParallelByWasm と同じシグネチャの
 * (signal, onProgress) => Promise<SolveResult> を返す。
 * @param simulationData
 * @param explorationTarget
 * @param wsEndpointUrl 接続先 (テストや別ポート起動用に上書き可能)
 */
export const createSolveAllByRustBackend =
  (
    simulationData: SimulationData,
    explorationTarget: ExplorationTarget,
    wsEndpointUrl: string = DEFAULT_RUST_BACKEND_URL
  ) =>
  (
    signal: AbortSignal,
    onProgress?: (result: SolveResult, percent: number) => void
  ): Promise<SolveResult> => {
    const startTime = Date.now();

    // 進捗率計算。solve.ts の _createSolveAllInParallel と同じ考え方で、
    // traceCandidatesNumMap 由来の理想候補数合計に対する累積 ideal_share の割合を使う。
    const maxTraceNum = simulationData.isChanceMode
      ? 5
      : simulationData.maxTraceNum;
    const ideal_candidates_num_by_indexes =
      traceCandidatesNumMap.get(maxTraceNum);
    const ideal_total_num = ideal_candidates_num_by_indexes?.reduce(
      (m, n) => m + n
    );

    const exploration_target = toWasmExplorationTarget(explorationTarget);
    const { environment, boost_area_coord_set, field, next_puyos } =
      toWasmEnvironmentFieldNextPuyos(simulationData);
    // ワイヤープロトコルでは Set ではなく配列で送る。
    const boost_area_coords = [...boost_area_coord_set];

    return new Promise<SolveResult>((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('aborted'));
        return;
      }

      const optimal_solutions: SolutionResult[] = [];
      let candidates_num = 0;
      let intermediate_ideal_candidates = 0;

      const socket = new WebSocket(wsEndpointUrl);

      // ハンドラを外してから close() するので、finish は何度呼ばれても安全
      // (例えば接続失敗時にブラウザが error に続けて close も発火する場合など)。
      // 2回目以降はハンドラがすでに null なのでそもそも呼ばれない。
      const finish = (action: () => void) => {
        signal.removeEventListener('abort', onAborted);
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
        action();
      };

      const onAborted = () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'abort' }));
        }
        finish(() => reject(new Error('aborted')));
      };
      signal.addEventListener('abort', onAborted);

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: 'solve',
            exploration_target,
            environment,
            boost_area_coords,
            field,
            next_puyos
          })
        );
      };

      socket.onerror = () => {
        finish(() =>
          reject(
            new Error(
              'Rustバックエンドサーバーに接続できませんでした。`npm run solver-server` でサーバーを起動してください。'
            )
          )
        );
      };

      socket.onclose = () => {
        // resolve/reject 済みでない切断は、探索完了前にサーバーが落ちた等の異常系。
        finish(() =>
          reject(
            new Error('Rustバックエンドサーバーとの接続が切断されました。')
          )
        );
      };

      socket.onmessage = (ev: MessageEvent<string>) => {
        const message = JSON.parse(ev.data) as ServerMessage;

        switch (message.type) {
          case 'partial': {
            candidates_num += message.candidates_num;
            for (const s of message.optimal_solutions) {
              mergeResultIfRankedIn(
                explorationTarget,
                toJsOptimalSolution(s),
                optimal_solutions
              );
            }
            if (ideal_candidates_num_by_indexes && ideal_total_num) {
              intermediate_ideal_candidates += message.ideal_share;
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
            break;
          }
          case 'done': {
            finish(() =>
              resolve({
                explorationTarget,
                elapsedTime: Date.now() - startTime,
                candidates_num,
                optimal_solutions
              })
            );
            break;
          }
          case 'error': {
            finish(() => reject(new Error(message.message)));
            break;
          }
        }
      };
    });
  };
