// src/components/editor/CodeEditor.jsx
//
// Code Editor Compartment — NOTEBOOK CELL EDITION
// -----------------------------------------------------------------------
// MODIFIED: now takes a `cellId` prop and reads/writes that specific
// cell's slice in the store, instead of a single global editor slice.
//
// BUG FIX from the test run: previously the textarea's default VALUE
// was "// Try: H * |0>\n// or: kron(X, Y)\n", which got typed into the
// input and then literally evaluated (including the // comment syntax,
// which Math.js doesn't understand) — causing the dimension-mismatch
// error you saw. Fix: the hint text is now a PLACEHOLDER (shown only
// when empty, never part of the actual value, never evaluated), and
// the cell starts with a genuinely empty rawInput.
//
// Design constraints applied (Jupyter/VS Code minimal aesthetic):
// - Auto-growing textarea (height follows content, like a real code
//   cell) instead of a fixed-height box that wastes/cramps space.
// - No border-radius glass-panel treatment here — Cell.jsx already
//   provides the card chrome; this is just the input surface itself.
// - Glow reserved for focus only, and now more subtle (this is one
//   compartment among several stacked cells, not a hero element).

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuantumStore } from "../../store/useQuantumStore";

export function CodeEditor({ cellId }) {
  const scheduleEvaluation = useQuantumStore((s) => s.scheduleEvaluation);
  const evaluateNow = useQuantumStore((s) => s.evaluateNow);
  const errorMessage = useQuantumStore((s) => s.cells[cellId]?.evaluation.error);

  // Local state for instant-feeling typing (store update is debounced,
  // but the visible textarea value is never blocked waiting on it).
  const [localText, setLocalText] = useState("");
  const textareaRef = useRef(null);

  // --- Auto-grow height to fit content, like a real code cell ---
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [localText]);

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalText(value);
      scheduleEvaluation(cellId, value, 500);
    },
    [scheduleEvaluation, cellId]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        evaluateNow(cellId, localText);
      }
    },
    [evaluateNow, cellId, localText]
  );

  return (
    <div className="flex flex-col">
      <textarea
        ref={textareaRef}
        value={localText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        rows={1}
        className="
          w-full resize-none overflow-hidden rounded-lg bg-slate-950/40 p-3
          font-mono text-sm text-slate-200
          placeholder:text-slate-600
          focus:outline-none focus:ring-1 focus:ring-cyan-400/30
        "
        placeholder="H * |0>   (Shift+Enter to run)"
      />

      {errorMessage && (
        <div
          className="
            mt-2 rounded-md border border-red-500/30 bg-red-950/20
            px-3 py-1.5 text-xs text-red-300/90
          "
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}