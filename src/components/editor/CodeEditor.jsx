// src/components/editor/CodeEditor.jsx
//
// Code Editor Compartment — QUANTUM LIGHT GLASSMORPHISM + LINE NUMBERS
// -----------------------------------------------------------------------
// This file gains THREE new features from the design doc, on top of the
// light-theme conversion:
//
//   1. LINE NUMBERS — a gutter column showing 1, 2, 3... synced to the
//      textarea's line count. Implemented as a separate <div> of numbers
//      that scrolls in lockstep with the textarea (via a shared scroll
//      handler), since a single <textarea> can't natively render its
//      own gutter.
//
//   2. RED SQUIGGLY UNDERLINE on error — HONEST LIMITATION UP FRONT:
//      the doc describes "the offending code gets a subtle red squiggly
//      underline," implying per-token/per-span error highlighting. We do
//      NOT have a real parser producing error position/span information
//      — math.js's error messages are strings, not structured
//      {line, column, length} objects. Building true per-character
//      squiggly-underline-at-the-exact-error-location would require
//      writing our own expression parser or patching math.js's internals,
//      which is a much bigger undertaking than this file. What we DO
//      implement: when there's an error, the ENTIRE textarea gets a
//      wavy red underline treatment via a CSS text-decoration trick,
//      signaling "something in here is wrong" without pretending to
//      pinpoint the exact character. Flagging this clearly rather than
//      silently under-delivering on the spec.
//
//   3. ERROR TOAST — a frosted-glass panel that slides in from the top
//      via Framer Motion when evaluation fails, replacing the old plain
//      inline red box from the dark version.
//
// BUG FIX (still preserved from earlier): placeholder text lives in the
// HTML placeholder attribute only, never evaluated as real input.

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";

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
            bg-slate-50/60 px-2 py-3 text-right
            font-code text-sm leading-6 text-slate-400
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
            w-full resize-none overflow-hidden bg-transparent px-3 py-3
            font-code text-sm leading-6 text-slate-800
            placeholder:text-slate-400
            focus:outline-none
            ${hasError ? "quantum-error-squiggly" : ""}
          `}
          placeholder="H * |0>   (Shift+Enter to run)"
        />
      </div>

      {/* --- Error toast: frosted glass, slides in from the top --- */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
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