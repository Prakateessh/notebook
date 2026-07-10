// src/components/visualizer/MatrixStepper.jsx
//
// Visual Stepper Orchestration Engine
// -----------------------------------------------------------------------
// BUG FIX: StaticResultDisplay previously called result.toString(),
// which dumps Math.js's raw bracket-list text form (e.g. "[[0, -i],
// [i, 0]]") instead of a real matrix layout. FIX: results that are
// matrices/vectors now render as a proper KaTeX \begin{bmatrix}...\end{bmatrix}
// block, with each entry formatted through the same rectangular a+bi
// complex-number logic used everywhere else in the app (MatrixCell).
// Scalars (plain single numbers) still render as a simple inline value.

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { useQuantumStore } from "../../store/useQuantumStore";
import { MatrixCell } from "./MatrixCell";
import { KroneckerStepper } from "./KroneckerStepper";
import { MATRIX_MORPH, PLAYFUL_BOUNCE, cascadeTransition } from "../../lib/motionPresets";

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

    const computeFrames = frames.filter((f) => f.type === "cell-compute");
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
  }, [frames]);

  if (!frames.length) {
    if (!rawResult && !errorMessage) {
      return null;
    }
    return (
      <div className="flex flex-col items-center justify-center py-6">
        {errorMessage ? null : rawResult !== null && rawResult !== undefined ? (
          <StaticResultDisplay result={rawResult} />
        ) : null}
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

        {currentFrame.type === "complete" && (
          <CompleteFrame
            cellId={cellId}
            resultSoFar={currentFrame.resultSoFar}
            isKronecker={Boolean(currentFrame.matrixA)}
          />
        )}
      </div>
    </div>
  );
}

function MultiplicationFrame({ cellId, frame, matrixA, matrixB, resultDims }) {
  const { rowIndex, colIndex, terms, resultSoFar } = frame;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex items-center gap-4">
        <MatrixGrid
          matrix={matrixA}
          getLayoutId={(r, c) => `${cellId}-A-${r}-${c}`}
          getState={(r) => (r === rowIndex ? "row-highlight" : "idle")}
        />

        <span className="font-math text-xl text-slate-400">×</span>

        <MatrixGrid
          matrix={matrixB}
          getLayoutId={(r, c) => `${cellId}-B-${r}-${c}`}
          getState={(_r, c) => (c === colIndex ? "col-highlight" : "idle")}
        />
      </div>

      <AnimatePresence mode="popLayout">
        <div className="flex items-center gap-2">
          {terms.map((term, k) => (
            <motion.div
              key={`${cellId}-term-${k}`}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={cascadeTransition(k, 0.08)}
              className="flex items-center gap-1"
            >
              <MatrixCell value={term.a} layoutId={`${cellId}-term-a-${k}`} variant="term" state="active" />
              <span className="font-math text-slate-400">×</span>
              <MatrixCell value={term.b} layoutId={`${cellId}-term-b-${k}`} variant="term" state="active" />
              {k < terms.length - 1 && <span className="font-math ml-1 text-slate-400">+</span>}
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      <span className="text-slate-400">↓</span>

      <MatrixGrid
        matrix={resultSoFar}
        getLayoutId={(r, c) => `${cellId}-result-${r}-${c}`}
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

function CompleteFrame({ cellId, resultSoFar, isKronecker }) {
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

// ============================================================
// BUG FIX: proper bracketed-matrix LaTeX rendering, replacing
// the old raw result.toString() call.
// ============================================================

/** Rounds to 4 decimals, strips trailing zeros. Same logic as MatrixCell. */
function roundClean(n) {
  return Math.round(n * 10000) / 10000;
}

/** Formats one entry (real or complex) as rectangular a+bi LaTeX text. */
function formatEntryLatex(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "re" in value && "im" in value) {
    const re = roundClean(value.re);
    const im = roundClean(value.im);
    if (im === 0) return `${re}`;
    const sign = im < 0 ? "-" : "+";
    const imAbs = Math.abs(im);
    const imStr = imAbs === 1 ? "i" : `${imAbs}i`;
    return `${re} ${sign} ${imStr}`;
  }
  return `${roundClean(value)}`;
}

/**
 * Converts a Math.js evaluation result (matrix, vector, or scalar)
 * into a proper KaTeX bmatrix LaTeX string, so results like dagger(Y)
 * or |0><1| render as an actual bracketed matrix instead of raw
 * Math.js toString() text.
 */
function resultToLatex(result) {
  // Scalar (plain number or complex number, not wrapped in a matrix)
  if (typeof result !== "object" || result === null) {
    return formatEntryLatex(result);
  }
  if ("re" in result && "im" in result && !result.toArray) {
    return formatEntryLatex(result);
  }

  // Math.js Matrix or plain array — normalize to a 2D array first.
  let arr;
  if (result.toArray) {
    arr = result.toArray();
  } else if (Array.isArray(result)) {
    arr = result;
  } else {
    // Unknown shape — fall back to plain toString rather than crash.
    return result.toString ? result.toString() : String(result);
  }

  // Ensure 2D (a plain 1D array becomes a single row).
  const rows2D = Array.isArray(arr[0]) ? arr : [arr];

  const bodyRows = rows2D
    .map((row) => row.map((v) => formatEntryLatex(v)).join(" & "))
    .join(" \\\\ ");

  return `\\begin{bmatrix} ${bodyRows} \\end{bmatrix}`;
}

function StaticResultDisplay({ result }) {
  const latex = resultToLatex(result);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 font-math">
      <InlineMath math={latex} />
    </div>
  );
}