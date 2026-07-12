// src/components/visualizer/MatrixStepper.jsx
//
// Visual Stepper Orchestration Engine
// -----------------------------------------------------------------------
// NOW supports "mapping", "outer-product", and "addition" frames for
// equation‑rich gate derivation.

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { useQuantumStore } from "../../store/useQuantumStore";
import { MatrixCell } from "./MatrixCell";
import { KroneckerStepper } from "./KroneckerStepper";
import { GateColumnDisplay } from "./GateStepper";
import { MATRIX_MORPH, PLAYFUL_BOUNCE, cascadeTransition } from "../../lib/motionPresets";
import { SymbolicMatrix, SymbolicScalar, SymbolicNode } from "../../lib/symbolicEngine";

export function MatrixStepper({ cellId }) {
  const frames = useQuantumStore((s) => s.cells[cellId]?.stepper.frames ?? []);
  const currentFrameIndex = useQuantumStore(
    (s) => s.cells[cellId]?.stepper.currentFrameIndex ?? 0
  );
  const isPlaying = useQuantumStore((s) => s.cells[cellId]?.stepper.isPlaying ?? false);
  const nextFrame = useQuantumStore((s) => s.nextFrame);
  const rawResult = useQuantumStore((s) => s.cells[cellId]?.evaluation.result);
  const errorMessage = useQuantumStore((s) => s.cells[cellId]?.evaluation.error);

  const currentFrame = frames[currentFrameIndex];

  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    if (currentFrameIndex >= frames.length - 1) return;

    const timer = setTimeout(() => {
      nextFrame(cellId);
    }, 1100);

    return () => clearTimeout(timer);
  }, [isPlaying, currentFrameIndex, frames.length, nextFrame, cellId]);

  const { matrixA, matrixB, resultDims } = useMemo(() => {
    if (!frames.length) return { matrixA: null, matrixB: null, resultDims: null };

    const currentChainStep = currentFrame?.chainStep ?? 0;
    const computeFrames = frames.filter(
      (f) => f.type === "cell-compute" && f.chainStep === currentChainStep
    );
    if (!computeFrames.length) return { matrixA: null, matrixB: null, resultDims: null };

    const aRows = new Map();
    const bCols = new Map();
    let maxRow = 0;
    let maxCol = 0;

    computeFrames.forEach((f) => {
      aRows.set(f.rowIndex, f.rowValues);
      bCols.set(f.colIndex, f.colValues);
      maxRow = Math.max(maxRow, f.rowIndex);
      maxCol = Math.max(maxCol, f.colIndex);
    });

    const A = Array.from({ length: maxRow + 1 }, (_, r) => aRows.get(r));
    const bColCount = maxCol + 1;
    const bRowCount = bCols.get(0)?.length ?? 0;
    const B = Array.from({ length: bRowCount }, (_, r) =>
      Array.from({ length: bColCount }, (_, c) => bCols.get(c)[r])
    );

    return {
      matrixA: A,
      matrixB: B,
      resultDims: { rows: maxRow + 1, cols: maxCol + 1 },
    };
  }, [frames, currentFrame]);

  if (!frames.length && !rawResult && !errorMessage) {
    return null;
  }

  if (!frames.length && rawResult) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <StaticResultDisplay result={rawResult} cellId={cellId} />
      </div>
    );
  }

  if (!currentFrame) return null;

  return (
    <div className="flex flex-col py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-code text-[10px] uppercase tracking-wider text-slate-400">
          Out
        </span>
        <span className="font-code text-[10px] text-slate-400">
          Step {currentFrameIndex + 1} / {frames.length}
        </span>
      </div>

      <div className="flex flex-col items-center gap-6">
        {currentFrame.type === "cell-compute" && matrixA && matrixB && (
          <MultiplicationFrame
            cellId={cellId}
            frame={currentFrame}
            matrixA={matrixA}
            matrixB={matrixB}
            resultDims={resultDims}
          />
        )}

        {currentFrame.type === "block-compute" && (
          <KroneckerStepper cellId={cellId} frame={currentFrame} />
        )}

        {currentFrame.type === "gate-column" && (
          <GateColumnDisplay cellId={cellId} frame={currentFrame} />
        )}

        {currentFrame.type === "mapping" && (
          <MappingDisplay cellId={cellId} frame={currentFrame} />
        )}

        {currentFrame.type === "outer-product" && (
          <OuterProductDisplay cellId={cellId} frame={currentFrame} />
        )}

        {currentFrame.type === "addition" && (
          <AdditionDisplay cellId={cellId} frame={currentFrame} />
        )}

        {currentFrame.type === "complete" && (
          <CompleteFrame
            cellId={cellId}
            resultSoFar={currentFrame.resultSoFar}
            isKronecker={Boolean(currentFrame.matrixA)}
            isGate={Boolean(currentFrame.gateName)}
            isDefine={currentFrame.gateName && !currentFrame.resultSoFar}
            matrix={currentFrame.matrix}
            gateName={currentFrame.gateName}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Multiplication frame (unchanged) ----------
function MultiplicationFrame({ cellId, frame, matrixA, matrixB, resultDims }) {
  const { rowIndex, colIndex, terms, resultSoFar, runningSum, chainStep = 0 } = frame;

  const sumString = terms
    .map((term) => {
      const aStr = term.a instanceof SymbolicNode ? term.a.toLatex() : formatShort(term.a);
      const bStr = term.b instanceof SymbolicNode ? term.b.toLatex() : formatShort(term.b);
      return `${aStr} × ${bStr}`;
    })
    .join(" + ");

  const resultString = runningSum instanceof SymbolicNode ? runningSum.toLatex() : formatShort(runningSum);

  const prefix = `${cellId}-chain${chainStep}`;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="max-w-md rounded-lg border border-cyan-quantum-200 bg-cyan-quantum-50/60 p-3 text-center">
        <p className="font-ui text-xs text-cyan-quantum-700">
          Computing result cell <span className="font-code">[{rowIndex}][{colIndex}]</span>{" "}
          = row {rowIndex} of A · column {colIndex} of B
        </p>
        <p className="mt-1 font-math text-xs text-slate-700">
          {sumString} = {resultString}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <MatrixGrid
          matrix={matrixA}
          getLayoutId={(r, c) => `${prefix}-A-${r}-${c}`}
          getState={(r) => (r === rowIndex ? "row-highlight" : "idle")}
        />
        <span className="font-math text-xl text-slate-400">×</span>
        <MatrixGrid
          matrix={matrixB}
          getLayoutId={(r, c) => `${prefix}-B-${r}-${c}`}
          getState={(_r, c) => (c === colIndex ? "col-highlight" : "idle")}
        />
      </div>

      <AnimatePresence mode="popLayout">
        <div className="flex items-center gap-2">
          {terms.map((term, k) => (
            <motion.div
              key={`${prefix}-term-${k}`}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={cascadeTransition(k, 0.08)}
              className="flex items-center gap-1"
            >
              <MatrixCell value={term.a} layoutId={`${prefix}-term-a-${k}`} variant="term" state="active" />
              <span className="font-math text-slate-400">×</span>
              <MatrixCell value={term.b} layoutId={`${prefix}-term-b-${k}`} variant="term" state="active" />
              {k < terms.length - 1 && <span className="font-math ml-1 text-slate-400">+</span>}
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      <span className="text-slate-400">↓</span>

      <MatrixGrid
        matrix={resultSoFar}
        getLayoutId={(r, c) => `${prefix}-result-${r}-${c}`}
        getState={(r, c) =>
          r === rowIndex && c === colIndex
            ? "active"
            : resultSoFar[r][c] !== null
            ? "settled"
            : "idle"
        }
      />
    </div>
  );
}

// ---------- Mapping Display (NEW) ----------
function MappingDisplay({ cellId, frame }) {
  const { gateName, stepIndex, inputBasis, outputVector } = frame;

  return (
    <motion.div
      className="flex flex-col items-center gap-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <p className="font-ui text-xs text-slate-500">
        Known equation:
      </p>
      <div className="flex items-center gap-3">
        <span className="font-code text-lg text-slate-800">{gateName}</span>
        <span className="font-code text-lg text-cyan-quantum-600">{inputBasis}</span>
        <span className="font-math text-xl text-slate-400">=</span>
        <div className="flex flex-col gap-1 rounded-lg border border-purple-200 bg-purple-50/60 p-2">
          {outputVector.map((row, r) => (
            <div key={r} className="flex gap-1">
              <MatrixCell
                value={row[0]}
                layoutId={`${cellId}-map-${stepIndex}-${r}`}
                state="settled"
              />
            </div>
          ))}
        </div>
      </div>
      <p className="font-ui text-xs text-slate-400">
        This tells us that <strong>column {stepIndex}</strong> of {gateName} is the vector above.
      </p>
    </motion.div>
  );
}

// ---------- Outer Product Display ----------
function OuterProductDisplay({ cellId, frame }) {
  const { gateName, stepIndex, inputBasis, outputVector, basisRow, outerMatrix } = frame;

  const rowVectorDisplay = [basisRow];

  return (
    <motion.div
      className="flex flex-col items-center gap-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <p className="font-ui text-xs text-slate-500">
        Compute the outer product{" "}
        <span className="font-code">|output⟩⟨{inputBasis.slice(1, -1)}|</span>
        {" "}to place the column in the matrix:
      </p>

      <div className="flex items-center gap-3">
        {/* Output ket (column) */}
        <div className="flex flex-col gap-1 rounded-lg border border-purple-200 bg-purple-50/60 p-2">
          {outputVector.map((row, r) => (
            <div key={r} className="flex gap-1">
              <MatrixCell
                value={row[0]}
                layoutId={`${cellId}-outcol-${stepIndex}-${r}`}
                state="settled"
              />
            </div>
          ))}
        </div>

        <span className="font-math text-xl text-slate-400">⟨{inputBasis.slice(1, -1)}|</span>

        {/* Row vector (bra) */}
        <div className="flex gap-1 rounded-lg border border-cyan-quantum-200 bg-cyan-quantum-50/60 p-2">
          {rowVectorDisplay[0].map((val, c) => (
            <MatrixCell
              key={c}
              value={val}
              layoutId={`${cellId}-row-${stepIndex}-${c}`}
              state="idle"
            />
          ))}
        </div>
      </div>

      <span className="text-slate-400">=</span>

      {/* Outer product matrix */}
      <div className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
        {outerMatrix.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((val, c) => (
              <MatrixCell
                key={c}
                value={val}
                layoutId={`${cellId}-outer-${stepIndex}-${r}-${c}`}
                state="active"
              />
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ---------- Addition Display (NEW) ----------
function AdditionDisplay({ cellId, frame }) {
  const { gateName, stepIndex, prevMatrix, outerMatrix, newMatrix } = frame;

  return (
    <motion.div
      className="flex flex-col items-center gap-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <p className="font-ui text-xs text-slate-500">
        Add this outer product to the running total matrix of {gateName}:
      </p>

      <div className="flex items-center gap-3">
        {/* Previous accumulator */}
        <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          {prevMatrix.map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map((val, c) => (
                <MatrixCell
                  key={c}
                  value={val}
                  layoutId={`${cellId}-prev-${stepIndex}-${r}-${c}`}
                  state="idle"
                />
              ))}
            </div>
          ))}
        </div>

        <span className="font-math text-xl text-slate-400">+</span>

        {/* Outer product (new column highlighted) */}
        <div className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
          {outerMatrix.map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map((val, c) => (
                <MatrixCell
                  key={c}
                  value={val}
                  layoutId={`${cellId}-outer2-${stepIndex}-${r}-${c}`}
                  state="active"
                />
              ))}
            </div>
          ))}
        </div>

        <span className="font-math text-xl text-slate-400">=</span>

        {/* New accumulator (column placed) */}
        <div className="flex flex-col gap-1 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
          {newMatrix.map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map((val, c) => (
                <MatrixCell
                  key={c}
                  value={val}
                  layoutId={`${cellId}-new-${stepIndex}-${r}-${c}`}
                  state={c <= stepIndex ? "settled" : "idle"}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="font-code text-[10px] text-slate-400">
        After placing column {stepIndex}, the matrix now has {stepIndex + 1} / {newMatrix.length} columns filled.
      </p>
    </motion.div>
  );
}

// ---------- Complete Frame ----------
function CompleteFrame({ cellId, resultSoFar, isKronecker, isGate, isDefine, matrix, gateName }) {
  if ((isGate || isDefine) && matrix) {
    return (
      <motion.div
        className="flex flex-col items-center gap-2"
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        transition={PLAYFUL_BOUNCE}
      >
        <span className="font-code text-[10px] uppercase tracking-wider text-emerald-600/70">
          {gateName} · Full Matrix
        </span>
        <MatrixGrid
          matrix={matrix}
          getLayoutId={(r, c) => `${cellId}-result-${r}-${c}`}
          getState={() => "settled"}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={PLAYFUL_BOUNCE}
    >
      <span className="font-code text-[10px] uppercase tracking-wider text-emerald-600/70">
        Complete{isKronecker ? " · Kronecker Product" : ""}
      </span>
      <MatrixGrid
        matrix={resultSoFar}
        getLayoutId={(r, c) => `${cellId}-result-${r}-${c}`}
        getState={() => "settled"}
      />
    </motion.div>
  );
}

// ---------- MatrixGrid ----------
function MatrixGrid({ matrix, getLayoutId, getState }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
      {matrix.map((row, r) => (
        <div key={r} className="flex gap-1">
          {row.map((val, c) => (
            <MatrixCell
              key={c}
              value={val}
              layoutId={getLayoutId(r, c)}
              state={getState(r, c)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Helpers ----------
function formatShort(value) {
  if (value === null || value === undefined) return "?";
  if (value instanceof SymbolicNode) return value.toLatex();
  if (typeof value === "object" && "re" in value) {
    const r = round(value.re);
    const i = round(value.im);
    if (i === 0) return r;
    const sign = i < 0 ? "-" : "+";
    return `${r} ${sign} ${Math.abs(i)}i`;
  }
  return round(value);
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// ---------- Static Result Display ----------
function StaticResultDisplay({ result, cellId }) {
  if (result === null || result === undefined) return null;
  if (result instanceof SymbolicMatrix) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
        <MatrixGrid matrix={result.grid} getLayoutId={(r, c) => `${cellId}-static-${r}-${c}`} getState={() => "settled"} />
      </div>
    );
  }
  if (result instanceof SymbolicScalar) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 font-math">
        <InlineMath math={result.toLatex()} />
      </div>
    );
  }
  if (typeof result === "object" && result !== null && !Array.isArray(result) && !result.toArray) {
    if (typeof result.message === "string") {
      return (
        <div className="rounded-lg border border-purple-200 bg-purple-50/60 p-4 font-ui text-sm text-purple-800">
          {result.message}
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 font-code text-xs text-slate-600">
        {JSON.stringify(result, null, 2)}
      </div>
    );
  }
  let matrix = null;
  try {
    if (typeof result.toArray === "function") {
      const arr = result.toArray();
      matrix = Array.isArray(arr[0]) ? arr : [arr];
    } else if (Array.isArray(result)) {
      matrix = Array.isArray(result[0]) ? result : [result];
    }
  } catch { matrix = null; }
  if (matrix) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
        <MatrixGrid matrix={matrix} getLayoutId={(r, c) => `${cellId}-static-${r}-${c}`} getState={() => "settled"} />
      </div>
    );
  }
  const latex = resultToLatex(result);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 font-math">
      <InlineMath math={latex} />
    </div>
  );
}

function resultToLatex(result) {
  if (typeof result !== "object" || result === null) return `${result}`;
  if ("re" in result && "im" in result && !result.toArray) {
    return `${round(result.re)} ${result.im < 0 ? "-" : "+"} ${Math.abs(round(result.im))}i`;
  }
  let arr;
  if (result.toArray) arr = result.toArray();
  else if (Array.isArray(result)) arr = result;
  else return result.toString ? result.toString() : String(result);
  const rows2D = Array.isArray(arr[0]) ? arr : [arr];
  const body = rows2D.map(row => row.map(v => `${v}`).join(" & ")).join(" \\\\ ");
  return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
}