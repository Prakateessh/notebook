// src/components/layout/SplitShell.jsx
//
// Split Shell – Fixed Two-Column Layout with Draggable Divider
// -----------------------------------------------------------------------
// Drag the thin purple bar between the notebook and visualizer to resize.
// Reliable implementation: uses a state flag to attach global listeners.

import { useState, useCallback, useRef, useEffect } from "react";
import { NotebookColumn } from "../notebook/NotebookColumn";
import { VisualizerPanel } from "../visualizer/VisualizerPanel";

export function SplitShell() {
  const [rightWidth, setRightWidth] = useState(46); // percent
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // When dragging starts, attach global listeners
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const total = rect.width;
      let pct = ((total - x) / total) * 100;
      pct = Math.min(70, Math.max(30, pct));
      setRightWidth(pct);
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const onDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-screen w-full flex-col overflow-hidden lg:flex-row"
    >
      {/* Left column: scrollable notebook */}
      <div className="order-2 flex-1 overflow-y-auto lg:order-1 lg:h-screen">
        <NotebookColumn />
      </div>

      {/* Draggable divider (visible on lg+ screens) */}
      <div
        className={`
          order-3 hidden shrink-0 cursor-col-resize select-none
          transition-colors duration-150
          lg:flex lg:w-2 lg:items-center lg:justify-center
          ${isDragging ? "bg-purple-300" : "bg-slate-200 hover:bg-purple-300"}
        `}
        onMouseDown={onDividerMouseDown}
      >
        {/* visual grip dots */}
        <div className="flex flex-col gap-1 pointer-events-none">
          <div className="h-0.5 w-0.5 rounded-full bg-slate-400" />
          <div className="h-0.5 w-0.5 rounded-full bg-slate-400" />
          <div className="h-0.5 w-0.5 rounded-full bg-slate-400" />
        </div>
      </div>

      {/* Right column: sticky visualizer */}
      <div
        className="
          order-1 w-full shrink-0 border-b border-purple-100/70
          lg:order-3 lg:h-screen lg:border-b-0 lg:border-l
          lg:max-w-[70vw]
        "
        style={{ width: `${rightWidth}%` }}
      >
        <VisualizerPanel />
      </div>
    </div>
  );
}