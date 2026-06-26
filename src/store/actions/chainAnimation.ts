import { cloneSimulationData } from '../../logics/SimulationData';
import { Simulator } from '../../logics/Simulator';
import { sleep } from '../../logics/generics/sleep';
import { usePuyoAppStore } from '../puyoAppStore';

/** 連鎖アニメーションを実行する */
export const doChainAnimation = async (): Promise<void> => {
  usePuyoAppStore.getState().chainAnimationStarted();

  const getAnimationDuration = () =>
    usePuyoAppStore.getState().animationDuration;
  const animationSteps = usePuyoAppStore.getState().animationSteps;

  for (let i = 0; i < animationSteps.length; i++) {
    if (i !== 0) {
      await sleep(getAnimationDuration());
    }
    usePuyoAppStore.getState().chainAnimationStep(i);
  }

  usePuyoAppStore.getState().chainAnimationEnded();
};

/** なぞりが完了したとき */
export const tracingFinished = (): void => {
  usePuyoAppStore.getState().chainStarted();

  const state = usePuyoAppStore.getState();
  const simulator = new Simulator(cloneSimulationData(state.simulationData));

  const animationSteps = simulator.doChains(true)!;

  usePuyoAppStore.getState().chainEnded(animationSteps);

  doChainAnimation();
};
