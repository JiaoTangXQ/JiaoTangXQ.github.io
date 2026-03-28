import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ClusterInfo } from "@/lib/content/types";
import { nebulaVertex, nebulaFragment } from "../shaders/nebula";

type Props = {
  clusters: ClusterInfo[];
};

const NEBULA_WIDTH = 400;
const NEBULA_HEIGHT = 300;

/**
 * Parse a CSS hex color string to a THREE.Color.
 * Handles both #RGB and #RRGGBB formats.
 */
function parseColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

type NebulaMeshData = {
  key: string;
  position: [number, number, number];
  color: THREE.Color;
  /** Each nebula gets a unique time multiplier for independent drift. */
  timeMul: number;
  /** Unique offset so nebulas don't all look the same. */
  driftOffset: [number, number];
};

/**
 * Renders a large semi-transparent nebula plane near each cluster center.
 * Each uses the nebula shader with that cluster's color at low opacity.
 */
export function NebulaLayer({ clusters }: Props) {
  const meshes = useMemo<NebulaMeshData[]>(() => {
    return clusters.map((c, i) => ({
      key: c.name,
      position: [c.centerX, c.centerY, -5] as [number, number, number],
      color: parseColor(c.color),
      timeMul: 0.7 + (i * 0.23) % 0.6, // 0.7 - 1.3 range
      driftOffset: [
        Math.sin(i * 2.1) * 0.001,
        Math.cos(i * 1.7) * 0.0008,
      ] as [number, number],
    }));
  }, [clusters]);

  return (
    <group renderOrder={-30}>
      {meshes.map((m) => (
        <NebulaMesh key={m.key} data={m} />
      ))}
    </group>
  );
}

function NebulaMesh({ data }: { data: NebulaMeshData }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: data.color },
      uOpacity: { value: 0.09 }, // subtle, within 0.06-0.15 range
      uOffset: { value: new THREE.Vector2(0, 0) },
    }),
    [data.color],
  );

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat) return;
    const t = clock.getElapsedTime() * data.timeMul;
    mat.uniforms.uTime.value = t;
    // Slow independent drift
    mat.uniforms.uOffset.value.set(
      Math.sin(t * 0.05) * data.driftOffset[0] * 100,
      Math.cos(t * 0.04) * data.driftOffset[1] * 100,
    );
  });

  return (
    <mesh position={data.position} frustumCulled={false}>
      <planeGeometry args={[NEBULA_WIDTH, NEBULA_HEIGHT]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={nebulaVertex}
        fragmentShader={nebulaFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
