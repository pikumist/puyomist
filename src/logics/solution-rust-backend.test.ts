import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSimulationData } from '../store/internal/createSimulationData';
import { ExplorationCategory, PreferenceKind } from './ExplorationTarget';
import type { ExplorationTarget } from './ExplorationTarget';
import { createSolveAllByRustBackend } from './solution-rust-backend';
import type { WasmSolutionResult } from './wasm-interface';

/** テスト用の最小限の WebSocket モック。実際のネットワークは一切使わない。 */
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN) {
      throw new Error('not open');
    }
    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  // --- テストヘルパー ---
  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }

  simulateError() {
    this.onerror?.();
  }

  simulateUnexpectedClose() {
    this.onclose?.();
  }

  lastSent(): any {
    return JSON.parse(this.sent.at(-1)!);
  }
}

const explorationTarget: ExplorationTarget = {
  category: ExplorationCategory.PuyotsukaiCount,
  preference_priorities: [PreferenceKind.BiggerValue],
  optimal_solution_count: 2
};

const makeWasmSolution = (value: number, x = 0, y = 0): WasmSolutionResult => ({
  trace_coords: [{ x, y }],
  chains: [],
  value,
  popped_chance_num: 0,
  popped_heart_num: 0,
  popped_prism_num: 0,
  popped_ojama_num: 0,
  popped_kata_num: 0,
  is_all_cleared: false
});

