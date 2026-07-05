import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';

import '../app/globals.css';

import Providers from '../app/Providers';
import LabelerApp from './LabelerApp';

// Local-dev-only entry for the puyoquess labeling UI. Deliberately does not
// touch `logics/session` / `store/loadPuyoAppState` (that's browser-storage
// persistence for the public app) — the labeler always starts from the
// store's plain default state and loads a board explicitly per item.

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <Providers>
      <LabelerApp />
    </Providers>
  </StrictMode>
);
