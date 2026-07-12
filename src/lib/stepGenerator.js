// src/lib/stepGenerator.js
//
// Visual Stepper Frame Generator
// -----------------------------------------------------------------------
// Converts a matrix operation (multiplication, Kronecker product, or
// a gate-only expression) into an ARRAY OF FRAMES that the UI can step
// through with Framer Motion.
//
// Each frame is a plain data object — no rendering logic lives here.
// MatrixStepper.jsx / KroneckerStepper.jsx / GateStepper.jsx consume
// these frames and animate transitions between them.
//
// Frame shape (matrix multiplication), one frame PER OUTPUT CELL:
// {
//   type: "cell-compute",
//   rowIndex: number,          // which row of A is active
//   colIndex: number,          // which column of B is active
//   rowValues: number[],       // the highlighted row from A
//   colValues: number[],       // the highlighted column from B
//   terms: { a: number, b: number, product: number }[],  // per-term products
//   runningSum: number,        // final value for this cell
//   resultSoFar: (number|null)[][],  // partial result matrix, null = not yet computed
// }
//
// Frame shape (Kronecker product), one frame PER OUTPUT BLOCK:
// {
//   type: "block-compute",
//   aRowIndex: number,
//   aColIndex: number,
//   scalar: number,
//   block: number[][],
//   blockOffset: { row: number, col: number },
//   resultSoFar: (number|null)[][],
//   matrixA: number[][],       // NEW: full source matrix A, unchanged across all frames
//   matrixB: number[][],       // NEW: full source matrix B, unchanged across all frames
// }
//
// Frame shape (gate explanation), one frame PER COLUMN:
// {
//   type: "gate-column",
//   gateName: string,          // e.g., "CNOT", "H"
//   columnIndex: number,       // 0‑based column index
//   inputBasis: string,        // "|00⟩", "|0⟩", etc.
//   columnVector: number[],    // the column as a flat array
//   matrix: number[][],        // full gate matrix (2D array)
//   numQubits: number          // number of qubits this gate acts on
// }
// A final frame of type "complete" holds the full matrix for the gate.
//
// Design notes:
// - We do NOT mutate the caller's matrices. Everything is read via
//   plain 2D arrays (call math.matrix(...).toArray() before passing in).
// - Complex numbers are supported: term values are stored as-is
//   (could be JS numbers or math.js Complex instances) — the UI/KaTeX
//   layer is responsible for formatting them as a+bi.
// - This module has ZERO dependency on Math.js itself; it just expects
//   plain nested arrays and a `multiply`/`add` function pair, so it stays
//   decoupled and testable. The caller passes in math.js's multiply/add
//   (or plain JS operators for the simple real-number case).
// - matrixA/matrixB on Kronecker frames are REFERENCES, not clones — A
//   and B never mutate during the sweep, so no defensive copying is
//   needed there (unlike resultSoFar, which genuinely changes frame to
//   frame and DOES need cloning for Framer Motion's layout system to
//   detect changes correctly via reference inequality).

/**
 * Generates cell-by-cell frames for matrix multiplication A * B.
 *
 * @param {Array<Array<number>>} A - m x n matrix (plain 2D array)
 * @param {Array<Array<number>>} B - n x p matrix (plain 2D array)
 * @param {object} ops - { multiply: (a,b) => value, add: (a,b) => value }
 *        Pass math.js's math.multiply / math.add for complex support,
 *        or plain (a,b)=>a*b / (a,b)=>a+b for the simple real case.
 * @returns {Array<object>} frames - ordered array of frame objects
 */
