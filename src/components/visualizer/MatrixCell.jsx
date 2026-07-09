// src/components/visualizer/MatrixCell.jsx
//
// Individual Animated Matrix Cell
// -----------------------------------------------------------------------
// The atomic visual unit of the stepper. Renders one cell of a matrix
// (or a floating arithmetic term) with KaTeX, wrapped in a motion.div
// that participates in Framer Motion's shared layout animation system.
//
// This is deliberately a "dumb" presentational component: it receives
// a value + highlight state as props and renders it. All frame-to-frame
// orchestration (which cells highlight when, sequencing) lives in
// MatrixStepper.jsx. This file only knows how to look good and animate
// smoothly when its props change.
//
// Complex number formatting: per your rectangular-form decision,
// a+bi. Handles math.js Complex instances (has .re/.im) and plain
// JS numbers uniformly.

import { motion } from "framer-motion";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

/**
 * Formats a numeric value (real or math.js Complex) into a LaTeX string
 * suitable for KaTeX rendering, in standard a+bi rectangular form.
 */
function formatValueAsLatex(value) {
  if (value === null || value === undefined) return "";

  // math.js Complex instances expose .re and .im
  if (typeof value === "object" && "re" in value && "im" in value) {
    const re = roundClean(value.re);
    const im = roundClean(value.im);

    if (im === 0) return `${re}`;
    const sign = im < 0 ? "-" : "+";
    const imAbs = Math.abs(im);
    const imStr = imAbs === 1 ? "i" : `${imAbs}i`;
    return `${re} ${sign} ${imStr}`;
  }

  // Plain real number
  return `${roundClean(value)}`;
}

/** Rounds to 4 decimal places and strips trailing zeros for legibility. */
function roundClean(n) {
  const rounded = Math.round(n * 10000) / 10000;
  return rounded;
}

/**
 * @param {object} props
 * @param {number|object} props.value - the cell's numeric/complex value
 * @param {string} props.layoutId - unique id for Framer Motion's layout
 *        animation system; cells that share a layoutId across frames
 *        will morph between positions/sizes instead of popping.
 * @param {"idle"|"row-highlight"|"col-highlight"|"active"|"settled"} props.state
 *        visual state driving border/glow color.
 * @param {"cell"|"term"} props.variant - "cell" = fixed matrix cell,
 *        "term" = floating arithmetic term (smaller, used for the
 *        a*b product tokens shown mid-calculation).
 */
export function MatrixCell({
  value,
  layoutId,
  state = "idle",
  variant = "cell",
}) {
  const latex = formatValueAsLatex(value);

  const stateStyles = {
    idle: "border-slate-800/60 bg-slate-900/40",
    "row-highlight": "border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_16px_rgba(34,211,238,0.25)]",
    "col-highlight": "border-fuchsia-400/60 bg-fuchsia-500/10 shadow-[0_0_16px_rgba(232,121,249,0.25)]",
    active: "border-amber-400/70 bg-amber-500/10 shadow-[0_0_20px_rgba(251,191,36,0.3)]",
    settled: "border-emerald-400/40 bg-emerald-500/5 shadow-[0_0_12px_rgba(52,211,153,0.15)]",
  };

  const sizeClasses =
    variant === "term"
      ? "min-w-[2.5rem] px-2 py-1 text-xs"
      : "min-w-[3.5rem] px-3 py-2 text-sm";

  return (
    <motion.div
      layoutId={layoutId}
      layout
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 28,
        mass: 0.8,
      }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={`
        flex items-center justify-center rounded-xl border
        text-slate-100 transition-colors duration-200
        ${stateStyles[state]}
        ${sizeClasses}
      `}
    >
      {latex ? <InlineMath math={latex} /> : (
        <span className="text-slate-600">·</span>
      )}
    </motion.div>
  );
}