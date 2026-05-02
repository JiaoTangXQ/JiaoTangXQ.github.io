/**
 * 引力场暗示层
 *
 * 在共享主题的节点之间渲染微弱的发光连线，可视化知识关联。
 * - 共享主题越多，连线越亮
 * - 距离越远，alpha 越低
 * - 仅在 zoom > 0.8 时可见（远景隐藏，避免视觉混乱）
 * - 使用二次贝塞尔曲线，不是直线，增加流动感
 */
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CosmosNode } from "@/lib/content/types";
import { getPalette } from "@/lib/content/types";
import {
  gravityFieldVertex,
  gravityFieldFragment,
} from "../shaders/gravityField";

type Props = {
  nodes: CosmosNode[];
};

type Link = {
  i: number;
  j: number;
  sharedCount: number;
};

/** 每条线段的采样点数 */
const SEGMENTS_PER_LINK = 16;

/** 构建共享主题的节点对 */
function buildLinks(nodes: CosmosNode[]): Link[] {
  const links: Link[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].topics.filter((t) =>
        nodes[j].topics.includes(t),
      ).length;
      if (shared > 0) {
        links.push({ i, j, sharedCount: shared });
      }
    }
  }
  return links;
}

export function GravityFieldLayer({ nodes }: Props) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const { camera } = useThree();
  const opacityRef = useRef(0);

  const { geometry } = useMemo(() => {
    const links = buildLinks(nodes);

    // 每条线有 SEGMENTS_PER_LINK + 1 个顶点
    const vertsPerLink = SEGMENTS_PER_LINK + 1;
    const totalVerts = links.length * vertsPerLink;

    const positions = new Float32Array(totalVerts * 3);
    const alphas = new Float32Array(totalVerts);
    const colors = new Float32Array(totalVerts * 3);

    for (let li = 0; li < links.length; li++) {
      const link = links[li];
      const a = nodes[link.i];
      const b = nodes[link.j];

      // 两个节点颜色混合
      const pa = getPalette(a.cluster);
      const pb = getPalette(b.cluster);
      const colA = new THREE.Color(pa.core[0]);
      const colB = new THREE.Color(pb.core[0]);

      // 距离 → alpha 衰减
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const distFade = Math.max(0, 1 - dist / 600); // 600 以外完全透明
      const baseAlpha = distFade * distFade * 0.12 * Math.min(link.sharedCount, 3);

      // 贝塞尔曲线控制点（垂直于连线方向偏移）
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const perpX = -dy / (dist + 0.01);
      const perpY = dx / (dist + 0.01);
      const curvature = dist * 0.08;
      const cpX = midX + perpX * curvature;
      const cpY = midY + perpY * curvature;

      const offset = li * vertsPerLink;

      for (let s = 0; s <= SEGMENTS_PER_LINK; s++) {
        const t = s / SEGMENTS_PER_LINK;
        const idx = offset + s;

        // 二次贝塞尔曲线
        const omt = 1 - t;
        const px = omt * omt * a.x + 2 * omt * t * cpX + t * t * b.x;
        const py = omt * omt * a.y + 2 * omt * t * cpY + t * t * b.y;

        positions[idx * 3 + 0] = px;
        positions[idx * 3 + 1] = py;
        positions[idx * 3 + 2] = -2; // 节点下方

        // alpha: 两端淡出，中间最亮
        const edgeFade = Math.sin(t * Math.PI);
        alphas[idx] = baseAlpha * edgeFade;

        // 颜色: 从 A 到 B 渐变
        const mixCol = colA.clone().lerp(colB, t);
        colors[idx * 3 + 0] = mixCol.r;
        colors[idx * 3 + 1] = mixCol.g;
        colors[idx * 3 + 2] = mixCol.b;
      }
    }

    // 构建 indices（LINE_STRIP 需要手动分段）
    const indices: number[] = [];
    for (let li = 0; li < links.length; li++) {
      const offset = li * vertsPerLink;
      for (let s = 0; s < SEGMENTS_PER_LINK; s++) {
        indices.push(offset + s, offset + s + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);

    return { geometry: geo };
  }, [nodes]);

  // zoom 控制整体可见度
  useFrame(() => {
    const mat = materialRef.current;
    if (!mat) return;

    const zoom = (camera as THREE.OrthographicCamera).zoom ?? 1;
    // zoom 0.8 以下完全隐藏，1.2 以上完全可见
    const target = Math.max(0, Math.min(1, (zoom - 0.8) / 0.4));
    opacityRef.current += (target - opacityRef.current) * 0.1;
    mat.opacity = opacityRef.current;
  });

  return (
    <lineSegments geometry={geometry} renderOrder={-10} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={gravityFieldVertex}
        fragmentShader={gravityFieldFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}
