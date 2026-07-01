import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { boostAreaKeyMap } from '@/logics/BoostArea';
import { ExplorationCategory, PreferenceKind } from '@/logics/ExplorationTarget';
import { PuyoType } from '@/logics/PuyoType';
import { toBoardJson, toPuyomistJson } from '@/logics/app-json';
import { createSimulationData } from '@/store/internal/createSimulationData';
import BoardReceiver from './BoardReceiver';

vi.mock('@/store/actions', () => ({
  boardDetectedAndSolve: vi.fn(),
  puyomistJsonDetectedAndSolve: vi.fn()
}));
vi.mock('@/store/puyoAppStore', () => ({
  screenshotReceived: vi.fn()
}));
vi.mock('@/logics/board-detection', () => ({
  detectBoard: vi.fn()
}));

import { boardDetectedAndSolve, puyomistJsonDetectedAndSolve } from '@/store/actions';
import { detectBoard } from '@/logics/board-detection';
import { screenshotReceived } from '@/store/puyoAppStore';

const validCsv = `B,B,B,B,B,B,B,B
Y,P,R,G,Y,G,B,G
P,G,P,H,W,Y,R,G
P,P,B,B,Y,B,G,R
Y,Y,Y,G,P,Y,G,R
G,G,P,R,G,P,B,R
P,G,P,R,R,P,P,B`;

const invalidCsv = `Y,P,R,G,Y,G,B,G
P,G,P,H,W,Y,R,G
P,P,B,B,Y,B,G,R
Y,Y,Y,G,P,Y,G,R
G,G,P,R,G,P,B,R
P,G,P,R,R,P,P,B`;

const makeSimulationData = () => {
  const field: PuyoType[][] = [...new Array(6)].map(() =>
    [...new Array(8)].map(() => PuyoType.Red)
  );
  const nextPuyos: PuyoType[] = [...new Array(8)].map(() => PuyoType.Blue);
  return createSimulationData({ field, nextPuyos });
};

const explorationTarget = {
  category: ExplorationCategory.PuyotsukaiCount,
  preference_priorities: [PreferenceKind.BiggerValue],
  optimal_solution_count: 5
} as any;

const getFileInput = (): HTMLInputElement =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

const uploadFile = async (file: File) => {
  fireEvent.change(getFileInput(), { target: { files: [file] } });
};

const defaultProps = {
  canvasMaxWidth: 300,
  screenshotInfo: undefined,
  errorMessage: undefined
};

