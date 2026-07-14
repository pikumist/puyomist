import { cleanup, render, screen } from '@testing-library/react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import BridgePreview from '../components/panels/BridgePreview';
import { PuyoType } from '../logics/PuyoType';
import { customBoardId } from '../logics/boards';
import { usePuyoAppStore } from '../store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '../store/types';

// 解探索(ソルバ)は E2E の対象外なのでスタブ化する。boardDetectedAndSolve が
// solveButtonClicked を呼ぶが、本テストで検証したいのは盤面注入・プレビュー・
// detectBoard 非発火であって解ではない。
vi.mock('../store/actions/solve', () => ({
  solveButtonClicked: vi.fn(),
  playSolutionButtonClicked: vi.fn()
}));

/** ブラウザの WebSocket を差し替えるフェイク。生成インスタンスを sockets に積む。 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  readyState = 0;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
  /** サーバからのメッセージ到来をシミュレートする。 */
  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }
}

const socket = () => {
  const s = FakeWebSocket.instances[0];
  if (!s) throw new Error('receiver did not open a WebSocket');
  return s;
};

const resetStore = () =>
  usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));

beforeAll(async () => {
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  // jsdom は createObjectURL/revokeObjectURL 未実装なのでスタブ。
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  resetStore();
  // 実運用の副作用モジュール(localhost ガード付き)をそのまま import して駆動する。
  await import('./dispatchWhenScreenshotReceivedViaWebSocket');
  socket().onopen?.(new Event('open'));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  resetStore();
});

afterEach(() => cleanup());

const NORMAL_CSV = [
  'R,G,B,Y,P,R,G,B', // next
  'R,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_'
].join('\n');

const CHANCE_CSV = [
  '_,_,_,_,_,_,_,_', // next 全 '_' = CHANCE マーカ
  'Y,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_',
  '_,_,_,_,_,_,_,_'
].join('\n');

const tinyImage = { mime: 'image/jpeg', base64: btoa('x') };

describe('board bridge E2E (WS -> store -> render)', () => {
  it('receiver は localhost で WebSocket を1本張る', () => {
    expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(1);
    expect(socket().url).toBe('ws://localhost:3000');
  });

  it('board メッセージ(画像付き)で盤面が注入され、プレビューも設定される', () => {
    socket().emit({ type: 'board', mode: 'NORMAL', csv: NORMAL_CSV, image: tinyImage });

    const s = usePuyoAppStore.getState();
    expect(s.boardId).toBe(customBoardId);
    // next 行の先頭 'R' と field(0,0) の 'R' が反映されている
    expect(s.lastScreenshotBoard?.nextPuyos?.[0]).toBe(PuyoType.Red);
    expect(s.lastScreenshotBoard?.field[0][0]).toBe(PuyoType.Red);
    // NORMAL なので通常モード
    expect(s.simulationData.isChanceMode).toBe(false);
    // プレビューが設定される
    expect(s.bridgePreview?.blobUrl).toBe('blob:mock');
  });

  it('board メッセージは screenshotInfo を触らない(= TS detectBoard を発火させない)', () => {
    socket().emit({ type: 'board', mode: 'NORMAL', csv: NORMAL_CSV, image: tinyImage });
    // BoardReceiver の detectBoard は [screenshotInfo] 依存の useEffect でのみ走る。
    // board 経路が screenshotInfo を undefined のままにしていれば発火し得ない。
    expect(usePuyoAppStore.getState().screenshotInfo).toBeUndefined();
  });

  it('CHANCE モードは isChanceMode に反映され、next 行は空になる', () => {
    socket().emit({ type: 'board', mode: 'CHANCE', csv: CHANCE_CSV, image: tinyImage });

    const s = usePuyoAppStore.getState();
    expect(s.simulationData.isChanceMode).toBe(true);
    expect(s.lastScreenshotBoard?.nextPuyos?.every((p) => p === undefined)).toBe(true);
  });

  it('画像なしの board メッセージは前回プレビューをクリアする', () => {
    socket().emit({ type: 'board', mode: 'NORMAL', csv: NORMAL_CSV, image: tinyImage });
    expect(usePuyoAppStore.getState().bridgePreview).toBeDefined();

    socket().emit({ type: 'board', mode: 'NORMAL', csv: NORMAL_CSV });
    expect(usePuyoAppStore.getState().bridgePreview).toBeUndefined();
  });

  it('BridgePreview は bridgePreview 設定時のみ画像を描画する', () => {
    // 未設定: 何も描画しない
    const view = render(<BridgePreview />);
    expect(screen.queryByAltText('bridge preview')).toBeNull();
    view.unmount();

    // board+画像 メッセージ後: 左下に img が出る
    socket().emit({ type: 'board', mode: 'NORMAL', csv: NORMAL_CSV, image: tinyImage });
    render(<BridgePreview />);
    const img = screen.getByAltText('bridge preview') as HTMLImageElement;
    expect(img.src).toContain('blob:mock');
  });

  it('レガシーな FileInfo(type なし)は従来どおり screenshotReceived へ流れる', () => {
    socket().emit({
      filePath: '/x.png',
      fileName: 'x.png',
      mime: 'image/png',
      contentAsBase64: btoa('x'),
      size: 1
    });
    const s = usePuyoAppStore.getState();
    expect(s.screenshotInfo?.fileName).toBe('x.png');
    expect(s.screenshotInfo?.blobUrl).toBe('blob:mock');
  });
});
