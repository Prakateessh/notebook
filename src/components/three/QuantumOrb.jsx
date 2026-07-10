// src/components/three/QuantumOrb.jsx
//
// Quantum Orb — Real 3D via react-three-fiber
// -----------------------------------------------------------------------
// A genuinely 3D, WebGL-rendered "Bloch-sphere-inspired" object for the
// HeroIntro's wow-moment. This is NOT a CSS 3D trick — it's an actual
// Three.js scene with real depth, lighting, and camera perspective.
//
// Design concept: a Bloch sphere is the standard way physicists
// visualize a single qubit's state as a point on a unit sphere. We
// don't need full scientific accuracy here (this is a decorative hero
// element, not a functional Bloch-sphere plotter), but we borrow its
// visual vocabulary: a translucent wireframe sphere, equatorial rings,
// and a glowing "state point" orbiting the surface — instantly reads
// as "quantum" to anyone even vaguely familiar with the field, while
// looking striking to everyone else regardless.
//
// Structure:
//   - Outer wireframe sphere (semi-transparent, cyan-quantum tint)
//   - Two equatorial torus rings at different angles (suggests the
//     sphere's axes, adds visual complexity/depth)
//   - An inner glowing core sphere (purple-quantum, emissive material)
//   - A small orbiting point light + mesh representing "the state" —
//     slowly travels along one of the ring paths
//   - Continuous slow auto-rotation of the whole group (ambient,
//     always-moving, but calm — not frantic)
//
// Performance note: this is a genuinely separate rendering pipeline
// (WebGL canvas) from the rest of the DOM/CSS-based app. Kept as a
// small, fixed-size, self-contained <Canvas> so it doesn't compete for
// GPU resources with the rest of the page once the intro has played.

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, Torus, Trail } from "@react-three/drei";
import * as THREE from "three";

/** The rotating group containing sphere, rings, core, and orbiting point. */
function OrbGroup() {
  const groupRef = useRef();
  const orbiterRef = useRef();

  // Slow continuous rotation of the whole assembly — ambient motion,
  // not something the user controls (no OrbitControls/drag interaction
  // — this is a decorative hero element, not an explorable tool).
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.15;
    }
    // Orbiting "state point" travels along a tilted circular path
    // around the sphere, representing a qubit state precessing.
    if (orbiterRef.current) {
      const t = state.clock.elapsedTime * 0.6;
      orbiterRef.current.position.set(
        Math.cos(t) * 1.35,
        Math.sin(t * 1.3) * 0.4,
        Math.sin(t) * 1.35
      );
    }
  });

  // Memoize sphere/torus geometry args so they aren't recreated every render.
  const sphereArgs = useMemo(() => [1, 32, 32], []);

  return (
    <group ref={groupRef}>
      {/* Outer wireframe sphere — cyan-quantum tint, translucent */}
      <Sphere args={sphereArgs}>
        <meshBasicMaterial
          color="#00a3b8"
          wireframe
          transparent
          opacity={0.35}
        />
      </Sphere>

      {/* Equatorial ring 1 — flat on the XZ plane */}
      <Torus args={[1, 0.006, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#00a3b8" transparent opacity={0.5} />
      </Torus>

      {/* Equatorial ring 2 — tilted, suggests a second axis */}
      <Torus args={[1, 0.006, 16, 100]} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <meshBasicMaterial color="#8f42d8" transparent opacity={0.4} />
      </Torus>

      {/* Inner glowing core — purple-quantum, emissive */}
      <Sphere args={[0.28, 24, 24]}>
        <meshStandardMaterial
          color="#8127cf"
          emissive="#8127cf"
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </Sphere>

      {/* Orbiting "state point" with a soft trailing streak */}
      <Trail
        width={2}
        length={5}
        color="#00d9f0"
        attenuation={(t) => t * t}
      >
        <mesh ref={orbiterRef}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial
            color="#00d9f0"
            emissive="#00d9f0"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      </Trail>
    </group>
  );
}

/**
 * @param {object} props
 * @param {number} props.size - pixel width/height of the canvas
 *        (square aspect ratio). Defaults to 320px, sized for the
 *        HeroIntro composition.
 */
export function QuantumOrb({ size = 320 }) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        camera={{ position: [0, 0.6, 3.2], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        {/* Ambient + directional light so the emissive core and the
            standard-material orbiter render with proper depth cues,
            even though most of the visual interest comes from
            emissive glow rather than external lighting. */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[2, 2, 2]} intensity={0.6} />

        <OrbGroup />
      </Canvas>
    </div>
  );
}