// src/components/controls/PlaybackControls.jsx
//
// Playback Controls Compartment — NOTEBOOK CELL EDITION
// -----------------------------------------------------------------------
// MODIFIED: now takes a `cellId` prop and reads/dispatches against that
// specific cell's stepper slice, instead of a single global slice.
//
// Also restyled to be more compact, since this now lives inside a
// two-column strip (PlaybackControls | ProbabilityPanel) at the bottom
// of each notebook cell card, rather than occupying its own full bento
// compartment. Buttons are slightly smaller, the scrub slider label
// text is condensed, but all functionality from the original file is
// fully preserved — nothing was cut, only re-sized to fit the new
// compact layout.
//
// Selective subscriptions: only reads this cell's stepper.currentFrameIndex,
// stepper.frames.length, and stepper.isPlaying — so this component
// doesn't re-render when other cells' state changes, or when this
// cell's editor/evaluation slices change independently.
//
// Design constraints applied:
// - No skeuomorphic buttons (no fake 3D bevel/drop-shadow buttons).
// - Active/pressed states use glow + subtle scale, not depth tricks.
// - Disabled states (e.g. no frames yet) are visually muted, not hidden
//   — keeps the two-column strip from reflowing awkwardly.

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
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-600">
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

          <span className="ml-auto font-mono text-[10px] text-slate-600">
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
            bg-slate-800 accent-cyan-400
            disabled:cursor-not-allowed disabled:opacity-30
          "
        />
      </div>
    </div>
  );
}

/**
 * Reusable control button. `primary` gets the accent glow treatment
 * (used for the central Play/Pause button). Disabled state mutes
 * opacity rather than hiding, so the transport bar never reflows.
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
            ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.15)] hover:bg-cyan-500/20"
            : "border-slate-800/60 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
        }
      `}
    >
      {children}
    </motion.button>
  );
}