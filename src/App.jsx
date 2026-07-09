// src/App.jsx
//
// App Root — NOTEBOOK EDITION
// -----------------------------------------------------------------------
// REPLACES the old BentoGrid-based wiring. The app now renders a single
// NotebookShell, which internally manages the scrollable list of
// independent, self-contained cells (editor + visualizer + playback +
// probability, all bundled per-cell inside Cell.jsx).
//
// BentoGrid.jsx is now RETIRED — it assumed a single fixed-layout page
// with one editor/one visualizer/one controls-set, which no longer
// matches the notebook architecture. It is not imported here. You can
// safely delete src/components/layout/BentoGrid.jsx (and the now-empty
// src/components/layout/ folder) — see the terminal command below.

import { NotebookShell } from "./components/notebook/NotebookShell";

function App() {
  return <NotebookShell />;
}

export default App;