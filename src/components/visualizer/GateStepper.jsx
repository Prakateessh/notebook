// src/components/visualizer/GateStepper.jsx
//
// Gate Column‑by‑Column Explanation Display
// -----------------------------------------------------------------------
// Now shows the full gate matrix with the current column highlighted and
// a clear mapping from the input basis state to the output column.
//
// Caption example:
//   |10⟩  →  column 2 of CNOT  =  |11⟩

import { useMemo } from "react";
import { motion } from "framer-motion";
import { MatrixCell } from "./MatrixCell";
import { GENTLE_SETTLE } from "../../lib/motionPresets";

/**
 * Generates basis state labels for a given number of qubits.
 */
function generateBasisLabels(numQubits) {
  const count = 1 << numQubits;
  return Array.from({ length: count }, (_, i) =>
    `|${i.toString(2).padStart(numQubits, "0")}⟩`
  );
}

export function GateColumnDisplay({ cellId, frame }) {
  const { gateName, columnIndex, inputBasis, columnVector, matrix, numQubits } = frame;

  // Determine the output basis state: the column that has a single 1 (for permutation gates)
  // For non‑permutation gates (like H), just show the column vector.
  const outputBasis = useMemo(() => {
    if (!columnVector || columnVector.length !== matrix.length) return null;
    // Check if the column has exactly one entry equal to 1 and the rest 0
    const ones = columnVector.filter(v => {
      if (typeof v === "object" && v.re !== undefined) return v.re === 1 && v.im === 0;
      return v === 1;
    });
    const zeros = columnVector.filter(v => {
      if (typeof v === "object" && v.re !== undefined) return v.re === 0 && v.im === 0;
      return v === 0;
    });
    if (ones.length === 1 && zeros.length === columnVector.length - 1) {
      const idx = columnVector.findIndex(v => {
        if (typeof v === "object" && v.re !== undefined) return v.re === 1 && v.im === 0;
        return v === 1;
      });
      const labels = generateBasisLabels(numQubits);
      return labels[idx];
    }
    return null;
  }, [columnVector, matrix, numQubits]);

  const columnAsColumn = matrix.map(row => [row[columnIndex]]);

  return (
    <motion.div
      className="flex flex-col items-center gap-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={GENTLE_SETTLE}
    >
      <p className="font-ui text-xs text-slate-500">
        Input{" "}
        <span className="font-code text-cyan-quantum-600">{inputBasis}</span>
        {" → "}
        <span className="font-code text-purple-quantum-600">column {columnIndex}</span>{" "}
        of {gateName}
        {outputBasis ? (
          <>
            {" = "}
            <span className="font-code text-emerald-600">{outputBasis}</span>
          </>
        ) : null}
      </p>

      <div className="flex items-center gap-4">
        {/* Full gate matrix with current column highlighted */}
        <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          {matrix.map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map((val, c) => (
                <MatrixCell
                  key={c}
                  value={val}
                  layoutId={`${cellId}-gate-${r}-${c}`}
                  state={c === columnIndex ? "col-highlight" : "idle"}
                />
              ))}
            </div>
          ))}
        </div>

        <span className="font-math text-xl text-slate-400">=</span>

        {/* Output column vector */}
        <div className="flex flex-col gap-1 rounded-lg border border-purple-quantum-200 bg-purple-quantum-50/60 p-2.5">
          {columnAsColumn.map((row, r) => (
            <div key={r} className="flex gap-1">
              <MatrixCell
                value={row[0]}
                layoutId={`${cellId}-outcol-${r}`}
                state="settled"
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}