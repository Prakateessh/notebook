// src/components/notebook/Cell.jsx
//
// Notebook Cell — Input-Only Card, Split-View Edition (REWRITE)
// -----------------------------------------------------------------------
// NEW: Status indicator dot next to the cell number header:
//   ● cyan  = active (visualizer is watching this cell)
//   ● green = evaluated successfully (result exists)
//   ● red   = evaluation error
//   ● grey  = empty / not yet evaluated

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
  const hasResult = useQuantumStore(
    (s) => s.cells[cellId]?.evaluation.result !== null &&
      s.cells[cellId]?.evaluation.result !== undefined
  );

  const isActive = activeCellId === cellId;

  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // --- Cursor-follow tilt effect ---
  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const maxTilt = 4; // degrees
    setTilt({
      x: (py - 0.5) * -maxTilt * 2,
      y: (px - 0.5) * maxTilt * 2,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  // Determine status dot color
  let statusColor = "bg-slate-300"; // default idle
  if (isActive) {
    statusColor = "bg-cyan-quantum-500";
  } else if (hasError) {
    statusColor = "bg-red-500";
  } else if (hasResult) {
    statusColor = "bg-emerald-500";
  }

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
        {/* --- Header row: cell number + status dot + delete --- */}
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`} />
            <span className="font-code text-xs text-slate-500">
              In [{cellNumber}]
            </span>
          </div>

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