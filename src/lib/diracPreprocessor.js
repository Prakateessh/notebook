// src/lib/diracPreprocessor.js
//
// Dirac Notation Preprocessor
// -----------------------------------------------------------------------
// Translates physicist-friendly Dirac notation into valid Math.js
// expressions BEFORE the string is handed to math.evaluate().
//
// BUG FIX: BRA_0 and BRA_1 previously used single-bracket comma syntax
// ("[1,0]"), which Math.js parses as a 1-D VECTOR, not a 1x2 row
// MATRIX. This meant multiply(ket, bra) and multiply(bra, ket) calls
// were mixing a real matrix (kets use semicolon syntax "[1;0]", which
// correctly creates a 2x1 matrix) with a vector, and Math.js's
// multiply() has different, incompatible dimension rules for
// matrix-times-vector vs matrix-times-matrix — producing exactly the
// "Matrix columns (1) must match Vector length (2)" error. FIX: bras
// now use double-bracket syntax ("[[1,0]]"), which Math.js correctly
// parses as a genuine 1x2 row matrix, matching kets' matrix semantics.
//
// Supported translations:
//   |0>            -> [1;0]                (ket, computational basis, 2x1 matrix)
//   |1>             -> [0;1]
//   <0|             -> [[1,0]]              (bra = row vector, 1x2 matrix)
//   <1|             -> [[0,1]]
//   |00>            -> kron([1;0],[1;0])    (multi-qubit ket, auto-expanded)
//   <01|            -> kron([[1,0]],[[0,1]]) (multi-qubit bra)
//   <a|b>           -> multiply(bra_a, ket_b)   (inner product)
//   |a><b|          -> multiply(ket_a, bra_b)   (outer product)
//
// Design notes:
// - This is a STRING-LEVEL preprocessor, not a parser. It runs a series
//   of regex passes over the raw input and returns a new string that
//   math.evaluate() can consume directly.
// - Order of passes matters: outer/inner products must be detected
//   BEFORE plain kets/bras are expanded, otherwise "|0><1|" would be
//   torn apart into two independent replacements and lose the
//   adjacency information needed to know it's an outer product.
// - Multi-qubit kets (|00>, |01>, etc.) are expanded qubit-by-qubit
//   into a chain of kron() calls, since Math.js has no native tensor
//   product literal syntax. Same applies to multi-qubit bras — kron()
//   of two proper 1x2 row matrices correctly produces a 1x4 row
//   matrix, preserving the bra's "row vector" identity through the
//   expansion (this only works correctly now that bras are true
//   matrices, not vectors — with the old vector-based bras, kron()
//   of two 1-D vectors would have produced another 1-D vector, losing
//   the row-vs-column distinction entirely).

const KET_0 = "[1;0]";
const KET_1 = "[0;1]";
const BRA_0 = "[[1,0]]";
const BRA_1 = "[[0,1]]";

/**
 * Expands a multi-symbol ket string like "00" or "101" into a
 * chain of kron() calls: kron(kron([1;0],[1;0]),[0;1])
 */
function expandKet(bits) {
  const vectors = bits.split("").map((b) => (b === "0" ? KET_0 : KET_1));
  return vectors.reduce((acc, v) => {
    if (acc === null) return v;
    return `kron(${acc},${v})`;
  }, null);
}

/**
 * Expands a multi-symbol bra string like "00" or "101" into a
 * chain of kron() calls using row-vector (1x2 matrix) bra components.
 */
function expandBra(bits) {
  const vectors = bits.split("").map((b) => (b === "0" ? BRA_0 : BRA_1));
  return vectors.reduce((acc, v) => {
    if (acc === null) return v;
    return `kron(${acc},${v})`;
  }, null);
}

/**
 * Main preprocessor entry point.
 * @param {string} input - raw editor text, e.g. "H * |0>" or "<0|1>"
 * @returns {string} - a string safe to pass to math.evaluate()
 */
export function preprocessDirac(input) {
  let out = input;

  // --- Pass 1: Outer products  |a><b|  ->  multiply(ket_a, bra_b) ---
  // Matches |bits1><bits2| as a single contiguous unit.
  out = out.replace(
    /\|([01]+)><([01]+)\|/g,
    (_, ketBits, braBits) => `multiply(${expandKet(ketBits)},${expandBra(braBits)})`
  );

  // --- Pass 2: Inner products  <a|b>  ->  multiply(bra_a, ket_b) ---
  out = out.replace(
    /<([01]+)\|([01]+)>/g,
    (_, braBits, ketBits) => `multiply(${expandBra(braBits)},${expandKet(ketBits)})`
  );

  // --- Pass 3: Plain multi-qubit / single-qubit kets  |bits>  ---
  out = out.replace(/\|([01]+)>/g, (_, bits) => expandKet(bits));

  // --- Pass 4: Plain multi-qubit / single-qubit bras  <bits|  ---
  out = out.replace(/<([01]+)\|/g, (_, bits) => expandBra(bits));

  return out;
}