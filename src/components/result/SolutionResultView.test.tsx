import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ExplorationTarget } from '@/logics/ExplorationTarget';
import { PuyoCoord } from '@/logics/PuyoCoord';
import type { SolutionResult, SolveResult } from '@/logics/solution';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import SolutionResultView from './SolutionResultView';

const makeSolution = (value: number): SolutionResult => ({
  trace_coords: [PuyoCoord.xyToCoord(0, 0)!, PuyoCoord.xyToCoord(1, 0)!],
  chains: [],
  value,
  popped_chance_num: 0,
  popped_heart_num: 0,
  popped_prism_num: 0,
  popped_ojama_num: 0,
  popped_kata_num: 0,
  is_all_cleared: false
});

const makeResult = (
  target: ExplorationTarget = INITIAL_PUYO_APP_STATE.explorationTarget
): SolveResult => ({
  explorationTarget: target,
  elapsedTime: 1234,
  candidates_num: 42,
  optimal_solutions: [makeSolution(100), makeSolution(50)]
});

describe('SolutionResultView', () => {
  it('renders nothing without a result', () => {
    const { container } = render(
      <SolutionResultView result={undefined} index={0} isInProgress={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders target, candidates and per-attribute damage', () => {
    render(
      <SolutionResultView result={makeResult()} index={0} isInProgress={false} />
    );
    expect(screen.getByText(/候補数/)).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByLabelText('解の選択')).toBeInTheDocument();
  });

  it('shows in-progress markers while solving', () => {
    render(
      <SolutionResultView result={makeResult()} index={0} isInProgress />
    );
    expect(screen.getByText('(推定)')).toBeInTheDocument();
  });
});
