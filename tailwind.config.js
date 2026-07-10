/** @type {import('tailwindcss').Config} */
// tailwind.config.js
//
// Tailwind Theme Configuration — Quantum Light Glassmorphism
// -----------------------------------------------------------------------
// Registers the three-font system as proper Tailwind theme tokens
// (font-ui, font-math, font-code) instead of relying on plain CSS
// utility classes. This gives IntelliSense/autocomplete support in
// editors, and lets Tailwind's JIT compiler tree-shake unused font
// declarations properly.
//
// NOTE: this makes the .font-ui/.font-math/.font-code classes defined
// in src/index.css's @layer utilities block REDUNDANT (Tailwind will
// now generate the exact same class names automatically from this
// config). We should remove that block from index.css to avoid
// duplicate/conflicting definitions — flagging this as a small
// follow-up cleanup, not urgent since duplicate identical rules don't
// break anything, they're just redundant bytes.
//
// Accent colors registered as named tokens (cyan-quantum, purple-quantum)
// per the doc's exact hex values, DISTINCT from Tailwind's built-in
// cyan-600/purple-600 (which are close but not pixel-identical to the
// doc's #006877 and #8127cf). Using named custom tokens avoids ambiguity
// about which "cyan-600" we mean anywhere in the codebase.

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        ui: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        math: ['"Source Serif 4"', 'ui-serif', 'Georgia', 'serif'],
        code: ['"JetBrains Mono"', 'ui-monospace', '"Cascadia Code"', 'monospace'],
      },
      colors: {
        // Named per the design doc's exact spec, so "cyan-quantum" always
        // means #006877 everywhere in the codebase, unambiguously.
        'cyan-quantum': {
        DEFAULT: '#006877',
        50: '#e6f5f7',
        100: '#c0e5ea',
        400: '#00a3b8',
        500: '#008299',
        600: '#006877',
        700: '#00505b',
      },
      'purple-quantum': {
        DEFAULT: '#8127cf',
        50: '#f3e9fc',
        100: '#e2c9f7',
        400: '#a05de0',
        500: '#8f42d8',
        600: '#8127cf',
        700: '#661fa3',
      },
      },
      backdropBlur: {
        // Explicit named token matching the doc's "backdrop-blur-md"
        // spec precisely, in case default Tailwind's md value ever
        // changes between versions — pins it deliberately.
        glass: '12px',
      },
    },
  },
  plugins: [],
}