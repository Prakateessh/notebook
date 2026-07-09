// src/lib/stepGenerator.js
//
// Visual Stepper Frame Generator
// -----------------------------------------------------------------------
// Converts a matrix operation (multiplication or Kronecker product) into
// an ARRAY OF FRAMES that the UI can step through with Framer Motion.
//
// Each frame is a plain data object — no rendering logic lives here.
// MatrixStepper.jsx will consume these frames and animate transitions
// between them using <motion.div layout> + <AnimatePresence>.
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
// A final frame of type "complete" holds the fully computed matrix.
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
      });
    }
  }

  frames.push({
    type: "complete",
    resultSoFar,
  });

  return frames;
}