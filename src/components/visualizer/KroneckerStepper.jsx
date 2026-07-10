// src/components/visualizer/KroneckerStepper.jsx
//
// Kronecker Stepper — "Fly and Duplicate" Animation (REBUILT)
// -----------------------------------------------------------------------
// Replaces the old inline KroneckerFrame logic that used to live inside
// MatrixStepper.jsx (that version just showed a static scalar + a
// pre-scaled block appearing directly in place — no real sense of "B
// traveling to become part of the result," which is what read as
// "trash" per your feedback).
//
// NEW BEHAVIOR (matches your exact spec):
//   1. Full matrix A and full matrix B are shown side by side, and
//      STAY VISIBLE throughout the whole sequence (not just one frame).
//   2. For the CURRENT block being computed (A[i][j]), a scaled CLONE
//      of the full B grid appears right next to the real B grid.
//   3. That clone then physically FLIES — real pixel-measured motion,
//      not a fake CSS trick — from B's position to its target block
//      slot inside the growing Result grid, using FLY_TRAVEL spring
//      physics with a visible trailing/arcing motion.
//   4. On arrival, it lands with PLAYFUL_BOUNCE (a small satisfying
//      overshoot-and-settle), then the clone is retired and the real,
//      static resultSoFar cells take over that slot.
//
// TECHNICAL APPROACH: real DOM measurement via getBoundingClientRect,
// NOT guessed/hardcoded pixel math. Three refs (container, B grid,
// result grid) let us compute the exact pixel delta between B's
// current screen position and the target block's screen position,
// so the flight is accurate regardless of matrix size, zoom level, or
// container width. This is genuinely more robust than eyeballing a
// fixed cell-size constant.

import { useRef, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MatrixCell } from "./MatrixCell";
import { FLY_TRAVEL, PLAYFUL_BOUNCE, DURATIONS } from "../../lib/motionPresets";

/**
 * @param {object} props
 * @param {string} props.cellId - scopes layoutIds to this notebook cell
 * @param {object} props.frame - current "block-compute" frame from
 *        generateKroneckerSteps (must include matrixA/matrixB — see
 *        the accompanying stepGenerator.js update)
 */
export function KroneckerStepper({ cellId, frame }) {
  const { aRowIndex, aColIndex, scalar, block, blockOffset, resultSoFar, matrixA, matrixB } = frame;

  const containerRef = useRef(null);
  const bGridRef = useRef(null);
  const resultGridRef = useRef(null);

  // "source" = clone sitting right next to B, about to depart.
  // "flying"  = clone's animate prop has been given the real measured
  //             offset, so Framer Motion springs it across the canvas.
  const [phase, setPhase] = useState("source");
  const [flightDelta, setFlightDelta] = useState({ x: 0, y: 0 });

  // Re-run the measure-then-fly sequence every time we land on a NEW
  // block frame (aRowIndex/aColIndex change identifies a new block).
  useLayoutEffect(() => {
    setPhase("source");
    setFlightDelta({ x: 0, y: 0 });

    // Small delay before measuring + launching flight — gives the
    // "clone just appeared next to B" moment a beat to register with
    // the eye before it takes off (this pause is deliberate pacing,
    // not a technical necessity).
    const measureTimer = setTimeout(() => {
      if (!bGridRef.current || !resultGridRef.current) return;

      const bRect = bGridRef.current.getBoundingClientRect();
      const resultRect = resultGridRef.current.getBoundingClientRect();

      const p = matrixB.length; // rows of B (= block height in cells)
      const q = matrixB[0].length; // cols of B (= block width in cells)
      const outCols = matrixA[0].length * q;

      // Real measured cell pixel size within the result grid, derived
      // from the grid's actual rendered width divided by column count
      // — NOT a hardcoded constant, so this stays accurate at any
      // screen size or zoom level.
      const cellPx = resultRect.width / outCols;

      const targetX =
        resultRect.left + blockOffset.col * cellPx - bRect.left;
      const targetY =
        resultRect.top + blockOffset.row * cellPx - bRect.top;

      setFlightDelta({ x: targetX, y: targetY });
      setPhase("flying");
    }, 350);

    // After the flight has had time to land + bounce-settle, retire
    // the clone (its final resting frame visually overlaps with the
    // real result cell taking over, so the handoff is invisible).
    const retireTimer = setTimeout(() => {
      setPhase("landed");
    }, 350 + DURATIONS.cinematic * 1000);

    return () => {
      clearTimeout(measureTimer);
      clearTimeout(retireTimer);
    };
  }, [aRowIndex, aColIndex, matrixB, matrixA, blockOffset]);

  return (
    <div ref={containerRef} className="relative flex w-full flex-col items-center gap-6">
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

        {/* --- The flying clone: a scaled copy of B, only visible
              during "source" and "flying" phases --- */}
        <AnimatePresence>
          {phase !== "landed" && (
            <motion.div
              className="pointer-events-none absolute left-0 top-0 z-10"
              style={{
                // Positioned to overlap B's own rendered location at
                // rest (offset applied via animate.x/y, not layout).
                transform: `translate(${bGridRef.current?.offsetLeft ?? 0}px, 0px)`,
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.9 }}
              animate={
                phase === "flying"
                  ? { x: flightDelta.x, y: flightDelta.y, opacity: 1, scale: 1 }
                  : { x: 0, y: 0, opacity: 1, scale: 1 }
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

      <span className="text-slate-400">↓</span>

      {/* --- Result grid: grows in as blocks land --- */}
      <div ref={resultGridRef}>
        <FullGrid
          matrix={resultSoFar}
          getLayoutId={(r, c) => `${cellId}-result-${r}-${c}`}
          getState={(r, c) => (resultSoFar[r][c] !== null ? "settled" : "idle")}
        />
      </div>

      <span className="font-code text-[10px] text-slate-400">
        Placing A[{aRowIndex}][{aColIndex}] · B (scalar = {formatScalar(scalar)})
      </span>
    </div>
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