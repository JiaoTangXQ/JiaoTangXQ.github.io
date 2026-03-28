import { Canvas } from "@react-three/fiber";
import type { CosmosData } from "@/lib/content/types";
import type { CameraState } from "../camera/useCamera";
import { CameraController } from "../camera/CameraController";
import { DeepSpaceLayer } from "./DeepSpaceLayer";
import { StarFieldLayer } from "./StarFieldLayer";
import { NebulaLayer } from "./NebulaLayer";
import { NodeLayer } from "./NodeLayer";

type Props = {
  data: CosmosData;
  cameraRef: React.RefObject<CameraState>;
  hoveredSlug: string | null;
  activeSlug: string | null;
  activeTheme: string | null;
  onNodeHover: (slug: string | null) => void;
  onNodeClick: (slug: string) => void;
};

/**
 * The R3F Canvas rendering all cosmos GPU layers.
 * Camera state is managed externally and passed via ref.
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
      <NodeLayer
        nodes={data.nodes}
        hoveredSlug={hoveredSlug}
        activeSlug={activeSlug}
        activeTheme={activeTheme}
        onNodeHover={onNodeHover}
        onNodeClick={onNodeClick}
      />
    </Canvas>
  );
}
