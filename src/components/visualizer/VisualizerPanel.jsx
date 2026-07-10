// src/components/visualizer/VisualizerPanel.jsx
//
// Visualizer Panel — The Right‑Column "Video Player"
// -----------------------------------------------------------------------
// Purple‑theme polish:
//   • Header title uses gradient‑text‑subtle (deep charcoal → faint purple).
//   • The "Measure" button is wrapped in .glow-border-btn – a rotating
//     lavender glow appears on hover.
//   • PlaybackControls step buttons remain cyan for functional contrast.
//   • Keyboard shortcuts unchanged.
//
// REMOVED: Bloch sphere – will be re‑added later in a dedicated layout.
// This keeps the visualizer clean and focused on the stepper.

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { MatrixStepper } from "./MatrixStepper";
import { PlaybackControls } from "../controls/PlaybackControls";
import { ProbabilityPanel } from "../controls/ProbabilityPanel";
import { GENTLE_SETTLE } from "../../lib/motionPresets";

export function VisualizerPanel() {
  const activeCellId = useQuantumStore((s) => s.activeCellId);
  const cellOrder = useQuantumStore((s) => s.cellOrder);
  const cellResult = useQuantumStore(
    (s) => s.cells[activeCellId]?.evaluation.result
  );
  const hasResult = cellResult !== null && cellResult !== undefined;
  const hasError = useQuantumStore(
    (s) => !!s.cells[activeCellId]?.evaluation.error
  );

  const activeCellNumber = cellOrder.indexOf(activeCellId) + 1;
  const showEmptyState = !hasResult && !hasError;

  const isStateVector = hasResult && isColumnVector(cellResult);

  // Measurement handler
  const handleMeasure = useCallback(() => {
    if (!activeCellId || !isStateVector) return;

    let amplitudes;
    try {
      if (typeof cellResult.toArray === "function") {
        const arr = cellResult.toArray();
        if (
          Array.isArray(arr) &&
          arr.length > 0 &&
          Array.isArray(arr[0]) &&
          arr[0].length === 1
        ) {
          amplitudes = arr.map((row) => row[0]);
        } else if (Array.isArray(arr) && arr.length > 0 && !Array.isArray(arr[0])) {
          amplitudes = arr;
        } else {
          return;
        }
      } else {
        return;
      }
    } catch {
      return;
    }

    const math = useQuantumStore.getState().math;
    if (!math) return;

    let probabilities;
    try {
      probabilities = math.prob(amplitudes);
    } catch {
      probabilities = amplitudes.map((a) => {
        const abs =
          typeof a === "object" && a.re !== undefined
            ? Math.hypot(a.re, a.im)
            : Math.abs(a);
        return abs * abs;
      });
    }

    const r = Math.random();
    let cum = 0;
    let chosenIndex = 0;
    for (let i = 0; i < probabilities.length; i++) {
      cum += probabilities[i];
      if (r <= cum) {
        chosenIndex = i;
        break;
      }
    }

    const newAmplitudes = amplitudes.map((_, i) => (i === chosenIndex ? 1 : 0));

    let newResult;
    try {
      newResult = math.matrix(newAmplitudes.map((v) => [v]));
    } catch {
      newResult = newAmplitudes;
    }

    useQuantumStore.setState((state) => ({
      cells: {
        ...state.cells,
        [activeCellId]: {
          ...state.cells[activeCellId],
          evaluation: {
            ...state.cells[activeCellId].evaluation,
            result: newResult,
          },
          stepper: { frames: [], currentFrameIndex: 0, isPlaying: false },
        },
      },
    }));
  }, [activeCellId, isStateVector, cellResult]);

  // Keyboard shortcuts – focus‑based
  const panelRef = useRef(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const handleKeyDown = (e) => {
      const active = document.activeElement;
      if (
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        active?.isContentEditable
      )
        return;

      if (!activeCellId) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        useQuantumStore.getState().prevFrame(activeCellId);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        useQuantumStore.getState().nextFrame(activeCellId);
      } else if (e.key === " ") {
        e.preventDefault();
        useQuantumStore.getState().togglePlayback(activeCellId);
      }
    };

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [activeCellId]);

  return (
    <div
      ref={panelRef}
      tabIndex={0}
      className="flex h-full flex-col bg-white/60 backdrop-blur-glass outline-none transition-shadow duration-200 focus:ring-2 focus:ring-purple-300/60 focus:ring-inset"
    >
      {/* --- Header --- */}
      <div className="flex items-center justify-between border-b border-purple-100/70 px-6 py-4">
        <h2 className="font-ui text-sm font-medium tracking-wide gradient-text-subtle">
          Visualizer
        </h2>
        <span className="font-code text-xs text-slate-400">
          {activeCellId
            ? `watching In [${activeCellNumber}]`
            : "no cell selected"}
        </span>
      </div>

      {/* --- Main stage: MatrixStepper or empty‑state watermark --- */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-auto px-6 py-4">
        <AnimatePresence mode="wait">
          {showEmptyState ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={GENTLE_SETTLE}
              className="absolute inset-0"
            >
              <WatermarkPattern />
              <div className="relative flex h-full flex-col items-center justify-center gap-2">
                <p className="font-ui text-sm text-slate-400">
                  Click into a cell and evaluate an expression
                </p>
                <p className="font-code text-xs text-purple-300">
                  H * |0⟩ · kron(X, Y) · CNOT * |10⟩
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={GENTLE_SETTLE}
              className="w-full"
            >
              {activeCellId && <MatrixStepper cellId={activeCellId} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- Footer strip: playback + probability, plus Measure button --- */}
      {activeCellId && (
        <div className="border-t border-purple-100/70 px-6 py-4">
          <div className="grid grid-cols-2 gap-6 mb-4">
            <PlaybackControls cellId={activeCellId} />
            <ProbabilityPanel cellId={activeCellId} />
          </div>

          {isStateVector && (
            <div className="glow-border-btn rounded-xl">
              <motion.button
                onClick={handleMeasure}
                whileTap={{ scale: 0.95 }}
                className="
                  w-full rounded-xl border-2 border-purple-200 bg-purple-50/70
                  py-2.5 font-ui text-xs font-semibold text-purple-700
                  backdrop-blur-sm transition-all duration-300
                  hover:bg-purple-100 hover:border-purple-300
                "
              >
                Measure
              </motion.button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isColumnVector(result) {
  if (!result) return false;
  try {
    let arr;
    if (typeof result.toArray === "function") {
      arr = result.toArray();
    } else if (Array.isArray(result)) {
      arr = result;
    } else {
      return false;
    }
    if (!Array.isArray(arr) || arr.length === 0) return false;
    return arr.every((row) => Array.isArray(row) && row.length === 1);
  } catch {
    return false;
  }
}

function WatermarkPattern() {
  const placements = [
    { glyph: "|ψ⟩", top: "12%", left: "15%", size: "3rem", rotate: -8 },
    { glyph: "⟨0|", top: "22%", left: "70%", size: "2.5rem", rotate: 6 },
    { glyph: "|1⟩", top: "68%", left: "20%", size: "2.75rem", rotate: 4 },
    { glyph: "⟨ψ|", top: "78%", left: "68%", size: "3.25rem", rotate: -5 },
    { glyph: "|+⟩", top: "40%", left: "8%", size: "2rem", rotate: 10 },
    { glyph: "⟨1|", top: "8%", left: "55%", size: "2.25rem", rotate: -12 },
    { glyph: "|00⟩", top: "55%", left: "45%", size: "2.5rem", rotate: 3 },
    { glyph: "H", top: "35%", left: "82%", size: "3.5rem", rotate: -4 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.05]">
      {placements.map((p, i) => (
        <span
          key={i}
          className="font-math absolute select-none text-purple-300"
          style={{
            top: p.top,
            left: p.left,
            fontSize: p.size,
            transform: `rotate(${p.rotate}deg)`,
          }}
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}