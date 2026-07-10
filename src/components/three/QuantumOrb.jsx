// src/components/three/QuantumOrb.jsx
//
// Quantum Orb – Instagram‑Reel Edition
// -----------------------------------------------------------------------
// Adds a Sparkles particle field and tilts the whole group toward the
// mouse cursor for a responsive, premium feel.

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, Torus, Sparkles } from "@react-three/drei";
import * as THREE from "three";

function OrbGroup({ mouseTarget }) {
  const groupRef = useRef();
  const targetQuat = useRef(new THREE.Quaternion());

  // Smoothly rotate the group toward the mouse position
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Base auto‑rotation (ambient spin)
    groupRef.current.rotation.y += delta * 0.1;

    // Compute target quaternion based on mouse (tilt limited)
    const maxTilt = 0.8; // radians
    const targetX = mouseTarget.current.y * maxTilt;
    const targetY = mouseTarget.current.x * maxTilt;
    const targetZ = 0;

    const euler = new THREE.Euler(targetX, targetY, targetZ);
    targetQuat.current.setFromEuler(euler);

    // Smooth interpolation toward target tilt
    groupRef.current.quaternion.slerp(targetQuat.current, 0.05);
  });

  const sphereArgs = useMemo(() => [1, 32, 32], []);

  return (
    <group ref={groupRef}>
      {/* Outer wireframe sphere */}
      <Sphere args={sphereArgs}>
        <meshBasicMaterial
          color="#00a3b8"
          wireframe
          transparent
          opacity={0.25}
        />
      </Sphere>

      {/* Equatorial ring 1 */}
      <Torus args={[1, 0.006, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#00a3b8" transparent opacity={0.4} />
      </Torus>

      {/* Equatorial ring 2 */}
      <Torus args={[1, 0.006, 16, 100]} rotation={[Math.PI / 3, Math.PI / 4, 0]}>
        <meshBasicMaterial color="#8f42d8" transparent opacity={0.35} />
      </Torus>

      {/* Inner glowing core */}
      <Sphere args={[0.24, 24, 24]}>
        <meshStandardMaterial
          color="#8127cf"
          emissive="#8127cf"
          emissiveIntensity={2.5}
          toneMapped={false}
        />
      </Sphere>

      {/* Tiny floating “state point” */}
      <Sphere args={[0.06, 16, 16]} position={[0.9, 0.4, 0.5]}>
        <meshStandardMaterial
          color="#00d9f0"
          emissive="#00d9f0"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </Sphere>

      {/* Sparkles particle field around the orb */}
      <Sparkles
        count={400}
        scale={[3, 3, 3]}
        size={2}
        speed={0.3}
        opacity={0.6}
        color="#00e0ff"
      />
    </group>
  );
}

export function QuantumOrb({ size = 340 }) {
  const mouseTarget = useRef({ x: 0, y: 0 });

  return (
    <div
      style={{ width: size, height: size }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        mouseTarget.current = { x, y };
      }}
      onPointerLeave={() => {
        mouseTarget.current = { x: 0, y: 0 };
      }}
    >
      <Canvas
        camera={{ position: [0, 0.4, 3.2], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 2, 2]} intensity={0.8} />
        <OrbGroup mouseTarget={mouseTarget} />
      </Canvas>
    </div>
  );
}