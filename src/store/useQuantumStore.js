// src/store/useQuantumStore.js
//
// Central Zustand store for the Quantum Math Scratchpad.
// -----------------------------------------------------------------------
// Three logical slices, combined in one store (Zustand doesn't need
// separate files for this to stay organized — slices are just
// namespaced by key):
//
//   editor:      raw text input, debounce timer handle
//   evaluation:  parsed result, error state, detected operation type
//   stepper:     frame array, current frame index, playback state
//
// Why one store instead of three: the stepper needs to react the
// instant evaluation succeeds, and playback controls need to read
// stepper state without importing evaluation logic. Keeping them
// in one Zustand store means components subscribe to ONLY the
// slice/field they need (via selector functions), so re-renders
// stay scoped — you get the "separate store" isolation benefit
// without the cross-file wiring cost.

import { create } from "zustand";
import { create as createMathInstance, all } from "mathjs";
import { injectQuantumStdlib } from "../lib/quantumStdlib";
import { preprocessDirac } from "../lib/diracPreprocessor";
import {
  generateMultiplicationSteps,
  generateKroneckerSteps,
} from "../lib/stepGenerator";

// --- Math.js instance setup (singleton, created once at module load) ---
const math = createMathInstance(all);
injectQuantumStdlib(math);

// Op functions handed to stepGenerator — using math.js versions so
// complex numbers (e.g. from the Y gate) are handled correctly.
const mathOps = {
  multiply: math.multiply,
  add: math.add,
};

/**
 * Detects which "top level" operation the user's raw input represents,
 * so we know whether to call generateMultiplicationSteps or
 * generateKroneckerSteps. This is a light heuristic, not a full parser:
 * it looks for the presence of `kron(` (from preprocessed Dirac
 * multi-qubit states, or explicit user calls) vs a bare `*` between
 * two matrix-looking operands.
 *
 * NOTE: this only affects which STEP ANIMATION we generate for the
 * visualizer. The actual math.evaluate() call always runs regardless,
 * so the numeric answer is correct even if step-detection guesses wrong
 * — worst case, the user sees the multiplication animation instead of
 * the Kronecker block animation, but the final result is right.
 */
function detectOperationType(preprocessedInput) {
  if (/kron\s*\(/.test(preprocessedInput)) return "kronecker";
  if (/\*/.test(preprocessedInput)) return "multiplication";
  return "unknown";
}

export const useQuantumStore = create((set, get) => ({
  // ================= EDITOR SLICE =================
  editor: {
    rawInput: "",
    debounceTimer: null,
  },

  setRawInput: (text) => {
    set((state) => ({ editor: { ...state.editor, rawInput: text } }));
  },

  /**
   * Called by CodeEditor.jsx on every keystroke. Handles the debounce
   * itself so the component doesn't need its own timer logic.
   */
  scheduleEvaluation: (text, delayMs = 500) => {
    const { editor } = get();
    if (editor.debounceTimer) clearTimeout(editor.debounceTimer);

    const timer = setTimeout(() => {
      get().evaluateInput(text);
    }, delayMs);

    set((state) => ({
      editor: { ...state.editor, rawInput: text, debounceTimer: timer },
    }));
  },

  /** Called directly on Shift+Enter to skip the debounce wait. */
  evaluateNow: (text) => {
    const { editor } = get();
    if (editor.debounceTimer) clearTimeout(editor.debounceTimer);
    get().evaluateInput(text);
  },

  // ================= EVALUATION SLICE =================
  evaluation: {
    result: null, // raw math.js evaluation result
    error: null, // error message string, or null
    operationType: "unknown", // "multiplication" | "kronecker" | "unknown"
  },

  evaluateInput: (rawText) => {
    try {
      const preprocessed = preprocessDirac(rawText);
      const result = math.evaluate(preprocessed, {
        // expose stdlib symbols directly in scope so bare `I`, `X`, etc.
        // resolve without the user needing to prefix anything
      });
      const operationType = detectOperationType(preprocessed);

      set(() => ({
        evaluation: { result, error: null, operationType },
      }));

      // Immediately kick off frame generation for the visualizer.
      get().generateFrames(preprocessed, operationType);
    } catch (err) {
      set((state) => ({
        evaluation: { ...state.evaluation, error: err.message, result: null },
      }));
      // Clear stale frames so the visualizer doesn't show an old,
      // now-incorrect animation next to a fresh error message.
      set(() => ({
        stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
      }));
    }
  },

  // ================= STEPPER SLICE =================
  stepper: {
    frames: [],
    currentFrameIndex: 0,
    isPlaying: false,
  },

  /**
   * Attempts to extract two matrix operands from the preprocessed
   * string and generate step frames. This is intentionally simple:
   * it looks for the FIRST top-level binary operation matching
   * "kron(A,B)" or "A*B" patterns already expanded by the Dirac
   * preprocessor, evaluates each operand separately via math.evaluate,
   * converts to plain arrays, then calls the appropriate step generator.
   *
   * If operands can't be cleanly extracted (e.g. a complex expression
   * with more than one operation chained), frames are left empty and
   * the visualizer falls back to just showing the final result
   * (MatrixStepper.jsx handles that fallback case).
   */
  generateFrames: (preprocessedInput, operationType) => {
    try {
      let frames = [];

      if (operationType === "kronecker") {
        const match = preprocessedInput.match(/kron\(([^,]+),(.+)\)$/);
        if (match) {
          const A = math.evaluate(match[1]).toArray
            ? math.evaluate(match[1]).toArray()
            : math.evaluate(match[1]);
          const B = math.evaluate(match[2]).toArray
            ? math.evaluate(match[2]).toArray()
            : math.evaluate(match[2]);
          frames = generateKroneckerSteps(A, B, mathOps);
        }
      } else if (operationType === "multiplication") {
        const parts = preprocessedInput.split("*");
        if (parts.length === 2) {
          const A = math.evaluate(parts[0]).toArray
            ? math.evaluate(parts[0]).toArray()
            : math.evaluate(parts[0]);