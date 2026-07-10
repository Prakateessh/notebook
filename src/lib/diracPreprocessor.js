// src/lib/diracPreprocessor.js
//
// Dirac Notation Preprocessor
// -----------------------------------------------------------------------
// Translates physicist-friendly Dirac notation into valid Math.js
// expressions BEFORE the string is handed to math.evaluate().
//
// Supported translations:
//   |0>            -> [1;0]                (ket, computational basis, 2x1 matrix)
//   |1>            -> [0;1]
//   |+>            -> (1/sqrt(2))*[1;1]    (superposition)
//   |->            -> (1/sqrt(2))*[1;-1]
//   |i>            -> (1/sqrt(2))*[1;i]    (imaginary superposition)
//   |-i>           -> (1/sqrt(2))*[1;-i]
//   <0|            -> [[1,0]]              (bra = row vector, 1x2 matrix)
//   <1|            -> [[0,1]]
//   <+|            -> (1/sqrt(2))*[[1,1]]
//   <-|            -> (1/sqrt(2))*[[1,-1]]
//   <i|            -> (1/sqrt(2))*[[1,-i]] (bra is conjugate transpose of ket)
//   <-i|           -> (1/sqrt(2))*[[1,i]]
//   |00>           -> kron([1;0],[1;0])    (multi-qubit ket, auto-expanded)
//   <01|           -> kron([[1,0]],[[0,1]]) (multi-qubit bra)
//   <a|b>          -> multiply(bra_a, ket_b)   (inner product)
//   |a><b|         -> multiply(ket_a, bra_b)   (outer product)
//
// Design notes:
// - This is a STRING-LEVEL preprocessor, not a parser. It runs a series
//   of regex passes over the raw input and returns a new string that
//   math.evaluate() can consume directly.
// - Order of passes matters: outer/inner products must be detected
//   BEFORE plain kets/bras are expanded, otherwise "|0><1|" would be
//   torn apart into two independent replacements.
// - Multi-qubit kets (|00>, |01>, etc.) are expanded qubit-by-qubit
//   into a chain of kron() calls.

const KET_0 = "[1;0]";
const KET_1 = "[0;1]";
const BRA_0 = "[[1,0]]";
const BRA_1 = "[[0,1]]";

// Superposition states – inserted as scaled column/row vectors.
// Math.js will evaluate (1/sqrt(2)) * [1;1] correctly.
const KET_PLUS  = "(1/sqrt(2))*[1;1]";
const KET_MINUS = "(1/sqrt(2))*[1;-1]";
const KET_I     = "(1/sqrt(2))*[1;i]";
const KET_MINUS_I = "(1/sqrt(2))*[1;-i]";

const BRA_PLUS  = "(1/sqrt(2))*[[1,1]]";
const BRA_MINUS = "(1/sqrt(2))*[[1,-1]]";
const BRA_I     = "(1/sqrt(2))*[[1,-i]]";   // conjugate of |i>
const BRA_MINUS_I = "(1/sqrt(2))*[[1,i]]";  // conjugate of |-i>

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
 * @param {string} input - raw editor text, e.g. "H * |+>" or "<0|1>"
 * @returns {string} - a string safe to pass to math.evaluate()
 */
export function preprocessDirac(input) {
  let out = input;

  // --- Pass 1: Outer products  |a><b|  ->  multiply(ket_a, bra_b) ---
  // Now also supports superposition kets/bras like |+><-|.
  out = out.replace(
    /\|([01+\-i]+)><([01+\-i]+)\|/g,
    (_, ketBits, braBits) => {
      const ket = expandSymbolicKet(ketBits);
      const bra = expandSymbolicBra(braBits);
      return `multiply(${ket},${bra})`;
    }
  );

  // --- Pass 2: Inner products  <a|b>  ->  multiply(bra_a, ket_b) ---
  out = out.replace(
    /<([01+\-i]+)\|([01+\-i]+)>/g,
    (_, braBits, ketBits) => {
      const bra = expandSymbolicBra(braBits);
      const ket = expandSymbolicKet(ketBits);
      return `multiply(${bra},${ket})`;
    }
  );

  // --- Pass 3: Plain kets  |bits>  ---
  out = out.replace(/\|([01+\-i]+)>/g, (_, bits) => expandSymbolicKet(bits));

  // --- Pass 4: Plain bras  <bits|  ---
  out = out.replace(/<([01+\-i]+)\|/g, (_, bits) => expandSymbolicBra(bits));

  return out;
}

/**
 * Expands a symbolic ket string (may contain +, -, i as well as 0/1).
 * If the string is pure 0/1, expands to kron of basis kets.
 * Otherwise, replaces the entire symbolic label with the corresponding
 * predefined superposition vector.
 */
function expandSymbolicKet(bits) {
  // If it's a standard multi‑qubit basis ket (only 0 and 1)
  if (/^[01]+$/.test(bits)) {
    return expandKet(bits);
  }
  // Single‑qubit superposition states
  switch (bits) {
    case "+":  return KET_PLUS;
    case "-":  return KET_MINUS;
    case "i":  return KET_I;
    case "-i": return KET_MINUS_I;
    default:   return `|${bits}>`; // fallback, shouldn't happen with regex guard
  }
}

/**
 * Expands a symbolic bra string (may contain +, -, i as well as 0/1).
 */
function expandSymbolicBra(bits) {
  if (/^[01]+$/.test(bits)) {
    return expandBra(bits);
  }
  switch (bits) {
    case "+":  return BRA_PLUS;
    case "-":  return BRA_MINUS;
    case "i":  return BRA_I;
    case "-i": return BRA_MINUS_I;
    default:   return `<${bits}|`;
  }
}