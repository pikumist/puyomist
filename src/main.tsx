import ReactDOM from 'react-dom/client';
import PuyoApp from './components/PuyoApp.tsx';
import './main.css';
import { Provider } from 'react-redux';
import { session } from './logics/session.ts';
import { loadPuyoAppState } from './reducers/internal/loadPuyoAppState.ts';
import { hydrate } from './reducers/puyoAppSlice.ts';
import { store } from './reducers/store.ts';

store.dispatch(hydrate(loadPuyoAppState()));

store.subscribe(() => {
  // debounce する
  const { puyoApp } = store.getState();
  session.setBoardId(puyoApp.boardId);
  session.setNextSelection(puyoApp.nextSelection);
  session.setMaxTraceNum(puyoApp.field.getMaxTraceNum());
  session.setPoppingLeverage(puyoApp.field.getPoppingLeverage());
  session.setAnimationDuration(puyoApp.field.getAnimationDuration());
  session.setOptimizationTarget(puyoApp.optimizationTarget);
  session.setSolutionMethod(puyoApp.solutionMethod);
  session.setLastScreenshotBoard(puyoApp.lastScreenshotBoard);
  session.setBoostAreaKeyList(puyoApp.boostAreaKeyList);
  session.setBoardEditMode(puyoApp.boardEditMode);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <PuyoApp />
  </Provider>
);
