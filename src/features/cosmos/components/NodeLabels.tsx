import { useMemo } from "react";
import type { CosmosNode } from "@/lib/content/types";
import { getPalette, buildCoverGradient } from "@/lib/content/types";
import "@/styles/cosmos-ui.css";

type Camera = {
  x: number;
  y: number;
  zoom: number;
};

type Props = {
  nodes: CosmosNode[];
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  lodMode: "far" | "mid" | "near";
  onNodeClick: (slug: string) => void;
};

type VisibleNode = {
  node: CosmosNode;
  screenX: number;
  screenY: number;
};

const MARGIN = 200; // px beyond viewport edges to still render labels

export function NodeLabels({
  nodes,
  camera,
  viewportWidth,
  viewportHeight,
  lodMode,
  onNodeClick,
}: Props) {
  // Only render at mid or near zoom
  const shouldRender = lodMode === "mid" || lodMode === "near";

  // Project nodes to screen coordinates and filter visible ones
  const visibleNodes: VisibleNode[] = useMemo(() => {
    if (!shouldRender) return [];

    const halfW = viewportWidth / 2;
    const halfH = viewportHeight / 2;
    const result: VisibleNode[] = [];

    // Frustum size must match CosmosScene orthographic camera bounds
    const frustumW = 1600; // left=-800, right=800
    const frustumH = 1200; // bottom=-600, top=600
    const scaleX = (viewportWidth / frustumW) * camera.zoom;
    const scaleY = (viewportHeight / frustumH) * camera.zoom;

    for (const node of nodes) {
      const screenX = halfW + (node.x - camera.x) * scaleX;
      // Y inverted: world Y-up → screen Y-down
      const screenY = halfH - (node.y - camera.y) * scaleY;

      // Check if within padded viewport
      if (
        screenX >= -MARGIN &&
        screenX <= viewportWidth + MARGIN &&
        screenY >= -MARGIN &&
        screenY <= viewportHeight + MARGIN
      ) {
        result.push({ node, screenX, screenY });
      }
    }

    return result;
  }, [nodes, camera.x, camera.y, camera.zoom, viewportWidth, viewportHeight, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div className="node-labels" aria-label="文章标签">
      {visibleNodes.map(({ node, screenX, screenY }) => {
        const palette = getPalette(node.cluster);
        return (
          <div
            key={node.slug}
            className={`node-labels__item${shouldRender ? " node-labels__item--visible" : ""}`}
            style={{
              left: `${screenX}px`,
              top: `${screenY}px`,
            }}
            onClick={() => onNodeClick(node.slug)}
            role="button"
            tabIndex={0}
            aria-label={node.title}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNodeClick(node.slug);
              }
            }}
          >
            {lodMode === "near" ? (
              /* Near mode: mini preview card with cover strip */
              <div className="node-labels__card">
                <div
                  className="node-labels__card-cover"
                  style={{
                    background:
                      node.cover.style === "image" && node.cover.imageUrl
                        ? `url(${node.cover.imageUrl}) center/cover no-repeat`
                        : buildCoverGradient(node.cover, node.cluster),
                  }}
                />
                <div className="node-labels__card-body">
                  <div className="node-labels__card-title">{node.title}</div>
                  <div className="node-labels__card-cluster">
                    <span
                      className="node-labels__card-dot"
                      style={{ background: palette.core[0] }}
                    />
                    {node.cluster}
                  </div>
                  <div className="node-labels__card-summary">
                    {node.summary}
                  </div>
                </div>
              </div>
            ) : (
              /* Mid mode: simple title label */
              <span className="node-labels__title">{node.title}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
