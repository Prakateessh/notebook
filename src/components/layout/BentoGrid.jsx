// src/components/layout/BentoGrid.jsx
//
// Bento Grid Layout Shell
// -----------------------------------------------------------------------
// Pure layout + styling component. No math logic, no state subscriptions
// beyond simple prop-passthrough (children). This defines the visual
// skeleton: a CSS grid dividing the screen into distinct glassmorphism
// compartments.
//
// Layout (desktop, >= lg breakpoint):
//   +----------------+-------------------------------+
//   |                |                                |
//   |   Editor       |     Hero Visualizer            |
//   |   (col-span-4) |     (col-span-8, row-span-2)   |
//   |                |                                |
//   +----------------+                                |
//   |  Playback      |                                |
//   |  Controls      |                                |
//   |  (col-span-2)  +-------------------------------+
//   |  Probability   |
//   |  Panel         |
//   |  (col-span-2)  |
//   +----------------+
//
// Design constraints (from spec):
// - bg-slate-950 base, no skeuomorphism, no parallax.
// - Each compartment: rounded-3xl, backdrop-blur, subtle border,
//   glow only on ACTIVE state (handled by children via className prop,
//   not hardcoded here).
// - Background stays static — no scroll-linked transforms anywhere
//   in this file.

export function BentoGrid({ editorSlot, visualizerSlot, controlsSlot, probabilitySlot }) {
  return (
    <div className="min-h-screen w-full bg-slate-950 p-4 md:p-6 lg:p-8">
      {/* Static ambient glow — fixed position, NOT parallax/scroll-linked.
          Purely decorative background wash, sits behind everything. */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.15), transparent 40%), radial-gradient(circle at 80% 70%, rgba(168,85,247,0.12), transparent 45%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12 lg:grid-rows-[auto_auto]">
        {/* --- Editor Compartment --- */}
        <BentoCell className="lg:col-span-4 lg:row-span-1">
          {editorSlot}
        </BentoCell>

        {/* --- Hero Visualizer Compartment (largest, spans 2 rows) --- */}
        <BentoCell className="lg:col-span-8 lg:row-span-2 min-h-[420px] lg:min-h-0">
          {visualizerSlot}
        </BentoCell>

        {/* --- Playback Controls Compartment --- */}
        <BentoCell className="lg:col-span-2 lg:row-span-1">
          {controlsSlot}
        </BentoCell>

        {/* --- Probability Panel Compartment --- */}
        <BentoCell className="lg:col-span-2 lg:row-span-1">
          {probabilitySlot}
        </BentoCell>
      </div>
    </div>
  );
}

/**
 * BentoCell: the reusable glassmorphism compartment wrapper.
 * Every bento box in the grid gets this same treatment so the
 * aesthetic stays consistent regardless of what's inside it.
 *
 * className prop lets parent control grid placement (col-span etc.)
 * while this component owns the visual treatment (blur, border, radius).
 */
function BentoCell({ className = "", children }) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-3xl
        border border-slate-800/60
        bg-slate-900/40 backdrop-blur-xl
        shadow-[0_0_0_1px_rgba(255,255,255,0.02)]
        ${className}
      `}
    >
      {/* Inner hairline highlight — subtle, not a fake bevel/skeuomorphic edge.
          Just a 1px top gradient to suggest glass thickness. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-400/20 to-transparent" />
      <div className="relative h-full p-5 md:p-6">{children}</div>
    </div>
  );
}