// src/lib/motionPresets.js
//
// Custom Motion System — "Quantum Glass" Animation Language
// -----------------------------------------------------------------------
// Every Framer Motion transition in this app should import from HERE
// rather than inlining ad-hoc { type: "spring", stiffness: ..., damping: ... }
// objects scattered across files. This is what makes the motion feel
// like a deliberate, designed "custom class" rather than default
// library behavior — a small, curated vocabulary of movement, reused
// consistently so every morph/slide/fade in the app feels like it
// belongs to the same system.
//
// Naming philosophy: presets are named by INTENT (what kind of thing
// is moving and why), not by their raw physics parameters. A component
// author should be able to read `MATRIX_MORPH` and know "this is for
// matrix cells changing position/size," without needing to know or
// care what stiffness/damping value that implies under the hood.
//
// Categories:
//   1. Spring presets   — for layout/position/scale changes (springs
//                          feel organic; used for anything that moves
//                          through physical space).
//   2. Cubic-bezier easings — for opacity/color fades where a spring's
//                          overshoot would look wrong (a color fading
//                          in shouldn't "bounce" past full opacity).
//   3. Duration constants — shared timing values so staggered sequences
//                          (e.g. Kronecker's fly-and-duplicate) stay
//                          rhythmically consistent instead of every
//                          animator picking their own arbitrary number.
//   4. Stagger helpers  — functions that generate per-index delay so
//                          multi-element animations (grids, term lists)
//                          cascade instead of firing all at once.

// ============================================================
// 1. SPRING PRESETS — for position, scale, layout animations
// ============================================================

/**
 * MATRIX_MORPH: the primary spring for MatrixCell layout animations —
 * cells sliding/resizing when a frame changes. Tuned to feel precise
 * and "snappy-but-smooth" — quantum computation should feel exact,
 * not sluggish or overly bouncy. Slightly under-damped for a very
 * subtle settle-wobble that reads as "alive" without being cartoonish.
 */
export const MATRIX_MORPH = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.9,
};

/**
 * FLY_TRAVEL: for elements traveling a LONG distance across the canvas
 * (e.g. Kronecker's B-block flying from its origin position into a
 * result slot). Lower stiffness than MATRIX_MORPH so long-distance
 * travel has visible, satisfying momentum/arc rather than snapping
 * across the screen instantly. Higher damping to prevent overshoot
 * wobble at the end of a long flight (an overshooting object at the
 * end of a long throw reads as "out of control," not premium).
 */
export const FLY_TRAVEL = {
  type: "spring",
  stiffness: 180,
  damping: 26,
  mass: 1.1,
};

/**
 * GENTLE_SETTLE: for small UI chrome elements settling into place
 * (cards appearing, panels sliding in). Soft and calm — used for
 * things that should feel "arriving," not "computing."
 */
export const GENTLE_SETTLE = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

/**
 * PLAYFUL_BOUNCE: deliberately under-damped for moments that SHOULD
 * feel celebratory/emphatic — e.g. a Kronecker block landing in its
 * final slot, or the "Complete" state settling in. A visible bounce
 * here is a FEATURE (it's the "ta-da" moment), not a flaw.
 */
export const PLAYFUL_BOUNCE = {
  type: "spring",
  stiffness: 260,
  damping: 16,
  mass: 1,
};

/**
 * TILT_RESPONSE: fast, tight spring for hover-tilt/cursor-follow
 * micro-interactions on notebook cells. Needs to feel INSTANT and
 * responsive to cursor movement, not floaty — a tilt effect that lags
 * behind the cursor feels broken, not premium.
 */
export const TILT_RESPONSE = {
  type: "spring",
  stiffness: 500,
  damping: 40,
  mass: 0.5,
};

// ============================================================
// 2. CUBIC-BEZIER EASINGS — for opacity/color fades
// ============================================================

/**
 * EASE_QUANTUM_IN: custom cubic-bezier for elements fading/scaling IN.
 * A slight ease-out-heavy curve (fast start, gentle finish) — chosen
 * over Framer Motion's default "easeOut" for a slightly more
 * "materializing" feel appropriate to a quantum-themed app, vs. a
 * generic UI fade.
 */
export const EASE_QUANTUM_IN = [0.16, 1, 0.3, 1];

/**
 * EASE_QUANTUM_OUT: mirrored curve for elements fading/scaling OUT.
 * Fast finish, gentle start — objects should feel like they're being
 * "dismissed" quickly rather than lingering.
 */
export const EASE_QUANTUM_OUT = [0.7, 0, 0.84, 0];

/**
 * EASE_STANDARD: general-purpose UI easing (panel slides, toast
 * entrances) — a refined standard ease, less aggressive than the
 * quantum-specific curves above, for chrome that shouldn't call
 * attention to itself.
 */
export const EASE_STANDARD = [0.4, 0, 0.2, 1];

// ============================================================
// 3. DURATION CONSTANTS — shared timing for staggered sequences
// ============================================================

export const DURATIONS = {
  instant: 0.15,
  fast: 0.25,
  base: 0.4,
  slow: 0.6,
  cinematic: 0.9, // used for the "video player" feel of the visualizer —
  // deliberately slower than typical UI motion, since the
  // whole point of the stepper is to be WATCHED, not rushed past.
};

// ============================================================
// 4. STAGGER HELPERS — cascading multi-element animations
// ============================================================

/**
 * staggeredDelay(index, baseDelay): returns a delay value for the Nth
 * element in a sequence, so grids/lists cascade in rather than
 * appearing simultaneously. Used for e.g. Kronecker's 4 output blocks
 * landing one after another, or a matrix's cells populating in a
 * subtle wave rather than all at once.
 *
 * @param {number} index - position in the sequence (0-based)
 * @param {number} baseDelay - seconds between each staggered element
 *        (defaults to a snappy 0.06s — noticeable cascade without
 *        feeling slow for grids with many cells)
 */
export function staggeredDelay(index, baseDelay = 0.06) {
  return index * baseDelay;
}

/**
 * flyTransition(index): convenience wrapper combining FLY_TRAVEL spring
 * physics with a staggered delay, specifically for the Kronecker
 * fly-and-duplicate animation where multiple B-copies travel to their
 * block positions in sequence rather than simultaneously.
 */
export function flyTransition(index, baseDelay = 0.15) {
  return {
    ...FLY_TRAVEL,
    delay: staggeredDelay(index, baseDelay),
  };
}

/**
 * cascadeTransition(index): convenience wrapper combining GENTLE_SETTLE
 * with a staggered delay, for grid cells / list items appearing in a
 * wave rather than all at once.
 */
export function cascadeTransition(index, baseDelay = 0.05) {
  return {
    ...GENTLE_SETTLE,
    delay: staggeredDelay(index, baseDelay),
  };
}