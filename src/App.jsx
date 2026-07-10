// src/App.jsx
//
// App Root — SPLIT-VIEW + HERO INTRO EDITION
// -----------------------------------------------------------------------
// Final wiring for this entire pass. Sequence:
//
//   1. On mount, if hasSeenIntro is false, render <HeroIntro>.
//   2. HeroIntro auto-plays its demo sequence, then calls onComplete
//      (either automatically after its timers, or immediately if the
//      user clicks "Enter notebook →").
//   3. onComplete calls markIntroSeen() in the store AND flips local
//      state to swap HeroIntro out for the real app.
//   4. The real app = AmbientBackground (fixed, behind everything) +
//      SplitShell (the actual notebook + visualizer split layout).
//
// AnimatePresence wraps the intro/main-app swap so HeroIntro's exit
// transition (fade out, defined in HeroIntro.jsx itself) plays before
// the main app mounts, rather than an abrupt cut.

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useQuantumStore } from "./store/useQuantumStore";
import { HeroIntro } from "./components/intro/HeroIntro";
import { AmbientBackground } from "./components/layout/AmbientBackground";
import { SplitShell } from "./components/layout/SplitShell";

function App() {
  const hasSeenIntro = useQuantumStore((s) => s.hasSeenIntro);
  const markIntroSeen = useQuantumStore((s) => s.markIntroSeen);

  // Local mirror of hasSeenIntro purely to drive the AnimatePresence
  // swap — we don't render straight off the store's hasSeenIntro alone
  // because we want HeroIntro's exit animation to play BEFORE this
  // component unmounts, and AnimatePresence needs the child to
  // disappear from the tree (not just receive a new prop) to trigger
  // its exit transition.
  const [introFinished, setIntroFinished] = useState(hasSeenIntro);

  const handleIntroComplete = () => {
    markIntroSeen();
    setIntroFinished(true);
  };

  return (
    <>
      <AmbientBackground />

      <AnimatePresence mode="wait">
        {!introFinished ? (
          <HeroIntro key="intro" onComplete={handleIntroComplete} />
        ) : (
          <SplitShell key="main" />
        )}
      </AnimatePresence>
    </>
  );
}

export default App;