// src/components/layout/AmbientBackground.jsx
//
// Ambient Background — Gradient Mesh + Grain Texture
// -----------------------------------------------------------------------
// Fixed, full-viewport decorative layer sitting BEHIND all app content
// (SplitShell, notebook cells, visualizer panel). This is what gives
// the "rich" premium feel you asked for — replacing the previous flat
// #faf8ff canvas with a soft, animated gradient mesh plus a subtle
// grain/noise texture overlay (the grain is what keeps large color
// gradients from looking like a flat "gradient tool default" — real
// premium UIs almost always add a touch of noise to gradients to
// avoid the "banding"/artificial look of a pure CSS gradient).
//
// IMPORTANT: this is PURELY decorative and NON-interactive.
// - position: fixed + pointer-events: none + z-index below everything
//   else, so it never intercepts clicks/scroll/focus meant for the
//   real UI (cells, buttons, etc.)
// - No parallax/scroll-linked transforms — this satisfies the original
//   spec's "no parallax scrolling" constraint even in this much richer
//   version. The gradient blobs DO gently drift via a slow CSS
//   animation (this is ambient motion, not scroll-triggered parallax
//   — the distinction matters: parallax ties motion to scroll
//   position, this does not).
//
// Technique: three large, blurred, radial-gradient "blobs" in the
// three brand colors (cyan-quantum, purple-quantum, plus a soft neutral
// warm tone for balance), each with an independent slow drift animation
// so they never look static, layered UNDER an SVG noise filter for
// grain texture.

import { useMemo } from "react";

export function AmbientBackground() {
  // Generate the SVG noise filter definition once (never needs to
  // change/re-render — memoized so it's created exactly once for the
  // lifetime of the app).
  const noiseFilterId = useMemo(() => "quantum-grain-filter", []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* --- Base canvas color (matches index.css but kept explicit here
            so this component is self-contained/portable) --- */}
      <div className="absolute inset-0 bg-[#faf8ff]" />

      {/* --- Gradient mesh blobs — three independently drifting blobs --- */}
      <div className="quantum-blob quantum-blob-cyan" />
      <div className="quantum-blob quantum-blob-purple" />
      <div className="quantum-blob quantum-blob-warm" />

      {/* --- Grain/noise overlay via SVG filter --- */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.035]">
        <filter id={noiseFilterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${noiseFilterId})`} />
      </svg>
    </div>
  );
}