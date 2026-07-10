// src/components/editor/CodeEditor.jsx
//
// Code Editor – syntax highlighting, store sync, and auto‑complete
// -----------------------------------------------------------------------
// - Reads the cell's rawInput from the store and syncs with it.
// - Shows coloured syntax via React elements.
// - Shift+Enter evaluates the whole cell.
// - Auto‑complete popup for gates and built‑in functions.
//   Triggered by typing letters; filtered by what's under the cursor.
//   Select with mouse click or Enter key.

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { GENTLE_SETTLE } from "../../lib/motionPresets";

// ---- Available completions ----
const COMPLETIONS = [
  // Gates
  { label: "I",       type: "gate" },
  { label: "X",       type: "gate" },
  { label: "Y",       type: "gate" },
  { label: "Z",       type: "gate" },
  { label: "H",       type: "gate" },
  { label: "S",       type: "gate" },
  { label: "T",       type: "gate" },
  { label: "CNOT",    type: "gate" },
  { label: "SWAP",    type: "gate" },
  { label: "CZ",      type: "gate" },
  { label: "CY",      type: "gate" },
  { label: "CH",      type: "gate" },
  { label: "CCNOT",   type: "gate" },
  // Rotations
  { label: "Rx(",     type: "gate" },
  { label: "Ry(",     type: "gate" },
  { label: "Rz(",     type: "gate" },
  // Functions
  { label: "kron(",         type: "func" },
  { label: "dagger(",       type: "func" },
  { label: "prob(",         type: "func" },
  { label: "expect(",       type: "func" },
  { label: "variance(",     type: "func" },
  { label: "commutator(",   type: "func" },
  { label: "anticommutator(", type: "func" },
  { label: "isUnitary(",    type: "func" },
  { label: "controlled(",   type: "func" },
];

// ---- Token types for syntax highlighting ----
const GATES = new Set([
  "I","X","Y","Z","H","S","T",
  "CNOT","SWAP","CZ","CY","CH","CCNOT"
]);

const FUNCS = new Set([
  "kron","dagger","prob","expect","variance",
  "commutator","anticommutator","isUnitary","controlled"
]);

const OPERATORS = new Set(["*","+","-","/","^","=","(",")",",","[","]","{","}"]);

function isDiracToken(token) {
  return /^[|]\s*[01+\-i]*\s*[>]$/.test(token) || /^<[01+\-i]*[|]$/.test(token);
}

function isNumberToken(token) {
  return /^(pi|sqrt|\d+\.?\d*[i]?|[\d.]+e[+-]?\d+)$/.test(token);
}

function tokenizeLine(line) {
  const tokens = [];
  const parts = line.split(/(\s+)/g);
  parts.forEach((part) => {
    if (part === "") return;
    if (/^\s+$/.test(part)) {
      tokens.push({ text: part, cls: "" });
      return;
    }
    if (GATES.has(part)) tokens.push({ text: part, cls: "hl-gate" });
    else if (FUNCS.has(part)) tokens.push({ text: part, cls: "hl-func" });
    else if (isNumberToken(part)) tokens.push({ text: part, cls: "hl-number" });
    else if (isDiracToken(part)) tokens.push({ text: part, cls: "hl-dirac" });
    else if (OPERATORS.has(part)) tokens.push({ text: part, cls: "hl-operator" });
    else tokens.push({ text: part, cls: "" });
  });
  return tokens;
}

function buildHighlightedLines(text) {
  const lines = text.split("\n");
  return lines.map((line) => {
    if (line.trim().startsWith("//")) {
      return [{ text: line, cls: "hl-comment" }];
    }
    return tokenizeLine(line);
  });
}

