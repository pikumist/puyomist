import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PuyoAttr } from '@/logics/PuyoAttr';
import { PuyoCoord } from '@/logics/PuyoCoord';
import { PuyoType } from '@/logics/PuyoType';
import {
  type PaintSearchResult,
  enumeratePaintableCoords,
  paintSearchSignatureOf
} from '@/logics/paint-search';
import { SolutionMethod } from '@/logics/solution';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import PaintSearchDialog from './PaintSearchDialog';

// 実際の探索は WASM ワーカーを起こすので、ここでは差し替えてダイアログの振る舞い
// だけを見る。探索そのものの担保は Rust 側 (split_evaluation_matches_sequential_search)。
vi.mock('@/store/actions', () => ({
  paintSearchButtonClicked: () => {
    const state = usePuyoAppStore.getState();
    state.paintSearchStarted();
    state.paintSearched(fakeResult());
  }
}));

/** 塗り案3件と「塗らない」1件を持つ、今の状態に対して有効な結果 */
const fakeResult = (): PaintSearchResult => {
  const state = usePuyoAppStore.getState();
  const { color, showExpectedValue } = state.paintSearchSettings;
  const candidates = enumeratePaintableCoords(state.simulationData, color);
  const solution = {
    trace_coords: [],
    chains: [],
    value: 0,
    popped_chance_num: 0,
    popped_heart_num: 0,
    popped_prism_num: 0,
    popped_ojama_num: 0,
    popped_kata_num: 0,
    is_all_cleared: false
  };

  const plans = [0, 1, 2].map((i) => ({
    coords: candidates.slice(i, i + 2),
    value: 240 - i * 6,
    expectedValue: showExpectedValue ? 280 - i * 6 : undefined,
    solution: { ...solution, value: 240 - i * 6 }
  }));
  plans.push({
    coords: [],
    value: 96,
    expectedValue: showExpectedValue ? 118 : undefined,
    solution: { ...solution, value: 96 }
  });

  return {
    plans,
    elapsedTime: 1000,
    signature: paintSearchSignatureOf(
      state.simulationData,
      state.explorationTarget,
      state.paintSearchSettings
    )
  };
};

/** 塗り候補が十分ある盤面 (全マス青) を仕込む */
const setBlueField = () => {
  let id = 1;
  usePuyoAppStore.setState((s) => ({
    lastScreenshotBoard: {
      field: [...new Array(PuyoCoord.YNum)].map(() =>
        [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Blue)
      ),
      nextPuyos: [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Blue)
    },
    simulationData: {
      ...s.simulationData,
      field: [...new Array(PuyoCoord.YNum)].map(() =>
        [...new Array(PuyoCoord.XNum)].map(() => ({
          id: id++,
          type: PuyoType.Blue
        }))
      )
    }
  }));
};

const renderDialog = (onOpenChange = vi.fn()) => {
  render(<PaintSearchDialog open onOpenChange={onOpenChange} />);
  return onOpenChange;
};

/** 探索ボタンを押して結果が出るまで待つ */
const search = async () => {
  fireEvent.click(screen.getByRole('button', { name: '塗り探索' }));
  await waitFor(() =>
    expect(usePuyoAppStore.getState().paintSearchResult).toBeDefined()
  );
};

