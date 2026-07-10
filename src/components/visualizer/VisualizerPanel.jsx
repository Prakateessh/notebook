// src/components/visualizer/VisualizerPanel.jsx
//
// Visualizer Panel — The Right-Column "Video Player"
// -----------------------------------------------------------------------
// This is the sticky right column rendered by SplitShell.jsx. It reads
// `activeCellId` from the store (set whenever a notebook cell's editor
// gains focus — see CodeEditor.jsx's onFocus hook, wired in a later
// file) and displays THAT cell's MatrixStepper + PlaybackControls +
// ProbabilityPanel, all in one generously-spaced, premium composite —
// replacing the old per-cell inline versions that made cells feel
// cramped.
//
// EMPTY STATE: per your spec, when there's nothing to show (no cell
// has been evaluated yet, or the active cell's input is empty), we
// render a subtle KaTeX-notation watermark pattern — faint |ψ⟩, |0⟩,
// ⟨ψ|, and similar quantum bra-ket glyphs scattered across the empty
// canvas — rather than a blank box or a plain "nothing here" message.
// This keeps the panel feeling alive and on-theme even before the
// user has typed anything.
//
// Layout: header (cell indicator) at top, MatrixStepper takes the
// dominant vertical space (this IS the "video" — it should feel like
// the main event, not squeezed), Playback + Probability sit together
// in a footer strip, similar spacing logic to a real video player's
// scrubber-plus-metadata bar beneath the video itself.

import { motion, AnimatePresence } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { MatrixStepper } from "./MatrixStepper";
import { PlaybackControls } from "../controls/PlaybackControls";
import { ProbabilityPanel } from "../controls/ProbabilityPanel";
import { GENTLE_SETTLE } from "../../lib/motionPresets";

const WATERMARK_GLYPHS = ["|ψ⟩", "⟨0|", "|1⟩", "⟨ψ|", "|+⟩", "⟨1|", "|00⟩", "H"];

export function VisualizerPanel() {
  const activeCellId = useQuantumStore((s) => s.activeCellId);
  const cellOrder = useQuantumStore((s) => s.cellOrder);
  const hasResult = useQuantumStore(
    (s) => s.cells[activeCellId]?.evaluation.result !== null &&
      s.cells[activeCellId]?.evaluation.result !== undefined
  );
  const hasError = useQuantumStore((s) => !!s.cells[activeCellId]?.evaluation.error);
  const hasFrames = useQuantumStore(
    (s) => (s.cells[activeCellId]?.stepper.frames.length ?? 0) > 0
  );

  const activeCellNumber = cellOrder.indexOf(activeCellId) + 1;
  const showEmptyState = !hasResult && !hasError;

  return (
    <div className="flex h-full flex-col bg-white/50 backdrop-blur-glass">
      {/* --- Header --- */}
      <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4">
        <h2 className="font-ui text-sm font-medium tracking-wide text-slate-700">
          Visualizer
        </h2>
        <span className="font-code text-xs text-slate-400">
          {activeCellId ? `watching In [${activeCellNumber}]` : "no cell selected"}
        </span>
      </div>

      {/* --- Main stage: MatrixStepper or empty-state watermark --- */}
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
                <p className="font-code text-xs text-slate-300">
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

      {/* --- Footer strip: playback + probability, side by side --- */}
      {activeCellId && (
        <div className="grid grid-cols-2 gap-6 border-t border-slate-200/70 px-6 py-4">
          <PlaybackControls cellId={activeCellId} />
          <ProbabilityPanel cellId={activeCellId} />
        </div>
      )}
    </div>
  );
}

/**
 * Faint, scattered bra-ket notation pattern for the empty state.
 * Positioned with fixed percentage coordinates (not randomly generated
 * per render, so the pattern doesn't jump around on re-render) and
 * varied rotation/size for organic, non-grid-like scatter.
 */
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
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.06]">
      {placements.map((p, i) => (
        <span
          key={i}
          className="font-math absolute select-none text-cyan-quantum-600"
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