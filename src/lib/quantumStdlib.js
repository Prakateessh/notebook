// src/lib/quantumStdlib.js
//
// Quantum Standard Library — injected into a Math.js instance on app mount.
// Provides gate matrices, dagger (conjugate transpose), prob (Born rule),
// parameterised rotation gates Rx(θ), Ry(θ), Rz(θ), and utility functions:
// commutator(A,B), anticommutator(A,B), isUnitary(M), controlled(U),
// expect(O, state), variance(O, state).
//
// NEW: variance(operator, state) = ⟨ψ|O²|ψ⟩ – ⟨ψ|O|ψ⟩²
//       (uncertainty is sqrt(variance))
//
// Extended with additional common gates: S, T, SWAP, CZ, CY, CH, CCNOT.
//
// Design notes:
// - All gates are returned as math.matrix() so they compose correctly
//   with math.multiply, math.kron, etc.
// - Rotation gates are functions of an angle (in radians).
// - controlled(U) takes a 2×2 matrix U and returns a 4×4 controlled‑U gate.
// - dagger(A) = conjugate transpose.
// - prob(state) = Born rule: |amplitude|^2 for each component.
// - commutator(A,B) = A*B - B*A
// - anticommutator(A,B) = A*B + B*A
// - isUnitary(M) = true if M * dagger(M) ≈ identity
// - expect(O, state) = ⟨ψ|O|ψ⟩ (complex number or real)
// - variance(O, state) = ⟨ψ|O²|ψ⟩ – ⟨ψ|O|ψ⟩²

/**
 * Injects the quantum gate library and helper functions into a
 * Math.js instance. Call this once, right after creating the
 * math.js instance (e.g. in useQuantumStore or on app mount).
 *
 * @param {object} math - a Math.js instance (from `import { create, all } from 'mathjs'`)
 */
export function injectQuantumStdlib(math) {
  // --- Single‑qubit gates ---

  const I = math.matrix([
    [1, 0],
    [0, 1],
  ]);

  const X = math.matrix([
    [0, 1],
    [1, 0],
  ]);

  const Y = math.matrix([
    [math.complex(0, 0), math.complex(0, -1)],
    [math.complex(0, 1), math.complex(0, 0)],
  ]);

  const Z = math.matrix([
    [1, 0],
    [0, -1],
  ]);

  const invSqrt2 = 1 / Math.sqrt(2);
  const H = math.matrix([
    [invSqrt2, invSqrt2],
    [invSqrt2, -invSqrt2],
  ]);

  // Phase gate (S) : P(π/2)
  const S = math.matrix([
    [1, 0],
    [0, math.complex(0, 1)],
  ]);

  // π/8 gate (T) : P(π/4)
  const expIpi4 = math.exp(math.complex(0, Math.PI / 4));
  const T = math.matrix([
    [1, 0],
    [0, expIpi4],
  ]);

  // --- Parameterised rotation gates ---

  function Rx(theta) {
    const c = math.cos(math.divide(theta, 2));
    const s = math.sin(math.divide(theta, 2));
    const negIS = math.multiply(math.complex(0, -1), s);
    return math.matrix([
      [c, negIS],
      [negIS, c],
    ]);
  }

  function Ry(theta) {
    const c = math.cos(math.divide(theta, 2));
    const s = math.sin(math.divide(theta, 2));
    const negS = math.multiply(-1, s);
    return math.matrix([
      [c, negS],
      [s, c],
    ]);
  }

  function Rz(theta) {
    const eNeg = math.exp(math.multiply(math.complex(0, -1), math.divide(theta, 2)));
    const ePos = math.exp(math.multiply(math.complex(0, 1), math.divide(theta, 2)));
    return math.matrix([
      [eNeg, 0],
      [0, ePos],
    ]);
  }

  // --- Two‑qubit gates ---

  const CNOT = math.matrix([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 0],
  ]);

  const SWAP = math.matrix([
    [1, 0, 0, 0],
    [0, 0, 1, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
  ]);

  const CZ = math.matrix([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, -1],
  ]);

  const CY = math.matrix([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, math.complex(0, 0), math.complex(0, -1)],
    [0, 0, math.complex(0, 1), math.complex(0, 0)],
  ]);

  const CH = math.matrix([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, invSqrt2, invSqrt2],
    [0, 0, invSqrt2, -invSqrt2],
  ]);

  // --- Three‑qubit gate ---

  const CCNOT = math.matrix([
    [1, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 1, 0],
  ]);

  // --- Controlled gate factory ---

  function controlled(U) {
    const uArr = math.matrix(U).toArray();
    return math.matrix([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, uArr[0][0], uArr[0][1]],
      [0, 0, uArr[1][0], uArr[1][1]],
    ]);
  }

  // --- Helper functions ---

  function dagger(A) {
    const transposed = math.transpose(A);
    return math.map(transposed, (entry) => math.conj(entry));
  }

  function prob(state) {
    const arr = math.flatten(math.matrix(state)).toArray();
    return arr.map((amplitude) => {
      const mag = math.abs(amplitude);
      return math.re(math.multiply(mag, mag)) ?? mag * mag;
    });
  }

  function commutator(A, B) {
    const AB = math.multiply(A, B);
    const BA = math.multiply(B, A);
    return math.subtract(AB, BA);
  }

  function anticommutator(A, B) {
    const AB = math.multiply(A, B);
    const BA = math.multiply(B, A);
    return math.add(AB, BA);
  }

  function isUnitary(M) {
    const dg = dagger(M);
    const prod = math.multiply(M, dg);
    const size = math.size(prod);
    const rows = size.get([0]);
    const cols = size.get([1]);
    if (rows !== cols) return false;
    const tol = 1e-10;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const val = math.subset(prod, math.index(i, j));
        const expected = i === j ? 1 : 0;
        if (math.abs(math.subtract(val, expected)) > tol) {
          return false;
        }
      }
    }
    return true;
  }

  function expect(operator, state) {
    const bra = dagger(state);
    const psi = math.multiply(operator, state);
    const result = math.multiply(bra, psi);
    if (result.size) {
      return math.subset(result, math.index(0, 0));
    } else if (Array.isArray(result)) {
      return result[0][0] ?? result[0];
    }
    return result;
  }

  /**
   * variance(operator, state): returns ⟨ψ|O²|ψ⟩ – ⟨ψ|O|ψ⟩².
   * This measures the spread of measurement outcomes for observable O.
   */
  function variance(operator, state) {
    const O2 = math.multiply(operator, operator);  // O²
    const expO2 = expect(O2, state);
    const expO = expect(operator, state);
    const expOSq = math.multiply(expO, expO);  // ⟨O⟩²
    return math.subtract(expO2, expOSq);
  }

  // --- Register everything ---
  math.import(
    {
      I,
      X,
      Y,
      Z,
      H,
      S,
      T,
      Rx,
      Ry,
      Rz,
      CNOT,
      SWAP,
      CZ,
      CY,
      CH,
      CCNOT,
      controlled,
      dagger,
      prob,
      commutator,
      anticommutator,
      isUnitary,
      expect,
      variance,
    },
    { override: true }
  );
}