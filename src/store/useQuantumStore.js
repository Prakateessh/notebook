// src/store/useQuantumStore.js
//
// Central Zustand store – symbolic matrices + evaluation logs + gate derivation
// -----------------------------------------------------------------------
// NEW: `define` syntax for deriving a gate from its action on basis states.
// Example:
//   define SWAP:
//   |00> → |00>
//   |01> → |10>
//   |10> → |01>
//   |11> → |11>
// This builds the gate matrix step‑by‑step in the visualiser.

import { create } from "zustand";
import { create as createMathInstance, all } from "mathjs";
import { injectQuantumStdlib } from "../lib/quantumStdlib";
import { preprocessDirac } from "../lib/diracPreprocessor";

import {
  generateMultiplicationSteps,
  generateKroneckerSteps,
  generateGateExplanationSteps,
  generateGateDerivationDetailed,   // <-- changed import
} from "../lib/stepGenerator";
import {
  sym,
  symbolicMultiply,
  symbolicAdd,
  SymbolicMatrix,
  SymbolicScalar,
  symbolicMatrixFromArray,
  createSymbolicMatrix,
} from "../lib/symbolicEngine";

const math = createMathInstance(all);
injectQuantumStdlib(math);

const numericOps = { multiply: math.multiply, add: math.add };
const symbolicOps = { multiply: symbolicMultiply, add: symbolicAdd };

// ---- helpers ----
function hasDeclaredSymbols(text, symbols) {
  const tokens = text.split(/[\s*+(),]+/);
  return tokens.some(t => symbols.has(t));
}

function hasSymbolicVariable(text, variables) {
  const tokens = text.split(/[\s*+(),]+/);
  return tokens.some(t => variables[t] instanceof SymbolicMatrix);
}

function detectOperationType(rawInput) {
  const trimmed = rawInput.trim();
  if (/^\s*define\s+[a-zA-Z_]\w*\s*:/m.test(trimmed)) return "define";
  if (/^\s*let\s+[a-zA-Z_]\w*\s*=/.test(trimmed)) return "let";
  if (/^\s*symbols\b/.test(trimmed)) return "symbols";
  if (/^\s*matrix\s*\(/.test(trimmed)) return "matrix";
  if (/^\s*kron\s*\(/.test(trimmed)) return "kronecker";
  if (/\*/.test(trimmed)) return "multiplication";
  return "gate";
}

function isGateMatrix(result) {
  if (!result || typeof result.toArray !== "function") return false;
  const arr = result.toArray();
  return Array.isArray(arr) && arr.length >= 2 && Array.isArray(arr[0]) && arr[0].length >= 2;
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
    logs: [],
  };
}

function generateCellId() {
  return `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function friendlyError(err, expr) {
  const msg = (err && err.message) || (err && err.toString()) || String(err);
  if (/dimension/i.test(msg) || /columns/i.test(msg)) {
    return "Gate and state dimensions don't match.";
  }
  if (/Undefined symbol/i.test(msg)) return msg;
  if (/Unexpected end/i.test(msg)) return "Expression seems incomplete.";
  return msg;
}

// ---- Matrix literal parser ----
function parseMatrixLiteral(text) {
  const match = text.match(/^\[\[(.+?)\]\]$/);
  if (!match) return null;
  const inner = match[1];
  const rows = inner.split("],[").map(s => s.replace(/^\[/, "").replace(/\]$/, ""));
  const grid = rows.map(row => row.split(",").map(s => s.trim()));
  const cols = grid[0].length;
  return grid.every(row => row.length === cols) ? grid : null;
}

// ---- matrix(…) call parser ----
function parseMatrixCall(text) {
  const match = text.match(
    /^matrix\s*\(\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*"([a-zA-Z])"\s*(?:,\s*"col"\s*)?\s*)?\s*\)$/
  );
  if (!match) return null;
  const rows = parseInt(match[1], 10);
  const cols = parseInt(match[2], 10);
  const base = match[3] || "a";
  const colMode = text.includes('"col"');
  const symMat = createSymbolicMatrix(rows, cols, base, colMode);
  const allNames = [];
  symMat.grid.forEach(row => row.forEach(cell => {
    if (cell.type === "symbol") allNames.push(cell.name);
  }));
  return { matrix: symMat, symbols: allNames };
}

function resolveOperand(str, variables, symbols) {
  const s = str.trim();
  if (variables[s] && variables[s] instanceof SymbolicMatrix) return variables[s];
  const lit = parseMatrixLiteral(s);
  if (lit) return buildSymbolicMatrix(lit, symbols);
  const call = parseMatrixCall(s);
  if (call) {
    call.symbols.forEach(n => symbols.add(n));
    return call.matrix;
  }
  throw new Error(`"${s}" is not a symbolic matrix.`);
}

function buildSymbolicMatrix(grid, symbols) {
  return symbolicMatrixFromArray(grid.map(row => row.map(cell => stringToNode(cell, symbols))));
}

function stringToNode(str, symbols) {
  const t = str.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return sym(Number(t));
  if (symbols.has(t)) return sym(t);
  throw new Error(`Unknown symbol "${t}". Declare it first.`);
}

// ---- helper to push a log entry ----
function pushLog(set, get, cellId, entry) {
  set(state => ({
    cells: {
      ...state.cells,
      [cellId]: {
        ...state.cells[cellId],
        logs: [...(state.cells[cellId]?.logs || []), entry],
      },
    },
  }));
}

// ---- FIXED: parseDefineBlock – outputExprs now use ASCII '>' ----
function parseDefineBlock(rawText) {
  const trimmed = rawText.trim();
  const lines = trimmed.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  const firstLine = lines[0];
  const defineMatch = firstLine.match(/^define\s+([a-zA-Z_]\w*)\s*:\s*$/);
  if (!defineMatch) return null;

  const gateName = defineMatch[1];
  const mappingLines = lines.slice(1);

  const mapObj = {};
  for (const line of mappingLines) {
    const m = line.match(/^\s*\|([01+\-i]+)>\s*→\s*\|([01+\-i]+)>\s*$/);
    if (!m) return null;
    mapObj[m[1]] = m[2];
  }

  const basisKeys = Object.keys(mapObj);
  if (basisKeys.length === 0) return null;
  const numQubits = basisKeys[0].length;
  const expectedCount = 1 << numQubits;
  if (basisKeys.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} basis state mappings for a ${numQubits}‑qubit gate.`);
  }

  const sortedBasis = basisKeys.sort((a, b) => parseInt(a, 2) - parseInt(b, 2));

  const basisLabels = sortedBasis.map(b => `|${b}⟩`);             // display labels
  const outputExprs = sortedBasis.map(b => `|${mapObj[b]}>`);     // <-- ASCII '>' for preprocessor

  return { gateName, basisLabels, outputExprs, numQubits };
}

