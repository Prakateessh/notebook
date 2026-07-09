// src/components/editor/CodeEditor.jsx
//
// Code Editor Compartment
// -----------------------------------------------------------------------
// Accepts MATLAB-style syntax mixed with Dirac notation. Evaluates
// automatically on a debounce, or immediately on Shift+Enter.
//
// Wiring to the store:
// - Every keystroke calls scheduleEvaluation(text) — debounced eval.
// - Shift+Enter calls evaluateNow(text) — skips the debounce wait.
// - Subscribes ONLY to editor.rawInput and evaluation.error via
//   selector functions, so this component doesn't re-render on
//   unrelated stepper/probability state changes (Zustand selective
//   subscription — this is the "less latency" benefit from our
//   earlier state-management decision).
//
// Design constraints applied:
// - No skeuomorphic textbox styling (no fake inset bevel).
// - Glow appears only on focus (the "active state" glow from spec).
// - Monospace font for code legibility.

import { useState, useCallback } from "react";
import { useQuantumStore } from "../../store/useQuantumStore";

export function CodeEditor() {
  // Selective subscriptions — only re-render when these specific
  // fields change, not on every store update.
  const scheduleEvaluation = useQuantumStore((s) => s.scheduleEvaluation);
  const evaluateNow = useQuantumStore((s) => s.evaluateNow);
  const errorMessage = useQuantumStore((s) => s.evaluation.error);

  // Local state for the textarea value itself. We keep this local
  // (not fully store-driven on every keystroke) so typing feels
  // instant — the store's rawInput updates via the debounce path,
  // but the visible text the user sees is never blocked by store
  // round-trips.
  const [localText, setLocalText] = useState(
    "// Try: H * |0>\n// or: kron(X, Y)\n"
  );
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalText(value);
      scheduleEvaluation(value, 500); // 500ms debounce
    },
    [scheduleEvaluation]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault(); // don't insert a newline
        evaluateNow(localText);
      }
    },
    [evaluateNow, localText]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-wide text-slate-400">
          EDITOR
        </h2>
        <span className="text-xs text-slate-600">Shift+Enter to run</span>
      </div>

      <div
        className={`
          relative flex-1 rounded-2xl border transition-colors duration-200
          ${
            isFocused
              ? "border-cyan-400/50 shadow-[0_0_24px_rgba(34,211,238,0.15)]"
              : "border-slate-800/60"
          }
        `}
      >
        <textarea
          value={localText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          spellCheck={false}
          className="
            h-full w-full resize-none rounded-2xl bg-transparent p-4
            font-mono text-sm text-slate-200
            placeholder:text-slate-600
            focus:outline-none
          "
          placeholder="H * |0>"
        />
      </div>

      {errorMessage && (
        <div
          className="
            mt-3 rounded-xl border border-red-500/30 bg-red-950/30
            px-3 py-2 text-xs text-red-300
          "
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}