import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/store/actions', () => ({
  solveButtonClicked: vi.fn(),
  playSolutionButtonClicked: vi.fn()
}));

import { playSolutionButtonClicked, solveButtonClicked } from '@/store/actions';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import SolutionMenu from './SolutionMenu';

describe('SolutionMenu', () => {
  it('shows the search action when idle', () => {
    render(<SolutionMenu solving={false} hasResult={false} />);
    expect(screen.getByLabelText('最適解を探索')).toBeInTheDocument();
  });

  it('shows the cancel action while solving', () => {
    render(<SolutionMenu solving hasResult={false} />);
    expect(screen.getByLabelText('探索をキャンセル')).toBeInTheDocument();
  });

  it('disables result actions when there is no result', () => {
    render(<SolutionMenu solving={false} hasResult={false} />);
    expect(screen.getByLabelText('探索結果クリア')).toBeDisabled();
    expect(screen.getByLabelText('解でなぞり')).toBeDisabled();
  });

  it('clears the result via the store on click', () => {
    usePuyoAppStore.setState({ solveResult: undefined, optimalSolutionIndex: 5 });
    render(<SolutionMenu solving={false} hasResult />);
    fireEvent.click(screen.getByLabelText('探索結果クリア'));
    expect(usePuyoAppStore.getState().optimalSolutionIndex).toBe(-1);
  });

  it('resets the board via the store on click', () => {
    usePuyoAppStore.setState({
      activeAnimationStepIndex: 4,
      animationSteps: [{} as never]
    });
    render(<SolutionMenu solving={false} hasResult />);
    fireEvent.click(screen.getByLabelText('盤面リセット'));
    expect(usePuyoAppStore.getState().activeAnimationStepIndex).toBe(-1);
    expect(usePuyoAppStore.getState().animationSteps).toEqual([]);
  });

  it('starts a search on click when idle', () => {
    render(<SolutionMenu solving={false} hasResult={false} />);
    fireEvent.click(screen.getByLabelText('最適解を探索'));
    expect(solveButtonClicked).toHaveBeenCalledTimes(1);
  });

  it('cancels the in-progress search on click', () => {
    const abortController = new AbortController();
    usePuyoAppStore.setState({ abortControllerForSolving: abortController });
    render(<SolutionMenu solving hasResult={false} />);
    fireEvent.click(screen.getByLabelText('探索をキャンセル'));
    expect(abortController.signal.aborted).toBe(true);
  });

  it('plays the solution via the store on click', () => {
    render(<SolutionMenu solving={false} hasResult />);
    fireEvent.click(screen.getByLabelText('解でなぞり'));
    expect(playSolutionButtonClicked).toHaveBeenCalledTimes(1);
  });
});
