// src/components/layout/SplitShell.jsx
//
// Split Shell — Fixed Two-Column Layout
// -----------------------------------------------------------------------
// Top-level layout for the main app (post-intro). Implements the
// "Jupyter notebook on the left, sticky video-player visualizer on the
// right" structure you specified.
//
// Layout mechanics:
// - Outer container: h-screen, flex-row, overflow hidden (prevents the
//   whole PAGE from scrolling — only the left column scrolls internally).
// - Left column (NotebookColumn): flex-1, its OWN overflow-y-auto, so
//   it scrolls independently while the right column stays put. This is
//   the actual mechanism behind "sticky while left scrolls" — it's not
//   CSS position:sticky (which only sticks within a scrolling ancestor
//   and would still let the WHOLE page including the right column
//   scroll away) — it's a genuine split-viewport layout where each
//   column manages its own scroll region independently.
// - Right column (VisualizerPanel): fixed width, NEVER scrolls itself
//   (VisualizerPanel's own internal content should fit or use its own
//   internal scroll if ever needed, but by default this column's
//   height is pinned to the viewport).
//
// Responsive note: below the lg breakpoint, side-by-side stops making
// sense (right column would get too cramped). We stack vertically on
// small screens — notebook on top (scrollable), visualizer panel below
// as a normal-flow block (not fixed-height) so mobile users still see
// everything, just not in the "video player beside playlist" layout.

import { NotebookColumn } from "../notebook/NotebookColumn";
import { VisualizerPanel } from "../visualizer/VisualizerPanel";

export function SplitShell() {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden lg:flex-row">
      {/* --- Left column: scrollable notebook --- */}
      <div className="order-2 flex-1 overflow-y-auto lg:order-1 lg:h-screen">
        <NotebookColumn />
      </div>

      {/* --- Right column: sticky visualizer "video player" --- */}
      <div
        className="
          order-1 w-full shrink-0 border-b border-slate-200/70
          lg:order-2 lg:h-screen lg:w-[46%] lg:border-b-0 lg:border-l
          lg:max-w-[720px]
        "
      >
        <VisualizerPanel />
      </div>
    </div>
  );
}