// src/components/controls/ProbabilityPanel.jsx
//
// Probability Panel Compartment
// -----------------------------------------------------------------------
// Real-time |amplitude|^2 percentages, computed via the injected
// prob() stdlib function. Renders as animated horizontal bars —
// one per basis state component of the current evaluation result.
//
// IMPORTANT ASSUMPTION: this panel only makes sense when the
// evaluation result is a STATE VECTOR (a column vector of amplitudes),
// not an arbitrary matrix (e.g. a bare gate like `H` alone, or a
// 2x2 result from A*B where A,B aren't state-related). We detect
// "is this a column vector" heuristically and show a neutral empty
// state otherwise, rather than crashing or showing nonsense bars.
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

export function ProbabilityPanel() {
  const result = useQuantumStore((s) => s.evaluation.result);
  const error = useQuantumStore((s) => s.evaluation.error);

  const stateVector = extractStateVector(result);

  if (error || !stateVector) {
    return (
      <div className="flex h-full flex-col">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-slate-400">
          PROBABILITY
        </h2>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-xs text-slate-600">
            {error ? "—" : "Evaluate a state vector to see probabilities"}
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
    <div className="flex h-full flex-col">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-slate-400">
        PROBABILITY
      </h2>

      <div className="flex flex-1 flex-col justify-center gap-2.5">
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
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 font-mono text-xs text-slate-400">
        {label}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800/60">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-xs text-slate-300">
        {percent}%
      </span>
    </div>
  );
}