import { configureStore } from '@reduxjs/toolkit';
import { PUYO_APP_SLICE_KEY, puyoAppReducer } from './puyoAppSlice';

export const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'puyoApp/hydrate',
          'puyoApp/tracingCoordAdded',
          'puyoApp/puyoEdited',
          'puyoApp/solved',
          'puyoApp/animationFrame',
          'puyoApp/animationEnd'
        ],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: [
          'puyoApp.field',
          'puyoApp.solvedResult',
          'puyoApp.chainDamages'
        ]
      }
    }),

  reducer: {
    [PUYO_APP_SLICE_KEY]: puyoAppReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
