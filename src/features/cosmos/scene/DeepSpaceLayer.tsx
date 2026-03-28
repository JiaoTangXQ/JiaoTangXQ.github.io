import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { deepSpaceVertex, deepSpaceFragment } from "../shaders/deepSpace";

/**
 * Full-screen quad rendered at z=-10 displaying a rich deep-space gradient
 * with slowly drifting radial color fields.
 */
export function DeepSpaceLayer() {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = clock.getElapsedTime();
    mat.uniforms.uResolution.value.set(size.width, size.height);
  });

  return (
    <mesh renderOrder={-100} frustumCulled={false}>
      {/* Fullscreen quad in NDC: position.xy covers [-1,1] */}
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={deepSpaceVertex}
        fragmentShader={deepSpaceFragment}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
        transparent={false}
      />
    </mesh>
  );
}
