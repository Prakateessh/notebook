// src/components/visualizer/MatrixStepper.jsx
//
// Visual Stepper Orchestration Engine
// -----------------------------------------------------------------------
// Consumes stepper.frames from the Zustand store and choreographs
// MatrixCell instances through AnimatePresence + shared layoutIds so
// Framer Motion morphs cells between frames instead of popping them.
//
// KEY CHOREOGRAPHY IDEA:
// Every cell that conceptually "is the same thing" across frames shares
// the same layoutId. That's what makes Framer Motion animate position/
// size changes as a spring-driven morph rather than a re-mount.
//
//   Matrix A cells:      "A-{row}-{col}"      (stable across all frames)
//   Matrix B cells:      "B-{row}-{col}"      (stable across all frames)
//   Floating term cells: "term-{k}"           (k = index within current
//                                               frame's terms array —
//                                               these appear/disappear
//                                               each frame, so they use
//                                               AnimatePresence exit/enter
//                                               rather than a persistent
//                                               layoutId morph)
//   Result cells:        "result-{row}-{col}" (stable across all frames;
//                                               starts as a "·" placeholder,
//                                               morphs into the computed
//                                               value when its frame hits)
//
// Because A and B layoutIds never change frame-to-frame, they don't
// "morph" visually — they stay in place while their highlight STATE
// (idle -> row-highlight -> col-highlight -> active) transitions via
// MatrixCell's own color/shadow transition. The actual MORPH (spring
// stretch/merge) happens on the floating term cells traveling toward
// the result cell, and the result cell growing from "·" to its value.
//
// FALLBACK: if frames is empty (evaluation succeeded but frame
// extraction failed — see generateFrames' regex limitations in the
// store), we just render the raw evaluation.result as a static
// KaTeX block. No morph, but the user still sees a correct answer.

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { useQuantumStore } from "../../store/useQuantumStore";
import { MatrixCell } from "./MatrixCell";

export function MatrixStepper() {
  const frames = useQuantumStore((s) => s.stepper.frames);
  const currentFrameIndex = useQuantumStore((s) => s.stepper.currentFrameIndex);
  const isPlaying = useQuantumStore((s) => s.stepper.isPlaying);
  const nextFrame = useQuantumStore((s) => s.nextFrame);
  const rawResult = useQuantumStore((s) => s.evaluation.result);
  const errorMessage = useQuantumStore((s) => s.evaluation.error);

  const currentFrame = frames[currentFrameIndex];

  // --- Auto-advance playback ---
  // When isPlaying is true, step forward automatically every 900ms.
  // Stops at the last frame (nextFrame() already clamps internally).
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    if (currentFrameIndex >= frames.length - 1) return;

    const timer = setTimeout(() => {
      nextFrame();
    }, 900);

    return () => clearTimeout(timer);
  }, [isPlaying, currentFrameIndex, frames.length, nextFrame]);

  // --- Reconstruct full A and B matrices from the frame set ---
  // Frames only carry the ACTIVE row/col per step, not the full
  // original matrices. We rebuild them by scanning all frames and
  // collecting each unique row (from rowValues) and column (from
  // colValues) — this works because a full multiplication sweep
  // visits every row and every column at least once.
  const { matrixA, matrixB, resultDims } = useMemo(() => {
    if (!frames.length) return { matrixA: null, matrixB: null, resultDims: null };

    const computeFrames = frames.filter((f) => f.type === "cell-compute");
    if (!computeFrames.length) return { matrixA: null, matrixB: null, resultDims: null };

    const aRows = new Map(); // rowIndex -> rowValues
    const bCols = new Map(); // colIndex -> colValues
    let maxRow = 0;
    let maxCol = 0;

    computeFrames.forEach((f) => {
      aRows.set(f.rowIndex, f.rowValues);
      bCols.set(f.colIndex, f.colValues);
      maxRow = Math.max(maxRow, f.rowIndex);
      maxCol = Math.max(maxCol, f.colIndex);
    });

    const A = Array.from({ length: maxRow + 1 }, (_, r) => aRows.get(r));
    // B is stored column-major in our map, transpose back to row-major
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

  // --- Fallback: no frames available, show static result ---
  if (!frames.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        {errorMessage ? (
          <p className="text-sm text-slate-600">Awaiting valid input…</p>
        ) : rawResult !== null && rawResult !== undefined ? (
          <StaticResultDisplay result={rawResult} />
        ) : (
          <p className="text-sm text-slate-600">
            Enter an expression in the editor to begin.
          </p>
        )}
      </div>
    );
  }

  if (!currentFrame) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-wide text-slate-400">
          VISUALIZER
        </h2>
        <span className="text-xs text-slate-600">
          Step {currentFrameIndex + 1} / {frames.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        {currentFrame.type === "cell-compute" && matrixA && matrixB && (
          <MultiplicationFrame
            frame={currentFrame}
            matrixA={matrixA}
            matrixB={matrixB}
            resultDims={resultDims}
          />
        )}

        {currentFrame.type === "block-compute" && (
          <KroneckerFrame frame={currentFrame} />
        )}

        {currentFrame.type === "complete" && (
          <CompleteFrame resultSoFar={currentFrame.resultSoFar} />
        )}
      </div>
    </div>
  );
}

