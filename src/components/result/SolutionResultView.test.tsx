import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Board } from '@/logics/Board';
import type { ExplorationTarget } from '@/logics/ExplorationTarget';
import { PuyoCoord } from '@/logics/PuyoCoord';
import { PuyoType } from '@/logics/PuyoType';
import { customBoardId } from '@/logics/boards';
import type { SolutionResult, SolveResult } from '@/logics/solution';
import { simulateSolution } from '@/logics/solution-value';
import { createSimulationData } from '@/store/internal/createSimulationData';
import { usePuyoAppStore } from '@/store/puyoAppStore';
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

/** ハートをなぞると赤4個が落ちて消える盤面 */
const fallingRedsBoard = (): Board => {
  const field = [...new Array(PuyoCoord.YNum)].map(() => [
    ...new Array<PuyoType | undefined>(PuyoCoord.XNum)
  ]);
  field[0][0] = PuyoType.Red;
  field[1][0] = PuyoType.Red;
  field[2][0] = PuyoType.Red;
  field[3][0] = PuyoType.Red;
  field[3][1] = PuyoType.Ojama;
  field[5][1] = PuyoType.Heart;

  return { field, nextPuyos: [...new Array(PuyoCoord.XNum)] };
};

/** 盤面とその解をストアに置き、プラス付与案が出せる状態にする */
const setUpPlusAssignableState = (): SolveResult => {
  usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  usePuyoAppStore.setState({
    boardId: customBoardId,
    lastScreenshotBoard: fallingRedsBoard(),
    simulationData: createSimulationData(fallingRedsBoard(), {})
  });

  const state = usePuyoAppStore.getState();
  const result: SolveResult = {
    explorationTarget: state.explorationTarget,
    candidates_num: 1,
    elapsedTime: 1,
    optimal_solutions: [
      simulateSolution(state.simulationData, state.explorationTarget, [
        PuyoCoord.xyToCoord(1, 5)!
      ])
    ]
  };
  usePuyoAppStore.setState({ solveResult: result, optimalSolutionIndex: 0 });
  return result;
};

describe('SolutionResultView', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('renders nothing without a result', () => {
    const { container } = render(
      <SolutionResultView result={undefined} index={0} isInProgress={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders target, candidates and per-attribute damage', () => {
    render(
      <SolutionResultView
        result={makeResult()}
        index={0}
        isInProgress={false}
      />
    );
    expect(screen.getByText(/候補数/)).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByLabelText('解の選択')).toBeInTheDocument();
  });

  it('shows in-progress markers while solving', () => {
    render(<SolutionResultView result={makeResult()} index={0} isInProgress />);
    expect(screen.getByText('(推定)')).toBeInTheDocument();
  });

  it('keeps the plus assign summary hidden until it is switched on', () => {
    const result = setUpPlusAssignableState();
    render(
      <SolutionResultView result={result} index={0} isInProgress={false} />
    );

    expect(screen.queryByRole('button', { name: '適用' })).toBeNull();

    fireEvent.click(screen.getByLabelText('プラス付与案'));
    expect(screen.getByRole('button', { name: '適用' })).toBeInTheDocument();
    // 赤4個にプラスが付き、ぷよ使いカウントが 5 (赤4+巻き込まれたおじゃま1) から 9 になる
    expect(
      screen.getByRole('button', { name: '適用' }).parentElement!.textContent
    ).toContain('5 → 9');
  });

  it('changes how many pluses the plan may use', () => {
    const result = setUpPlusAssignableState();
    render(
      <SolutionResultView result={result} index={0} isInProgress={false} />
    );
    fireEvent.click(screen.getByLabelText('プラス付与案'));
    fireEvent.click(screen.getByLabelText('プラス付与数を減らす'));

    expect(usePuyoAppStore.getState().plusAssignSettings.num).toBe(7);
  });

  it('applies the plan to the board and offers the undo', () => {
    const result = setUpPlusAssignableState();
    render(
      <SolutionResultView result={result} index={0} isInProgress={false} />
    );
    fireEvent.click(screen.getByLabelText('プラス付与案'));
    fireEvent.click(screen.getByRole('button', { name: '適用' }));

    expect(usePuyoAppStore.getState().simulationData.field[0][0]!.type).toBe(
      PuyoType.RedPlus
    );

    fireEvent.click(screen.getByRole('button', { name: '取り消し' }));
    expect(usePuyoAppStore.getState().simulationData.field[0][0]!.type).toBe(
      PuyoType.Red
    );
  });

  it('says so when no cell can take a plus', () => {
    const result = setUpPlusAssignableState();
    usePuyoAppStore.setState({ optimalSolutionIndex: -1 });
    render(
      <SolutionResultView result={result} index={0} isInProgress={false} />
    );
    fireEvent.click(screen.getByLabelText('プラス付与案'));

    expect(
      screen.getByText('プラスを付けられるマスがありません')
    ).toBeInTheDocument();
  });

  it('renders no elapsed time text when none is recorded', () => {
    const result = { ...makeResult(), elapsedTime: 0 };
    render(
      <SolutionResultView result={result} index={0} isInProgress={false} />
    );
    const row = screen.getByText(/探索時間/).closest('div')!;
    expect(row.querySelector('.num')?.textContent).toBe('');
  });
});
