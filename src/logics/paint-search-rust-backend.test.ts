import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSimulationData } from '../store/internal/createSimulationData';
import { ExplorationCategory, PreferenceKind } from './ExplorationTarget';
import type { ExplorationTarget } from './ExplorationTarget';
import { PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import {
  PaintPrecision,
  defaultPaintSearchSettings,
  paintSearchSignatureOf
} from './paint-search';
import { searchPaintPlansByRustBackend } from './paint-search-rust-backend';
import type { WasmPaintPlan } from './wasm-interface';

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
  optimal_solution_count: 1
};

const simulationData = createSimulationData({}, { maxTraceNum: 5 });

const makePlan = (value: number): WasmPaintPlan => ({
  coords: [
    { x: 0, y: 0 },
    { x: 1, y: 0 }
  ],
  value,
  expected_value: undefined,
  solution: {
    trace_coords: [{ x: 2, y: 2 }],
    chains: [],
    value,
    popped_chance_num: 0,
    popped_heart_num: 0,
    popped_prism_num: 0,
    popped_ojama_num: 0,
    popped_kata_num: 0,
    is_all_cleared: false
  }
});

const search = (
  options: Parameters<typeof searchPaintPlansByRustBackend>[3] = {},
  url?: string
) =>
  searchPaintPlansByRustBackend(
    simulationData,
    explorationTarget,
    { ...defaultPaintSearchSettings, precision: PaintPrecision.High },
    options,
    url
  );

describe('searchPaintPlansByRustBackend', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it('sends a paint message with the search params once the socket opens', () => {
    void search().catch(() => {});

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe('ws://localhost:3011');
    socket.simulateOpen();

    const sent = socket.lastSent();
    expect(sent.type).toBe('paint');
    expect(Array.isArray(sent.boost_area_coords)).toBe(true);
    expect(sent.params.target).toBe(PuyoAttr.Red);
    // 精度は Rust の PaintPrecision の値で送る (幅の対応はサーバー側が決める)
    expect(sent.params.precision).toBe(1);
    expect(sent).toHaveProperty('exploration_target');
    expect(sent).toHaveProperty('environment');
    expect(sent).toHaveProperty('field');
    expect(sent).toHaveProperty('next_puyos');
  });

  it('connects to a custom endpoint when provided', () => {
    void search({}, 'ws://localhost:9999').catch(() => {});
    expect(FakeWebSocket.instances[0].url).toBe('ws://localhost:9999');
  });

  it('reports the progress it is told about', () => {
    const seen: number[] = [];
    void search({ onProgress: (p) => seen.push(p) }).catch(() => {});

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateMessage({ type: 'paint_progress', percent: 25 });
    socket.simulateMessage({ type: 'paint_progress', percent: 60 });

    expect(seen).toEqual([25, 60]);
  });

  it('resolves with the plans, converted and signed', async () => {
    const promise = search();

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateMessage({
      type: 'paint_result',
      plans: [makePlan(240), makePlan(198)]
    });
    socket.simulateMessage({ type: 'done' });

    const result = await promise;

    expect(result.plans.map((p) => p.value)).toEqual([240, 198]);
    expect(result.plans[0].coords).toEqual([
      PuyoCoord.xyToCoord(0, 0),
      PuyoCoord.xyToCoord(1, 0)
    ]);
    expect(result.plans[0].solution.trace_coords).toEqual([
      PuyoCoord.xyToCoord(2, 2)
    ]);
    // 結果は入力の指紋を携える (古くなった結果をストアが弾けるように)
    expect(result.signature).toBe(
      paintSearchSignatureOf(simulationData, explorationTarget, {
        ...defaultPaintSearchSettings,
        precision: PaintPrecision.High
      })
    );
  });

  it('resolves with nothing when the server reports no plans', async () => {
    const promise = search();

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateMessage({ type: 'done' });

    await expect(promise).resolves.toMatchObject({ plans: [] });
  });

  it('sends an abort and rejects when the signal fires', async () => {
    const controller = new AbortController();
    const promise = search({ signal: controller.signal });

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    controller.abort();

    expect(socket.lastSent()).toEqual({ type: 'abort' });
    await expect(promise).rejects.toThrow('aborted');
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(search({ signal: controller.signal })).rejects.toThrow(
      'aborted'
    );
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('rejects with a hint to start the server when it cannot connect', async () => {
    const promise = search();
    FakeWebSocket.instances[0].simulateError();

    await expect(promise).rejects.toThrow(/solver-server/);
  });

  it('rejects when the connection drops before the search finishes', async () => {
    const promise = search();
    FakeWebSocket.instances[0].simulateUnexpectedClose();

    await expect(promise).rejects.toThrow('切断されました');
  });

  it('rejects with the server error message', async () => {
    const promise = search();

    const socket = FakeWebSocket.instances[0];
    socket.simulateOpen();
    socket.simulateMessage({ type: 'error', message: '不正なメッセージ' });

    await expect(promise).rejects.toThrow('不正なメッセージ');
  });
});
