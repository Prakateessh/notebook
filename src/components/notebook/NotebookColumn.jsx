// src/components/notebook/NotebookColumn.jsx
//
// Notebook Column — Left Column Wrapper (REPLACES NotebookShell.jsx)
// -----------------------------------------------------------------------
// This is the left-hand scrollable column rendered inside SplitShell.jsx.
// Structurally almost identical to the old NotebookShell.jsx, but:
//
//   1. No longer sets its own bg-slate-950/light-canvas background —
//      AmbientBackground.jsx now owns the app's global background,
//      and this column sits transparently on top of it (so the
//      gradient mesh/grain is visible behind the notebook column too,
//      not just behind the visualizer panel).
//   2. No longer assumes it owns the full viewport height itself —
//      SplitShell.jsx's parent div handles the height/scroll region;
//      this component just needs to render its content normally.
//   3. Renamed from NotebookShell -> NotebookColumn to reflect its new
//      role as ONE column of a two-column layout, not the entire app shell.
//
// You can safely delete the old src/components/notebook/NotebookShell.jsx
// file now — nothing imports it anymore once App.jsx is updated (final
// file in this pass).

import { AnimatePresence, motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { Cell } from "./Cell";
import { GENTLE_SETTLE } from "../../lib/motionPresets";

export function NotebookColumn() {
  const cellOrder = useQuantumStore((s) => s.cellOrder);
  const addCell = useQuantumStore((s) => s.addCell);
  const setActiveCell = useQuantumStore((s) => s.setActiveCell);

  const canDelete = cellOrder.length > 1;

  const handleAddCell = () => {
    const newId = addCell();
    // Immediately focus the visualizer panel on the freshly created
    // cell, so the "video player" doesn't keep showing a now-scrolled-
    // away previous cell while the user starts typing in the new one.
    setActiveCell(newId);
  };

  return (
    <div className="min-h-full w-full px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* --- Notebook title/header --- */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-ui text-sm font-medium tracking-wide text-slate-700">
            quantum-scratchpad
          </h1>
          <span className="font-code text-xs text-slate-500">
            {cellOrder.length} {cellOrder.length === 1 ? "cell" : "cells"}
          </span>
        </div>

        {/* --- Cell list --- */}
        <div className="flex flex-col gap-4">
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
          onClick={handleAddCell}
          whileTap={{ scale: 0.98 }}
          transition={GENTLE_SETTLE}
          className="
            mt-4 flex w-full items-center justify-center gap-2 rounded-xl
            border border-dashed border-slate-300 bg-white/40 py-3
            font-ui text-xs text-slate-500
            backdrop-blur-glass
            transition-colors duration-150
            hover:border-cyan-quantum-400/50 hover:bg-cyan-quantum-50/60 hover:text-cyan-quantum-700
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