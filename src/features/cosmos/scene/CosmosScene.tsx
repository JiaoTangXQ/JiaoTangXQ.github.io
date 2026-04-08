import { Canvas } from "@react-three/fiber";
import type { CosmosData } from "@/lib/content/types";
import type { CameraState } from "../camera/useCamera";
import { CameraController } from "../camera/CameraController";
import { DeepSpaceLayer } from "./DeepSpaceLayer";
import { StarFieldLayer } from "./StarFieldLayer";
import { NebulaLayer } from "./NebulaLayer";
import { MeteorLayer } from "./MeteorLayer";
import { NodeLayer } from "./NodeLayer";
import { FpsMonitor } from "./FpsMonitor";

type Props = {
  data: CosmosData;
  cameraRef: React.RefObject<CameraState>;
  hoveredSlug: string | null;
  activeSlug: string | null;
  activeTheme: string | null;
  onNodeHover: (slug: string | null) => void;
  onNodeClick: (slug: string) => void;
};

/** 开发模式下显示 FPS 监控 */
const DEV = import.meta.env.DEV;

/**
 * The R3F Canvas rendering all cosmos GPU layers.
 * Camera state is managed externally and passed via ref.
 *
 * 渲染顺序（从后到前）：
 * 1. DeepSpace — fragment shader 深空渐变
 * 2. StarField — 12000 粒子星空
 * 3. Nebula   — 多层 FBM 星云（每个集群一片）
 * 4. Meteor   — 流星 + 星尘粒子
 * 5. Nodes    — 行星节点（InstancedMesh）
 */
export function CosmosScene({
  data,
  cameraRef,
  hoveredSlug,
  activeSlug,
  activeTheme,
  onNodeHover,
  onNodeClick,
}: Props) {
  const frustumSize = 800;

  return (
    <Canvas
      orthographic
      camera={{
        position: [0, 0, 100],
        zoom: 1,
        near: 0.1,
        far: 1000,
        left: -frustumSize,
        right: frustumSize,
        top: frustumSize * 0.75,
        bottom: -frustumSize * 0.75,
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      dpr={[1, 2]}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <CameraController stateRef={cameraRef} />
      <DeepSpaceLayer />
      <StarFieldLayer />
      <NebulaLayer clusters={data.clusters} />
      <MeteorLayer />
      <NodeLayer
        nodes={data.nodes}
        hoveredSlug={hoveredSlug}
        activeSlug={activeSlug}
        activeTheme={activeTheme}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
      />
      {DEV && <FpsMonitor />}
    </Canvas>
  );
}
