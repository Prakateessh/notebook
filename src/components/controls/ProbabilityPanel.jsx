// src/components/controls/ProbabilityPanel.jsx
//
// Probability Panel Compartment — NOTEBOOK CELL EDITION
// -----------------------------------------------------------------------
// MODIFIED: now takes a `cellId` prop and reads that specific cell's
// evaluation slice, instead of a single global slice.
//
// Also restyled to be more compact, since this now lives inside a
// two-column strip (PlaybackControls | ProbabilityPanel) at the bottom
// of each notebook cell card, rather than occupying its own full bento
// compartment. Bar height and label sizing are reduced to fit, but all
// functionality — state-vector detection, Born-rule computation, basis
// labeling — is fully preserved from the original file, nothing cut.
//
// IMPORTANT ASSUMPTION (unchanged from original): this panel only makes
// sense when the evaluation result is a STATE VECTOR (a column vector
// of amplitudes), not an arbitrary matrix (e.g. a bare gate like `H`
// alone, or a 2x2 result from A*B where A,B aren't state-related). We
// detect "is this a column vector" heuristically and show a neutral
// empty state otherwise, rather than crashing or showing nonsense bars.
//
// Basis labels: for an n-dimensional state vector, log2(n) qubits
// are inferred, and labels are generated as |000>, |001>, etc.
// If n isn't a power of 2, we fall back to numeric indices.

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
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Probability
        </h3>
        <div className="flex flex-1 items-center">
          <p className="text-[11px] text-slate-700">
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
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-600">
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
      <span className="w-10 shrink-0 font-mono text-[10px] text-slate-500">
        {label}
      </span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/60">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[10px] text-slate-400">
        {percent}%
      </span>
    </div>
  );
}