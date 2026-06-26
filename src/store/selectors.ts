import type { PuyoAppState } from './types';

/** ステートからアクティブなアニメーションステップを選択する */
export const selectActiveAnimationStep = (state: PuyoAppState) => {
  const { animationSteps, activeAnimationStepIndex } = state;

  if (
    animationSteps.length > 0 &&
    activeAnimationStepIndex >= 0 &&
    activeAnimationStepIndex <= animationSteps.length - 1
  ) {
    return animationSteps[activeAnimationStepIndex];
  }
};

/** ステートからアクティブな連鎖リストを選択する */
export const selectActiveChains = (state: PuyoAppState) => {
  const step = selectActiveAnimationStep(state);
  return step?.chains;
};

/** ステートからアクティブなフィールドとネクストぷよを選択する */
export const selectActiveFieldAndNextPuyos = (state: PuyoAppState) => {
  const step = selectActiveAnimationStep(state);

  if (step) {
    return {
      field: step.field,
      nextPuyos: step.nextPuyos
    };
  }

  const { simulationData } = state;

  return {
    field: simulationData.field,
    nextPuyos: simulationData.nextPuyos
  };
};
