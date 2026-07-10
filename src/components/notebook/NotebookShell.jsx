// src/components/notebook/NotebookShell.jsx
//
// Notebook Shell — Scrollable Cell List — QUANTUM LIGHT GLASSMORPHISM
// -----------------------------------------------------------------------
// MODIFIED FOR LIGHT THEME: background switched from bg-slate-950 (dark)
// to the doc's specified slate-50-equivalent canvas (#faf8ff, set
// globally in index.css on the <html> element — this component no longer
// needs to set its own background color, it just needs to NOT fight it
// with a conflicting bg- class).
//
// Text colors flipped from light-on-dark (text-slate-400/600) to
// dark-on-light (text-slate-600/700) for readable contrast against the
// new light canvas.
//
// Structure, animation logic (AnimatePresence, addCell), and the
// cellOrder mapping are UNCHANGED from the dark version — only colors
// and font classes are touched in this file.

import { AnimatePresence, motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { Cell } from "./Cell";

export function NotebookShell() {
  const cellOrder = useQuantumStore((s) => s.cellOrder);
  const addCell = useQuantumStore((s) => s.addCell);

  const canDelete = cellOrder.length > 1;

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
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
          onClick={addCell}
          whileTap={{ scale: 0.98 }}
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