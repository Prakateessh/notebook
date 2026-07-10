// src/components/notebook/NotebookColumn.jsx
//
// Notebook Column – Left Column Wrapper
// -----------------------------------------------------------------------
// NEW: A book‑icon button in the header opens the Gate Cheatsheet
// slide‑out panel.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { Cell } from "./Cell";
import { Cheatsheet } from "../cheatsheet/Cheatsheet";
import { GENTLE_SETTLE } from "../../lib/motionPresets";

export function NotebookColumn() {
  const cellOrder = useQuantumStore((s) => s.cellOrder);
  const addCell = useQuantumStore((s) => s.addCell);
  const setActiveCell = useQuantumStore((s) => s.setActiveCell);

  const [showCheatsheet, setShowCheatsheet] = useState(false);

  const canDelete = cellOrder.length > 1;

  const handleAddCell = () => {
    const newId = addCell();
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
          <div className="flex items-center gap-3">
            <span className="font-code text-xs text-slate-500">
              {cellOrder.length} {cellOrder.length === 1 ? "cell" : "cells"}
            </span>
            {/* Cheatsheet toggle button */}
            <button
              onClick={() => setShowCheatsheet(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Gate Cheatsheet"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h12" strokeLinecap="round" />
                <circle cx="20" cy="18" r="2" fill="currentColor" />
              </svg>
            </button>
          </div>
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

      {/* --- Cheatsheet overlay --- */}
      <AnimatePresence>
        {showCheatsheet && (
          <Cheatsheet onClose={() => setShowCheatsheet(false)} />
        )}
      </AnimatePresence>
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