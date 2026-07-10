// src/components/editor/CodeEditor.jsx
//
// Code Editor Compartment — SPLIT-VIEW POLISH PASS
// -----------------------------------------------------------------------
// FOCUS-BUBBLING CONFIRMATION: this component intentionally does NOT
// attach its own onFocus handler to the <textarea> that stops or
// redirects focus events. React's synthetic focus event bubbles up
// through the component tree by default, so when this textarea
// receives focus, Cell.jsx's wrapping onFocus={() => setActiveCell(cellId)}
// fires automatically — no explicit wiring needed in THIS file for
// that to work. Verified this stays true after the polish pass below;
// nothing here calls stopPropagation or preventDefault on focus.
//
// POLISH CHANGES in this pass:
//   - Slightly more generous padding (p-3 -> p-3.5) and line-height
//     (leading-6 -> leading-7) — the previous version felt a little
//     tight now that cells have more visual breathing room overall.
//   - Focus ring color upgraded from a generic cyan to the app's
//     actual cyan-quantum-400 token, so focus states feel consistent
//     with the rest of the light theme's accent system.
//   - Placeholder text updated to reflect a couple more example
//     operations (previously only suggested H * |0>), giving new
//     users a wider hint at what's possible without needing to read
//     documentation first — small but genuinely helps the "student
//     friendly" goal.
//
// Everything else — line number gutter, auto-grow height, debounced
// evaluation, Shift+Enter immediate eval, the squiggly-underline error
// state, the frosted error toast — is UNCHANGED in behavior from the
// previous version.

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { GENTLE_SETTLE } from "../../lib/motionPresets";

export function CodeEditor({ cellId }) {
  const scheduleEvaluation = useQuantumStore((s) => s.scheduleEvaluation);
  const evaluateNow = useQuantumStore((s) => s.evaluateNow);
  const errorMessage = useQuantumStore((s) => s.cells[cellId]?.evaluation.error);

  const [localText, setLocalText] = useState("");
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // --- Auto-grow height to fit content ---
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [localText]);

  // --- Line count derived from content (minimum 1 line) ---
  const lineCount = Math.max(localText.split("\n").length, 1);

  // --- Keep the line-number gutter's scroll position synced to the
  //     textarea's scroll position (relevant once content overflows
  //     the visible area, e.g. very long multi-line expressions). ---
  const handleScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

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

  const hasError = Boolean(errorMessage);

  return (
    <div className="relative flex flex-col">
      <div
        className={`
          flex overflow-hidden rounded-lg border bg-white/60
          transition-colors duration-200
          ${hasError ? "border-red-300" : "border-slate-200"}
        `}
      >
        {/* --- Line number gutter --- */}
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="
            select-none overflow-hidden border-r border-slate-200/70
            bg-slate-50/60 px-2 py-3.5 text-right
            font-code text-sm leading-7 text-slate-400
          "
          style={{ minWidth: "2.5rem" }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* --- The actual textarea --- */}
        <textarea
          ref={textareaRef}
          value={localText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          rows={1}
          className={`
            w-full resize-none overflow-hidden bg-transparent px-3.5 py-3.5
            font-code text-sm leading-7 text-slate-800
            placeholder:text-slate-400
            focus:outline-none focus:ring-1 focus:ring-cyan-quantum-400/40
            ${hasError ? "quantum-error-squiggly" : ""}
          `}
          placeholder="H * |0⟩   ·   kron(X, Y)   ·   Shift+Enter to run"
        />
      </div>

      {/* --- Error toast: frosted glass, slides in from the top --- */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={GENTLE_SETTLE}
            className="
              mt-2 rounded-lg border border-red-200 bg-white/80
              px-3 py-2 backdrop-blur-glass
              font-ui text-xs text-red-600/90
              shadow-[0_2px_8px_rgba(0,0,0,0.06)]
            "
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}