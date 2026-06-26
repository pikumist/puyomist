import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  ExplorationCategory,
  type ExplorationTarget
} from '@/logics/ExplorationTarget';
import { PuyoCoord } from '@/logics/PuyoCoord';
import type { SolutionResult, SolveResult } from '@/logics/solution';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import OptimalSolutionSelector from './OptimalSolutionSelector';

const makeSolution = (value: number): SolutionResult => ({
  trace_coords: [PuyoCoord.xyToCoord(0, 0)!],
  chains: [],
  value,
  popped_chance_num: 0,
  popped_heart_num: 0,
  popped_prism_num: 0,
  popped_ojama_num: 0,
  popped_kata_num: 0,
  is_all_cleared: false
});

const makeResult = (category: ExplorationCategory): SolveResult => ({
  explorationTarget: {
    ...INITIAL_PUYO_APP_STATE.explorationTarget,
    category
  } as ExplorationTarget,
  elapsedTime: 0,
  candidates_num: 0,
  optimal_solutions: [makeSolution(12.345), makeSolution(6.7)]
});

describe('OptimalSolutionSelector', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('formats damage values with two decimals', () => {
    render(
      <OptimalSolutionSelector
        result={makeResult(ExplorationCategory.Damage)}
        index={0}
      />
    );
    fireEvent.click(screen.getByLabelText('解の選択'));
    expect(screen.getAllByText(/12\.35/).length).toBeGreaterThan(0);
  });

  it('formats count values without decimals', () => {
    render(
      <OptimalSolutionSelector
        result={makeResult(ExplorationCategory.PuyotsukaiCount)}
        index={0}
      />
    );
    fireEvent.click(screen.getByLabelText('解の選択'));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    // 12.345 -> "12" (no decimals) for non-damage categories
    expect(screen.getAllByText(/1: 12 \(/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/12\.35/)).not.toBeInTheDocument();
  });
});
