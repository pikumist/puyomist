import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PuyoCoord } from '../../logics/PuyoCoord';
import { PuyoType } from '../../logics/PuyoType';
import { createSimulationData } from '../internal/createSimulationData';
import { usePuyoAppStore } from '../puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '../types';
import { doChainAnimation, tracingFinished } from './chainAnimation';

const getState = () => usePuyoAppStore.getState();

/** 全面赤の盤面で、左下4個をなぞった状態のシミュレーションデータ */
const makeTracedRedSimulationData = () => {
  const field: PuyoType[][] = [...new Array(PuyoCoord.YNum)].map(() =>
    [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Red)
  );
  const nextPuyos: PuyoType[] = [...new Array(PuyoCoord.XNum)].map(
    () => PuyoType.Red
  );
  const traceCoords = [
    PuyoCoord.xyToCoord(0, 0)!,
    PuyoCoord.xyToCoord(1, 0)!,
    PuyoCoord.xyToCoord(2, 0)!,
    PuyoCoord.xyToCoord(3, 0)!
  ];
  return createSimulationData({ field, nextPuyos }, { traceCoords });
};

beforeEach(() => {
  usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  vi.useRealTimers();
});

describe('tracingFinished', () => {
  it('runs the simulator and populates animation steps', () => {
    usePuyoAppStore.setState({
      simulationData: makeTracedRedSimulationData(),
      animationDuration: 0
    });
    tracingFinished();
    expect(getState().animationSteps.length).toBeGreaterThan(0);
  });
});

describe('doChainAnimation', () => {
  it('steps through every animation frame and ends', async () => {
    usePuyoAppStore.setState({
      simulationData: makeTracedRedSimulationData(),
      animationDuration: 10
    });
    // prime animationSteps via the simulator
    tracingFinished();
    const steps = getState().animationSteps;
    expect(steps.length).toBeGreaterThan(0);

    vi.useFakeTimers();
    const promise = doChainAnimation();
    await vi.runAllTimersAsync();
    await promise;
    vi.useRealTimers();

    expect(getState().animating).toBe(false);
    expect(getState().activeAnimationStepIndex).toBe(steps.length - 1);
  });
});
