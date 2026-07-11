// src/lib/symbolicEngine.js
//
// Symbolic Engine – representation and operations for algebraic expressions
// -----------------------------------------------------------------------
// Provides:
//   - SymbolicNode classes with toHTML() for rendering (no KaTeX dependency)
//   - Factory functions: sym(), multiply(), add()
//   - createSymbolicMatrix(rows, cols, baseName, colLetters)

// ---- Base class ----
export class SymbolicNode {
  toHTML() { return ""; }
  isZero() { return false; }
  isOne() { return false; }
}

// ---- Scalar (symbol or number) ----
export class SymbolicScalar extends SymbolicNode {
  constructor(value) {
    super();
    if (typeof value === "number") {
      this.type = "number";
      this.value = value;
    } else if (typeof value === "string") {
      this.type = "symbol";
      this.name = value;
    } else if (value instanceof SymbolicScalar) {
      this.type = value.type;
      if (this.type === "number") this.value = value.value;
      else this.name = value.name;
    } else {
      throw new Error("Invalid scalar: " + value);
    }
  }

  isZero() {
    return this.type === "number" && this.value === 0;
  }

  isOne() {
    return this.type === "number" && this.value === 1;
  }

  toHTML() {
    if (this.type === "number") {
      return `${this.value}`;
    }
    // underscore → subscript
    const parts = this.name.split("_");
    if (parts.length === 2) {
      return `${parts[0]}<sub>${parts[1]}</sub>`;
    }
    // column‑letter names like "d1" → d<sub>1</sub>
    const match = this.name.match(/^([a-z])(\d+)$/i);
    if (match) {
      return `${match[1]}<sub>${match[2]}</sub>`;
    }
    return this.name;
  }

  // Keep toLatex for any remaining KaTeX uses (optional)
  toLatex() {
    if (this.type === "number") return `${this.value}`;
    const parts = this.name.split("_");
    if (parts.length === 2) return `${parts[0]}_{${parts[1]}}`;
    const match = this.name.match(/^([a-z])(\d+)$/i);
    if (match) return `${match[1]}_{${match[2]}}`;
    return this.name;
  }
}

// ---- Product (a × b) ----
export class SymbolicProduct extends SymbolicNode {
  constructor(left, right) {
    super();
    this.left = left;
    this.right = right;
  }

  toHTML() {
    const l = this.left.toHTML();
    const r = this.right.toHTML();
    return `${l} &#x00D7; ${r}`; // × character
  }

  toLatex() {
    return `${this.left.toLatex()} \\cdot ${this.right.toLatex()}`;
  }
}

// ---- Sum (a + b) ----
export class SymbolicSum extends SymbolicNode {
  constructor(left, right) {
    super();
    this.left = left;
    this.right = right;
  }

  toHTML() {
    return `${this.left.toHTML()} + ${this.right.toHTML()}`;
  }

  toLatex() {
    return `${this.left.toLatex()} + ${this.right.toLatex()}`;
  }
}

// ---- Symbolic Matrix (2D array of nodes) ----
export class SymbolicMatrix extends SymbolicNode {
  constructor(grid) {
    super();
    this.grid = grid;
  }

  toHTML() {
    const rows = this.grid.map(row =>
      row.map(cell => cell.toHTML()).join(" &nbsp; ")
    );
    return `<table class="matrix-table"><tr><td>${rows.join("</td></tr><tr><td>")}</td></tr></table>`;
  }

  toLatex() {
    const rows = this.grid.map(row =>
      row.map(cell => cell.toLatex()).join(" & ")
    );
    return `\\begin{bmatrix} ${rows.join(" \\\\ ")} \\end{bmatrix}`;
  }
}

// ---- Factory helpers ----
export function sym(value) {
  return new SymbolicScalar(value);
}

export function symbolicMultiply(a, b) {
  if (a.isZero() || b.isZero()) return sym(0);
  if (a.isOne()) return b;
  if (b.isOne()) return a;
  if (a.type === "number" && b.type === "number") {
    return sym(a.value * b.value);
  }
  return new SymbolicProduct(a, b);
}

export function symbolicAdd(a, b) {
  if (a.isZero()) return b;
  if (b.isZero()) return a;
  if (a.type === "number" && b.type === "number") {
    return sym(a.value + b.value);
  }
  return new SymbolicSum(a, b);
}

export function symbolicMatrixFromArray(arr) {
  const grid = arr.map(row =>
    row.map(cell => {
      if (cell instanceof SymbolicNode) return cell;
      return sym(cell);
    })
  );
  return new SymbolicMatrix(grid);
}

// ---- Create a symbolic matrix of any size ----
export function createSymbolicMatrix(rows, cols, baseName = "a", colLetters = false) {
  const grid = [];
  if (colLetters) {
    const startCode = baseName.charCodeAt(0);
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        const letter = String.fromCharCode(startCode + j);
        row.push(sym(`${letter}${i + 1}`));
      }
      grid.push(row);
    }
  } else {
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        row.push(sym(`${baseName}_${i + 1}${j + 1}`));
      }
      grid.push(row);
    }
  }
  return new SymbolicMatrix(grid);
}