const FIRST_CELL_ID = generateCellId();

export const useQuantumStore = create((set, get) => ({
  cellOrder: [FIRST_CELL_ID],
  cells: { [FIRST_CELL_ID]: createEmptyCell() },
  activeCellId: FIRST_CELL_ID,
  setActiveCell: (id) => set(() => ({ activeCellId: id })),
  hasSeenIntro: false,
  markIntroSeen: () => set(() => ({ hasSeenIntro: true })),
  variables: {},
  symbols: new Set(),

  declareSymbols: (str) => {
    const names = str.split(/[\s,]+/).filter(Boolean);
    set(state => ({ symbols: new Set([...state.symbols, ...names]) }));
  },

  addCell: (type = "code") => {
    const newId = generateCellId();
    set(state => ({
      cellOrder: [...state.cellOrder, newId],
      cells: { ...state.cells, [newId]: createEmptyCell(type) },
    }));
    return newId;
  },

  removeCell: (cellId) => {
    set(state => {
      if (state.cellOrder.length <= 1) return state;
      const { [cellId]: _removed, ...remainingCells } = state.cells;
      const remainingOrder = state.cellOrder.filter(id => id !== cellId);
      const nextActiveCellId =
        state.activeCellId === cellId ? remainingOrder[0] : state.activeCellId;
      return {
        cellOrder: remainingOrder,
        cells: remainingCells,
        activeCellId: nextActiveCellId,
      };
    });
  },

  moveCell: (cellId, newIndex) => {
    set(state => {
      const oldIndex = state.cellOrder.indexOf(cellId);
      if (oldIndex === -1 || oldIndex === newIndex) return state;
      const newOrder = [...state.cellOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, cellId);
      return { cellOrder: newOrder };
    });
  },

  setRawInput: (cellId, text) => {
    set(state => ({
      cells: {
        ...state.cells,
        [cellId]: {
          ...state.cells[cellId],
          editor: { ...state.cells[cellId].editor, rawInput: text },
        },
      },
    }));
  },

  scheduleEvaluation: (cellId, text, delay = 500) => {
    const cell = get().cells[cellId];
    if (!cell) return;
    if (cell.editor.debounceTimer) clearTimeout(cell.editor.debounceTimer);
    const timer = setTimeout(() => get().evaluateInput(cellId, text), delay);
    set(state => ({
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
      set(state => ({
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
      const vars = get().variables;
      const syms = get().symbols;

      // ---- NEW: define block (with safer evaluation) ----
      const defineParsed = parseDefineBlock(rawText);
      if (defineParsed) {
        const { gateName, basisLabels, outputExprs, numQubits } = defineParsed;

        const outputColumns = [];
        for (let i = 0; i < outputExprs.length; i++) {
          const expr = outputExprs[i];
          let preprocessed;
          try {
            preprocessed = preprocessDirac(expr);
          } catch (e) {
            throw new Error(
              `Could not process Dirac notation "${expr}". ${e.message}`
            );
          }
          let mat;
          try {
            mat = math.evaluate(preprocessed, {});
          } catch (e) {
            throw new Error(
              `Could not evaluate "${preprocessed}" for output ${expr}. ${e.message}`
            );
          }
          if (typeof mat.toArray !== "function") {
            throw new Error(
              `Output ${expr} did not evaluate to a matrix.`
            );
          }
          outputColumns.push(mat.toArray());
        }

        const n = outputColumns.length;
        const finalMatrix = [];
        for (let r = 0; r < n; r++) {
          const row = [];
          for (let c = 0; c < n; c++) {
            const col = outputColumns[c];
            row.push(Array.isArray(col[r]) ? col[r][0] : col[r]);
          }
          finalMatrix.push(row);
        }

        const gateMatrix = math.matrix(finalMatrix);
        set(state => ({
          variables: { ...state.variables, [gateName]: gateMatrix },
        }));

        // ---- CHANGED: call detailed derivation ----
        const frames = generateGateDerivationDetailed(outputColumns, basisLabels, gateName);

        set(state => ({
          cells: {
            ...state.cells,
            [cellId]: {
              ...state.cells[cellId],
              evaluation: {
                result: gateMatrix,
                error: null,
                operationType: "define",
              },
              stepper: { frames, currentFrameIndex: 0, isPlaying: false },
            },
          },
        }));
        pushLog(set, get, cellId, {
          timestamp: new Date().toISOString(),
          input: rawText,
          result: `Gate "${gateName}" derived`,
          error: null,
        });
        return;
      }

      // ---- 0. If the whole expression is a variable that holds a symbolic matrix, display it ----
      if (/^[a-zA-Z_]\w*$/.test(expression) && vars[expression] instanceof SymbolicMatrix) {
        set(state => ({
          cells: {
            ...state.cells,
            [cellId]: {
              ...state.cells[cellId],
              evaluation: { result: vars[expression], error: null, operationType: "symbolic" },
              stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
            },
          },
        }));
        pushLog(set, get, cellId, {
          timestamp: new Date().toISOString(),
          input: rawText,
          result: "displayed symbolic matrix",
          error: null,
        });
        return;
      }

      const hasMatrixCall = /matrix\s*\(/.test(expression);
      const hasSymbol = hasDeclaredSymbols(expression, syms);
      const hasSymVar = hasSymbolicVariable(expression, vars);

      // ---- 2. symbols declaration ----
      if (/^\s*symbols\b/.test(expression)) {
        const decl = expression.replace(/^symbols\s*/, "").trim();
        get().declareSymbols(decl);
        set(state => ({
          cells: {
            ...state.cells,
            [cellId]: {
              ...state.cells[cellId],
              evaluation: {
                result: { message: `Symbols declared: ${decl}` },
                error: null,
                operationType: "symbols",
              },
              stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
            },
          },
        }));
        pushLog(set, get, cellId, {
          timestamp: new Date().toISOString(),
          input: rawText,
          result: `Symbols declared: ${decl}`,
          error: null,
        });
        return;
      }

      // ---- 3. standalone matrix() ----
      if (/^\s*matrix\s*\(/.test(expression)) {
        const call = parseMatrixCall(expression);
        if (!call) throw new Error("Invalid matrix() syntax.");
        get().declareSymbols(call.symbols.join(","));
        set(state => ({
          cells: {
            ...state.cells,
            [cellId]: {
              ...state.cells[cellId],
              evaluation: { result: call.matrix, error: null, operationType: "matrix" },
              stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
            },
          },
        }));
        pushLog(set, get, cellId, {
          timestamp: new Date().toISOString(),
          input: rawText,
          result: "created symbolic matrix",
          error: null,
        });
        return;
      }

      // ---- 4. let (variable definition) ----
      if (/^\s*let\s+[a-zA-Z_]\w*\s*=/.test(expression)) {
        const match = expression.match(/^\s*let\s+([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        if (!match) throw new Error("Use 'let name = expr'.");
        const varName = match[1];
        const rhs = match[2].trim();

        // RHS matrix() ?
        const call = parseMatrixCall(rhs);
        if (call) {
          get().declareSymbols(call.symbols.join(","));
          set(state => ({
            variables: { ...state.variables, [varName]: call.matrix },
            cells: {
              ...state.cells,
              [cellId]: {
                ...state.cells[cellId],
                evaluation: { result: call.matrix, error: null, operationType: "let" },
                stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
              },
            },
          }));
          pushLog(set, get, cellId, {
            timestamp: new Date().toISOString(),
            input: rawText,
            result: `stored as ${varName}`,
            error: null,
          });
          return;
        }

        // RHS matrix literal ?
        const lit = parseMatrixLiteral(rhs);
        if (lit) {
          const symMat = buildSymbolicMatrix(lit, syms);
          set(state => ({
            variables: { ...state.variables, [varName]: symMat },
            cells: {
              ...state.cells,
              [cellId]: {
                ...state.cells[cellId],
                evaluation: { result: symMat, error: null, operationType: "let" },
                stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
              },
            },
          }));
          pushLog(set, get, cellId, {
            timestamp: new Date().toISOString(),
            input: rawText,
            result: `stored as ${varName}`,
            error: null,
          });
          return;
        }

        // numeric let
        const preprocessed = preprocessDirac(rhs);
        const scope = { ...vars };
        const value = math.evaluate(preprocessed, scope);
        set(state => ({
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
        pushLog(set, get, cellId, {
          timestamp: new Date().toISOString(),
          input: rawText,
          result: `stored as ${varName}`,
          error: null,
        });
        return;
      }

      // ---- 5. symbolic expressions (now also includes variables holding symbolic matrices) ----
      if (hasMatrixCall || hasSymbol || hasSymVar) {
        if (/\*/.test(expression)) {
          const parts = expression.split("*").map(s => s.trim());
          if (parts.length !== 2) throw new Error("Symbolic multiplication requires exactly two operands.");
          const A = resolveOperand(parts[0], vars, syms);
          const B = resolveOperand(parts[1], vars, syms);
          if (A instanceof SymbolicMatrix && B instanceof SymbolicMatrix) {
            const frames = generateMultiplicationSteps(A.grid, B.grid, symbolicOps)
              .map(f => ({ ...f, chainStep: 0 }));
            set(state => ({
              cells: {
                ...state.cells,
                [cellId]: {
                  ...state.cells[cellId],
                  evaluation: { result: null, error: null, operationType: "multiplication" },
                  stepper: { frames, currentFrameIndex: 0, isPlaying: false },
                },
              },
            }));
            pushLog(set, get, cellId, {
              timestamp: new Date().toISOString(),
              input: rawText,
              result: "symbolic multiplication (see stepper)",
              error: null,
            });
            return;
          }
          throw new Error("Symbolic multiplication supports only matrix × matrix.");
        }

        const kronMatch = expression.match(/^kron\(([^,]+),(.+)\)$/);
        if (kronMatch) {
          const A = resolveOperand(kronMatch[1].trim(), vars, syms);
          const B = resolveOperand(kronMatch[2].trim(), vars, syms);
          if (A instanceof SymbolicMatrix && B instanceof SymbolicMatrix) {
            const frames = generateKroneckerSteps(A.grid, B.grid, symbolicOps);
            set(state => ({
              cells: {
                ...state.cells,
                [cellId]: {
                  ...state.cells[cellId],
                  evaluation: { result: null, error: null, operationType: "kronecker" },
                  stepper: { frames, currentFrameIndex: 0, isPlaying: false },
                },
              },
            }));
            pushLog(set, get, cellId, {
              timestamp: new Date().toISOString(),
              input: rawText,
              result: "symbolic Kronecker (see stepper)",
              error: null,
            });
            return;
          }
          throw new Error("Symbolic Kronecker requires two matrices.");
        }

        throw new Error("Symbolic expressions can only be multiplication or Kronecker product.");
      }

      // ---- 6. Numeric evaluation (Math.js) ----
      let preprocessed;
      try {
        preprocessed = preprocessDirac(expression);
      } catch (preErr) {
        throw new Error("Invalid Dirac notation. Make sure you use |0>, <0|, |10>, etc. correctly.");
      }

      const scope = { ...vars };
      const result = math.evaluate(preprocessed, scope);
      let opType = detectOperationType(expression);
      if (opType === "gate" && !isGateMatrix(result)) opType = "unknown";

      set(state => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            evaluation: { result, error: null, operationType: opType },
          },
        },
      }));

      if (opType === "multiplication" || opType === "kronecker" || opType === "gate") {
        get().generateFrames(cellId, preprocessed, opType, result);
      }

      pushLog(set, get, cellId, {
        timestamp: new Date().toISOString(),
        input: rawText,
        result: "evaluated",
        error: null,
      });
    } catch (err) {
      const friendly = friendlyError(err, expression);
      set(state => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            evaluation: { ...state.cells[cellId].evaluation, error: friendly, result: null },
            stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
          },
        },
      }));
      pushLog(set, get, cellId, {
        timestamp: new Date().toISOString(),
        input: rawText,
        result: null,
        error: friendly,
      });
    }
  },

  clearLogs: (cellId) => {
    set(state => ({
      cells: {
        ...state.cells,
        [cellId]: { ...state.cells[cellId], logs: [] },
      },
    }));
  },

  generateFrames: (cellId, preprocessedInput, operationType, result) => {
    // unchanged numeric frame generation
    try {
      let frames = [];
      if (operationType === "kronecker") {
        const match = preprocessedInput.match(/kron\(([^,]+),(.+)\)$/);
        if (match) {
          const A = math.evaluate(match[1], { ...get().variables }).toArray();
          const B = math.evaluate(match[2], { ...get().variables }).toArray();
          frames = generateKroneckerSteps(A, B, numericOps);
        }
      } else if (operationType === "multiplication") {
        const parts = preprocessedInput.split("*").map(s => s.trim());
        if (parts.length === 2) {
          const A = math.evaluate(parts[0], { ...get().variables }).toArray();
          const B = math.evaluate(parts[1], { ...get().variables }).toArray();
          frames = generateMultiplicationSteps(A, B, numericOps).map(f => ({ ...f, chainStep: 0 }));
        } else {
          let current = math.evaluate(parts[0], { ...get().variables });
          for (let i = 1; i < parts.length; i++) {
            const next = math.evaluate(parts[i], { ...get().variables });
            const A = current.toArray();
            const B = next.toArray();
            const steps = generateMultiplicationSteps(A, B, numericOps).map(f => ({ ...f, chainStep: i - 1 }));
            frames.push(...steps);
            current = math.multiply(current, next);
          }
        }
      } else if (operationType === "gate") {
        const gateMatrix = result.toArray();
        frames = generateGateExplanationSteps(gateMatrix, preprocessedInput.trim()).map(f => ({ ...f, chainStep: 0 }));
      }
      set(state => ({
        cells: {
          ...state.cells,
          [cellId]: {
            ...state.cells[cellId],
            stepper: { frames, currentFrameIndex: 0, isPlaying: false },
          },
        },
      }));
    } catch (e) {
      console.error("Frame generation error", e);
    }
  },

  nextFrame: (cellId) => {
    set(state => {
      const cell = state.cells[cellId];
      if (!cell) return state;
      const next = Math.min(cell.stepper.currentFrameIndex + 1, cell.stepper.frames.length - 1);
      return {
        cells: {
          ...state.cells,
          [cellId]: { ...cell, stepper: { ...cell.stepper, currentFrameIndex: next } },
        },
      };
    });
  },

  prevFrame: (cellId) => {
    set(state => {
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
    set(state => {
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

  setFrameIndex: (cellId, idx) => {
    set(state => {
      const cell = state.cells[cellId];
      if (!cell) return state;
      return {
        cells: {
          ...state.cells,
          [cellId]: { ...cell, stepper: { ...cell.stepper, currentFrameIndex: idx } },
        },
      };
    });
  },

  setCellType: (cellId, type) => {
    set(state => ({
      cells: {
        ...state.cells,
        [cellId]: { ...state.cells[cellId], type },
      },
    }));
  },
}));

export { math };