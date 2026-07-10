// src/store/useQuantumStore.js
//
// Central Zustand store for the Quantum Math Scratchpad — SPLIT‑VIEW EDITION.
// -----------------------------------------------------------------------
// NEW: Smarter error messages – common Math.js errors are replaced with
//      friendly quantum‑specific hints.
// NEW: moveCell action – swaps cell positions in cellOrder for reordering.

import { create } from "zustand";
import { create as createMathInstance, all } from "mathjs";
import { injectQuantumStdlib } from "../lib/quantumStdlib";
import { preprocessDirac } from "../lib/diracPreprocessor";
import {
  generateMultiplicationSteps,
  generateKroneckerSteps,
  generateGateExplanationSteps,
} from "../lib/stepGenerator";

const math = createMathInstance(all);
injectQuantumStdlib(math);

const mathOps = {
  multiply: math.multiply,
  add: math.add,
};

function detectOperationType(rawInput) {
  const trimmed = rawInput.trim();
  if (/^\s*let\s+[a-zA-Z_]\w*\s*=/.test(trimmed)) return "let";
  if (/^\s*kron\s*\(/.test(trimmed)) return "kronecker";
  if (/\*/.test(trimmed)) return "multiplication";
  return "gate";
}

function isGateMatrix(result) {
  if (!result || typeof result.toArray !== "function") return false;
  const arr = result.toArray();
  if (!Array.isArray(arr) || arr.length === 0) return false;
  if (!Array.isArray(arr[0])) return false;
  return arr.length >= 2 && arr[0].length >= 2;
}

function buildWholeCellExpression(rawText) {
  const lines = rawText.split("\n");
  const meaningful = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));
  return meaningful.join(" ");
}

function createEmptyCell(type = "code") {
  return {
    type,
    editor: { rawInput: "", debounceTimer: null },
    evaluation: { result: null, error: null, operationType: "unknown" },
    stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
  };
}

