// src/components/editor/MarkdownEditor.jsx
//
// Simple Markdown Editor – split textarea + live preview.
// -----------------------------------------------------------------------
// Uses a minimal regex‑based renderer for bold, italic, headings, lists,
// and line breaks.  No external dependencies – just what you already have.

import { useState, useCallback, useMemo } from "react";
// Need to import useQuantumStore at top (added)
import { useQuantumStore } from "../../store/useQuantumStore";

/**
 * Converts a plain markdown string into basic HTML.
 * Supports: headings (###, ##, #), bold (**text**), italic (*text*),
 * unordered lists (- item), and paragraphs separated by blank lines.
 */
function renderMarkdown(text) {
  if (!text) return "";

  // Escape HTML entities first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headings (must be at start of line)
  html = html.replace(/^### (.+)$/gm, "<h3 class='font-ui font-semibold text-base text-purple-800 mt-4 mb-1'>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2 class='font-ui font-semibold text-lg text-purple-800 mt-4 mb-1'>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1 class='font-ui font-bold text-xl text-purple-800 mt-4 mb-2'>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>");

  // Paragraphs: split by double newlines, wrap each block
  const blocks = html.split(/\n\n+/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // If the block already contains <h1>-<h6> or <li>, leave it alone
      if (/^<(h[1-6]|li)/.test(trimmed)) return trimmed;
      // Otherwise wrap in <p>
      return `<p class='mb-2'>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

export function MarkdownEditor({ cellId }) {
  const store = useQuantumStore;
  // We read/write the cell's rawInput through the store
  const rawInput = useQuantumStore((s) => s.cells[cellId]?.editor?.rawInput || "");
  const setRawInput = useQuantumStore((s) => s.setRawInput);

  const [localText, setLocalText] = useState(rawInput);
  const [preview, setPreview] = useState(true);

  // When store rawInput changes externally (e.g. import), sync local state
  const [lastExternal, setLastExternal] = useState(rawInput);
  if (rawInput !== lastExternal) {
    setLastExternal(rawInput);
    if (rawInput !== localText) {
      setLocalText(rawInput);
    }
  }

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalText(value);
      setRawInput(cellId, value); // persist to store
    },
    [cellId, setRawInput]
  );

  const renderedHTML = useMemo(() => renderMarkdown(localText), [localText]);

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPreview((p) => !p)}
          className="rounded-md bg-purple-50 px-3 py-1 text-xs font-medium text-purple-600 transition hover:bg-purple-100"
        >
          {preview ? "Edit" : "Preview"}
        </button>
        <span className="text-[10px] text-slate-400 font-ui">Markdown</span>
      </div>

      {/* Editor / Preview */}
      <div className="min-h-[4rem]">
        {preview ? (
          <div
            className="prose prose-sm max-w-none text-slate-700 font-ui leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderedHTML }}
          />
        ) : (
          <textarea
            value={localText}
            onChange={handleChange}
            className="w-full resize-none overflow-hidden rounded-lg border border-purple-200 bg-white/60 px-3 py-2 font-code text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-300"
            rows={5}
            placeholder="## My notes&#10;&#10;- ket |0> means the zero state&#10;- **H** creates superposition"
          />
        )}
      </div>
    </div>
  );
}

