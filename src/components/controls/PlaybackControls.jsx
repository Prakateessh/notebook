// src/components/controls/PlaybackControls.jsx
//
// Playback Controls Compartment — QUANTUM LIGHT GLASSMORPHISM
// -----------------------------------------------------------------------
// MODIFIED FOR LIGHT THEME: per the design doc's exact spec for this
// compartment — "flat, clean aesthetic, transitioning to a Cyan 50
// background on hover" — buttons now use bg-cyan-quantum-50 as the
// hover state instead of the dark version's bg-slate-800/60 hover.
//
// The primary Play/Pause button uses cyan-quantum-600 as its resting
// accent color (matching the doc's "Primary (Cyan 600)" spec for "the
// Play button" specifically, called out by name in the design doc).
//
// All functionality (transport buttons, scrub slider, cellId-scoped
// selectors/actions) is COMPLETELY UNCHANGED from the notebook-cell
// version — this file is color/theme changes only.

import { motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";

// Simple inline icon components — kept local so this file has zero
// icon-library dependency (avoids adding e.g. lucide-react just for
// three glyphs). Each is a minimal stroke-based SVG matching the
// "no skeuomorphism" aesthetic.
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function IconStepBack() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M6 6h2v12H6zM20 6v12l-10-6z" />
    </svg>
  );
}
function IconStepForward() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M16 6h2v12h-2zM4 6v12l10-6z" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {string} props.cellId - which cell in the store this control panel
 *        drives. Every selector and every dispatched action is scoped to
 *        this cellId, so multiple PlaybackControls instances (one per
 *        notebook cell) never interfere with each other.
 */
export function PlaybackControls({ cellId }) {
  const currentFrameIndex = useQuantumStore(
    (s) => s.cells[cellId]?.stepper.currentFrameIndex ?? 0
  );
  const frameCount = useQuantumStore(
    (s) => s.cells[cellId]?.stepper.frames.length ?? 0
  );
  const isPlaying = useQuantumStore(
    (s) => s.cells[cellId]?.stepper.isPlaying ?? false
  );

  const nextFrame = useQuantumStore((s) => s.nextFrame);
  const prevFrame = useQuantumStore((s) => s.prevFrame);
  const togglePlayback = useQuantumStore((s) => s.togglePlayback);
  const setFrameIndex = useQuantumStore((s) => s.setFrameIndex);

  const hasFrames = frameCount > 0;
  const isAtStart = currentFrameIndex === 0;
  const isAtEnd = currentFrameIndex >= frameCount - 1;

  return (
    <div className="flex flex-col">
      <h3 className="mb-2 font-ui text-[10px] uppercase tracking-wider text-slate-400">
        Playback
      </h3>

      <div className="flex flex-col gap-2.5">
        {/* Transport buttons */}
        <div className="flex items-center gap-1.5">
          <ControlButton
            onClick={() => prevFrame(cellId)}
            disabled={!hasFrames || isAtStart}
            label="Previous step"
          >
            <IconStepBack />
          </ControlButton>

          <ControlButton
            onClick={() => togglePlayback(cellId)}
            disabled={!hasFrames}
            label={isPlaying ? "Pause" : "Play"}
            primary
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </ControlButton>

          <ControlButton
            onClick={() => nextFrame(cellId)}
            disabled={!hasFrames || isAtEnd}
            label="Next step"
          >
            <IconStepForward />
          </ControlButton>

          <span className="ml-auto font-code text-[10px] text-slate-400">
            {hasFrames ? `${currentFrameIndex + 1}/${frameCount}` : "—"}
          </span>
        </div>

        {/* Scrub slider */}
        <input
          type="range"
          min={0}
          max={Math.max(frameCount - 1, 0)}
          value={currentFrameIndex}
          onChange={(e) => setFrameIndex(cellId, Number(e.target.value))}
          disabled={!hasFrames}
          className="
            h-1 w-full cursor-pointer appearance-none rounded-full
            bg-slate-200 accent-cyan-quantum-600
            disabled:cursor-not-allowed disabled:opacity-30
          "
        />
      </div>
    </div>
  );
}

/**
 * Reusable control button. `primary` gets the doc-specified Cyan 600
 * treatment (the "Play button" color called out explicitly in the
 * design doc). Disabled state mutes opacity rather than hiding, so the
 * transport bar never reflows.
 */
function ControlButton({ onClick, disabled, label, primary, children }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={disabled ? {} : { scale: 0.92 }}
      className={`
        flex h-8 w-8 items-center justify-center rounded-lg border
        transition-colors duration-150
        disabled:cursor-not-allowed disabled:opacity-30
        ${
          primary
            ? "border-cyan-quantum-600/40 bg-cyan-quantum-50 text-cyan-quantum-700 hover:bg-cyan-quantum-100"
            : "border-slate-200 bg-white/60 text-slate-500 hover:border-cyan-quantum-300 hover:bg-cyan-quantum-50 hover:text-cyan-quantum-700"
        }
      `}
    >
      {children}
    </motion.button>
  );
}