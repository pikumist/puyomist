import type { RootState } from '../reducers/store';

export const selectAppState = (state: RootState) => state.puyoApp;