function generateCellId() {
  return `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- smarter error messages ----
function friendlyError(originalError, expression) {
  const msg = originalError.message || originalError.toString();

  // Dimension mismatch
  if (/dimension/i.test(msg) || /columns/i.test(msg)) {
    return "Gate and state dimensions don't match. For example, a 4×4 gate needs a 4‑component state (like |10⟩ for CNOT).";
  }

  // Unknown symbol (often a gate without *)
  if (/Undefined symbol/i.test(msg)) {
    const match = msg.match(/Undefined symbol\s+(\w+)/i);
    if (match) {
      const sym = match[1];
      const known = ["I","X","Y","Z","H","S","T","CNOT","SWAP","CZ","CY","CH","CCNOT",
                     "Rx","Ry","Rz","kron","dagger","prob","expect","variance",
                     "commutator","anticommutator","isUnitary","controlled"];
      if (known.includes(sym)) {
        return `"${sym}" is a quantum gate or function. Did you forget to multiply with '*'? Example: ${sym} * |0>`;
      }
    }
  }

  // Unexpected end (often missing closing bracket/paren)
  if (/Unexpected end/i.test(msg)) {
    return "Expression seems incomplete. Check for missing parentheses or brackets.";
  }

  // Generic fallback
  return msg;
}

const FIRST_CELL_ID = generateCellId();

export const useQuantumStore = create((set, get) => ({
  cellOrder: [FIRST_CELL_ID],
  cells: { [FIRST_CELL_ID]: createEmptyCell() },
  activeCellId: FIRST_CELL_ID,
  setActiveCell: (cellId) => set(() => ({ activeCellId: cellId })),
  hasSeenIntro: false,
  markIntroSeen: () => set(() => ({ hasSeenIntro: true })),
  variables: {},

  addCell: (type = "code") => {
    const newId = generateCellId();
    set((state) => ({
      cellOrder: [...state.cellOrder, newId],
      cells: { ...state.cells, [newId]: createEmptyCell(type) },
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

  // ----- cell reordering (used by drag-and-drop or up/down buttons) -----
  moveCell: (cellId, newIndex) => {
    set((state) => {
      const oldIndex = state.cellOrder.indexOf(cellId);
      if (oldIndex === -1 || oldIndex === newIndex) return state;
      const newOrder = [...state.cellOrder];
      // Remove from old position and insert at new position
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, cellId);
      return { cellOrder: newOrder };
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
    const timer = setTimeout(() => get().evaluateInput(cellId, text), delayMs);
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
    const cell = get().cells[cellId];
    if (!cell || cell.type !== "code") return;

    const expression = buildWholeCellExpression(rawText || "");
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
      let operationType = detectOperationType(expression);

      if (operationType === "let") {
        const match = expression.match(/^\s*let\s+([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        if (!match) throw new Error("Invalid variable definition.");
        const varName = match[1];
        const rhsExpr = match[2].trim();
        const preprocessedRHS = preprocessDirac(rhsExpr);
        const scope = { ...get().variables };
        const value = math.evaluate(preprocessedRHS, scope);
        set((state) => ({
          variables: { ...state.variables, [varName]: value },
          cells: {
            ...state.cells,
            [cellId]: {
              ...state.cells[cellId],
              evaluation: { result: value, error: null, operationType: "let" },
              stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
            },
          },
        }));
        return;
      }

      const preprocessed = preprocessDirac(expression);
      const scope = { ...get().variables };
      const result = math.evaluate(preprocessed, scope);

      if (operationType === "gate" && !isGateMatrix(result)) {
        operationType = "unknown";
      }

      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            evaluation: { result, error: null, operationType },
          },
        },
      }));

      get().generateFrames(cellId, preprocessed, operationType, result);
    } catch (err) {
      // ---- friendly error ----
      const friendly = friendlyError(err, expression);
      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            evaluation: { ...state.cells[cellId].evaluation, error: friendly, result: null },
            stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
          },
        },
      }));
    }
  },

  generateFrames: (cellId, preprocessedInput, operationType, result) => {
    try {
      let frames = [];

      if (operationType === "kronecker") {
        const match = preprocessedInput.match(/kron\(([^,]+),(.+)\)$/);
        if (match) {
          const evalA = math.evaluate(match[1], { ...get().variables });
          const evalB = math.evaluate(match[2], { ...get().variables });
          const A = evalA.toArray ? evalA.toArray() : evalA;
          const B = evalB.toArray ? evalB.toArray() : evalB;
          frames = generateKroneckerSteps(A, B, mathOps);
        }
      } else if (operationType === "multiplication") {
        const parts = preprocessedInput.split("*");
        if (parts.length === 2) {
          const evalA = math.evaluate(parts[0], { ...get().variables });
          const evalB = math.evaluate(parts[1], { ...get().variables });
          const A = evalA.toArray ? evalA.toArray() : evalA;
          const B = evalB.toArray ? evalB.toArray() : evalB;
          frames = generateMultiplicationSteps(A, B, mathOps);
          frames = frames.map(f => ({ ...f, chainStep: 0 }));
        } else {
          const operands = parts.map(p => math.evaluate(p, { ...get().variables }));
          let currentResult = operands[0];
          for (let i = 1; i < operands.length; i++) {
            const nextOperand = operands[i];
            const A = currentResult.toArray ? currentResult.toArray() : currentResult;
            const B = nextOperand.toArray ? nextOperand.toArray() : nextOperand;
            const stepFrames = generateMultiplicationSteps(A, B, mathOps);
            const tagged = stepFrames.map(f => ({ ...f, chainStep: i - 1 }));
            frames.push(...tagged);
            currentResult = math.multiply(currentResult, nextOperand);
          }
        }
      } else if (operationType === "gate") {
        const gateMatrix = result.toArray();
        const gateName = preprocessedInput.trim();
        frames = generateGateExplanationSteps(gateMatrix, gateName);
        frames = frames.map(f => ({ ...f, chainStep: 0 }));
      }

      set((state) => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            stepper: { frames, currentFrameIndex: 0, isPlaying: false },
          },
        },
      }));
    } catch (err) {
      console.error("Frame generation error:", err);
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

  setCellType: (cellId, type) => {
    set((state) => ({
      cells: {
        ...state.cells,
        [cellId]: { ...state.cells[cellId], type },
      },
    }));
  },
}));

export { math };