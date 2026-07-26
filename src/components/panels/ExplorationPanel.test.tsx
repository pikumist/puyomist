import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { boardSignatureOf } from '@/logics/paint-search';
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

  it('shows an indeterminate progress bar while solving with no progress yet', () => {
    usePuyoAppStore.setState({ solving: true, solvingProgressPercent: 0 });
    const { container } = render(<ExplorationPanel />);
    const bar = container.querySelector(
      '[data-slot="progress"]'
    ) as HTMLElement;
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar.style.visibility).toBe('visible');
  });

  it('shows the numeric progress and the estimated marker while solving', () => {
    const result = {
      explorationTarget: INITIAL_PUYO_APP_STATE.explorationTarget,
      elapsedTime: 100,
      candidates_num: 10,
      optimal_solutions: []
    };
    usePuyoAppStore.setState({
      solving: true,
      solvingProgressPercent: 42,
      solveResult: result
    });
    const { container } = render(<ExplorationPanel />);
    const bar = container.querySelector(
      '[data-slot="progress"]'
    ) as HTMLElement;
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('(推定)')).toBeInTheDocument();
  });

  it('offers the Rust backend option on localhost (jsdom default hostname)', () => {
    render(<ExplorationPanel />);
    fireEvent.click(screen.getByLabelText('探索法の選択'));
    expect(
      screen.getByRole('option', { name: '全探索Rustバックエンド' })
    ).toBeInTheDocument();
  });

  it('selects the Rust backend method from the select', () => {
    render(<ExplorationPanel />);
    fireEvent.click(screen.getByLabelText('探索法の選択'));
    const option = screen.getByRole('option', {
      name: '全探索Rustバックエンド'
    });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    expect(usePuyoAppStore.getState().solutionMethod).toBe(
      'solveAllByRustBackend'
    );
  });
});

describe('ExplorationPanel — ぷよ塗り探索', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('hides the paint search while a JS method is selected', () => {
    usePuyoAppStore.setState({ solutionMethod: 'solveAllInParallel' as never });
    render(<ExplorationPanel />);
    expect(
      screen.queryByRole('button', { name: '塗探索' })
    ).not.toBeInTheDocument();
  });

  it('offers the paint search on the wasm method', () => {
    usePuyoAppStore.setState({
      solutionMethod: 'solveAllInParallelByWasm' as never
    });
    render(<ExplorationPanel />);
    expect(screen.getByRole('button', { name: '塗探索' })).toBeInTheDocument();
  });

  it('opens the paint search dialog', () => {
    usePuyoAppStore.setState({
      solutionMethod: 'solveAllInParallelByWasm' as never
    });
    render(<ExplorationPanel />);
    fireEvent.click(screen.getByRole('button', { name: '塗探索' }));
    expect(screen.getByText('ぷよ塗り探索')).toBeInTheDocument();
  });

  it('offers the undo only after a paint has been applied', () => {
    const { rerender } = render(<ExplorationPanel />);
    expect(
      screen.queryByRole('button', { name: '塗りを元に戻す' })
    ).not.toBeInTheDocument();

    const state = usePuyoAppStore.getState();
    usePuyoAppStore.setState({
      paintUndo: {
        board: { field: [[]], nextPuyos: [] },
        boardSignature: boardSignatureOf(state.simulationData)
      }
    });
    rerender(<ExplorationPanel />);
    fireEvent.click(screen.getByRole('button', { name: '塗りを元に戻す' }));
    expect(usePuyoAppStore.getState().paintUndo).toBeUndefined();
  });

  it('hides the undo once the board has moved on since the paint', () => {
    usePuyoAppStore.setState({
      paintUndo: {
        board: { field: [[]], nextPuyos: [] },
        boardSignature: 'from-another-board'
      }
    });
    render(<ExplorationPanel />);
    expect(
      screen.queryByRole('button', { name: '塗りを元に戻す' })
    ).not.toBeInTheDocument();
  });
});

describe('ExplorationPanel — Rustバックエンド (localhost限定表示)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('hides the Rust backend option off localhost', async () => {
    vi.stubGlobal('location', { ...window.location, hostname: 'example.com' });
    vi.resetModules();
    const { default: PanelOffLocalhost } = await import('./ExplorationPanel');
    const { usePuyoAppStore: freshStore } = await import(
      '@/store/puyoAppStore'
    );
    const { INITIAL_PUYO_APP_STATE: freshInitial } = await import(
      '@/store/types'
    );
    freshStore.setState(structuredClone(freshInitial));

    render(<PanelOffLocalhost />);
    fireEvent.click(screen.getByLabelText('探索法の選択'));
    expect(
      screen.queryByRole('option', { name: '全探索Rustバックエンド' })
    ).not.toBeInTheDocument();
  });
});
