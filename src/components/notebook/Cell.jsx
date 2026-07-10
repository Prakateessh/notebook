// src/components/notebook/Cell.jsx
//
// Notebook Cell — Input-Only Card, Split-View Edition (REWRITE)
// -----------------------------------------------------------------------
// MAJOR STRUCTURAL CHANGE: this cell no longer embeds MatrixStepper,
// PlaybackControls, or ProbabilityPanel. Those all moved to the right
// column's VisualizerPanel.jsx (single instance, shows whichever cell
// is "active"). This cell is now PURELY the code input + its own
// header (In [n]:, delete button) — much lighter, which directly
// addresses your "cramped and awkward" complaint: cells are now small,
// calm, focused units, and the "video" happens in one dedicated place
// instead of being duplicated inside every single cell.
//
// NEW: sets `activeCellId` in the store whenever this cell's card
// gains focus (via onFocus on the wrapping div, which catches focus
// bubbling up from the CodeEditor's textarea inside it) — this is
// what makes the right panel "auto-switch as you click between cells."
//
// NEW MICRO-INTERACTION: cursor-follow tilt effect. As the mouse moves
// over an unfocused cell, the card subtly tilts in 3D (rotateX/rotateY)
// toward the cursor position, using TILT_RESPONSE's tight, responsive
// spring so it feels instantly reactive rather than floaty. This is a
// CSS 3D trick (perspective + rotateX/Y transforms), not WebGL — an
// appropriately lightweight touch for something happening on every
// cell simultaneously, reserving the "real" Three.js budget for the
// one-time HeroIntro moment as we discussed.

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { CodeEditor } from "../editor/CodeEditor";
import { TILT_RESPONSE, GENTLE_SETTLE } from "../../lib/motionPresets";

/**
 * @param {object} props
 * @param {string} props.cellId - which cell in the store this card renders
 * @param {number} props.cellNumber - 1-indexed display position (In [1]:, In [2]:, etc.)
 * @param {boolean} props.canDelete - whether the delete button should be active
 *        (false when this is the only remaining cell in the notebook)
 */
export function Cell({ cellId, cellNumber, canDelete }) {
  const removeCell = useQuantumStore((s) => s.removeCell);
  const setActiveCell = useQuantumStore((s) => s.setActiveCell);
  const activeCellId = useQuantumStore((s) => s.activeCellId);
  const hasError = useQuantumStore((s) => !!s.cells[cellId]?.evaluation.error);

  const isActive = activeCellId === cellId;

  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // --- Cursor-follow tilt: computes rotation based on cursor position
  //     relative to the card's center. Small max angle (4deg) keeps
  //     this feeling like a subtle premium touch, not a gimmick. ---
  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1

    const maxTilt = 4; // degrees
    setTilt({
      x: (py - 0.5) * -maxTilt * 2, // rotateX: inverted so top tilts toward cursor
      y: (px - 0.5) * maxTilt * 2, // rotateY
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, height: 0 }}
      transition={GENTLE_SETTLE}
      onFocus={() => setActiveCell(cellId)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 800 }}
      className="group relative"
    >
      <motion.div
        animate={{
          rotateX: isHovering ? tilt.x : 0,
          rotateY: isHovering ? tilt.y : 0,
        }}
        transition={TILT_RESPONSE}
        style={{ transformStyle: "preserve-3d" }}
        className={`
          relative rounded-xl border bg-white/80
          backdrop-blur-glass
          shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.03)]
          transition-colors duration-200
          ${isActive ? "border-cyan-quantum-400/60" : "border-slate-200"}
        `}
      >
        {/* --- Header row: cell number + delete --- */}
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2">
          <span className="font-code text-xs text-slate-500">
            In [{cellNumber}]
            {hasError && <span className="ml-2 font-ui text-red-500/80">error</span>}
            {isActive && (
              <span className="ml-2 font-ui text-cyan-quantum-500">● watching</span>
            )}
          </span>

          <button
            onClick={() => removeCell(cellId)}
            disabled={!canDelete}
            aria-label="Delete cell"
            className="
              rounded-md p-1 text-slate-400 opacity-0 transition-opacity
              hover:bg-slate-100 hover:text-slate-600
              disabled:pointer-events-none disabled:opacity-0
              group-hover:opacity-100
            "
          >
            <IconTrash />
          </button>
        </div>

        {/* --- Editor: the ONLY content inside a cell now --- */}
        <div className="px-4 py-3">
          <CodeEditor cellId={cellId} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
    </svg>
  );
}