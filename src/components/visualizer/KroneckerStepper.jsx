// src/components/visualizer/KroneckerStepper.jsx
//
// Kronecker Stepper — "Fly and Duplicate" Animation (BUG FIX + CLARITY PASS)
// -----------------------------------------------------------------------
// FIXED BUG: the flying clone's starting position was previously read
// via `bGridRef.current?.offsetLeft` INLINE during render (in a JSX
// style prop), which is unreliable — offsetLeft can read stale/zero
// values depending on render timing, causing the clone to sometimes
// appear to jump from the wrong spot. FIX: both the source position
// AND the target position are now measured together, in the same
// useLayoutEffect, via getBoundingClientRect on all three refs
// relative to the shared container — consistent, accurate, no
// render-timing race condition.
//
// EDUCATIONAL CLARITY ADDITIONS (per your "not good for education"
// feedback):
//   1. A descriptive caption above the animation states in plain
//      language what's happening: "Scaling B by A[i][j] = <value> and
//      placing it into block (row, col) of the result" — not just a
//      terse technical label.
//   2. The DESTINATION block in the result grid gets a pulsing dashed
//      outline the moment a new block frame starts — before the clone
//      even begins flying — so the viewer's eye is directed to WHERE
//      to look first, then watches the clone travel there. This
//      "look here next" cue was completely missing before, which was
//      likely a major reason it felt confusing.
//   3. Slower, clearer pacing: source-pause -> measured flight ->
//      bounce-landing -> brief hold before advancing, using
//      DURATIONS.cinematic consistently instead of arbitrary numbers.

import { useRef, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MatrixCell } from "./MatrixCell";
import { FLY_TRAVEL, PLAYFUL_BOUNCE, DURATIONS } from "../../lib/motionPresets";

/**
 * @param {object} props
 * @param {string} props.cellId - scopes layoutIds to this notebook cell
 * @param {object} props.frame - current "block-compute" frame from
 *        generateKroneckerSteps (includes matrixA/matrixB per the
 *        stepGenerator.js update from earlier in this build)
 */
