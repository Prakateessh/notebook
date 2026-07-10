// src/components/controls/PlaybackControls.jsx
//
// Playback Controls Compartment — STEP-FIRST REDESIGN
// -----------------------------------------------------------------------
// CHANGE: step-back/step-forward are now the PRIMARY, large, obvious
// controls (matching your request for manual left-right navigation
// through even small steps), and Play/Pause is demoted to a small
// secondary icon-only toggle off to the side — still available for
// anyone who wants auto-advance, but no longer the visual focus.
//
// Since generateFrames() in the store now defaults every new
// evaluation to isPlaying: false, users land on frame 1 paused and
// naturally reach for the big left/right buttons first.

import { motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {string} props.cellId - which cell in the store this control panel drives
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
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-ui text-[10px] uppercase tracking-wider text-slate-400">
          Step
        </h3>
        <span className="font-code text-[10px] text-slate-400">
          {hasFrames ? `${currentFrameIndex + 1} / ${frameCount}` : "—"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* --- Primary: big, obvious step buttons --- */}
        <StepButton
          onClick={() => prevFrame(cellId)}
          disabled={!hasFrames || isAtStart}
          label="Previous step"
        >
          <IconChevronLeft />
        </StepButton>

        <StepButton
          onClick={() => nextFrame(cellId)}
          disabled={!hasFrames || isAtEnd}
          label="Next step"
        >
          <IconChevronRight />
        </StepButton>

        {/* --- Secondary: small play/pause toggle for auto-advance --- */}
        <button
          onClick={() => togglePlayback(cellId)}
          disabled={!hasFrames}
          aria-label={isPlaying ? "Pause auto-advance" : "Auto-advance"}
          className="
            ml-auto flex h-6 w-6 items-center justify-center rounded-md
            text-slate-400 transition-colors
            hover:bg-slate-100 hover:text-slate-600
            disabled:cursor-not-allowed disabled:opacity-30
          "
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
      </div>

      {/* --- Scrub slider — still available for jumping directly to
            any step, complementary to the left/right buttons --- */}
      <input
        type="range"
        min={0}
        max={Math.max(frameCount - 1, 0)}
        value={currentFrameIndex}
        onChange={(e) => setFrameIndex(cellId, Number(e.target.value))}
        disabled={!hasFrames}
        className="
          mt-2.5 h-1 w-full cursor-pointer appearance-none rounded-full
          bg-slate-200 accent-cyan-quantum-600
          disabled:cursor-not-allowed disabled:opacity-30
        "
      />
    </div>
  );
}

/**
 * Large, primary step button — this is now the main interaction
 * surface for moving through the stepper, one frame (however small)
 * at a time.
 */
function StepButton({ onClick, disabled, label, children }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileTap={disabled ? {} : { scale: 0.9 }}
      className="
        flex h-9 w-9 items-center justify-center rounded-lg border
        border-cyan-quantum-600/40 bg-cyan-quantum-50 text-cyan-quantum-700
        transition-colors duration-150
        hover:bg-cyan-quantum-100
        disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50
        disabled:text-slate-300
      "
    >
      {children}
    </motion.button>
  );
}