describe('createSolveAllByRustBackend', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it('sends a solve message (boost area as an array) once the socket opens', () => {
    const simulationData = createSimulationData(
      {},
      { maxTraceNum: 1, boostAreaCoordList: [] }
    );
    const controller = new AbortController();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    void solve(controller.signal);

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe('ws://localhost:3011');
    socket.simulateOpen();

    const sent = socket.lastSent();
    expect(sent.type).toBe('solve');
    expect(Array.isArray(sent.boost_area_coords)).toBe(true);
    expect(sent).toHaveProperty('exploration_target');
    expect(sent).toHaveProperty('environment');
    expect(sent).toHaveProperty('field');
    expect(sent).toHaveProperty('next_puyos');
  });

  it('connects to a custom endpoint when provided', () => {
    const simulationData = createSimulationData({}, { maxTraceNum: 1 });
    const controller = new AbortController();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget,
      'ws://localhost:9999'
    );
    void solve(controller.signal);

    expect(FakeWebSocket.instances[0].url).toBe('ws://localhost:9999');
  });

  it('merges optimal_solutions incrementally across partial messages and reports cumulative percent', async () => {
    // maxTraceNum = 1 のとき traceCandidatesNumMap の合計は 48。
    const simulationData = createSimulationData({}, { maxTraceNum: 1 });
    const controller = new AbortController();
    const onProgress = vi.fn();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    const resultPromise = solve(controller.signal, onProgress);

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();

    socket.simulateMessage({
      type: 'partial',
      candidates_num: 10,
      optimal_solutions: [makeWasmSolution(5, 0, 0)],
      ideal_share: 12
    });

    expect(onProgress).toHaveBeenCalledTimes(1);
    const [firstResult, firstPercent] = onProgress.mock.calls[0];
    expect(firstResult.candidates_num).toBe(10);
    expect(firstResult.optimal_solutions).toHaveLength(1);
    expect(firstPercent).toBeCloseTo((100 * 12) / 48);

    socket.simulateMessage({
      type: 'partial',
      candidates_num: 7,
      // より良い解 (value=9) が先頭に来るはず
      optimal_solutions: [makeWasmSolution(9, 1, 0), makeWasmSolution(1, 2, 0)],
      ideal_share: 36
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
    const [secondResult, secondPercent] = onProgress.mock.calls[1];
    expect(secondResult.candidates_num).toBe(17);
    expect(secondPercent).toBeCloseTo(100);
    // optimal_solution_count = 2 なので、上位2件 (value 9, 5) のみ残る
    expect(secondResult.optimal_solutions.map((s: any) => s.value)).toEqual([
      9, 5
    ]);

    socket.simulateMessage({ type: 'done' });
    const result = await resultPromise;
    expect(result.candidates_num).toBe(17);
    expect(result.optimal_solutions.map((s) => s.value)).toEqual([9, 5]);
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it('uses a fixed maxTraceNum of 5 for percent calculation when in chance mode', () => {
    // チャンスモード中は maxTraceNum=99 であっても 5 固定の合計 (traceCandidatesNumMap) を使う。
    const simulationData = createSimulationData(
      {},
      { maxTraceNum: 99, isChanceMode: true }
    );
    const controller = new AbortController();
    const onProgress = vi.fn();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    void solve(controller.signal, onProgress);

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateMessage({
      type: 'partial',
      candidates_num: 1,
      optimal_solutions: [],
      ideal_share: 100
    });

    expect(onProgress).toHaveBeenCalledTimes(1);
    const [, percent] = onProgress.mock.calls[0];
    expect(percent).toBeGreaterThan(0);
  });

  it('does not call onProgress when maxTraceNum has no known ideal-candidates total', async () => {
    const simulationData = createSimulationData({}, { maxTraceNum: 999 });
    const controller = new AbortController();
    const onProgress = vi.fn();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    const resultPromise = solve(controller.signal, onProgress);

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateMessage({
      type: 'partial',
      candidates_num: 1,
      optimal_solutions: [],
      ideal_share: 1
    });
    expect(onProgress).not.toHaveBeenCalled();

    socket.simulateMessage({ type: 'done' });
    await expect(resultPromise).resolves.toMatchObject({ candidates_num: 1 });
  });

  it('rejects and closes the socket when the server sends an error message', async () => {
    const simulationData = createSimulationData({}, { maxTraceNum: 1 });
    const controller = new AbortController();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    const resultPromise = solve(controller.signal);

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateMessage({ type: 'error', message: '盤面が不正です' });

    await expect(resultPromise).rejects.toThrow('盤面が不正です');
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it('rejects with a helpful message when the socket fails to connect', async () => {
    const simulationData = createSimulationData({}, { maxTraceNum: 1 });
    const controller = new AbortController();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    const resultPromise = solve(controller.signal);

    const socket = FakeWebSocket.instances[0];
    socket.simulateError();

    await expect(resultPromise).rejects.toThrow('npm run solver-server');
  });

  it('rejects when the socket closes unexpectedly before done', async () => {
    const simulationData = createSimulationData({}, { maxTraceNum: 1 });
    const controller = new AbortController();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    const resultPromise = solve(controller.signal);

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateUnexpectedClose();

    await expect(resultPromise).rejects.toThrow('切断されました');
  });

  it('sends abort and rejects when the signal is aborted mid-solve', async () => {
    const simulationData = createSimulationData({}, { maxTraceNum: 1 });
    const controller = new AbortController();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    const resultPromise = solve(controller.signal);

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    controller.abort();

    await expect(resultPromise).rejects.toThrow('aborted');
    const abortMessage = socket.sent
      .map((s) => JSON.parse(s))
      .find((m) => m.type === 'abort');
    expect(abortMessage).toBeTruthy();
    expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it('rejects immediately without opening a socket when the signal is already aborted', async () => {
    const simulationData = createSimulationData({}, { maxTraceNum: 1 });
    const controller = new AbortController();
    controller.abort();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );

    await expect(solve(controller.signal)).rejects.toThrow('aborted');
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('aborting before the socket is open does not attempt to send on a non-open socket', async () => {
    const simulationData = createSimulationData({}, { maxTraceNum: 1 });
    const controller = new AbortController();
    const solve = createSolveAllByRustBackend(
      simulationData,
      explorationTarget
    );
    const resultPromise = solve(controller.signal);

    const socket = FakeWebSocket.instances[0];
    // socket.readyState is still CONNECTING here.
    controller.abort();

    await expect(resultPromise).rejects.toThrow('aborted');
    expect(socket.sent).toHaveLength(0);
  });
});
