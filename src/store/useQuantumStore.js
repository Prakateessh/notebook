// src/store/useQuantumStore.js
//
// Central Zustand store for the Quantum Math Scratchpad — SPLIT-VIEW EDITION.
// -----------------------------------------------------------------------
// REWRITE NOTE: adds two new pieces of NOTEBOOK-LEVEL (not per-cell)
// state on top of the existing multi-cell architecture:
//
//   1. activeCellId — which cell's output the right-hand "video player"
//      VisualizerPanel should currently display. Updated whenever a
//      cell's editor gains focus (see CodeEditor.jsx's onFocus hook,
//      wired in a later file). Defaults to the first cell so the
//      right panel isn't empty on initial load.
//
//   2. hasSeenIntro — whether the animated HeroIntro sequence has
//      already played this session. Set to true once HeroIntro finishes
//      (or is skipped), so refreshing mid-session via HMR or a state
//      update doesn't re-trigger the intro animation every time —
//      it's a "have we shown this already" flag, not persisted to
//      localStorage (per-session only, resets on full page reload,
//      which is the correct behavior for a "first impression" moment).
//
// Everything else — the cells map, per-cell editor/evaluation/stepper
// slices, all evaluation/stepper actions — is UNCHANGED from the
// previous version.

import { create } from "zustand";
import { create as createMathInstance, all } from "mathjs";
import { injectQuantumStdlib } from "../lib/quantumStdlib";
import { preprocessDirac } from "../lib/diracPreprocessor";
import {
  generateMultiplicationSteps,
  generateKroneckerSteps,
} from "../lib/stepGenerator";

const math = createMathInstance(all);
injectQuantumStdlib(math);

const mathOps = {
  multiply: math.multiply,
  add: math.add,
};

