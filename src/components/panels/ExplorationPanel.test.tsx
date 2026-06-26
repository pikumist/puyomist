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
});
