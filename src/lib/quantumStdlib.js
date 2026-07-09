// src/lib/quantumStdlib.js
//
// Quantum Standard Library — injected into a Math.js instance on app mount.
// Provides gate matrices, dagger (conjugate transpose), and prob (Born rule).
//
// Design notes:
// - Y gate requires complex entries -> built with math.complex(re, im).
// - All gates are returned as math.matrix() so they compose correctly
//   with math.multiply, math.kron, etc.
// - dagger(A) = conjugate transpose. Math.js has math.transpose and
//   math.conj, but conj on a matrix needs to be mapped element-wise
//   in older versions, so we do it explicitly for safety.
// - prob(state) implements the Born rule: |amplitude|^2 for each
//   component of a state vector (ket). Returns a plain array of
//   real numbers (not a math.js matrix) so UI components can map
//   over it directly without unwrapping.

/**
 * Injects the quantum gate library and helper functions into a
 * Math.js instance. Call this once, right after creating the
 * math.js instance (e.g. in useQuantumStore or on app mount).
 *
 * @param {object} math - a Math.js instance (from `import { create, all } from 'mathjs'`)
 */
export function injectQuantumStdlib(math) {
  // --- Single-qubit gates ---

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

  // --- Two-qubit gate ---

  // CNOT (control = qubit 0, target = qubit 1), standard computational
  // basis ordering |00>, |01>, |10>, |11>.
  const CNOT = math.matrix([
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 0],
  ]);

  // --- Helper functions ---

  /**
   * dagger(A): conjugate transpose of a matrix or vector.
   * Works element-wise on complex entries, falls back gracefully
   * on real matrices (conjugate of a real number is itself).
   */
  function dagger(A) {
    const transposed = math.transpose(A);
    return math.map(transposed, (entry) => {
      // math.conj works on complex numbers; for reals it's a no-op.
      return math.conj(entry);
    });
  }

  /**
   * prob(state): Born rule. Given a state vector (ket) as a
   * math.js matrix/array of amplitudes (possibly complex), returns
   * a plain JS array of probabilities: |amplitude_i|^2.
   *
   * Accepts either a math.matrix column vector or a plain array.
   */
  function prob(state) {
    const arr = math.flatten(math.matrix(state)).toArray();
    return arr.map((amplitude) => {
      const mag = math.abs(amplitude); // handles complex + real
      return math.re(math.multiply(mag, mag)) ?? mag * mag;
    });
  }

  // --- Register everything on the math.js instance ---

  math.import(
    {
      I,
      X,
      Y,
      Z,
      H,
      CNOT,
      dagger,
      prob,
    },
    { override: true } // allow re-injection during hot reload without throwing
  );
}