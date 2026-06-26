import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PuyoType } from '@/logics/PuyoType';
import { createSimulationData } from '@/store/internal/createSimulationData';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import ExportMenu from './ExportMenu';

const makeSimulationData = () => {
  const field: PuyoType[][] = [...new Array(6)].map(() =>
    [...new Array(8)].map(() => PuyoType.Red)
  );
  const nextPuyos: PuyoType[] = [...new Array(8)].map(() => PuyoType.Blue);
  return createSimulationData({ field, nextPuyos });
};

describe('ExportMenu', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderMenu = () =>
    render(
      <ExportMenu
        simulationData={makeSimulationData()}
        boostAreaKeyList={[]}
        explorationTarget={INITIAL_PUYO_APP_STATE.explorationTarget}
      />
    );

  it('downloads CSV / JSON / full JSON from the popover', () => {
    renderMenu();
    fireEvent.click(screen.getByLabelText('盤面を出力'));
    fireEvent.click(screen.getByText('CSV 出力'));
    fireEvent.click(screen.getByText('JSON 出力'));
    fireEvent.click(screen.getByText('JSON フル出力 (探索設定込み)'));
    expect(clickSpy).toHaveBeenCalledTimes(3);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(3);
  });
});
