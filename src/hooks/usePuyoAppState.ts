import { useSelector } from 'react-redux';
import type { RootState } from '../reducers/store';

export const usePuyoAppState = () =>
  useSelector<RootState, RootState['puyoApp']>((state) => state.puyoApp);
