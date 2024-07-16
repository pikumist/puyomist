import type { RootState } from '../reducers/store';
import { selectActiveAnimationStep } from './selectActiveAnimationStep';

/** ステートからアクティブなフィールドとネクストぷよを選択する */
export const selectActiveFieldAndNextPuyos = (state: RootState['puyoApp']) => {
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
