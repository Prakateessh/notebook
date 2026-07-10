// src/store/useQuantumStore.js
//
// Central Zustand store for the Quantum Math Scratchpad — SPLIT-VIEW EDITION.
// -----------------------------------------------------------------------
// CHANGE: generateFrames now starts every new evaluation PAUSED
// (isPlaying: false) instead of auto-playing. Per your request, the
// stepper should feel like manual step-by-step navigation (prev/next
// buttons) rather than an auto-advancing "video" — useful when you
// want to linger on small individual steps rather than watch them
// cascade automatically. Play/pause is still available as an option
// for those who DO want auto-advance, but it's no longer the default
// behavior on evaluation.

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

function extractLastExpression(rawText) {
  const lines = rawText.split("\n").map((line) => line.trim());
  const meaningful = lines.filter(
    (line) => line.length > 0 && !line.startsWith("//")
  );
  return meaningful.length > 0 ? meaningful[meaningful.length - 1] : "";
}

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

function generateCellId() {
  return `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const FIRST_CELL_ID = generateCellId();

export const useQuantumStore = create((set, get) => ({
  cellOrder: [FIRST_CELL_ID],
  cells: {
    [FIRST_CELL_ID]: createEmptyCell(),
  },

  activeCellId: FIRST_CELL_ID,

  setActiveCell: (cellId) => {
    set(() => ({ activeCellId: cellId }));
  },

  hasSeenIntro: false,

  markIntroSeen: () => {
    set(() => ({ hasSeenIntro: true }));
  },

  addCell: () => {
    const newId = generateCellId();
    set((state) => ({
      cellOrder: [...state.cellOrder, newId],
      cells: { ...state.cells, [newId]: createEmptyCell() },
    }));
    return newId;
  },

  removeCell: (cellId) => {
    set((state) => {
      if (state.cellOrder.length <= 1) return state;

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

  evaluateInput: (cellId, rawText) => {
    const expression = extractLastExpression(rawText || "");

    if (!expression) {
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
      const preprocessed = preprocessDirac(expression);
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
            // CHANGED: was `isPlaying: frames.length > 0` (auto-played
            // immediately on evaluation). Now always starts paused —
            // user steps through manually via prev/next buttons.
            stepper: { frames, currentFrameIndex: 0, isPlaying: false },
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