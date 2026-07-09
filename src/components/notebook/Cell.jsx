// src/components/notebook/Cell.jsx
//
// Notebook Cell — Composite Card
// -----------------------------------------------------------------------
// Wraps ONE cell's editor + visualizer + playback controls + probability
// panel into a single, self-contained Jupyter-style card. This is the
// unit that NotebookShell.jsx stacks vertically and scrolls through.
//
// Design direction (per your "Jupyter/VS Code notebook" choice):
// - Minimal chrome: thin border, no heavy glass/blur (that was the old
//   bento aesthetic — a notebook cell should feel more like a clean
//   code editor row, not a floating glass panel).
// - Glow reserved ONLY for the active/focused cell — an idle cell
//   sitting further down the page should look calm and quiet.
// - Compact per-cell playback + probability strip BELOW the visualizer,
//   not in separate bento boxes — this is what "self-contained like a
//   real notebook cell" means structurally.
//
// Layout inside one cell:
//   +--------------------------------------------------+
//   | [cell number]                      [delete icon]  |  <- header row
//   +--------------------------------------------------+
//   | CodeEditor (compact, auto-height textarea)        |
//   +--------------------------------------------------+
//   | MatrixStepper (visualizer output)                 |
//   +--------------------------------------------------+
//   | PlaybackControls | ProbabilityPanel (side by side)|
//   +--------------------------------------------------+

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { CodeEditor } from "../editor/CodeEditor";
import { MatrixStepper } from "../visualizer/MatrixStepper";
import { PlaybackControls } from "../controls/PlaybackControls";
import { ProbabilityPanel } from "../controls/ProbabilityPanel";

/**
 * @param {object} props
 * @param {string} props.cellId - which cell in the store this card renders
 * @param {number} props.cellNumber - 1-indexed display position (In [1]:, In [2]:, etc.)
 * @param {boolean} props.canDelete - whether the delete button should be active
 *        (false when this is the only remaining cell in the notebook)
 */
export function Cell({ cellId, cellNumber, canDelete }) {
  const removeCell = useQuantumStore((s) => s.removeCell);
  const hasFrames = useQuantumStore((s) => (s.cells[cellId]?.stepper.frames.length ?? 0) > 0);
  const hasError = useQuantumStore((s) => !!s.cells[cellId]?.evaluation.error);

  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, height: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        // Only unfocus if focus is actually leaving the whole card,
        // not just moving between two elements inside it.
        if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false);
      }}
      className={`
        group relative rounded-xl border bg-slate-900/60
        transition-colors duration-200
        ${isFocused ? "border-cyan-400/40" : "border-slate-800/50"}
      `}
    >
      {/* --- Header row: cell number + delete --- */}
      <div className="flex items-center justify-between border-b border-slate-800/50 px-4 py-2">
        <span className="font-mono text-xs text-slate-500">
          In [{cellNumber}]
          {hasError && <span className="ml-2 text-red-400/70">error</span>}
        </span>

        <button
          onClick={() => removeCell(cellId)}
          disabled={!canDelete}
          aria-label="Delete cell"
          className="
            rounded-md p-1 text-slate-600 opacity-0 transition-opacity
            hover:bg-slate-800/60 hover:text-slate-300
            disabled:pointer-events-none disabled:opacity-0
            group-hover:opacity-100
          "
        >
          <IconTrash />
        </button>
      </div>

      {/* --- Editor --- */}
      <div className="px-4 pt-3">
        <CodeEditor cellId={cellId} />
      </div>

      {/* --- Visualizer (only takes vertical space once there's something
            to show — an untouched cell shouldn't have a huge empty box) --- */}
      <div className={`px-4 ${hasFrames ? "min-h-[220px]" : ""}`}>
        <MatrixStepper cellId={cellId} />
      </div>

      {/* --- Compact controls strip: playback + probability side by side --- */}
      <div className="grid grid-cols-2 gap-3 border-t border-slate-800/50 px-4 py-3">
        <PlaybackControls cellId={cellId} />
        <ProbabilityPanel cellId={cellId} />
      </div>
    </motion.div>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
    </svg>
  );
}