import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import './app/main.css';

import App from './app/App';
import Providers from './app/Providers';
import { session } from './logics/session';
import { loadPuyoAppState } from './store/loadPuyoAppState';
import { usePuyoAppStore } from './store/puyoAppStore';

usePuyoAppStore.getState().hydrate(loadPuyoAppState());

usePuyoAppStore.subscribe((puyoApp) => {
  // TODO: debounce する
  session.setBoardId(puyoApp.boardId);
  session.setNextSelection(puyoApp.nextSelection);
  session.setMaxTraceNum(puyoApp.simulationData.maxTraceNum);
  session.setPoppingLeverage(puyoApp.simulationData.poppingLeverage);
  session.setAnimationDuration(puyoApp.animationDuration);
  session.setExplorationTarget(puyoApp.explorationTarget);
  session.setSolutionMethod(puyoApp.solutionMethod);
  session.setLastScreenshotBoard(puyoApp.lastScreenshotBoard);
  session.setBoostAreaKeyList(puyoApp.boostAreaKeyList);
  session.setBoardEditMode(puyoApp.boardEditMode);
});

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>
);
