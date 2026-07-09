// src/components/notebook/NotebookShell.jsx
//
// Notebook Shell — Scrollable Cell List
// -----------------------------------------------------------------------
// Top-level notebook container. Maps over cellOrder from the store and
// renders one <Cell> per entry, stacked vertically, scrollable. Includes
// the "+ Add Cell" affordance at the bottom, matching real notebook UX
// (Jupyter/VS Code both put "add cell" controls below the last cell).
//
// AnimatePresence wraps the cell list so that adding/removing a cell
// animates smoothly (new cells slide in, deleted cells collapse out)
// rather than popping — consistent with the "no instant snapping"
// morphing requirement from the original spec, now applied to the
// notebook structure itself rather than just the matrix math.
//
// Design constraints applied:
// - Calm, minimal background (bg-slate-950, no ambient glow wash —
//   that decorative touch belonged to the old bento hero page; a
//   notebook should read as a working document, not a landing page).
// - Fixed max-width, centered — mirrors how VS Code/Jupyter constrain
//   line length for readability rather than stretching edge-to-edge.

import { AnimatePresence, motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { Cell } from "./Cell";

export function NotebookShell() {
  const cellOrder = useQuantumStore((s) => s.cellOrder);
  const addCell = useQuantumStore((s) => s.addCell);

  const canDelete = cellOrder.length > 1;

  return (
    <div className="min-h-screen w-full bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        {/* --- Notebook title/header --- */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-mono text-sm font-medium tracking-wide text-slate-400">
            quantum-scratchpad
          </h1>
          <span className="font-mono text-xs text-slate-600">
            {cellOrder.length} {cellOrder.length === 1 ? "cell" : "cells"}
          </span>
        </div>

        {/* --- Cell list --- */}
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {cellOrder.map((cellId, index) => (
              <Cell
                key={cellId}
                cellId={cellId}
                cellNumber={index + 1}
                canDelete={canDelete}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* --- Add Cell affordance --- */}
        <motion.button
          onClick={addCell}
          whileTap={{ scale: 0.98 }}
          className="
            mt-3 flex w-full items-center justify-center gap-2 rounded-xl
            border border-dashed border-slate-800 py-3
            font-mono text-xs text-slate-600
            transition-colors duration-150
            hover:border-slate-700 hover:bg-slate-900/40 hover:text-slate-400
          "
        >
          <IconPlus />
          Add Cell
        </motion.button>
      </div>
    </div>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}