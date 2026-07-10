// src/components/cheatsheet/Cheatsheet.jsx
//
// Gate Cheatsheet – Slide‑out reference panel
// -----------------------------------------------------------------------
// Displays all available quantum gates, parameterised rotations,
// gate factories, and utility functions with their matrices.
// Matrices are rendered as mini MatrixCell grids (consistent with the
// rest of the app) – no KaTeX dependency.

import { motion } from "framer-motion";
import { math } from "../../store/useQuantumStore";
import { MatrixCell } from "../visualizer/MatrixCell";

// ---------- Helpers ----------

function getGateMatrix(gateName) {
  try {
    const m = math.evaluate(gateName, {});
    return m && m.toArray ? m.toArray() : null;
  } catch {
    return null;
  }
}

/** Render a 2D array as a miniature grid of MatrixCells */
function MiniMatrix({ matrix, layoutPrefix }) {
  if (!matrix) return null;
  return (
    <div className="inline-flex flex-col gap-0.5 rounded-md border border-slate-200 bg-slate-50/60 p-1.5">
      {matrix.map((row, r) => (
        <div key={r} className="flex gap-0.5">
          {row.map((val, c) => (
            <MatrixCell
              key={c}
              value={val}
              layoutId={`${layoutPrefix}-${r}-${c}`}
              state="idle"
              variant="term"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Data ----------

const singleQubitGates = [
  { name: "I",  desc: "Identity" },
  { name: "X",  desc: "Pauli‑X (bit flip)" },
  { name: "Y",  desc: "Pauli‑Y" },
  { name: "Z",  desc: "Pauli‑Z (phase flip)" },
  { name: "H",  desc: "Hadamard (creates superposition)" },
  { name: "S",  desc: "Phase gate (π/2)" },
  { name: "T",  desc: "π/8 gate (π/4)" },
];

const twoQubitGates = [
  { name: "CNOT", desc: "Controlled‑NOT" },
  { name: "SWAP", desc: "Swaps two qubits" },
  { name: "CZ",   desc: "Controlled‑Z" },
  { name: "CY",   desc: "Controlled‑Y" },
  { name: "CH",   desc: "Controlled‑H" },
];

const threeQubitGates = [
  { name: "CCNOT", desc: "Toffoli (controlled‑controlled‑NOT)" },
];

// For rotation gates, we evaluate at a sample angle and show the matrix
const rotationGates = [
  { name: "Rx(pi/2)",   label: "Rx(θ)",   desc: "Rotation around X axis (θ = π/2)" },
  { name: "Ry(pi/2)",   label: "Ry(θ)",   desc: "Rotation around Y axis (θ = π/2)" },
  { name: "Rz(pi/2)",   label: "Rz(θ)",   desc: "Rotation around Z axis (θ = π/2)" },
];

const utilityFunctions = [
  { name: "dagger(A)",      desc: "Conjugate transpose" },
  { name: "prob(state)",    desc: "Born rule: |amplitude|^2" },
  { name: "commutator(A,B)",desc: "A*B − B*A" },
  { name: "anticommutator(A,B)", desc: "A*B + B*A" },
  { name: "isUnitary(M)",   desc: "Checks if M is unitary" },
  { name: "expect(O, state)", desc: "Expectation value ⟨ψ|O|ψ⟩" },
  { name: "variance(O, state)", desc: "Variance of observable O" },
  { name: "controlled(U)",  desc: "Builds 4×4 controlled‑U from 2×2 U" },
];

// ---------- Component ----------

export function Cheatsheet({ onClose }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        className="relative h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white/95 shadow-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/90 px-6 py-4 backdrop-blur-glass">
          <h2 className="font-ui text-sm font-semibold text-slate-700">Gate Cheatsheet</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8 px-6 py-6">
          <Section title="Single‑Qubit Gates">
            {singleQubitGates.map((gate) => (
              <GateEntry key={gate.name} name={gate.name} desc={gate.desc} layoutPrefix={`s-${gate.name}`} />
            ))}
          </Section>

          <Section title="Two‑Qubit Gates">
            {twoQubitGates.map((gate) => (
              <GateEntry key={gate.name} name={gate.name} desc={gate.desc} layoutPrefix={`2-${gate.name}`} />
            ))}
          </Section>

          <Section title="Three‑Qubit Gate">
            {threeQubitGates.map((gate) => (
              <GateEntry key={gate.name} name={gate.name} desc={gate.desc} layoutPrefix={`3-${gate.name}`} />
            ))}
          </Section>

          <Section title="Parameterised Rotations">
            {rotationGates.map((rot) => (
              <GateEntry key={rot.name} name={rot.name} desc={rot.desc} label={rot.label} layoutPrefix={`rot-${rot.label}`} />
            ))}
          </Section>

          <Section title="Utility Functions">
            {utilityFunctions.map((func) => (
              <div key={func.name} className="mb-3">
                <span className="font-code text-sm font-medium text-cyan-quantum-700">{func.name}</span>
                <p className="font-ui text-xs text-slate-500">{func.desc}</p>
              </div>
            ))}
          </Section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-3 font-ui text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function GateEntry({ name, desc, label, layoutPrefix }) {
  const matrixArray = getGateMatrix(name);
  return (
    <div className="mb-4">
      <div className="font-code text-sm font-medium text-purple-quantum-700">
        {label || name}
      </div>
      <div className="font-ui text-xs text-slate-500 mb-1">{desc}</div>
      {matrixArray && (
        <MiniMatrix matrix={matrixArray} layoutPrefix={layoutPrefix} />
      )}
    </div>
  );
}