function detectOperationType(preprocessedInput) {
  if (/kron\s*\(/.test(preprocessedInput)) return "kronecker";
  if (/\*/.test(preprocessedInput)) return "multiplication";
  return "unknown";
}

/** Factory for a brand new, empty cell's state slice. */
function createEmptyCell() {
  return {
    editor: {
      rawInput: "",
      debounceTimer: null,
    },
    evaluation: {
      result: null,
      error: null,
      operationType: "unknown",
    },
    stepper: {
      frames: [],
      currentFrameIndex: 0,
      isPlaying: false,
    },
  };
}

/** Generates a reasonably unique cell id without needing a uuid dependency. */
function generateCellId() {
  return `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const FIRST_CELL_ID = generateCellId();

export const useQuantumStore = create((set, get) => ({
  // ================= NOTEBOOK-LEVEL STATE =================
  cellOrder: [FIRST_CELL_ID],
  cells: {
    [FIRST_CELL_ID]: createEmptyCell(),
  },

  // --- Split-view state: which cell the right panel displays ---
  activeCellId: FIRST_CELL_ID,

  setActiveCell: (cellId) => {
    set(() => ({ activeCellId: cellId }));
  },

  // --- Hero intro playback flag ---
  hasSeenIntro: false,

  markIntroSeen: () => {
    set(() => ({ hasSeenIntro: true }));
  },

  /** Appends a new empty cell to the end of the notebook. */
  addCell: () => {
    const newId = generateCellId();
    set((state) => ({
      cellOrder: [...state.cellOrder, newId],
      cells: { ...state.cells, [newId]: createEmptyCell() },
    }));
    return newId;
  },

  /** Removes a cell entirely. No-ops if it's the last remaining cell
   *  (a notebook should never have zero cells — always at least one).
   *  If the removed cell was the active one, falls back to the first
   *  remaining cell so the visualizer panel never points at a dead id. */
  removeCell: (cellId) => {
    set((state) => {
      if (state.cellOrder.length <= 1) return state; // guard: keep >=1 cell

      const { [cellId]: _removed, ...remainingCells } = state.cells;
      const remainingOrder = state.cellOrder.filter((id) => id !== cellId);

      const nextActiveCellId =
        state.activeCellId === cellId ? remainingOrder[0] : state.activeCellId;

      return {
        cellOrder: remainingOrder,
        cells: remainingCells,
        activeCellId: nextActiveCellId,
      };
    });
  },

  // ================= PER-CELL EDITOR ACTIONS =================

  setRawInput: (cellId, text) => {
    set((state) => ({
      cells: {
        ...state.cells,
        [cellId]: {
          ...state.cells[cellId],
          editor: { ...state.cells[cellId].editor, rawInput: text },
        },
      },
    }));
  },

  scheduleEvaluation: (cellId, text, delayMs = 500) => {
    const cell = get().cells[cellId];
    if (!cell) return;
    if (cell.editor.debounceTimer) clearTimeout(cell.editor.debounceTimer);

    const timer = setTimeout(() => {
      get().evaluateInput(cellId, text);
    }, delayMs);

    set((state) => ({
      cells: {
        ...state.cells,
        [cellId]: {
          ...state.cells[cellId],
          editor: { ...state.cells[cellId].editor, rawInput: text, debounceTimer: timer },
        },
      },
    }));
  },

  evaluateNow: (cellId, text) => {
    const cell = get().cells[cellId];
    if (!cell) return;
    if (cell.editor.debounceTimer) clearTimeout(cell.editor.debounceTimer);
    get().evaluateInput(cellId, text);
  },

  // ================= PER-CELL EVALUATION =================

  evaluateInput: (cellId, rawText) => {
    // Guard: ignore empty/whitespace-only input rather than throwing
    // a confusing "Undefined symbol" error at the user.
    if (!rawText || !rawText.trim()) {
      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            evaluation: { result: null, error: null, operationType: "unknown" },
            stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
          },
        },
      }));
      return;
    }

    try {
      const preprocessed = preprocessDirac(rawText);
      const result = math.evaluate(preprocessed, {});
      const operationType = detectOperationType(preprocessed);

      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            evaluation: { result, error: null, operationType },
          },
        },
      }));

      get().generateFrames(cellId, preprocessed, operationType);
    } catch (err) {
      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            evaluation: { ...state.cells[cellId].evaluation, error: err.message, result: null },
            stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
          },
        },
      }));
    }
  },

  // ================= PER-CELL STEPPER =================

  generateFrames: (cellId, preprocessedInput, operationType) => {
    try {
      let frames = [];

      if (operationType === "kronecker") {
        const match = preprocessedInput.match(/kron\(([^,]+),(.+)\)$/);
        if (match) {
          const evalA = math.evaluate(match[1]);
          const evalB = math.evaluate(match[2]);
          const A = evalA.toArray ? evalA.toArray() : evalA;
          const B = evalB.toArray ? evalB.toArray() : evalB;
          frames = generateKroneckerSteps(A, B, mathOps);
        }
      } else if (operationType === "multiplication") {
        const parts = preprocessedInput.split("*");
        if (parts.length === 2) {
          const evalA = math.evaluate(parts[0]);
          const evalB = math.evaluate(parts[1]);
          const A = evalA.toArray ? evalA.toArray() : evalA;
          const B = evalB.toArray ? evalB.toArray() : evalB;
          frames = generateMultiplicationSteps(A, B, mathOps);
        }
      }

      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            stepper: { frames, currentFrameIndex: 0, isPlaying: frames.length > 0 },
          },
        },
      }));
    } catch {
      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
          },
        },
      }));
    }
  },

  // ================= PER-CELL PLAYBACK CONTROLS =================

  nextFrame: (cellId) => {
    set((state) => {
      const cell = state.cells[cellId];
      if (!cell) return state;
      const { frames, currentFrameIndex } = cell.stepper;
      const next = Math.min(currentFrameIndex + 1, frames.length - 1);
      return {
        cells: {
          ...state.cells,
          [cellId]: { ...cell, stepper: { ...cell.stepper, currentFrameIndex: next } },
        },
      };
    });
  },

  prevFrame: (cellId) => {
    set((state) => {
      const cell = state.cells[cellId];
      if (!cell) return state;
      const prev = Math.max(cell.stepper.currentFrameIndex - 1, 0);
      return {
        cells: {
          ...state.cells,
          [cellId]: { ...cell, stepper: { ...cell.stepper, currentFrameIndex: prev } },
        },
      };
    });
  },

  togglePlayback: (cellId) => {
    set((state) => {
      const cell = state.cells[cellId];
      if (!cell) return state;
      return {
        cells: {
          ...state.cells,
          [cellId]: { ...cell, stepper: { ...cell.stepper, isPlaying: !cell.stepper.isPlaying } },
        },
      };
    });
  },

  setFrameIndex: (cellId, index) => {
    set((state) => {
      const cell = state.cells[cellId];
      if (!cell) return state;
      return {
        cells: {
          ...state.cells,
          [cellId]: { ...cell, stepper: { ...cell.stepper, currentFrameIndex: index } },
        },
      };
    });
  },
}));

export { math };