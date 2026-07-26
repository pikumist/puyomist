import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PuyoAttr } from '@/logics/PuyoAttr';
import { PuyoCoord } from '@/logics/PuyoCoord';
import { PuyoType } from '@/logics/PuyoType';
import { SolutionMethod } from '@/logics/solution';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import PaintSearchDialog from './PaintSearchDialog';

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

    // 色そのものが選択肢なので、選択状態は chip 全体のスタイル
    // (`has-data-checked:`) で示している。その足場となる data-checked が
    // 選んだ色にだけ立っていることを確かめる。
    const checked = screen
      .getAllByRole('radio')
      .filter((radio) => radio.querySelector('[data-checked]'));
    expect(checked).toHaveLength(1);
    expect(checked[0].closest('label')).toHaveTextContent('緑');
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

  it('cannot apply the "no paint" plan', async () => {
    renderDialog();
    await search();

    const buttons = screen.getAllByRole('button', { name: '適用' });
    expect(buttons.at(-1)).toBeDisabled();
  });
});
