import type { RootState } from '../reducers/store';
import { selectActiveAnimationStep } from './selectActiveAnimationStep';

/** ステートからアクティブな連鎖リストを選択する */
export const selectActiveChains = (state: RootState['puyoApp']) => {
  const step = selectActiveAnimationStep(state);
  return step?.chains ?? state.chains;
};