/**
 * Renders one step of matrix multiplication: A (row highlighted),
 * B (col highlighted), floating terms mid-flight, and the
 * partially-filled result matrix.
 */
function MultiplicationFrame({ frame, matrixA, matrixB, resultDims }) {
  const { rowIndex, colIndex, terms, resultSoFar } = frame;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex items-center gap-6">
        {/* Matrix A */}
        <MatrixGrid
          matrix={matrixA}
          getLayoutId={(r, c) => `A-${r}-${c}`}
          getState={(r) => (r === rowIndex ? "row-highlight" : "idle")}
        />

        <span className="text-2xl text-slate-600">×</span>

        {/* Matrix B */}
        <MatrixGrid
          matrix={matrixB}
          getLayoutId={(r, c) => `B-${r}-${c}`}
          getState={(_r, c) => (c === colIndex ? "col-highlight" : "idle")}
        />
      </div>

      {/* Floating arithmetic terms — these animate in/out per frame
          via AnimatePresence since they don't persist across frames. */}
      <AnimatePresence mode="popLayout">
        <div className="flex items-center gap-2">
          {terms.map((term, k) => (
            <motion.div
              key={`term-${k}`}
              layout
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="flex items-center gap-1"
            >
              <MatrixCell value={term.a} layoutId={`term-a-${k}`} variant="term" state="active" />
              <span className="text-slate-500">×</span>
              <MatrixCell value={term.b} layoutId={`term-b-${k}`} variant="term" state="active" />
              {k < terms.length - 1 && (
                <span className="ml-1 text-slate-500">+</span>
              )}
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      <span className="text-slate-600">↓</span>

      {/* Result matrix, filling in as frames progress */}
      <MatrixGrid
        matrix={resultSoFar}
        getLayoutId={(r, c) => `result-${r}-${c}`}
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

/**
 * Renders one block-scaling step of a Kronecker product: the
 * active scalar from A, and the resulting scaled block landing
 * into the output matrix.
 */
function KroneckerFrame({ frame }) {
  const { scalar, block, resultSoFar } = frame;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex items-center gap-4">
        <MatrixCell value={scalar} layoutId="kron-scalar" state="active" />
        <span className="text-2xl text-slate-600">⊗ B →</span>
        <MatrixGrid
          matrix={block}
          getLayoutId={(r, c) => `block-${r}-${c}`}
          getState={() => "active"}
        />
      </div>

      <span className="text-slate-600">↓</span>

      <MatrixGrid
        matrix={resultSoFar}
        getLayoutId={(r, c) => `result-${r}-${c}`}
        getState={(r, c) => (resultSoFar[r][c] !== null ? "settled" : "idle")}
      />
    </div>
  );
}

/** Final settled frame — everything computed, all cells glow "settled". */
function CompleteFrame({ resultSoFar }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs uppercase tracking-wider text-emerald-400/70">
        Complete
      </span>
      <MatrixGrid
        matrix={resultSoFar}
        getLayoutId={(r, c) => `result-${r}-${c}`}
        getState={() => "settled"}
      />
    </div>
  );
}

/** Generic matrix renderer — a grid of MatrixCell components. */
function MatrixGrid({ matrix, getLayoutId, getState }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-800/40 bg-slate-950/40 p-3">
      {matrix.map((row, r) => (
        <div key={r} className="flex gap-1.5">
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

/** Fallback static display when step frames couldn't be generated. */
function StaticResultDisplay({ result }) {
  const latex = result?.toString ? result.toString() : String(result);
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
      <InlineMath math={latex} />
    </div>
  );
}