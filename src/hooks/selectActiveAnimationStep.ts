import type { RootState } from '../reducers/store';

/** ステートからアクティブなアニメーションステップを選択する */
export const selectActiveAnimationStep = (state: RootState['puyoApp']) => {
  const { animationSteps, activeAnimationStepIndex } = state;

  if (
    animationSteps.length > 0 &&
    activeAnimationStepIndex >= 0 &&
    activeAnimationStepIndex <= animationSteps.length - 1
  ) {
    return animationSteps[activeAnimationStepIndex];
  }
};