describe('BoardReceiver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the drop zone', () => {
    render(<BoardReceiver {...defaultProps} />);
    expect(screen.getByText('ファイル選択')).toBeInTheDocument();
  });

  it('renders an error message when provided', () => {
    render(<BoardReceiver {...defaultProps} errorMessage="盤面が不正" />);
    expect(screen.getByText('盤面が不正')).toBeInTheDocument();
  });

  it('renders the screenshot file name when provided', () => {
    render(
      <BoardReceiver
        {...defaultProps}
        screenshotInfo={{
          filePath: '',
          fileName: 'shot.png',
          mime: 'image/png',
          size: 123,
          blobUrl: 'blob:existing'
        }}
      />
    );
    expect(screen.getByText('shot.png')).toBeInTheDocument();
  });

  describe('handleFile', () => {
    it('does nothing when the dropped file is rejected by the accept filter', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const file = new File(['bogus'], 'song.mp3', {
        type: 'audio/mpeg'
      });
      await uploadFile(file);

      // Give the async handler a chance to run.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screenshotReceived).not.toHaveBeenCalled();
      expect(boardDetectedAndSolve).not.toHaveBeenCalled();
      expect(puyomistJsonDetectedAndSolve).not.toHaveBeenCalled();
    });

    it('calls screenshotReceived when an image file is dropped', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:mock-url');

      const file = new File(['fake-image-content'], 'shot.png', {
        type: 'image/png'
      });
      await uploadFile(file);

      await waitFor(() => expect(screenshotReceived).toHaveBeenCalledTimes(1));
      expect(screenshotReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'shot.png',
          mime: 'image/png',
          size: file.size,
          blobUrl: 'blob:mock-url'
        })
      );
      expect(createObjectURLSpy).toHaveBeenCalledWith(file);
      expect(boardDetectedAndSolve).not.toHaveBeenCalled();
      expect(puyomistJsonDetectedAndSolve).not.toHaveBeenCalled();
    });

    it('calls boardDetectedAndSolve with a board for a valid csv file', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const file = new File([validCsv], 'board.csv', { type: 'text/csv' });
      await uploadFile(file);

      await waitFor(() =>
        expect(boardDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(boardDetectedAndSolve).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          nextPuyos: expect.any(Array),
          field: expect.any(Array)
        })
      );
    });

    it('calls boardDetectedAndSolve with an error for an invalid csv file', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const file = new File([invalidCsv], 'board.csv', { type: 'text/csv' });
      await uploadFile(file);

      await waitFor(() =>
        expect(boardDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(boardDetectedAndSolve).toHaveBeenCalledWith('行数が7でない');
    });

    it('calls boardDetectedAndSolve with a board for a valid board json file', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const json = toBoardJson(makeSimulationData());
      const file = new File([json], 'board.json', {
        type: 'application/json'
      });
      await uploadFile(file);

      await waitFor(() =>
        expect(boardDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(boardDetectedAndSolve).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          nextPuyos: expect.any(Array),
          field: expect.any(Array)
        })
      );
      expect(puyomistJsonDetectedAndSolve).not.toHaveBeenCalled();
    });

    it('calls boardDetectedAndSolve with an error for an invalid board json file', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const file = new File(
        [JSON.stringify({ type: 'board' })],
        'board.json',
        { type: 'application/json' }
      );
      await uploadFile(file);

      await waitFor(() =>
        expect(boardDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(boardDetectedAndSolve).toHaveBeenCalledWith('boardがない');
    });

    it('calls puyomistJsonDetectedAndSolve for a valid puyomist json file', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const boostKey = [...boostAreaKeyMap.keys()][0];
      const json = toPuyomistJson(
        makeSimulationData(),
        [boostKey],
        explorationTarget
      );
      const file = new File([json], 'puyomist.json', {
        type: 'application/json'
      });
      await uploadFile(file);

      await waitFor(() =>
        expect(puyomistJsonDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(puyomistJsonDetectedAndSolve).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'puyomist',
          boostAreaKeyList: [boostKey]
        })
      );
      expect(boardDetectedAndSolve).not.toHaveBeenCalled();
    });

    it('calls boardDetectedAndSolve with an error for an invalid puyomist json file', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const file = new File(
        [JSON.stringify({ type: 'puyomist' })],
        'puyomist.json',
        { type: 'application/json' }
      );
      await uploadFile(file);

      await waitFor(() =>
        expect(boardDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(boardDetectedAndSolve).toHaveBeenCalledWith('boardがない');
      expect(puyomistJsonDetectedAndSolve).not.toHaveBeenCalled();
    });

    it('does not call either detection action for an unknown json type', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const file = new File(
        [JSON.stringify({ type: 'unknown' })],
        'other.json',
        { type: 'application/json' }
      );
      await uploadFile(file);

      // Give the async handler a chance to run.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(boardDetectedAndSolve).not.toHaveBeenCalled();
      expect(puyomistJsonDetectedAndSolve).not.toHaveBeenCalled();
    });

    it('calls boardDetectedAndSolve with a JSON error message for malformed json', async () => {
      render(<BoardReceiver {...defaultProps} />);
      const file = new File(['{not valid json'], 'broken.json', {
        type: 'application/json'
      });
      await uploadFile(file);

      await waitFor(() =>
        expect(boardDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(boardDetectedAndSolve).toHaveBeenCalledWith('JSONが不正');
    });
  });

  describe('screenshot canvas detection effect', () => {
    let getContextSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      getContextSpy = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue({
          drawImage: vi.fn()
        } as unknown as CanvasRenderingContext2D);

      vi.stubGlobal(
        'Image',
        class {
          naturalWidth = 320;
          naturalHeight = 240;
          onload: (() => void) | null = null;
          set src(_value: string) {
            // Simulate the image finishing loading asynchronously.
            Promise.resolve().then(() => this.onload?.());
          }
        }
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      getContextSpy.mockRestore();
    });

    it('draws the image and reports a detected board', async () => {
      const board = { field: [], nextPuyos: [] };
      vi.mocked(detectBoard).mockReturnValue(board as any);

      render(
        <BoardReceiver
          {...defaultProps}
          screenshotInfo={{
            filePath: '',
            fileName: 'shot.png',
            mime: 'image/png',
            size: 123,
            blobUrl: 'blob:some-screenshot'
          }}
        />
      );

      await waitFor(() =>
        expect(boardDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(boardDetectedAndSolve).toHaveBeenCalledWith(undefined, board);
      expect(getContextSpy).toHaveBeenCalled();

      // The natural size is reflected in the preview text.
      expect(screen.getByText('(320px, 240px)')).toBeInTheDocument();
    });

    it('reports a detection error message when the board cannot be detected', async () => {
      vi.mocked(detectBoard).mockReturnValue('Cannot detect board rect.');

      render(
        <BoardReceiver
          {...defaultProps}
          screenshotInfo={{
            filePath: '',
            fileName: 'shot.png',
            mime: 'image/png',
            size: 123,
            blobUrl: 'blob:some-other-screenshot'
          }}
        />
      );

      await waitFor(() =>
        expect(boardDetectedAndSolve).toHaveBeenCalledTimes(1)
      );
      expect(boardDetectedAndSolve).toHaveBeenCalledWith(
        'Cannot detect board rect.'
      );
    });

    it('does not run detection when there is no screenshot', () => {
      render(<BoardReceiver {...defaultProps} />);
      expect(detectBoard).not.toHaveBeenCalled();
      expect(boardDetectedAndSolve).not.toHaveBeenCalled();
    });
  });
});
