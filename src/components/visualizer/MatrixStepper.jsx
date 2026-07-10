// src/components/visualizer/MatrixStepper.jsx
//
// Visual Stepper Orchestration Engine — QUANTUM LIGHT GLASSMORPHISM
// -----------------------------------------------------------------------
// MODIFIED FOR LIGHT THEME: matrix grid containers switched from
// bg-slate-950/40 (dark well) to bg-slate-50/60 (light recessed panel),
// borders from slate-800/40 to slate-200. Text labels flipped from
// light-on-dark to dark-on-light. All KaTeX/text rendering that isn't
// inside a MatrixCell now uses font-math (Source Serif 4) for the
// static-result fallback, and font-code (JetBrains Mono) for the
// technical step-counter labels.
//
// EVERYTHING ELSE — the cellId-scoped layoutId prefixing (critical fix
// from the notebook conversion), frame choreography logic, matrix
// reconstruction from frames, fallback rendering when frames are
// empty — is COMPLETELY UNCHANGED from the previous version. This file
// is theme/color changes ONLY, zero logic changes.

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { useQuantumStore } from "../../store/useQuantumStore";
import { MatrixCell } from "./MatrixCell";

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

  // --- Auto-advance playback (per-cell, calls nextFrame with THIS cellId) ---
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    if (currentFrameIndex >= frames.length - 1) return;

    const timer = setTimeout(() => {
      nextFrame(cellId);
    }, 900);

    return () => clearTimeout(timer);
  }, [isPlaying, currentFrameIndex, frames.length, nextFrame, cellId]);

  // --- Reconstruct full A and B matrices from the frame set (unchanged logic) ---
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

  // --- Fallback: no frames available ---
  if (!frames.length) {
    if (!rawResult && !errorMessage) {
      // Genuinely empty cell — don't render an awkward empty box at all.
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
          <KroneckerFrame cellId={cellId} frame={currentFrame} />
        )}

        {currentFrame.type === "complete" && (
          <CompleteFrame cellId={cellId} resultSoFar={currentFrame.resultSoFar} />
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
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
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

function KroneckerFrame({ cellId, frame }) {
  const { scalar, block, resultSoFar } = frame;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="flex items-center gap-3">
        <MatrixCell value={scalar} layoutId={`${cellId}-kron-scalar`} state="active" />
        <span className="font-math text-xl text-slate-400">⊗ B →</span>
        <MatrixGrid
          matrix={block}
          getLayoutId={(r, c) => `${cellId}-block-${r}-${c}`}
          getState={() => "active"}
        />
      </div>

      <span className="text-slate-400">↓</span>

      <MatrixGrid
        matrix={resultSoFar}
        getLayoutId={(r, c) => `${cellId}-result-${r}-${c}`}
        getState={(r, c) => (resultSoFar[r][c] !== null ? "settled" : "idle")}
      />
    </div>
  );
}

function CompleteFrame({ cellId, resultSoFar }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-code text-[10px] uppercase tracking-wider text-emerald-600/70">
        Complete
      </span>
      <MatrixGrid
        matrix={resultSoFar}
        getLayoutId={(r, c) => `${cellId}-result-${r}-${c}`}
        getState={() => "settled"}
      />
    </div>
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

function StaticResultDisplay({ result }) {
  const latex = result?.toString ? result.toString() : String(result);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 font-math">
      <InlineMath math={latex} />
    </div>
  );
}