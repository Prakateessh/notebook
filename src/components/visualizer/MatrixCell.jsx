// src/components/visualizer/MatrixCell.jsx
//
// Individual Animated Matrix Cell
// -----------------------------------------------------------------------
// Now supports both numeric/complex values AND symbolic nodes from
// src/lib/symbolicEngine.js.  When a SymbolicNode is passed, it renders
// its toHTML() output via dangerouslySetInnerHTML (no KaTeX dependency).

import { motion } from "framer-motion";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { MATRIX_MORPH } from "../../lib/motionPresets";
import { SymbolicNode } from "../../lib/symbolicEngine";

/**
 * Formats a numeric value (real or math.js Complex) into a LaTeX string.
 */
function formatValueAsLatex(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object" && "re" in value && "im" in value) {
    const re = roundClean(value.re);
    const im = roundClean(value.im);
    if (im === 0) return `${re}`;
    const sign = im < 0 ? "-" : "+";
    const imAbs = Math.abs(im);
    const imStr = imAbs === 1 ? "i" : `${imAbs}i`;
    return `${re} ${sign} ${imStr}`;
  }

  return `${roundClean(value)}`;
}

function roundClean(n) {
  const rounded = Math.round(n * 10000) / 10000;
  return rounded;
}

/**
 * @param {object} props
 * @param {number|object|SymbolicNode} props.value
 * @param {string} props.layoutId
 * @param {"idle"|"row-highlight"|"col-highlight"|"active"|"settled"} props.state
 * @param {"cell"|"term"} props.variant
 */
export function MatrixCell({
  value,
  layoutId,
  state = "idle",
  variant = "cell",
}) {
  // ---- symbolic path (now uses toHTML) ----
  if (value instanceof SymbolicNode) {
    const html = value.toHTML();
    const stateStyles = {
      idle: "border-slate-200 bg-white/50",
      "row-highlight": "border-cyan-quantum-400 bg-cyan-quantum-50",
      "col-highlight": "border-purple-quantum-400 bg-purple-quantum-50",
      active: "border-amber-400 bg-amber-50",
      settled: "border-emerald-300 bg-emerald-50/70",
    };
    const sizeClasses =
      variant === "term"
        ? "min-w-[2.5rem] px-2 py-1 text-xs"
        : "min-w-[3.5rem] px-3 py-2 text-sm";

    return (
      <motion.div
        layoutId={layoutId}
        layout
        transition={MATRIX_MORPH}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        className={`
          flex items-center justify-center rounded-lg border
          font-math text-slate-800 transition-colors duration-200
          ${stateStyles[state]}
          ${sizeClasses}
        `}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // ---- numeric / complex path (unchanged) ----
  const latex = formatValueAsLatex(value);

  const stateStyles = {
    idle: "border-slate-200 bg-white/50",
    "row-highlight": "border-cyan-quantum-400 bg-cyan-quantum-50",
    "col-highlight": "border-purple-quantum-400 bg-purple-quantum-50",
    active: "border-amber-400 bg-amber-50",
    settled: "border-emerald-300 bg-emerald-50/70",
  };

  const sizeClasses =
    variant === "term"
      ? "min-w-[2.5rem] px-2 py-1 text-xs"
      : "min-w-[3.5rem] px-3 py-2 text-sm";

  return (
    <motion.div
      layoutId={layoutId}
      layout
      transition={MATRIX_MORPH}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={`
        flex items-center justify-center rounded-lg border
        font-math text-slate-800 transition-colors duration-200
        ${stateStyles[state]}
        ${sizeClasses}
      `}
    >
      {latex ? <InlineMath math={latex} /> : (
        <span className="font-math text-slate-300">·</span>
      )}
    </motion.div>
  );
}