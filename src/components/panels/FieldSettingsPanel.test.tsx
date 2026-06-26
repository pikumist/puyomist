import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

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
});
