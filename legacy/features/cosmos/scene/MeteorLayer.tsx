/**
 * 流星 + 星尘粒子层
 *
 * 渲染两种粒子：
 * - 流星（150 个）：随机方向的短命高速粒子，带淡出拖尾
 * - 星尘（400 个）：缓慢漂浮的微小发光粒子
 *
 * 使用 Points + BufferGeometry + 自定义 shader 实现全 GPU 驱动。
 */
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { meteorVertex, meteorFragment } from "../shaders/meteor";

const METEOR_COUNT = 150;
const DUST_COUNT = 400;
const TOTAL = METEOR_COUNT + DUST_COUNT;
const SPREAD_X = 3500;
const SPREAD_Y = 2600;

export function MeteorLayer() {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const { camera } = useThree();

  const { geometry, uniforms } = useMemo(() => {
    const positions = new Float32Array(TOTAL * 3);
    const phases = new Float32Array(TOTAL);
    const speeds = new Float32Array(TOTAL);
    const angles = new Float32Array(TOTAL);
    const lifespans = new Float32Array(TOTAL);
    const types = new Float32Array(TOTAL);
    const brightnesses = new Float32Array(TOTAL);

    for (let i = 0; i < TOTAL; i++) {
      // 随机初始位置
      positions[i * 3 + 0] = (Math.random() - 0.5) * SPREAD_X * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y * 2;
      positions[i * 3 + 2] = 0;

      phases[i] = Math.random();

      if (i < METEOR_COUNT) {
        // 流星参数
        types[i] = 0;
        speeds[i] = 0.8 + Math.random() * 1.5;
        // 大致向右下方移动（-45° 到 -135°），带随机偏移
        angles[i] = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.8;
        lifespans[i] = 3.0 + Math.random() * 5.0;
        brightnesses[i] = 0.5 + Math.random() * 0.5;
      } else {
        // 星尘参数
        types[i] = 1;
        speeds[i] = 0;
        angles[i] = 0;
        lifespans[i] = 10.0 + Math.random() * 10.0;
        brightnesses[i] = 0.2 + Math.random() * 0.6;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
    geo.setAttribute("aLifespan", new THREE.BufferAttribute(lifespans, 1));
    geo.setAttribute("aType", new THREE.BufferAttribute(types, 1));
    geo.setAttribute(
      "aBrightness",
      new THREE.BufferAttribute(brightnesses, 1),
    );

    const u = {
      uTime: { value: 0 },
      uZoom: { value: 1.0 },
      uCameraPos: { value: new THREE.Vector2(0, 0) },
    };

    return { geometry: geo, uniforms: u };
  }, []);

  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat) return;

    mat.uniforms.uTime.value = clock.getElapsedTime();
    mat.uniforms.uZoom.value =
      (camera as THREE.OrthographicCamera).zoom ?? 1.0;
    mat.uniforms.uCameraPos.value.set(camera.position.x, camera.position.y);
  });

  return (
    <points geometry={geometry} renderOrder={-20} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={meteorVertex}
        fragmentShader={meteorFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