describe('PaintSearchDialog', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
    setBlueField();
  });

  it('changes the paint colour in the store', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('radio', { name: '緑' }));
    expect(usePuyoAppStore.getState().paintSearchSettings.color).toBe(
      PuyoAttr.Green
    );
  });

  it('changes the paint limit in the store', () => {
    renderDialog();
    const before = usePuyoAppStore.getState().paintSearchSettings.maxPaintNum;
    fireEvent.click(screen.getByLabelText('塗り上限を増やす'));
    expect(usePuyoAppStore.getState().paintSearchSettings.maxPaintNum).toBe(
      before + 1
    );
  });

  it('toggles the expected value column', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText('期待値も表示'));
    expect(
      usePuyoAppStore.getState().paintSearchSettings.showExpectedValue
    ).toBe(true);
  });

  it('hides the ultra precision unless the rust backend is selected', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText('探索精度の選択'));
    expect(screen.queryByRole('option', { name: '超高精度' })).toBeNull();
  });

  it('offers the ultra precision on the rust backend', () => {
    usePuyoAppStore.setState({
      solutionMethod: SolutionMethod.solveAllByRustBackend
    });
    renderDialog();
    fireEvent.click(screen.getByLabelText('探索精度の選択'));
    expect(
      screen.getByRole('option', { name: '超高精度' })
    ).toBeInTheDocument();
  });

  it('marks only the selected colour chip as checked', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('radio', { name: '緑' }));

    // 色そのものが選択肢なので、選択状態はチップ全体のスタイル
    // (`data-checked:` と `group-data-checked/chip:`) で示している。
    // その足場となる data-checked が選んだ色にだけ立っていることを確かめる。
    const checked = screen
      .getAllByRole('radio')
      .filter((radio) => radio.hasAttribute('data-checked'));
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveTextContent('緑');
  });

  it('changes the precision in the store', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText('探索精度の選択'));
    const option = screen.getByRole('option', { name: '高精度' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    expect(usePuyoAppStore.getState().paintSearchSettings.precision).toBe(
      'high'
    );
  });

  it('highlights the plan cells while a row has the focus', async () => {
    renderDialog();
    await search();

    const row = (await screen.findAllByRole('listitem'))[0]
      .firstElementChild as HTMLElement;
    fireEvent.focus(row);
    expect(usePuyoAppStore.getState().paintHighlightCoords).toEqual(
      usePuyoAppStore.getState().paintSearchResult!.plans[0].coords
    );

    fireEvent.blur(row);
    expect(usePuyoAppStore.getState().paintHighlightCoords).toBeUndefined();
  });

  it('lists the plans once the search finishes', async () => {
    renderDialog();
    await search();

    const plans = usePuyoAppStore.getState().paintSearchResult!.plans;
    expect(await screen.findByText('塗らない')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '適用' })).toHaveLength(
      plans.length
    );
  });

  it('highlights the plan cells on hover and clears them on leave', async () => {
    renderDialog();
    await search();

    const row = (await screen.findAllByRole('listitem'))[0];
    fireEvent.mouseEnter(row.firstElementChild!);
    const plan = usePuyoAppStore.getState().paintSearchResult!.plans[0];
    expect(usePuyoAppStore.getState().paintHighlightCoords).toEqual(
      plan.coords
    );

    fireEvent.mouseLeave(row.firstElementChild!);
    expect(usePuyoAppStore.getState().paintHighlightCoords).toBeUndefined();
  });

  it('applies the plan to the board and closes the dialog', async () => {
    const onOpenChange = renderDialog();
    await search();

    const plan = usePuyoAppStore.getState().paintSearchResult!.plans[0];
    fireEvent.click(screen.getAllByRole('button', { name: '適用' })[0]);

    const state = usePuyoAppStore.getState();
    for (const coord of plan.coords) {
      expect(state.simulationData.field[coord.y][coord.x]!.type).toBe(
        PuyoType.Red
      );
    }
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('drops the plans once the board changes underneath them', async () => {
    renderDialog();
    await search();
    expect(
      screen.getAllByRole('button', { name: '適用' }).length
    ).toBeGreaterThan(0);

    // 結果を出したあとに盤面を編集した ＝ その結果はもう別の盤面の答え
    usePuyoAppStore.setState((s) => ({
      simulationData: {
        ...s.simulationData,
        field: s.simulationData.field.map((row, y) =>
          row.map((puyo, x) =>
            y === 0 && x === 0 ? { id: puyo!.id, type: PuyoType.Green } : puyo
          )
        )
      }
    }));

    expect(
      await screen.findByText('塗り探索', { selector: 'button' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '適用' })).toBeNull();
  });

  it('clears the highlight when the dialog closes', async () => {
    const onOpenChange = renderDialog();
    await search();

    const row = (await screen.findAllByRole('listitem'))[0];
    fireEvent.mouseEnter(row.firstElementChild!);
    expect(usePuyoAppStore.getState().paintHighlightCoords).toBeDefined();

    // 右上の×と、フッターの Close の2つある。どちらでも閉じる
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(usePuyoAppStore.getState().paintHighlightCoords).toBeUndefined();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the expected value column when it is turned on', async () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText('期待値も表示'));
    await search();

    const plan = usePuyoAppStore.getState().paintSearchResult!.plans[0];
    expect(
      await screen.findByText(`期待値 ${plan.expectedValue}`)
    ).toBeInTheDocument();
  });

  it('offers a cancel button while searching, and aborts with it', () => {
    const controller = new AbortController();
    usePuyoAppStore.setState({
      paintSearching: true,
      paintSearchProgressPercent: 30,
      abortControllerForPaintSearch: controller
    });
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: '中断' }));

    expect(controller.signal.aborted).toBe(true);
  });

  it('hides the cancel button when no search is running', () => {
    renderDialog();
    expect(screen.queryByRole('button', { name: '中断' })).toBeNull();
  });

  it('cannot apply the "no paint" plan', async () => {
    renderDialog();
    await search();

    const buttons = screen.getAllByRole('button', { name: '適用' });
    expect(buttons.at(-1)).toBeDisabled();
  });
});
