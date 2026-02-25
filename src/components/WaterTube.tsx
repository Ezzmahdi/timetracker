"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";

interface Tube3DProps {
  fillPercent: number;
  color: string;
}

function Tube3D({ fillPercent, color }: Tube3DProps) {
  const liquidRef = useRef<THREE.Mesh>(null);
  const surfaceRef = useRef<THREE.Mesh>(null);
  const animFill = useRef(0);

  const R = 0.28;
  const H = 2.0;
  const bottom = -H / 2;
  const top = H / 2;
  const iR = R - 0.015;

  // Closed cylinder for glass body (with caps for edge detection)
  const glassCylGeo = useMemo(() => new THREE.CylinderGeometry(R, R, H, 48, 1, false), []);
  // Bottom hemisphere
  const bottomCapGeo = useMemo(
    () => new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    []
  );

  useFrame((_, dt) => {
    animFill.current += (fillPercent - animFill.current) * Math.min(dt * 4, 1);
    const f = Math.max(0, Math.min(1, animFill.current));
    const liqH = f * (H + R * 0.5);

    if (liquidRef.current) {
      liquidRef.current.scale.set(1, Math.max(0.001, liqH), 1);
      liquidRef.current.position.y = bottom - R * 0.25 + liqH / 2;
    }
    if (surfaceRef.current) {
      surfaceRef.current.position.y = bottom - R * 0.25 + liqH;
      surfaceRef.current.visible = f > 0.005;
    }
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.8} />
      <directionalLight position={[-2, 2, -3]} intensity={0.3} />

      <group rotation={[0.05, 0.25, 0]}>
        {/* Glass cylinder body — open top, capped bottom hidden by hemisphere */}
        <mesh geometry={glassCylGeo}>
          <meshStandardMaterial
            color="#c8d0dc"
            transparent
            opacity={0.12}
            roughness={0.0}
            metalness={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
          <Edges threshold={15} color="#9ca3af" linewidth={1} />
        </mesh>

        {/* Rounded bottom hemisphere */}
        <mesh position={[0, bottom, 0]} geometry={bottomCapGeo}>
          <meshStandardMaterial
            color="#c8d0dc"
            transparent
            opacity={0.1}
            roughness={0.0}
            metalness={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
          <Edges threshold={15} color="#9ca3af" linewidth={1} />
        </mesh>

        {/* Top rim — solid visible torus */}
        <mesh position={[0, top, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R, 0.02, 16, 64]} />
          <meshStandardMaterial color="#7a8599" roughness={0.15} metalness={0.3} />
        </mesh>

        {/* Lip flare ring */}
        <mesh position={[0, top + 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R + 0.012, 0.012, 8, 64]} />
          <meshStandardMaterial
            color="#8a94a8"
            transparent
            opacity={0.6}
            roughness={0.1}
          />
        </mesh>

        {/* Highlight streak on glass */}
        <mesh position={[R * 0.72, 0, R * 0.3]} rotation={[0, -0.35, 0]}>
          <planeGeometry args={[0.015, H * 0.75]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[R * 0.55, 0, R * 0.55]} rotation={[0, -0.6, 0]}>
          <planeGeometry args={[0.008, H * 0.5]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.1} side={THREE.DoubleSide} />
        </mesh>

        {/* Liquid body */}
        <mesh ref={liquidRef}>
          <cylinderGeometry args={[iR, iR, 1, 32]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.88}
            roughness={0.3}
            emissive={color}
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Liquid surface */}
        <mesh ref={surfaceRef} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[iR, 32]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Bottom liquid hemisphere */}
        <mesh position={[0, bottom, 0]}>
          <sphereGeometry args={[iR, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.88}
            roughness={0.3}
            emissive={color}
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>
    </>
  );
}

interface TubeCanvasProps {
  hours: number;
  maxHours: number;
  color: string;
}

export default function TubeCanvas({ hours, maxHours, color }: TubeCanvasProps) {
  const fill = maxHours > 0 ? hours / maxHours : 0;
  return (
    <Canvas
      camera={{ position: [0, -0.2, 5.2], fov: 28 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <Tube3D fillPercent={fill} color={color} />
    </Canvas>
  );
}
