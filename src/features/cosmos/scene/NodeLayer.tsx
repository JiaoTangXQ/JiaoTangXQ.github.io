import { useRef, useMemo, useCallback } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CosmosNode } from "@/lib/content/types";
import { getPalette } from "@/lib/content/types";
import { planetNodeVertex, planetNodeFragment } from "../shaders/planetNode";
import { getEmphasis, emphasisToFloat } from "../nodes/nodeEmphasis";

type Props = {
  nodes: CosmosNode[];
  hoveredSlug: string | null;
  activeSlug: string | null;
  activeTheme: string | null;
  onNodeHover: (slug: string | null) => void;
  onNodeClick: (slug: string) => void;
};

/**
 * Renders all cosmos nodes as billboard planes with the planetNode shader.
 * Each node's shader uniforms are driven by its data and the current
 * interaction state (hovered, active, theme filter).
 */
export function NodeLayer({
  nodes,
  hoveredSlug,
  activeSlug,
  activeTheme,
  onNodeHover,
  onNodeClick,
}: Props) {
  // Find the cluster of the currently hovered node for "related" emphasis
  const hoveredCluster = useMemo(() => {
    if (!hoveredSlug) return null;
    const node = nodes.find((n) => n.slug === hoveredSlug);
    return node?.cluster ?? null;
  }, [hoveredSlug, nodes]);

  return (
    <group renderOrder={10}>
      {nodes.map((node) => (
        <PlanetMesh
          key={node.slug}
          node={node}
          hoveredSlug={hoveredSlug}
          activeSlug={activeSlug}
          activeTheme={activeTheme}
          hoveredCluster={hoveredCluster}
          onNodeHover={onNodeHover}
          onNodeClick={onNodeClick}
        />
      ))}
    </group>
  );
}

type PlanetProps = {
  node: CosmosNode;
  hoveredSlug: string | null;
  activeSlug: string | null;
  activeTheme: string | null;
  hoveredCluster: string | null;
  onNodeHover: (slug: string | null) => void;
  onNodeClick: (slug: string) => void;
};

function PlanetMesh({
  node,
  hoveredSlug,
  activeSlug,
  activeTheme,
  hoveredCluster,
  onNodeHover,
  onNodeClick,
}: PlanetProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const palette = useMemo(() => getPalette(node.cluster), [node.cluster]);

  const uniforms = useMemo(
    () => ({
      uColorInner: { value: new THREE.Color(palette.core[0]) },
      uColorOuter: { value: new THREE.Color(palette.core[1]) },
      uTime: { value: 0 },
      uEmphasis: { value: 0.5 },
      uSize: { value: node.size },
    }),
    [palette, node.size],
  );

  // Compute target emphasis each frame and smoothly interpolate
  const emphasisRef = useRef(0.5);

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat) return;

    mat.uniforms.uTime.value = clock.getElapsedTime();

    // Compute target emphasis
    const level = getEmphasis(node, hoveredSlug, activeSlug, activeTheme, hoveredCluster);
    const target = emphasisToFloat(level);
    // Smooth interpolation toward target (avoid jarring pops)
    emphasisRef.current += (target - emphasisRef.current) * 0.12;
    mat.uniforms.uEmphasis.value = emphasisRef.current;
  });

  const handlePointerEnter = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onNodeHover(node.slug);
    },
    [node.slug, onNodeHover],
  );

  const handlePointerLeave = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onNodeHover(null);
    },
    [onNodeHover],
  );

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onNodeClick(node.slug);
    },
    [node.slug, onNodeClick],
  );

  // Billboard plane scale: node.size (1.0-1.7) → world-space diameter
  // Multiply by 30 so nodes are visible in the ~800-unit frustum
  const scale = node.size * 30;

  return (
    <mesh
      position={[node.x, node.y, 0]}
      scale={[scale, scale, 1]}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={planetNodeVertex}
        fragmentShader={planetNodeFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
