import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PuyoType } from '@/logics/PuyoType';
import { TraceMode } from '@/logics/TraceMode';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import FieldSettingsPanel from './FieldSettingsPanel';

describe('FieldSettingsPanel', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('increments maxTraceNum in the store', () => {
    render(<FieldSettingsPanel />);
    const before = usePuyoAppStore.getState().simulationData.maxTraceNum;
    fireEvent.click(screen.getByLabelText('最大なぞり数を増やす'));
    expect(usePuyoAppStore.getState().simulationData.maxTraceNum).toBe(
      before + 1
    );
  });

  it('opens the trace-mode select with options', () => {
    render(<FieldSettingsPanel />);
    fireEvent.click(screen.getByLabelText('なぞりモードの選択'));
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
  });

  it('changes the trace mode from the select', () => {
    render(<FieldSettingsPanel />);
    fireEvent.click(screen.getByLabelText('なぞりモードの選択'));
    const option = screen.getByRole('option', { name: '赤ぷよに変える' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    expect(usePuyoAppStore.getState().simulationData.traceMode).toBe(1);
  });

  it('decrements the minimum popping puyo number', () => {
    render(<FieldSettingsPanel />);
    const before =
      usePuyoAppStore.getState().simulationData.minimumPuyoNumForPopping;
    fireEvent.click(screen.getByLabelText('ひっつき最小数を減らす'));
    expect(
      usePuyoAppStore.getState().simulationData.minimumPuyoNumForPopping
    ).toBe(before - 1);
  });

  it('updates popping / chain leverage and animation duration', () => {
    render(<FieldSettingsPanel />);
    const sim = () => usePuyoAppStore.getState().simulationData;

    const popBefore = sim().poppingLeverage;
    fireEvent.click(screen.getByLabelText('同時消し倍率を増やす'));
    expect(sim().poppingLeverage).toBeGreaterThan(popBefore);

    const chainBefore = sim().chainLeverage;
    fireEvent.click(screen.getByLabelText('連鎖倍率を増やす'));
    expect(sim().chainLeverage).toBeGreaterThan(chainBefore);

    const durBefore = usePuyoAppStore.getState().animationDuration;
    fireEvent.click(screen.getByLabelText('コマ間隔を増やす'));
    expect(usePuyoAppStore.getState().animationDuration).toBeGreaterThan(
      durBefore
    );
  });

  it('toggles the dead cell marks in the store', () => {
    render(<FieldSettingsPanel />);
    fireEvent.click(screen.getByLabelText('ひっつかないぷよに印を付ける'));
    expect(usePuyoAppStore.getState().showDeadCells).toBe(true);
  });

  it('disables the dead cell toggle in the paint trace modes', () => {
    usePuyoAppStore.setState((state) => ({
      simulationData: { ...state.simulationData, traceMode: TraceMode.ToRed }
    }));
    render(<FieldSettingsPanel />);
    expect(
      screen.getByLabelText('ひっつかないぷよに印を付ける')
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables the dead cell toggle on a board with unknown puyos', () => {
    usePuyoAppStore.setState((state) => ({
      simulationData: {
        ...state.simulationData,
        field: state.simulationData.field.map((row, y) =>
          row.map((puyo, x) =>
            y === 0 && x === 0 ? { id: 1, type: PuyoType.Question } : puyo
          )
        )
      }
    }));
    render(<FieldSettingsPanel />);
    expect(
      screen.getByLabelText('ひっつかないぷよに印を付ける')
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the toggle as off while it cannot be judged, even if it was on', () => {
    usePuyoAppStore.setState((state) => ({
      showDeadCells: true,
      simulationData: { ...state.simulationData, traceMode: TraceMode.ToRed }
    }));
    render(<FieldSettingsPanel />);
    expect(
      screen.getByLabelText('ひっつかないぷよに印を付ける')
    ).toHaveAttribute('aria-checked', 'false');
  });
});
