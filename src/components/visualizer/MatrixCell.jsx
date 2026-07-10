// src/components/visualizer/MatrixCell.jsx
//
// Individual Animated Matrix Cell
// -----------------------------------------------------------------------
// CHANGE FROM PREVIOUS VERSION: the spring transition is now imported
// from motionPresets.js (MATRIX_MORPH) instead of being hardcoded
// inline. This is the last remaining component with an ad-hoc spring
// object — bringing it in line with MatrixStepper.jsx and
// KroneckerStepper.jsx, so every matrix cell across the ENTIRE app
// (multiplication grids, Kronecker grids, the flying clone, the intro
// demo) now morphs with the exact same tuned physics. This consistency
// is what makes the whole app's motion feel like one designed system
// rather than a collection of individually-tuned animations.
//
// Everything else — KaTeX rendering, complex number formatting in
// rectangular a+bi form, state-driven color styling, the "cell" vs
// "term" size variants — is UNCHANGED from the previous version.

import { motion } from "framer-motion";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { MATRIX_MORPH } from "../../lib/motionPresets";

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
 *        visual state driving border/background color.
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