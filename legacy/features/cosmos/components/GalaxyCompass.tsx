import { useMemo } from "react";
import type { ClusterInfo } from "@/lib/content/types";
import { getPalette } from "@/lib/content/types";
import "@/styles/cosmos-ui.css";

type Props = {
  clusters: ClusterInfo[];
  cameraX: number;
  cameraY: number;
};

export function GalaxyCompass({ clusters, cameraX, cameraY }: Props) {
  const nearest = useMemo(() => {
    if (clusters.length === 0) return null;

    let best: ClusterInfo | null = null;
    let bestDist = Infinity;

    // Camera position is typically negative of world offset,
    // so the world point the camera looks at is (-cameraX, -cameraY)
    const lookX = -cameraX;
    const lookY = -cameraY;

    for (const cluster of clusters) {
      const dx = cluster.centerX - lookX;
      const dy = cluster.centerY - lookY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = cluster;
      }
    }

    return best;
  }, [clusters, cameraX, cameraY]);

  if (!nearest) return null;

  const palette = getPalette(nearest.name);

  return (
    <div className="galaxy-compass" aria-label={`当前区域: ${nearest.name}`}>
      <span
        className="galaxy-compass__dot"
        style={{ background: palette.core[0] }}
        aria-hidden="true"
      />
      <span className="galaxy-compass__label">{nearest.name}</span>
    </div>
  );
}