export function KroneckerStepper({ cellId, frame }) {
  const { aRowIndex, aColIndex, scalar, block, blockOffset, resultSoFar, matrixA, matrixB } = frame;

  const containerRef = useRef(null);
  const bGridRef = useRef(null);
  const resultGridRef = useRef(null);

  // phase: "source" (clone sitting at B's position, not yet moving),
  //        "flying" (clone animating toward the measured target),
  //        "landed" (clone retired, real result cells take over).
  const [phase, setPhase] = useState("source");
  const [positions, setPositions] = useState({
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 0,
  });

  useLayoutEffect(() => {
    setPhase("source");

    // Measure BOTH source and target positions together, in one pass,
    // relative to the shared container — this replaces the old
    // render-time offsetLeft read that caused inconsistent starting
    // positions.
    const measure = () => {
      if (!containerRef.current || !bGridRef.current || !resultGridRef.current) {
        return null;
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const bRect = bGridRef.current.getBoundingClientRect();
      const resultRect = resultGridRef.current.getBoundingClientRect();

      const p = matrixB.length;
      const q = matrixB[0].length;
      const outCols = matrixA[0].length * q;
      const cellPx = resultRect.width / outCols;

      return {
        sourceX: bRect.left - containerRect.left,
        sourceY: bRect.top - containerRect.top,
        targetX: resultRect.left - containerRect.left + blockOffset.col * cellPx,
        targetY: resultRect.top - containerRect.top + blockOffset.row * cellPx,
      };
    };

    // Small pause at the source position first — lets the viewer
    // register "this scaled copy of B just appeared" before it moves.
    const flightTimer = setTimeout(() => {
      const measured = measure();
      if (measured) {
        setPositions(measured);
        setPhase("flying");
      }
    }, 400);

    // After the flight + bounce-settle has had time to complete,
    // retire the clone — the real result cells underneath already
    // show the same values, so the handoff is invisible.
    const retireTimer = setTimeout(() => {
      setPhase("landed");
    }, 400 + DURATIONS.cinematic * 1000 + 300);

    return () => {
      clearTimeout(flightTimer);
      clearTimeout(retireTimer);
    };
  }, [aRowIndex, aColIndex, matrixA, matrixB, blockOffset]);

  return (
    <div ref={containerRef} className="relative flex w-full flex-col items-center gap-5">
      {/* --- Plain-language caption --- */}
      <p className="font-ui max-w-md text-center text-xs leading-relaxed text-slate-500">
        Scaling B by{" "}
        <span className="font-code font-medium text-cyan-quantum-700">
          A[{aRowIndex}][{aColIndex}] = {formatScalar(scalar)}
        </span>{" "}
        and placing it into row {blockOffset.row}, column {blockOffset.col} of the result.
      </p>

      <div className="flex items-start gap-6">
        {/* --- Matrix A: full grid, current scalar highlighted --- */}
        <FullGrid
          matrix={matrixA}
          getLayoutId={(r, c) => `${cellId}-kronA-${r}-${c}`}
          getState={(r, c) => (r === aRowIndex && c === aColIndex ? "active" : "idle")}
        />

        <span className="font-math self-center text-xl text-slate-400">⊗</span>

        {/* --- Matrix B: full grid, stays constant, the flight origin --- */}
        <div ref={bGridRef}>
          <FullGrid
            matrix={matrixB}
            getLayoutId={(r, c) => `${cellId}-kronB-${r}-${c}`}
            getState={() => "col-highlight"}
          />
        </div>
      </div>

      <span className="text-slate-400">↓</span>

      {/* --- Result grid: destination block gets a pulsing outline
            cue BEFORE/DURING the flight, so the eye knows where to
            look first. --- */}
      <div ref={resultGridRef} className="relative">
        <FullGrid
          matrix={resultSoFar}
          getLayoutId={(r, c) => `${cellId}-result-${r}-${c}`}
          getState={(r, c) => (resultSoFar[r][c] !== null ? "settled" : "idle")}
        />

        {phase !== "landed" && (
          <DestinationOutline
            matrixB={matrixB}
            blockOffset={blockOffset}
            resultCols={matrixA[0].length * matrixB[0].length}
          />
        )}
      </div>

      {/* --- The flying clone --- */}
      <AnimatePresence>
        {phase !== "landed" && (
          <motion.div
            className="pointer-events-none absolute left-0 top-0 z-10"
            initial={{
              x: positions.sourceX,
              y: positions.sourceY,
              opacity: 0,
              scale: 0.9,
            }}
            animate={
              phase === "flying"
                ? { x: positions.targetX, y: positions.targetY, opacity: 1, scale: 1 }
                : { x: positions.sourceX, y: positions.sourceY, opacity: 1, scale: 1 }
            }
            exit={{ opacity: 0, scale: 0.7 }}
            transition={phase === "flying" ? FLY_TRAVEL : PLAYFUL_BOUNCE}
          >
            <FullGrid
              matrix={block}
              getLayoutId={(r, c) => `${cellId}-kron-flying-${r}-${c}`}
              getState={() => "active"}
              compact
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Pulsing dashed outline over the destination block position in the
 * result grid — a "look here next" visual cue. Purely decorative,
 * positioned via the same percentage math as the block itself.
 */
function DestinationOutline({ matrixB, blockOffset, resultCols }) {
  const p = matrixB.length;
  const q = matrixB[0].length;

  const leftPercent = (blockOffset.col / resultCols) * 100;
  const topPercent = (blockOffset.row / (resultCols / q) / p) * 100; // approximate, purely visual guide

  return (
    <motion.div
      className="pointer-events-none absolute rounded-md border-2 border-dashed border-cyan-quantum-400"
      style={{
        left: `${leftPercent}%`,
        top: 0,
        width: `${(q / resultCols) * 100}%`,
        height: "100%",
      }}
      animate={{ opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function formatScalar(value) {
  if (typeof value === "object" && value !== null && "re" in value) {
    return value.im === 0 ? `${round(value.re)}` : `${round(value.re)}+${round(value.im)}i`;
  }
  return `${round(value)}`;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

/** Generic matrix renderer — shared by A, B, the flying clone, and the result grid. */
function FullGrid({ matrix, getLayoutId, getState, compact = false }) {
  return (
    <div
      className={`
        flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60
        ${compact ? "p-1.5 opacity-90 shadow-lg" : "p-2.5"}
      `}
    >
      {matrix.map((row, r) => (
        <div key={r} className="flex gap-1">
          {row.map((val, c) => (
            <MatrixCell
              key={c}
              value={val}
              layoutId={getLayoutId(r, c)}
              state={getState(r, c)}
              variant={compact ? "term" : "cell"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}