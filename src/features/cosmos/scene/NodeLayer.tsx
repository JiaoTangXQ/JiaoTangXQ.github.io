/**
 * Instanced 节点渲染层
 *
 * 使用 InstancedMesh 批量渲染所有行星节点，支持 200+ 节点不掉帧。
 * 每个节点的颜色、大小、强调状态通过 instance attributes 传递到 shader。
 */
import { useRef, useMemo, useCallback, useEffect } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { CosmosNode } from "@/lib/content/types";
import { getPalette } from "@/lib/content/types";
import type { ClickMap } from "@/lib/usePlanetClicks";
import { planetNodeVertex, planetNodeFragment } from "../shaders/planetNode";
import { getEmphasis, emphasisToFloat } from "../nodes/nodeEmphasis";

/**
 * 动态星球大小：时间衰减 + 点击热度
 *
 * - 新文章（<1 周）size 最大 ~1.6
 * - 每周衰减，8 周后稳定在底线 0.7
 * - 每次点击 +0.05，上限 +0.8
 *
 * 冷启动分界线：2026-04-20 之前的所有 legacy 内容缩到 1/30，
 * 视觉上退化成背景星空中的一粒，让新内容一眼突出。
 * 这条界线只生效一次——过了界线的新内容按正常逻辑成长/衰减。
 */
const LEGACY_CUTOFF_MS = new Date("2026-04-20T00:00:00Z").getTime();
const LEGACY_SCALE = 1 / 30;

function dynamicSize(node: CosmosNode, clickCount: number): number {
  const base = node.size; // 构建时的 importance-based size (0.7-1.4)
  const nodeTime = new Date(node.date).getTime();

  // Legacy: cold-start 之前的内容退化为"星"
  if (!Number.isNaN(nodeTime) && nodeTime < LEGACY_CUTOFF_MS) {
    return base * LEGACY_SCALE;
  }

  // 时间衰减：按周计算
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeks = Math.max(0, (Date.now() - nodeTime) / msPerWeek);
  const timeFactor = 0.5 + 0.5 * Math.exp(-weeks / 4); // 1.0→0.5 over ~8 weeks

  // 点击热度加成
  const clickBoost = Math.min(0.8, clickCount * 0.05);

  return Math.max(0.5, base * timeFactor + clickBoost);
}

type Props = {
  nodes: CosmosNode[];
  clicks: ClickMap;
  hoveredSlug: string | null;
  activeSlug: string | null;
  activeTheme: string | null;
  /** 本地已访问 slug 集合（盲区地图用） */
  visitedSet?: Set<string>;
  /** 盲区模式目标强度 0-1，shader 内自动平滑插值 */
  blindspotTarget?: number;
  onNodeHover: (slug: string | null) => void;
  onNodeClick: (slug: string) => void;
};

const DUMMY = new THREE.Object3D();
const LERP_SPEED = 0.18;

