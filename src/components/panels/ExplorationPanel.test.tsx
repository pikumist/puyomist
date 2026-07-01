import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import ExplorationPanel from './ExplorationPanel';

describe('ExplorationPanel', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('increments the optimal solution count in the store', () => {
    render(<ExplorationPanel />);
    const before =
      usePuyoAppStore.getState().explorationTarget.optimal_solution_count;
    fireEvent.click(screen.getByLabelText('最適解の数を増やす'));
    expect(
      usePuyoAppStore.getState().explorationTarget.optimal_solution_count
    ).toBe(before + 1);
  });

  it('renders the solve action', () => {
    render(<ExplorationPanel />);
    expect(screen.getByLabelText('最適解を探索')).toBeInTheDocument();
  });

  it('changes the max trace num in the store', () => {
    render(<ExplorationPanel />);
    const before = usePuyoAppStore.getState().simulationData.maxTraceNum;
    fireEvent.click(screen.getByLabelText('最大なぞり数を増やす'));
    expect(usePuyoAppStore.getState().simulationData.maxTraceNum).toBe(
      before + 1
    );
  });

  it('changes the solution method from the select', () => {
    render(<ExplorationPanel />);
    fireEvent.click(screen.getByLabelText('探索法の選択'));
    const option = screen.getByRole('option', { name: '全探索マルチWASM' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    expect(usePuyoAppStore.getState().solutionMethod).toBe(
      'solveAllInParallelByWasm'
    );
  });
});
