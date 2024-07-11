import ReactDOM from 'react-dom/client';
import PuyoApp from './components/PuyoApp.tsx';
import './main.css';
import { StrictMode } from 'react';
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
  session.setMaxTraceNum(puyoApp.simulationData.maxTraceNum);
  session.setPoppingLeverage(puyoApp.simulationData.poppingLeverage);
  session.setAnimationDuration(puyoApp.simulationData.animationDuration);
  session.setExplorationTarget(puyoApp.explorationTarget);
  session.setSolutionMethod(puyoApp.solutionMethod);
  session.setLastScreenshotBoard(puyoApp.lastScreenshotBoard);
  session.setBoostAreaKeyList(puyoApp.boostAreaKeyList);
  session.setBoardEditMode(puyoApp.boardEditMode);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <PuyoApp />
    </Provider>
  </StrictMode>
);
