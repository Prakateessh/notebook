// src/components/controls/ProbabilityPanel.jsx
//
// Probability Panel Compartment — QUANTUM LIGHT GLASSMORPHISM
// -----------------------------------------------------------------------
// MODIFIED FOR LIGHT THEME: per the design doc's exact spec for this
// compartment — "a dynamic horizontal bar chart... Framer Motion
// physically stretches and animates these bars" — the bar fill now
// uses a cyan-quantum -> purple-quantum gradient (the doc's two named
// accent colors) instead of the dark version's cyan-400 -> fuchsia-400
// gradient (fuchsia was never actually specified anywhere in the doc;
// purple-quantum is the doc's real secondary accent).
//
// Track background, labels, and percentage text all flipped from
// light-on-dark to dark-on-light. Basis-state labels now use font-code
// (JetBrains Mono) since |00⟩-style labels read as technical/notation-
// adjacent tokens, consistent with how the doc treats coordinate/label
// text elsewhere.
//
// ALL LOGIC — extractStateVector, generateBasisLabels, the Born-rule
// prob() computation, the state-vector-detection heuristic and its
// documented limitations — is COMPLETELY UNCHANGED from the original
// file. This is colors and font classes only.

import { motion } from "framer-motion";
import { useQuantumStore, math } from "../../store/useQuantumStore";

/**
 * Attempts to extract a flat array of amplitudes from the evaluation
 * result IF it looks like a column vector (n x 1 matrix) or a plain
 * 1D array. Returns null if the shape doesn't match (e.g. it's a
 * square gate matrix), so the panel can show its empty state instead
 * of misinterpreting a gate as a state.
 */
function extractStateVector(result) {
  if (result === null || result === undefined) return null;

  try {
    // math.js matrices expose .size()
    if (result.size) {
      const dims = result.size();
      // Column vector: n x 1
      if (dims.length === 2 && dims[1] === 1) {
        return math.flatten(result).toArray();
      }
      // Already flat: n
      if (dims.length === 1) {
        return result.toArray();
      }
      return null; // e.g. a square gate matrix — not a state vector
    }

    // Plain JS array fallback
    if (Array.isArray(result)) {
      // Reject 2D arrays that aren't Nx1
      if (Array.isArray(result[0])) {
        if (result[0].length === 1) return result.map((r) => r[0]);
        return null;
      }
      return result;
    }
  } catch {
    return null;
  }

  return null;
}

/** Generates basis state labels like |0>, |1> or |00>, |01>, |10>, |11>. */
function generateBasisLabels(count) {
  const numQubits = Math.log2(count);
  if (!Number.isInteger(numQubits)) {
    // Not a clean power of 2 — fall back to numeric indices.
    return Array.from({ length: count }, (_, i) => `[${i}]`);
  }
  return Array.from({ length: count }, (_, i) =>
    `|${i.toString(2).padStart(numQubits, "0")}⟩`
  );
}

/**
 * @param {object} props
 * @param {string} props.cellId - which cell in the store this panel
 *        reads its evaluation result from. Scopes the component so
 *        multiple ProbabilityPanel instances (one per notebook cell)
 *        never read or display the wrong cell's data.
 */
export function ProbabilityPanel({ cellId }) {
  const result = useQuantumStore((s) => s.cells[cellId]?.evaluation.result);
  const error = useQuantumStore((s) => s.cells[cellId]?.evaluation.error);

  const stateVector = extractStateVector(result);

  if (error || !stateVector) {
    return (
      <div className="flex flex-col">
        <h3 className="mb-2 font-ui text-[10px] uppercase tracking-wider text-slate-400">
          Probability
        </h3>
        <div className="flex flex-1 items-center">
          <p className="font-ui text-[11px] text-slate-400">
            {error ? "—" : "No state vector"}
          </p>
        </div>
      </div>
    );
  }

  // prob() is the stdlib-injected Born rule function. We call the
  // same math instance's evaluate path indirectly by importing the
  // function reference directly off the math object for simplicity,
  // since prob() was injected via math.import().
  const probabilities = math.prob(stateVector);
  const labels = generateBasisLabels(stateVector.length);

  return (
    <div className="flex flex-col">
      <h3 className="mb-2 font-ui text-[10px] uppercase tracking-wider text-slate-400">
        Probability
      </h3>

      <div className="flex flex-col gap-1.5">
        {probabilities.map((p, i) => (
          <ProbabilityBar key={i} label={labels[i]} probability={p} />
        ))}
      </div>
    </div>
  );
}

/**
 * Single animated probability bar. Width morphs via Framer Motion
 * spring physics whenever `probability` changes (e.g. new evaluation,
 * or stepping through frames if you later wire this to stepper state
 * instead of final result — currently wired to final result only).
 */
function ProbabilityBar({ label, probability }) {
  const percent = Math.round(probability * 1000) / 10; // one decimal place

  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 font-code text-[10px] text-slate-500">
        {label}
      </span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/70">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-quantum-500 to-purple-quantum-500"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-code text-[10px] text-slate-500">
        {percent}%
      </span>
    </div>
  );
}