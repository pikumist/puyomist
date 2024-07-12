import { ChakraProvider } from '@chakra-ui/react';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import PuyoApp from './components/PuyoApp.tsx';
import { session } from './logics/session.ts';
import { loadPuyoAppState } from './reducers/internal/loadPuyoAppState.ts';
import { hydrate } from './reducers/puyoAppSlice.ts';
import { store } from './reducers/store.ts';
import theme from './theme.ts';

store.dispatch(hydrate(loadPuyoAppState()));

store.subscribe(() => {
  // TODO: debounce する
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
      <ChakraProvider theme={theme}>
        <PuyoApp />
      </ChakraProvider>
    </Provider>
  </StrictMode>
);