export function generateMultiplicationSteps(A, B, ops) {
  const { multiply, add } = ops;

  const m = A.length; // rows of A
  const n = A[0].length; // cols of A == rows of B
  const p = B[0].length; // cols of B

  if (B.length !== n) {
    throw new Error(
      `Dimension mismatch: A is ${m}x${n}, B is ${B.length}x${p}. Cannot multiply.`
    );
  }

  const frames = [];

  // resultSoFar starts as a grid of nulls — "not yet computed".
  // We deep-clone it on every frame so each frame is an independent
  // snapshot (important: Framer Motion needs new references to detect
  // layout changes correctly, mutating one shared array will break it).
  let resultSoFar = Array.from({ length: m }, () => Array(p).fill(null));

  for (let row = 0; row < m; row++) {
    for (let col = 0; col < p; col++) {
      const rowValues = A[row]; // full row from A
      const colValues = B.map((bRow) => bRow[col]); // full column from B

      // Compute each term a_k * b_k individually so the UI can show
      // them floating in one at a time before merging into runningSum.
      const terms = [];
      let runningSum = null;

      for (let k = 0; k < n; k++) {
        const a = rowValues[k];
        const b = colValues[k];
        const product = multiply(a, b);
        terms.push({ a, b, product });
        runningSum = runningSum === null ? product : add(runningSum, product);
      }

      // Clone resultSoFar for this frame, then commit this cell's value.
      const snapshot = resultSoFar.map((r) => [...r]);
      snapshot[row][col] = runningSum;
      resultSoFar = snapshot;

      frames.push({
        type: "cell-compute",
        rowIndex: row,
        colIndex: col,
        rowValues,
        colValues,
        terms,
        runningSum,
        resultSoFar: snapshot,
      });
    }
  }

  // Final frame: everything computed, used to trigger the "settle"
  // animation where highlights fade and the full result matrix glows.
  frames.push({
    type: "complete",
    resultSoFar,
  });

  return frames;
}

/**
 * Generates frames for a Kronecker product A ⊗ B.
 *
 * Unlike multiplication, Kronecker product doesn't have a "row dot
 * column" arithmetic step — instead, each output BLOCK is A[i][j] * B
 * (a full scaled copy of B placed into a block position). We frame it
 * block-by-block: highlight the scalar A[i][j], then show it scaling
 * a full copy of B into the correct block of the output.
 *
 * @param {Array<Array<number>>} A - m x n matrix
 * @param {Array<Array<number>>} B - p x q matrix
 * @param {object} ops - { multiply: (a,b) => value }
 * @returns {Array<object>} frames
 */
export function generateKroneckerSteps(A, B, ops) {
  const { multiply } = ops;

  const m = A.length;
  const n = A[0].length;
  const p = B.length;
  const q = B[0].length;

  const outRows = m * p;
  const outCols = n * q;

  const frames = [];
  let resultSoFar = Array.from({ length: outRows }, () =>
    Array(outCols).fill(null)
  );

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const scalar = A[i][j];

      // Compute this block: scalar * B (element-wise scale of full B)
      const block = B.map((bRow) => bRow.map((bVal) => multiply(scalar, bVal)));

      // Place the block into resultSoFar at the correct offset.
      const snapshot = resultSoFar.map((r) => [...r]);
      const rowOffset = i * p;
      const colOffset = j * q;
      for (let bi = 0; bi < p; bi++) {
        for (let bj = 0; bj < q; bj++) {
          snapshot[rowOffset + bi][colOffset + bj] = block[bi][bj];
        }
      }
      resultSoFar = snapshot;

      frames.push({
        type: "block-compute",
        aRowIndex: i,
        aColIndex: j,
        scalar,
        block,
        blockOffset: { row: rowOffset, col: colOffset },
        resultSoFar: snapshot,
        // Full source matrices carried on every frame so KroneckerStepper.jsx
        // can render persistent A/B grids alongside the current block,
        // rather than only having access to this single block's data.
        // These are references, not clones — A and B never mutate during
        // the sweep, so no defensive copying is needed here (unlike
        // resultSoFar, which genuinely changes frame to frame).
        matrixA: A,
        matrixB: B,
      });
    }
  }

  frames.push({
    type: "complete",
    resultSoFar,
    matrixA: A,
    matrixB: B,
  });

  return frames;
}

// ----------------------------------------------------------------------
// NEW: Gate Explanation Steps
// ----------------------------------------------------------------------

/**
 * Generates basis state labels like |0⟩, |1⟩ or |00⟩, |01⟩, |10⟩, |11⟩
 * for a given number of qubits.
 * @param {number} numQubits
 * @returns {string[]} array of basis labels
 */
function generateBasisLabels(numQubits) {
  const count = 1 << numQubits; // 2^numQubits
  return Array.from({ length: count }, (_, i) =>
    `|${i.toString(2).padStart(numQubits, "0")}⟩`
  );
}

/**
 * Generates column‑by‑column frames for a quantum gate.
 * Each frame highlights one column of the gate matrix, showing the
 * input basis state and the resulting output state (the column itself).
 *
 * @param {Array<Array<number>>} gateMatrix - n x n matrix (n = 2^k)
 * @param {string} gateName - e.g. "CNOT", "H"
 * @returns {Array<object>} frames - ordered array, last frame type "complete"
 */
