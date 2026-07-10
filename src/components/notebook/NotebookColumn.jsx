// src/components/notebook/NotebookColumn.jsx
//
// Notebook Column – Left Column Wrapper
// -----------------------------------------------------------------------
// Supports drag‑and‑drop cell reordering via HTML5 Drag & Drop API.
// Drop zones appear between cells and highlight when a dragged cell is over them.
// The store's `moveCell` action is called on drop.

import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { Cell } from "./Cell";
import { Cheatsheet } from "../cheatsheet/Cheatsheet";
import { GENTLE_SETTLE } from "../../lib/motionPresets";

export function NotebookColumn() {
  const cellOrder = useQuantumStore((s) => s.cellOrder);
  const addCell = useQuantumStore((s) => s.addCell);
  const setActiveCell = useQuantumStore((s) => s.setActiveCell);
  const setCellType = useQuantumStore((s) => s.setCellType);
  const moveCell = useQuantumStore((s) => s.moveCell);

  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const fileInputRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null); // which drop zone is active

  const canDelete = cellOrder.length > 1;

  const handleAddCell = () => {
    const newId = addCell();
    setActiveCell(newId);
  };

  // ---- export ----
  const handleExport = () => {
    const cells = useQuantumStore.getState().cells;
    const data = cellOrder.map((id) => ({
      input: cells[id]?.editor?.rawInput || "",
      type: cells[id]?.type || "code",
    }));
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notebook.qnb";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- import ----
  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error("Invalid notebook format");
        const state = useQuantumStore.getState();
        const currentOrder = [...state.cellOrder];
        currentOrder.forEach((id, idx) => {
          if (idx === 0) return;
          state.removeCell(id);
        });
        const firstExistingId = state.cellOrder[0];
        imported.forEach((item, index) => {
          const input = item.input || "";
          const type = item.type === "markdown" ? "markdown" : "code";
          if (index === 0) {
            state.setCellType(firstExistingId, type);
            state.setRawInput(firstExistingId, input);
            if (type === "code") state.evaluateNow(firstExistingId, input);
          } else {
            const newId = state.addCell(type);
            state.setRawInput(newId, input);
            if (type === "code") state.evaluateNow(newId, input);
          }
        });
        state.setActiveCell(firstExistingId);
      } catch (err) {
        alert("Failed to import notebook: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ---- drag‑and‑drop handlers ----
  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e, dropIndex) => {
      e.preventDefault();
      setDragOverIndex(null);
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId) return;
      const oldIndex = cellOrder.indexOf(draggedId);
      if (oldIndex === -1) return;
      // Calculate actual target index: drop zones are between cells.
      // If we drop in front of cell i, the new index is i.
      // If the dragged cell is before the target, adjusting is needed.
      let newIndex = dropIndex;
      if (oldIndex < dropIndex) newIndex = dropIndex - 1;
      if (newIndex === oldIndex) return;
      moveCell(draggedId, newIndex);
    },
    [cellOrder, moveCell]
  );

  return (
    <div className="min-h-full w-full px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-ui text-sm font-medium tracking-wide gradient-text-subtle">
            quantum‑scratchpad
          </h1>
          <div className="flex items-center gap-3">
            <span className="font-code text-xs text-slate-500">
              {cellOrder.length} {cellOrder.length === 1 ? "cell" : "cells"}
            </span>
            <button onClick={handleExport} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600" aria-label="Export notebook" title="Export notebook">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button onClick={handleImportClick} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600" aria-label="Import notebook" title="Import notebook">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button onClick={() => setShowCheatsheet(true)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-purple-50 hover:text-purple-600" aria-label="Gate Cheatsheet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h12" strokeLinecap="round" />
                <circle cx="20" cy="18" r="2" fill="currentColor" />
              </svg>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".qnb,.json" className="hidden" />
          </div>
        </div>

        {/* Cell list with drop zones */}
        <div className="flex flex-col gap-1">
          {/* Drop zone before first cell */}
          <DropZone
            index={0}
            isActive={dragOverIndex === 0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />

          <AnimatePresence initial={false}>
            {cellOrder.map((cellId, index) => (
              <div key={cellId}>
                <Cell
                  cellId={cellId}
                  cellNumber={index + 1}
                  canDelete={canDelete}
                />
                {/* Drop zone after each cell */}
                <DropZone
                  index={index + 1}
                  isActive={dragOverIndex === index + 1}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>

        {/* Add Cell button */}
        <div className="glow-border-btn mt-4 rounded-xl">
          <motion.button
            onClick={handleAddCell}
            whileTap={{ scale: 0.98 }}
            transition={GENTLE_SETTLE}
            className="
              flex w-full items-center justify-center gap-2 rounded-xl
              border-2 border-purple-100 bg-white/70 py-3
              font-ui text-xs font-medium text-purple-500
              backdrop-blur-sm transition-all duration-300
              hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700
            "
          >
            <IconPlus />
            Add Cell
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showCheatsheet && <Cheatsheet onClose={() => setShowCheatsheet(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ---- Drop zone component ----
function DropZone({ index, isActive, onDragOver, onDragLeave, onDrop }) {
  return (
    <div
      className={`
        h-2 rounded transition-all duration-150
        ${isActive ? "h-4 bg-purple-200/80" : "bg-transparent"}
      `}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
    />
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}