// ---- Component ----
export function CodeEditor({ cellId }) {
  const scheduleEvaluation = useQuantumStore((s) => s.scheduleEvaluation);
  const evaluateNow      = useQuantumStore((s) => s.evaluateNow);
  const errorMessage     = useQuantumStore((s) => s.cells[cellId]?.evaluation.error);
  const storeRawInput    = useQuantumStore((s) => s.cells[cellId]?.editor?.rawInput || "");

  const [localText, setLocalText] = useState(storeRawInput);
  const textareaRef    = useRef(null);
  const highlightRef   = useRef(null);
  const lineNumbersRef = useRef(null);

  // sync with store
  useEffect(() => {
    setLocalText(storeRawInput);
  }, [storeRawInput]);

  // --- Auto‑complete state ---
  const [showCompletions, setShowCompletions] = useState(false);
  const [filteredCompletions, setFilteredCompletions] = useState([]);
  const [selectedCompletionIdx, setSelectedCompletionIdx] = useState(0);
  const [completionPos, setCompletionPos] = useState({ top: 0, left: 0 });

  const highlightedLines = useMemo(() => buildHighlightedLines(localText), [localText]);

  // Auto‑grow
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [localText]);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    const hl = highlightRef.current;
    const ln = lineNumbersRef.current;
    if (!ta) return;
    if (hl) {
      hl.scrollTop  = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
    }
    if (ln) ln.scrollTop = ta.scrollTop;
  }, []);

  // ---- Auto‑complete logic ----
  const updateCompletions = useCallback((textarea, cursorPos) => {
    const text = textarea.value;
    // Find the start of the current word
    let start = cursorPos;
    while (start > 0 && /[a-zA-Z_]/.test(text[start - 1])) {
      start--;
    }
    const query = text.slice(start, cursorPos).toLowerCase();
    if (query.length === 0) {
      setShowCompletions(false);
      return;
    }

    const matches = COMPLETIONS.filter((c) =>
      c.label.toLowerCase().startsWith(query)
    );
    if (matches.length === 0) {
      setShowCompletions(false);
      return;
    }

    // Position the dropdown near the cursor
    const rect = textarea.getBoundingClientRect();
    const preText = text.slice(0, cursorPos);
    const preLines = preText.split("\n");
    const currentLineNum = preLines.length;
    const lineText = preLines[preLines.length - 1];
    const measureEl = document.createElement("span");
    measureEl.style.cssText = `
      position:absolute; visibility:hidden; white-space:pre;
      font-family: inherit; font-size: inherit; font-weight: inherit;
    `;
    measureEl.textContent = lineText;
    document.body.appendChild(measureEl);
    const lineWidth = measureEl.offsetWidth;
    document.body.removeChild(measureEl);
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const paddingTop = parseInt(getComputedStyle(textarea).paddingTop) || 0;
    const paddingLeft = parseInt(getComputedStyle(textarea).paddingLeft) || 0;

    setCompletionPos({
      top: rect.top + paddingTop + (currentLineNum - 1) * lineHeight + lineHeight,
      left: rect.left + paddingLeft + lineWidth,
    });

    setFilteredCompletions(matches);
    setSelectedCompletionIdx(0);
    setShowCompletions(true);
  }, []);

  const applyCompletion = useCallback((completion) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    let start = pos;
    while (start > 0 && /[a-zA-Z_]/.test(ta.value[start - 1])) {
      start--;
    }
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(pos);
    const newText = before + completion.label + after;
    setLocalText(newText);
    scheduleEvaluation(cellId, newText, 500);
    setShowCompletions(false);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + completion.label.length, start + completion.label.length);
    }, 0);
  }, [cellId, scheduleEvaluation]);

  // ---- Event handlers ----
  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalText(value);
      scheduleEvaluation(cellId, value, 500);
      updateCompletions(e.target, e.target.selectionStart);
    },
    [scheduleEvaluation, cellId, updateCompletions]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (showCompletions) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedCompletionIdx((prev) =>
            Math.min(prev + 1, filteredCompletions.length - 1)
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedCompletionIdx((prev) => Math.max(prev - 1, 0));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          applyCompletion(filteredCompletions[selectedCompletionIdx]);
          return;
        }
        if (e.key === "Escape") {
          setShowCompletions(false);
          return;
        }
      }

      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        setShowCompletions(false);
        evaluateNow(cellId, localText);
      }
    },
    [showCompletions, filteredCompletions, selectedCompletionIdx, applyCompletion, evaluateNow, cellId, localText]
  );

  const hasError  = Boolean(errorMessage);
  const lineCount = highlightedLines.length || 1;

  const wrapperClass = `flex overflow-hidden rounded-lg border bg-white/60 transition-colors duration-200 ${hasError ? "border-red-300" : "border-slate-200"}`;
  const textareaClass = `relative w-full resize-none overflow-hidden bg-transparent px-3.5 py-3.5 font-code text-sm leading-7 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-quantum-400/40 ${hasError ? "quantum-error-squiggly" : ""}`;

  return (
    <div className="relative flex flex-col">
      <style>{`
        .hl-gate     { color: #7c3aed; font-weight: 500; }
        .hl-func     { color: #059669; font-weight: 500; }
        .hl-dirac    { color: #0891b2; }
        .hl-number   { color: #d97706; }
        .hl-operator { color: #0f172a; font-weight: 700; }
        .hl-comment  { color: #94a3b8; font-style: italic; }
      `}</style>

      <div className={wrapperClass}>
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="select-none overflow-hidden border-r border-slate-200/70 bg-slate-50/60 px-2 py-3.5 text-right font-code text-sm leading-7 text-slate-400"
          style={{ minWidth: "2.5rem" }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        <div className="relative flex-1">
          {/* Highlighted backdrop */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3.5 py-3.5 font-code text-sm leading-7 pointer-events-none"
          >
            {highlightedLines.map((lineTokens, lineIdx) => (
              <div key={lineIdx}>
                {lineTokens.map((token, tokenIdx) => (
                  <span key={tokenIdx} className={token.cls}>
                    {token.text}
                  </span>
                ))}
              </div>
            ))}
          </div>

          {/* Transparent textarea */}
          <textarea
            ref={textareaRef}
            value={localText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            spellCheck={false}
            rows={1}
            className={textareaClass}
            style={{ color: "transparent", caretColor: "#0f172a" }}
            placeholder="H * |0⟩   ·   kron(X, Y)   ·   Shift+Enter to run"
          />
        </div>
      </div>

      {/* Auto‑complete dropdown */}
      {showCompletions && (
        <div
          className="absolute z-50 max-h-40 overflow-y-auto rounded-lg border border-purple-200 bg-white shadow-lg"
          style={{
            top: completionPos.top,
            left: completionPos.left,
          }}
        >
          {filteredCompletions.map((item, idx) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-3 py-1.5 font-code text-xs cursor-pointer ${
                idx === selectedCompletionIdx
                  ? "bg-purple-100 text-purple-800"
                  : "text-slate-700 hover:bg-purple-50"
              }`}
              onClick={() => applyCompletion(item)}
              onMouseEnter={() => setSelectedCompletionIdx(idx)}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  item.type === "gate" ? "bg-purple-500" : "bg-emerald-500"
                }`}
              />
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* Error toast */}
      <AnimatePresence>
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={GENTLE_SETTLE}
            className="mt-2 rounded-lg border border-red-200 bg-white/80 px-3 py-2 backdrop-blur-glass font-ui text-xs text-red-600/90 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}