export function NodeLayer({
  nodes,
  clicks,
  hoveredSlug,
  activeSlug,
  activeTheme,
  visitedSet,
  blindspotTarget = 0,
  onNodeHover,
  onNodeClick,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  // 当前 emphasis 值（用于平滑插值）
  const emphasisCurrent = useRef<Float32Array>(
    new Float32Array(nodes.length).fill(0.5),
  );

  // 找到 hovered 节点的 cluster
  const hoveredCluster = useMemo(() => {
    if (!hoveredSlug) return null;
    const node = nodes.find((n) => n.slug === hoveredSlug);
    return node?.cluster ?? null;
  }, [hoveredSlug, nodes]);

  // Instance attributes: 颜色、emphasis、大小、已访问标志
  const { colorInner, colorOuter, emphasis, nodeSize, visited, geometry } =
    useMemo(() => {
      const count = nodes.length;
      const ci = new Float32Array(count * 3);
      const co = new Float32Array(count * 3);
      const em = new Float32Array(count).fill(0.5);
      const ns = new Float32Array(count);
      const vi = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const palette = getPalette(nodes[i].cluster);
        const inner = new THREE.Color(palette.core[0]);
        const outer = new THREE.Color(palette.core[1]);
        ci[i * 3 + 0] = inner.r;
        ci[i * 3 + 1] = inner.g;
        ci[i * 3 + 2] = inner.b;
        co[i * 3 + 0] = outer.r;
        co[i * 3 + 1] = outer.g;
        co[i * 3 + 2] = outer.b;
        ns[i] = nodes[i].size;
      }

      const geo = new THREE.PlaneGeometry(1, 1);
      geo.setAttribute(
        "aColorInner",
        new THREE.InstancedBufferAttribute(ci, 3),
      );
      geo.setAttribute(
        "aColorOuter",
        new THREE.InstancedBufferAttribute(co, 3),
      );
      geo.setAttribute("aEmphasis", new THREE.InstancedBufferAttribute(em, 1));
      geo.setAttribute("aNodeSize", new THREE.InstancedBufferAttribute(ns, 1));
      geo.setAttribute("aVisited", new THREE.InstancedBufferAttribute(vi, 1));

      return {
        colorInner: ci,
        colorOuter: co,
        emphasis: em,
        nodeSize: ns,
        visited: vi,
        geometry: geo,
      };
    }, [nodes]);

  // 同步 visitedSet → aVisited attribute buffer
  useEffect(() => {
    const attr = geometry.getAttribute(
      "aVisited",
    ) as THREE.InstancedBufferAttribute;
    if (!attr) return;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < nodes.length; i++) {
      arr[i] = visitedSet && visitedSet.has(nodes[i].slug) ? 1 : 0;
    }
    attr.needsUpdate = true;
  }, [visitedSet, nodes, geometry]);

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBlindspot: { value: 0 },
    }),
    [],
  );

  // 设置 instance transforms（位置 + 动态缩放）
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < nodes.length; i++) {
      const size = dynamicSize(nodes[i], clicks[nodes[i].slug] ?? 0);
      const scale = size * 36;
      DUMMY.position.set(nodes[i].x, nodes[i].y, 0);
      DUMMY.scale.set(scale, scale, 1);
      DUMMY.updateMatrix();
      mesh.setMatrixAt(i, DUMMY.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [nodes, clicks]);

  // 每帧更新 uTime、blindspot 渐变和 emphasis 插值
  useFrame(({ clock }) => {
    const mat = materialRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value = clock.getElapsedTime();

    // uBlindspot 向目标值平滑过渡（~400ms）
    const bsCur = mat.uniforms.uBlindspot.value as number;
    const bsDiff = blindspotTarget - bsCur;
    if (Math.abs(bsDiff) > 0.001) {
      mat.uniforms.uBlindspot.value = bsCur + bsDiff * 0.12;
    }

    const empAttr = geometry.getAttribute("aEmphasis") as THREE.InstancedBufferAttribute;
    const cur = emphasisCurrent.current;
    let needsUpdate = false;

    for (let i = 0; i < nodes.length; i++) {
      const level = getEmphasis(
        nodes[i],
        hoveredSlug,
        activeSlug,
        activeTheme,
        hoveredCluster,
      );
      const target = emphasisToFloat(level);
      const prev = cur[i];
      const next = prev + (target - prev) * LERP_SPEED;

      if (Math.abs(next - prev) > 0.001) {
        cur[i] = next;
        empAttr.array[i] = next;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      empAttr.needsUpdate = true;
    }
  });

  // 通过 instanceId 识别被点击/hover 的节点
  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const id = e.instanceId;
      if (id !== undefined && id < nodes.length) {
        onNodeHover(nodes[id].slug);
      }
    },
    [nodes, onNodeHover],
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
      const id = e.instanceId;
      if (id !== undefined && id < nodes.length) {
        onNodeClick(nodes[id].slug);
      }
    },
    [nodes, onNodeClick],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, nodes.length]}
      renderOrder={10}
      frustumCulled={false}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={planetNodeVertex}
        fragmentShader={planetNodeFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}
