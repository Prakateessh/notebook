// src/components/notebook/Cell.jsx
//
// Notebook Cell – now with a collapsible evaluation log panel
// -----------------------------------------------------------------------
// A small "Log" button toggles a panel showing timestamped entries.
// Each entry can be copied individually, or the entire log copied at once.

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useQuantumStore } from "../../store/useQuantumStore";
import { CodeEditor } from "../editor/CodeEditor";
import { MarkdownEditor } from "../editor/MarkdownEditor";
import { TILT_RESPONSE, GENTLE_SETTLE } from "../../lib/motionPresets";

export function Cell({ cellId, cellNumber, canDelete }) {
  const removeCell = useQuantumStore((s) => s.removeCell);
  const setActiveCell = useQuantumStore((s) => s.setActiveCell);
  const activeCellId = useQuantumStore((s) => s.activeCellId);
  const hasError = useQuantumStore((s) => !!s.cells[cellId]?.evaluation.error);
  const hasResult = useQuantumStore(
    (s) =>
      s.cells[cellId]?.evaluation.result !== null &&
      s.cells[cellId]?.evaluation.result !== undefined
  );
  const cellType = useQuantumStore((s) => s.cells[cellId]?.type || "code");
  const setCellType = useQuantumStore((s) => s.setCellType);
  const logs = useQuantumStore((s) => s.cells[cellId]?.logs || []);
  const clearLogs = useQuantumStore((s) => s.clearLogs);

  const [showLogs, setShowLogs] = useState(false);
  const isActive = activeCellId === cellId;
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const maxTilt = 4;
    setTilt({ x: (py - 0.5) * -maxTilt * 2, y: (px - 0.5) * maxTilt * 2 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  // drag handle
  const handleDragStart = useCallback((e) => {
    e.dataTransfer.setData("text/plain", cellId);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => { if (cardRef.current) cardRef.current.style.opacity = "0.4"; }, 0);
  }, [cellId]);

  const handleDragEnd = useCallback(() => {
    if (cardRef.current) cardRef.current.style.opacity = "1";
  }, []);

  // status dot
  let statusColor = "bg-slate-300";
  if (cellType === "markdown") statusColor = "bg-purple-300";
  else if (isActive) statusColor = "bg-cyan-quantum-500";
  else if (hasError) statusColor = "bg-red-500";
  else if (hasResult) statusColor = "bg-emerald-500";

  const toggleCellType = () => setCellType(cellId, cellType === "code" ? "markdown" : "code");

  const copyLogs = () => {
    const text = logs
      .map(l => `[${l.timestamp}] ${l.error ? "ERROR" : "OK"}: ${l.input} → ${l.error || l.result}`)
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, height: 0 }}
      transition={GENTLE_SETTLE}
      onFocus={() => setActiveCell(cellId)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 800 }}
      className="group relative"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={isActive ? "" : "glow-border-card rounded-xl"}>
        <motion.div
          animate={{ rotateX: isHovering ? tilt.x : 0, rotateY: isHovering ? tilt.y : 0 }}
          transition={TILT_RESPONSE}
          style={{ transformStyle: "preserve-3d" }}
          className={`relative rounded-xl border bg-white/80 backdrop-blur-glass shadow-sm transition-all duration-300 ${
            isActive ? "border-purple-300 ring-1 ring-purple-200/50 shadow-md" : "border-purple-100"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                </svg>
              </span>
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor}`} />
              <span className="font-code text-xs text-slate-500">
                {cellType === "markdown" ? "✎" : `In [${cellNumber}]`}
              </span>
              {/* Log toggle button */}
              {cellType === "code" && (
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:bg-slate-100"
                >
                  {logs.length > 0 ? `Log (${logs.length})` : "Log"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleCellType}
                className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-purple-50 hover:text-purple-600 group-hover:opacity-100"
                title="Toggle markdown/code"
              >
                {cellType === "code" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                )}
              </button>
              <button
                onClick={() => removeCell(cellId)}
                disabled={!canDelete}
                aria-label="Delete cell"
                className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-purple-50 hover:text-purple-600 disabled:pointer-events-none disabled:opacity-0 group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="px-4 py-3">
            {cellType === "code" ? <CodeEditor cellId={cellId} /> : <MarkdownEditor cellId={cellId} />}
          </div>

          {/* Log panel */}
          {showLogs && logs.length > 0 && (
            <div className="border-t border-slate-200/70 px-4 py-2 bg-slate-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Evaluation Log</span>
                <div className="flex gap-2">
                  <button onClick={copyLogs} className="text-[10px] text-purple-500 hover:text-purple-700">Copy all</button>
                  <button onClick={() => clearLogs(cellId)} className="text-[10px] text-slate-400 hover:text-red-500">Clear</button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 font-code text-[10px]">
                {logs.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-slate-400 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span className={entry.error ? "text-red-500" : "text-emerald-600"}>
                      {entry.error || entry.result}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}