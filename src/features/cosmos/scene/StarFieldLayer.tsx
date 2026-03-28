import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { starFieldVertex, starFieldFragment } from "../shaders/starField";

const STAR_COUNT = 4000;
const SPREAD_X = 2000;
const SPREAD_Y = 1500;
const PARALLAX_FACTOR = 0.7;

/**
 * Star field rendered as Three.js Points with per-star twinkle animation.
 * Stars move at 0.7x the camera rate to create parallax depth.
 */
export function StarFieldLayer() {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const pointsRef = useRef<THREE.Points>(null!);
  const { camera } = useThree();

  const { geometry, uniforms } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const brightnesses = new Float32Array(STAR_COUNT);
    const colors = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Random position across a large area
      positions[i * 3 + 0] = (Math.random() - 0.5) * SPREAD_X * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y * 2;
      positions[i * 3 + 2] = 0;

      // Size: 0.5 - 2.5
      sizes[i] = 0.5 + Math.random() * 2.0;

      // Phase: 0 - 1 (used for twinkle offset)
      phases[i] = Math.random();

      // Brightness: 0.3 - 1.0
      brightnesses[i] = 0.3 + Math.random() * 0.7;

      // Color: 0 = warm white, 0.5 = cool white, 1.0 = faint blue
      // Weight toward cool white (center), fewer warm and blue extremes
      colors[i] = Math.random();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aBrightness", new THREE.BufferAttribute(brightnesses, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 1));

    const u = {
      uTime: { value: 0 },
      uZoom: { value: 1.0 },
    };

    return { geometry: geo, uniforms: u };
  }, []);

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    const pts = pointsRef.current;
    if (!mat || !pts) return;

    mat.uniforms.uTime.value = clock.getElapsedTime();
    mat.uniforms.uZoom.value = (camera as THREE.OrthographicCamera).zoom ?? 1.0;

    // Parallax: offset star layer position to track camera at reduced rate
    pts.position.x = camera.position.x * (1 - PARALLAX_FACTOR);
    pts.position.y = camera.position.y * (1 - PARALLAX_FACTOR);
  });

  return (
    <points ref={pointsRef} geometry={geometry} renderOrder={-50} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={starFieldVertex}
        fragmentShader={starFieldFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
