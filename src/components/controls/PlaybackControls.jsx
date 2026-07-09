// src/components/controls/PlaybackControls.jsx
//
// Playback Controls Compartment
// -----------------------------------------------------------------------
// Play/pause, step forward/back, and a scrub slider for the stepper
// frame array. Pure control surface — no math logic, just dispatches
// to the store's stepper actions (nextFrame, prevFrame, togglePlayback,
// setFrameIndex).
//
// Selective subscriptions: only reads stepper.currentFrameIndex,
// stepper.frames.length, and stepper.isPlaying — so this component
// doesn't re-render on editor keystrokes or evaluation changes.
//
// Design constraints applied:
// - No skeuomorphic buttons (no fake 3D bevel/drop-shadow buttons).
// - Active/pressed states use glow + subtle scale, not depth tricks.
// - Disabled states (e.g. no frames yet) are visually muted, not hidden
//   — keeps the layout stable (no bento cell reflow).

import { motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";

// Simple inline icon components — kept local so this file has zero
// icon-library dependency (avoids adding e.g. lucide-react just for
// three glyphs). Each is a minimal stroke-based SVG matching the
// "no skeuomorphism" aesthetic.
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function IconStepBack() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M6 6h2v12H6zM20 6v12l-10-6z" />
    </svg>
  );
}
function IconStepForward() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M16 6h2v12h-2zM4 6v12l10-6z" />
    </svg>
  );
}

export function PlaybackControls() {
  const currentFrameIndex = useQuantumStore((s) => s.stepper.currentFrameIndex);
  const frameCount = useQuantumStore((s) => s.stepper.frames.length);
  const isPlaying = useQuantumStore((s) => s.stepper.isPlaying);

  const nextFrame = useQuantumStore((s) => s.nextFrame);
  const prevFrame = useQuantumStore((s) => s.prevFrame);
  const togglePlayback = useQuantumStore((s) => s.togglePlayback);
  const setFrameIndex = useQuantumStore((s) => s.setFrameIndex);

  const hasFrames = frameCount > 0;
  const isAtStart = currentFrameIndex === 0;
  const isAtEnd = currentFrameIndex >= frameCount - 1;

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-slate-400">
        PLAYBACK
      </h2>

      <div className="flex flex-1 flex-col justify-center gap-4">
        {/* Transport buttons */}
        <div className="flex items-center justify-center gap-2">
          <ControlButton
            onClick={prevFrame}
            disabled={!hasFrames || isAtStart}
            label="Previous step"
          >
            <IconStepBack />
          </ControlButton>

          <ControlButton
            onClick={togglePlayback}
            disabled={!hasFrames}
            label={isPlaying ? "Pause" : "Play"}
            primary
          >
            {isPlaying ? <IconPause /> : <IconPlay />}
          </ControlButton>

          <ControlButton
            onClick={nextFrame}
            disabled={!hasFrames || isAtEnd}
            label="Next step"
          >
            <IconStepForward />
          </ControlButton>
        </div>

        {/* Scrub slider */}
        <div className="flex flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={Math.max(frameCount - 1, 0)}
            value={currentFrameIndex}
            onChange={(e) => setFrameIndex(Number(e.target.value))}
            disabled={!hasFrames}
            className="
              h-1 w-full cursor-pointer appearance-none rounded-full
              bg-slate-800 accent-cyan-400
              disabled:cursor-not-allowed disabled:opacity-30
            "
          />
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>Step {hasFrames ? currentFrameIndex + 1 : 0}</span>
            <span>{frameCount} total</span>
          </div>
        </div>
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
        flex h-10 w-10 items-center justify-center rounded-xl border
        transition-colors duration-150
        disabled:cursor-not-allowed disabled:opacity-30
        ${
          primary
            ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.2)] hover:bg-cyan-500/20"
            : "border-slate-800/60 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
        }
      `}
    >
      {children}
    </motion.button>
  );
}