export function generateGateExplanationSteps(gateMatrix, gateName) {
  const n = gateMatrix.length;
  const numQubits = Math.log2(n);
  if (!Number.isInteger(numQubits)) {
    throw new Error(
      `Gate matrix size ${n} is not a power of 2; cannot generate basis labels.`
    );
  }

  const basisLabels = generateBasisLabels(numQubits);
  const frames = [];

  for (let j = 0; j < n; j++) {
    // Extract column j (output state for input basis state |j⟩)
    const columnVector = gateMatrix.map(row => row[j]);

    frames.push({
      type: "gate-column",
      gateName,
      columnIndex: j,
      inputBasis: basisLabels[j],
      columnVector,
      matrix: gateMatrix,   // reference to the full matrix (never mutates)
      numQubits,
    });
  }

  // Final complete frame with the full matrix
  frames.push({
    type: "complete",
    gateName,
    matrix: gateMatrix,
    numQubits,
  });

  return frames;
}
 

// src/lib/stepGenerator.js
//
// Visual Stepper Frame Generator
// -----------------------------------------------------------------------
// … (existing comments and functions remain exactly as they were) …

// ============================================================
// DETAILED GATE DERIVATION – Equation‑Rich Steps
// ============================================================

/**
 * Generates extremely detailed step‑by‑step frames for building a gate
 * matrix from user‑specified basis‑state mappings.
 *
 * For each input‑output pair:
 *   1. Mapping frame:      U|basis⟩ = |output⟩  (the given equation).
 *   2. Outer‑product frame: |output⟩⟨basis|     (the matrix contribution).
 *   3. Addition frame:      accumulator + outer product → new accumulator.
 *
 * @param {Array<Array<number>>} outputColumns – ordered array of output
 *        column vectors (each a 2D array of shape 2^n × 1)
 * @param {Array<string>} basisLabels – e.g. ["|00⟩","|01⟩","|10⟩","|11⟩"]
 * @param {string} gateName – name of the gate being defined
 * @returns {Array<object>} frames – last frame is type "complete"
 */
export function generateGateDerivationDetailed(outputColumns, basisLabels, gateName) {
  const n = outputColumns.length;
  const qubits = Math.log2(n);
  if (!Number.isInteger(qubits)) {
    throw new Error("Number of output columns must be a power of 2.");
  }

  const frames = [];
  // Running sum matrix (starts as zero)
  let accumulator = Array.from({ length: n }, () => Array(n).fill(0));

  for (let j = 0; j < n; j++) {
    const outputVec = outputColumns[j]; // 2D column (n × 1)
    const basisLabel = basisLabels[j];

    // Ensure outputVec is a proper 2D column of scalars
    const safeOutputVec = outputVec.map(r =>
      Array.isArray(r) ? [r[0]] : [r]
    );

    // ---- 1. Mapping frame ----
    frames.push({
      type: "mapping",
      gateName,
      stepIndex: j,
      inputBasis: basisLabel,
      outputVector: safeOutputVec,
      numQubits: qubits,
    });

    // ---- 2. Compute the outer product ----
    const basisRow = Array(n).fill(0);
    basisRow[j] = 1;   // ⟨basis| has 1 at position j

    const outerMatrix = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      for (let c = 0; c < n; c++) {
        const ov = safeOutputVec[r][0];
        row.push(ov * basisRow[c]);
      }
      outerMatrix.push(row);
    }

    // Outer‑product frame
    frames.push({
      type: "outer-product",
      gateName,
      stepIndex: j,
      inputBasis: basisLabel,
      outputVector: safeOutputVec,
      basisRow,
      outerMatrix,
      numQubits: qubits,
    });

    // ---- 3. Add to accumulator ----
    const prevAccumulator = accumulator.map(r => [...r]);
    accumulator = accumulator.map((row, r) =>
      row.map((val, c) => val + outerMatrix[r][c])
    );

    // Addition frame
    frames.push({
      type: "addition",
      gateName,
      stepIndex: j,
      inputBasis: basisLabel,
      prevMatrix: prevAccumulator,
      outerMatrix,
      newMatrix: accumulator.map(r => [...r]),
      numQubits: qubits,
    });
  }

  // Final complete frame
  frames.push({
    type: "complete",
    gateName,
    matrix: accumulator,
    numQubits: qubits,
  });

  return frames;
}