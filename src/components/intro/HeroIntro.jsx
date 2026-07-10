// src/components/intro/HeroIntro.jsx
//
// Cinematic Hero — Light Violet Video Anchor (STRONGER DEPTH PASS)
// -----------------------------------------------------------------------
// CHANGES:
//   1. Parallax translate range roughly 3x wider (±16px -> ±48px on
//      the main content layer) and video tilt range doubled (±2deg ->
//      ±5deg), so cursor movement now produces clearly visible shift.
//   2. TRUE multi-plane depth: the author credit (background-ish, top
//      layer) now moves LESS than the headline block (foreground),
//      which moves MORE — this differential is what actually reads
//      as "3D depth" to the eye, rather than everything sliding as
//      one flat rigid unit.
//   3. Spring loosened (stiffness lowered, damping lowered) so it
//      follows the cursor with a touch of fluid lag/overshoot instead
//      of feeling stiff/locked.
//   4. Added a subtle scale pulse tied to cursor distance from center
//      on the video frame itself, reinforcing the 3D-tilt illusion
//      with a touch of "closer/further" depth cue.

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";

const TITLE_LINE1 = "Quantum";
const TITLE_LINE2 = "Scratchpad";

const EASE_LUXE = [0.16, 1, 0.3, 1];

export function HeroIntro({ onComplete }) {
  const [videoReady, setVideoReady] = useState(false);
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const videoRef = useRef(null);
  const heroRef = useRef(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Looser spring — lower stiffness/damping means more visible follow-
  // through and a touch of overshoot, which reads as more "alive" than
  // a tightly-locked cursor-follow.
  const springX = useSpring(mouseX, { stiffness: 55, damping: 12 });
  const springY = useSpring(mouseY, { stiffness: 55, damping: 12 });

  // --- Foreground layer (headline/button): moves MOST ---
  const fgX = useTransform(springX, [-0.5, 0.5], [-48, 48]);
  const fgY = useTransform(springY, [-0.5, 0.5], [-32, 32]);

  // --- Background-ish layer (author credit): moves LESS, opposite
  //     direction subtlety creates a genuine sense of separate depth
  //     planes rather than one rigid block. ---
  const bgX = useTransform(springX, [-0.5, 0.5], [-10, 10]);
  const bgY = useTransform(springY, [-0.5, 0.5], [-6, 6]);

  // --- Video 3D tilt: much wider angle range now ---
  const videoTiltX = useTransform(springY, [-0.5, 0.5], [7, -7]);
  const videoTiltY = useTransform(springX, [-0.5, 0.5], [-7, 7]);

  // --- Subtle scale cue: video feels slightly "closer" the further
  //     the cursor is from dead-center, reinforcing depth. ---
  const distanceFromCenter = useTransform([springX, springY], ([x, y]) =>
    Math.min(Math.sqrt(x * x + y * y) * 0.12, 1)
  );
  const videoScale = useTransform(distanceFromCenter, [0, 1], [1, 1.035]);

  const handleMouseMove = (e) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleVideoReady = () => setVideoReady(true);

  useEffect(() => {
    if (!videoReady) return;
    const t = setTimeout(() => setCurtainOpen(true), 120);
    return () => clearTimeout(t);
  }, [videoReady]);

  useEffect(() => {
    if (!curtainOpen) return;
    const t = setTimeout(() => setShowContent(true), 250);
    return () => clearTimeout(t);
  }, [curtainOpen]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.play().catch(() => {
      const tryPlay = () => {
        vid.play();
        window.removeEventListener("click", tryPlay);
      };
      window.addEventListener("click", tryPlay);
    });
  }, []);

  return (
    <div
      ref={heroRef}
      onMouseMove={handleMouseMove}
      className="relative h-screen overflow-hidden bg-white"
    >
      <motion.div
        initial={{ opacity: 0, scale: 1.15, rotate: -3 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.75, ease: EASE_LUXE }}
        style={{
          rotateX: videoTiltX,
          rotateY: videoTiltY,
          scale: videoScale,
          transformPerspective: 1000,
        }}
        className="absolute inset-4 overflow-hidden rounded-[2.5rem] shadow-[0_40px_120px_-20px_rgba(168,85,247,0.35)] md:inset-8"
      >
        <video
          ref={videoRef}
          src="/hero-bg.mp4"
          autoPlay
          loop
          muted
          playsInline
          onCanPlay={handleVideoReady}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/20 to-transparent" />

        {/* --- Background-plane layer: author credit, moves LEAST --- */}
        <motion.div style={{ x: bgX, y: bgY }} className="absolute inset-0 z-10">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_LUXE, delay: 0.5 }}
            className="absolute left-8 top-6 font-ui text-xs font-medium tracking-wide text-black"
          >
            Crafted by Prakateessh C.M.
          </motion.div>
        </motion.div>

        {/* --- Foreground-plane layer: headline/button, moves MOST --- */}
        <motion.div
          style={{ x: fgX, y: fgY }}
          className="relative z-10 flex h-full items-center"
        >
          <div className="ml-[6vw] max-w-2xl md:ml-[9vw]" style={{ perspective: 900 }}>
            {showContent && (
              <div>
                <h1 className="font-ui text-6xl font-extrabold leading-none tracking-tight text-slate-900 md:text-8xl">
                  <FlipLine text={TITLE_LINE1} delay={0} />
                  <FlipLine
                    text={TITLE_LINE2}
                    delay={0.08}
                    className="mt-1 bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent"
                  />
                </h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE_LUXE, delay: 0.3 }}
                  className="font-ui mt-6 max-w-md text-lg leading-relaxed text-slate-500"
                >
                  An interactive notebook for learning the mathematics of quantum computing —
                  step by step, morph by morph.
                </motion.p>

                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.4 }}
                  style={{ originX: 0 }}
                  className="mt-6 h-[3px] w-full max-w-[460px] rounded-full bg-gradient-to-r from-purple-200 via-purple-300 to-purple-200"
                />

                <MagneticButton onClick={onComplete} delay={0.48}>
                  Start learning
                </MagneticButton>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_50%,rgba(196,181,253,0.35),transparent_60%)]" />

      <AnimatePresence>
        {!curtainOpen && (
          <div className="absolute inset-0 z-30 flex">
            <motion.div
              initial={{ x: "0%" }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.55, ease: EASE_LUXE }}
              className="h-full w-1/2 bg-gradient-to-br from-purple-200 via-purple-100 to-white"
            />
            <motion.div
              initial={{ x: "0%" }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.55, ease: EASE_LUXE }}
              className="h-full w-1/2 bg-gradient-to-bl from-purple-200 via-purple-100 to-white"
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!videoReady && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6"
          >
            <div style={{ perspective: 600 }} className="relative h-24 w-24">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ transformStyle: "preserve-3d", rotateX: 62 }}
                animate={{ rotateZ: 360 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
              >
                <div
                  className="absolute inset-0 rounded-full border-[3px] border-transparent"
                  style={{ borderTopColor: "#c4b5fd", borderRightColor: "rgba(196,181,253,0.35)" }}
                />
              </motion.div>
              <motion.div
                className="absolute inset-2 rounded-full"
                style={{ transformStyle: "preserve-3d", rotateX: 62 }}
                animate={{ rotateZ: -360 }}
                transition={{ duration: 2.1, repeat: Infinity, ease: "linear" }}
              >
                <div
                  className="absolute inset-0 rounded-full border-[2px] border-transparent"
                  style={{ borderBottomColor: "rgba(168,85,247,0.5)" }}
                />
              </motion.div>
              <motion.div
                className="absolute -bottom-8 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-purple-300/40 blur-md"
                animate={{ scaleX: [1, 0.75, 1], opacity: [0.5, 0.3, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <span className="font-ui text-sm tracking-wide text-slate-400">
              Preparing your canvas…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FlipLine({ text, delay = 0, className = "" }) {
  return (
    <span className="block overflow-hidden" style={{ perspective: 800 }}>
      <motion.span
        initial={{ rotateX: -90, y: 40, opacity: 0 }}
        animate={{ rotateX: 0, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22, delay }}
        style={{ transformOrigin: "50% 100%", display: "inline-block" }}
        className={className}
      >
        {text}
      </motion.span>
    </span>
  );
}

function MagneticButton({ children, onClick, delay = 0 }) {
  const ref = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    setOffset({ x: relX * 0.3, y: relY * 0.3 });
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => {
    setIsHovering(false);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, x: offset.x, y: offset.y }}
      transition={{
        opacity: { duration: 0.4, ease: EASE_LUXE, delay },
        x: { type: "spring", stiffness: 180, damping: 13 },
        y: { type: "spring", stiffness: 180, damping: 13 },
      }}
      whileTap={{ scale: 0.95 }}
      className="glow-border-btn group relative mt-10 flex items-center gap-2.5 overflow-hidden rounded-full border-2 border-purple-200 bg-white/80 px-8 py-3 font-ui text-sm font-semibold text-purple-800 backdrop-blur-sm transition-colors duration-300 hover:border-purple-300 hover:bg-purple-100"
    >
      <span>{children}</span>
      <motion.svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4"
        animate={{ x: isHovering ? 4 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.path
          d="M5 12h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0.7 }}
          animate={{ pathLength: isHovering ? 1 : 0.7 }}
          transition={{ duration: 0.2, ease: EASE_LUXE }}
        />
        <motion.path
          d="M13 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ x: isHovering ? 2 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
      </motion.svg>
      <AnimatePresence>
        {isHovering && (
          <motion.span
            className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-purple-400"
            style={{ top: "50%", left: "50%", marginTop: -3, marginLeft: -3 }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [0, 60, 0, -60, 0],
              y: [-24, 0, 24, 0, -24],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}