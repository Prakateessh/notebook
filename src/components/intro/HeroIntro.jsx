// src/components/intro/HeroIntro.jsx
//
// Hero Intro — Animated First Impression
// -----------------------------------------------------------------------
// Plays ONCE per session (gated by store.hasSeenIntro), then calls
// onComplete so App.jsx can swap over to the real SplitShell notebook
// interface. Sequence:
//
//   1. Title morphs in ("quantum-scratchpad") with a staggered
//      letter-by-letter reveal.
//   2. The 3D QuantumOrb fades/scales in beside the title.
//   3. A live, auto-playing example — H * |0> — appears below, its
//      matrix-multiplication frames stepping through AUTOMATICALLY
//      (no user interaction) using the same frame-generation pipeline
//      the real app uses, so this isn't a fake mockup — it's the
//      actual product demonstrating itself.
//   4. After the sequence finishes (or the user clicks "Enter
//      Notebook"), calls onComplete.
//
// IMPORTANT: this component does NOT touch the real notebook's cell
// state. It runs its own tiny, self-contained instance of frame
// generation using the same lib/ functions (stepGenerator,
// quantumStdlib via a local throwaway math.js instance) — deliberately
// isolated so the intro's auto-play can never accidentally corrupt or
// interfere with the user's actual first notebook cell.

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { create as createMathInstance, all } from "mathjs";
import { QuantumOrb } from "../three/QuantumOrb";
import { MatrixCell } from "../visualizer/MatrixCell";
import { injectQuantumStdlib } from "../../lib/quantumStdlib";
import { generateMultiplicationSteps } from "../../lib/stepGenerator";
import {
  GENTLE_SETTLE,
  EASE_QUANTUM_IN,
  DURATIONS,
  cascadeTransition,
} from "../../lib/motionPresets";

const TITLE = "quantum-scratchpad";

/**
 * @param {object} props
 * @param {() => void} props.onComplete - called when the intro sequence
 *        finishes (auto-advance timer) or the user clicks through early.
 */
export function HeroIntro({ onComplete }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [showSkipHint, setShowSkipHint] = useState(false);

  // --- Isolated, throwaway math.js instance JUST for this demo ---
  // Never touches the real useQuantumStore — this is purely illustrative.
  const demoFrames = useMemo(() => {
    const demoMath = createMathInstance(all);
    injectQuantumStdlib(demoMath);
    const A = demoMath.evaluate("H").toArray();
    const B = demoMath.evaluate("[1;0]").toArray(); // |0>
    return generateMultiplicationSteps(A, B, {
      multiply: demoMath.multiply,
      add: demoMath.add,
    });
  }, []);

  const currentFrame = demoFrames[frameIndex];

  // --- Auto-advance the demo frames every 1.1s (cinematic pacing) ---
  useEffect(() => {
    if (frameIndex >= demoFrames.length - 1) return;
    const timer = setTimeout(() => {
      setFrameIndex((i) => Math.min(i + 1, demoFrames.length - 1));
    }, 1100);
    return () => clearTimeout(timer);
  }, [frameIndex, demoFrames.length]);

  // --- Reveal a "skip"/"enter" hint after the title has had time to land ---
  useEffect(() => {
    const timer = setTimeout(() => setShowSkipHint(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  // --- Auto-complete the whole intro once the demo has finished playing
  //     through fully, giving the user a moment to see the "Complete"
  //     state before transitioning to the real app. ---
  useEffect(() => {
    if (frameIndex < demoFrames.length - 1) return;
    const timer = setTimeout(() => {
      onComplete();
    }, 1800);
    return () => clearTimeout(timer);
  }, [frameIndex, demoFrames.length, onComplete]);

  const titleLetters = useMemo(() => TITLE.split(""), []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      exit={{ opacity: 0, transition: { duration: DURATIONS.slow, ease: EASE_QUANTUM_IN } }}
    >
      {/* --- Title + Orb row --- */}
      <div className="flex items-center gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...GENTLE_SETTLE, delay: 0.1 }}
        >
          <QuantumOrb size={200} />
        </motion.div>

        <h1 className="font-ui flex text-4xl font-semibold tracking-tight text-slate-800 md:text-5xl">
          {titleLetters.map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={cascadeTransition(i, 0.04)}
              className={char === "-" ? "mx-0.5 text-cyan-quantum-500" : ""}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </h1>
      </div>

      {/* --- Auto-playing live example --- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...GENTLE_SETTLE, delay: 1.0 }}
        className="mt-10 flex flex-col items-center gap-4"
      >
        <span className="font-code text-xs uppercase tracking-wider text-slate-400">
          H · |0⟩
        </span>

        {currentFrame && (
          <div className="flex items-center gap-4">
            {currentFrame.type === "cell-compute" && (
              <>
                <MiniGrid label="H" highlight="row-highlight" />
                <span className="font-math text-lg text-slate-400">×</span>
                <MiniGrid label="|0⟩" highlight="col-highlight" isVector />
                <span className="text-slate-400">=</span>
                <ResultGrid resultSoFar={currentFrame.resultSoFar} />
              </>
            )}
            {currentFrame.type === "complete" && (
              <ResultGrid resultSoFar={currentFrame.resultSoFar} settled />
            )}
          </div>
        )}
      </motion.div>

      {/* --- Skip/enter hint --- */}
      <AnimatePresence>
        {showSkipHint && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onComplete}
            className="
              mt-12 font-ui text-xs text-slate-400
              underline decoration-slate-300 underline-offset-4
              transition-colors hover:text-cyan-quantum-600
            "
          >
            Enter notebook →
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Small static 2x1 or 2x2 grid used for the demo's input operands. */
function MiniGrid({ label, highlight, isVector = false }) {
  const values = isVector ? [1, 0] : label === "H" ? [0.707, 0.707, 0.707, -0.707] : [];

  if (isVector) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
        {values.map((v, i) => (
          <MatrixCell key={i} value={v} layoutId={`intro-vec-${i}`} state={highlight} variant="term" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
      <div className="flex gap-1">
        <MatrixCell value={values[0]} layoutId="intro-h-00" state="idle" variant="term" />
        <MatrixCell value={values[1]} layoutId="intro-h-01" state="idle" variant="term" />
      </div>
      <div className="flex gap-1">
        <MatrixCell value={values[2]} layoutId="intro-h-10" state="idle" variant="term" />
        <MatrixCell value={values[3]} layoutId="intro-h-11" state="idle" variant="term" />
      </div>
    </div>
  );
}

/** Result column vector, updates as demo frames progress. */
function ResultGrid({ resultSoFar, settled = false }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
      {resultSoFar.map((row, i) => (
        <MatrixCell
          key={i}
          value={row[0]}
          layoutId={`intro-result-${i}`}
          state={settled ? "settled" : row[0] !== null ? "active" : "idle"}
          variant="term"
        />
      ))}
    </div>
  );
}