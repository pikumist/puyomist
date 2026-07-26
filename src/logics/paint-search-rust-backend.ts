/**
 * @module localhost限定のRustネイティブバックエンド (WebSocket) 経由のぷよ塗り探索
 *
 * WASM版 (`paint-search-worker-driver`) と同じ探索を、ハードウェアPEXTが効く
 * ネイティブバイナリで走らせる。分割の仕方が違うだけで**結果は同じ**になる
 * (精度→ビーム幅の対応は Rust の `PaintPrecision` に一本化してある)。
 *
 * README の「外部通信なし」を維持するため、このモジュールは
 * window.location.hostname === 'localhost' のときに選べる探索法からのみ呼ばれる。
 * 通信先は常に localhost で、すべてこのマシン内で完結する。
 */

import type { ExplorationTarget } from './ExplorationTarget';
import type { SimulationData } from './SimulationData';
import type { PaintSearchResult, PaintSearchSettings } from './paint-search';
import { paintSearchSignatureOf } from './paint-search';
import type { PaintSearchOptions } from './paint-search-worker-driver';
import type { WasmPaintPlan } from './wasm-interface';
import {
  toJsPaintPlan,
  toWasmEnvironmentFieldNextPuyos,
  toWasmExplorationTarget,
  toWasmPaintSearchParams
} from './wasm-serialize';

/** Rustネイティブバックエンド (solver-server) のデフォルト待受先。 */
const DEFAULT_RUST_BACKEND_URL = 'ws://localhost:3011';

/** 探索の進捗 (0..100)。 */
interface ServerPaintProgressMessage {
  type: 'paint_progress';
  percent: number;
}

/** 探索結果。良い順の塗り案。 */
interface ServerPaintResultMessage {
  type: 'paint_result';
  plans: WasmPaintPlan[];
}

interface ServerDoneMessage {
  type: 'done';
}

interface ServerErrorMessage {
  type: 'error';
  message: string;
}

type ServerMessage =
  | ServerPaintProgressMessage
  | ServerPaintResultMessage
  | ServerDoneMessage
  | ServerErrorMessage;

/**
 * ぷよ塗り探索を Rustネイティブバックエンドで実行する。
 *
 * `searchPaintPlansByWasm` と同じシグネチャなので、呼び出し側は探索法で差し替えるだけ。
 */
export const searchPaintPlansByRustBackend = async (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  settings: PaintSearchSettings,
  options: PaintSearchOptions = {},
  wsEndpointUrl: string = DEFAULT_RUST_BACKEND_URL
): Promise<PaintSearchResult> => {
  const { signal, onProgress } = options;
  const startTime = Date.now();

  const exploration_target = toWasmExplorationTarget(explorationTarget);
  const { environment, boost_area_coord_set, field, next_puyos } =
    toWasmEnvironmentFieldNextPuyos(simulationData);
  // ワイヤープロトコルでは Set ではなく配列で送る。
  const boost_area_coords = [...boost_area_coord_set];
  const params = toWasmPaintSearchParams(settings);

  return new Promise<PaintSearchResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }

    let plans: WasmPaintPlan[] = [];
    const socket = new WebSocket(wsEndpointUrl);

    // ハンドラを外してから close() するので、finish は何度呼ばれても安全。
    const finish = (action: () => void) => {
      signal?.removeEventListener('abort', onAborted);
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
    signal?.addEventListener('abort', onAborted);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'paint',
          exploration_target,
          environment,
          boost_area_coords,
          field,
          next_puyos,
          params
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
        reject(new Error('Rustバックエンドサーバーとの接続が切断されました。'))
      );
    };

    socket.onmessage = (ev: MessageEvent<string>) => {
      const message = JSON.parse(ev.data) as ServerMessage;

      switch (message.type) {
        case 'paint_progress': {
          onProgress?.(message.percent);
          break;
        }
        case 'paint_result': {
          plans = message.plans;
          break;
        }
        case 'done': {
          finish(() =>
            resolve({
              plans: plans.map(toJsPaintPlan),
              elapsedTime: Date.now() - startTime,
              signature: paintSearchSignatureOf(
                simulationData,
                explorationTarget,
                settings
              )
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
