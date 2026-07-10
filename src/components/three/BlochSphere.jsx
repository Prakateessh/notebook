// src/components/three/BlochSphere.jsx
//
// Bloch Sphere – Interactive 3D Visualisation of a Single‑Qubit State
// -----------------------------------------------------------------------
// Renders a real 3D Bloch sphere with coordinate axes, the sphere surface,
// and a state vector arrow pointing to the qubit's location on the sphere.
//
// INTERACTIVE FEATURES:
// - Drag to rotate the view (OrbitControls)
// - Scroll to zoom
// - Right‑drag to pan
// - Click on the sphere surface to collapse the state to the clicked point
//   (fires onStateChange callback with new [α, β] amplitudes)
//
// Usage:
//   <BlochSphere state={[alpha, beta]} size={320} onStateChange={handler} />
//
// `state` – array of two complex amplitudes (math.js complex or {re, im})
// `onStateChange` – callback receiving new amplitudes as [{re,im}, {re,im}]
//
// No other files need to be modified for drag‑to‑rotate; click‑to‑collapse
// works out‑of‑the‑box if you provide the callback.

import { useMemo, useCallback, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Sphere, Line, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/**
 * Converts a pair of complex amplitudes (α, β) to Bloch sphere coordinates.
 * Returns { x, y, z } in [-1,1].
 */
function stateToBloch(state) {
  if (!state || state.length !== 2) return { x: 0, y: 0, z: 1 };

  const alpha = state[0];
  const beta = state[1];

  const alphaNorm =
    typeof alpha === "object" ? alpha.re * alpha.re + alpha.im * alpha.im : alpha * alpha;
  const betaNorm =
    typeof beta === "object" ? beta.re * beta.re + beta.im * beta.im : beta * beta;
  const total = alphaNorm + betaNorm;
  if (total === 0) return { x: 0, y: 0, z: 0 };

  const betaReal = typeof beta === "object" ? beta.re : beta;
  const betaImag = typeof beta === "object" ? beta.im : 0;
  const alphaReal = typeof alpha === "object" ? alpha.re : alpha;
  const alphaImag = typeof alpha === "object" ? alpha.im : 0;

  const magBeta = Math.sqrt(betaNorm);
  const magAlpha = Math.sqrt(alphaNorm);
  const theta = 2 * Math.atan2(magBeta, magAlpha);

  const phaseAlpha = Math.atan2(alphaImag, alphaReal);
  const phaseBeta = Math.atan2(betaImag, betaReal);
  const phi = phaseBeta - phaseAlpha;

  return {
    x: Math.sin(theta) * Math.cos(phi),
    y: Math.sin(theta) * Math.sin(phi),
    z: Math.cos(theta),
  };
}

/**
 * Converts a unit direction (click on sphere surface) back to amplitudes.
 * Uses the convention that the global phase is zero (α real non‑negative).
 */
function blochToState(point) {
  const norm = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
  if (norm === 0) return [{ re: 1, im: 0 }, { re: 0, im: 0 }];
  const x = point.x / norm;
  const y = point.y / norm;
  const z = point.z / norm;

  const theta = Math.acos(Math.min(1, Math.max(-1, z)));
  const phi = Math.atan2(y, x);

  const cosHalf = Math.cos(theta / 2);
  const sinHalf = Math.sin(theta / 2);

  // α = cos(θ/2), β = e^(iφ) sin(θ/2)
  return [
    { re: cosHalf, im: 0 },
    { re: sinHalf * Math.cos(phi), im: sinHalf * Math.sin(phi) },
  ];
}

/**
 * 3D scene content: sphere, axes, state arrow, OrbitControls, click handler.
 */
function BlochScene({ blochCoords, showLabels, onStateChange }) {
  const { x, y, z } = blochCoords;
  const arrowLength = Math.sqrt(x * x + y * y + z * z);

  // References for the sphere mesh (for click detection)
  const sphereRef = useRef();

  // Handle click on the sphere surface
  const handlePointerDown = useCallback(
    (event) => {
      if (!onStateChange || !event.point) return;
      // event.point is in world coordinates. We need to project onto unit sphere.
      const point = event.point.clone().normalize();
      const newState = blochToState(point);
      onStateChange(newState);
    },
    [onStateChange]
  );

  return (
    <group>
      {/* Semi‑transparent sphere surface – clickable */}
      <Sphere
        ref={sphereRef}
        args={[1, 64, 64]}
        onClick={handlePointerDown}
      >
        <meshStandardMaterial
          color="#e2c9f7"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </Sphere>

      {/* Wireframe outline */}
      <Sphere args={[1.001, 32, 32]}>
        <meshBasicMaterial color="#a05de0" wireframe transparent opacity={0.2} />
      </Sphere>

      {/* Coordinate axes */}
      <Line points={[[-1.3, 0, 0], [1.3, 0, 0]]} color="#ff6b6b" lineWidth={1} />
      <Line points={[[0, -1.3, 0], [0, 1.3, 0]]} color="#51cf66" lineWidth={1} />
      <Line points={[[0, 0, -1.3], [0, 0, 1.3]]} color="#339af0" lineWidth={1} />

      {/* Axis labels */}
      {showLabels && (
        <>
          <Html position={[1.45, 0, 0]} style={{ fontSize: "12px", color: "#ff6b6b" }}>X</Html>
          <Html position={[0, 1.45, 0]} style={{ fontSize: "12px", color: "#51cf66" }}>Y</Html>
          <Html position={[0, 0, 1.45]} style={{ fontSize: "12px", color: "#339af0" }}>Z</Html>
        </>
      )}

      {/* State vector arrow */}
      {arrowLength > 0.01 && (
        <arrowHelper
          args={[
            new THREE.Vector3(x, y, z).normalize(),
            new THREE.Vector3(0, 0, 0),
            arrowLength,
            "#00d9f0",
            0.12,
            0.08,
          ]}
        />
      )}

      {/* Small sphere at the state point */}
      <Sphere args={[0.06, 16, 16]} position={[x, y, z]}>
        <meshStandardMaterial
          color="#00d9f0"
          emissive="#00d9f0"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </Sphere>

      {/* OrbitControls for interactive rotation/zoom/pan */}
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={1.5}
        maxDistance={5}
      />
    </group>
  );
}

/**
 * Main Bloch Sphere component.
 * @param {object} props
 * @param {Array} props.state – [alpha, beta] complex amplitudes
 * @param {number} props.size – canvas size in pixels (default 320)
 * @param {boolean} props.showLabels – show X/Y/Z labels (default true)
 * @param {Function} props.onStateChange – callback when user clicks a new point
 *        receives [{re, im}, {re, im}]
 */
export function BlochSphere({ state, size = 320, showLabels = true, onStateChange }) {
  const blochCoords = useMemo(() => stateToBloch(state), [state]);

  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        camera={{ position: [1.6, 1.2, 1.8], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 2, 2]} intensity={0.4} />
        <BlochScene
          blochCoords={blochCoords}
          showLabels={showLabels}
          onStateChange={onStateChange}
        />
      </Canvas>
    </div>
  );
}