/**
 * 博物馆风格节点标注
 *
 * 每个标签通过一条折线（leader line）连接到星球，
 * 文字颜色与星球主色一致。
 * 仅在 zoom 足够大时显示，避免低 zoom 时文字堆叠。
 */
import { memo, useMemo } from "react";
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
  /** 标签偏移方向 */
  offsetX: number;
  offsetY: number;
};

const MARGIN = 200;

/** DOM 标签上限：超过这个数只保留最重要的，避免 reconcile 抖动 */
const MAX_LABELS_MID = 60;
const MAX_LABELS_NEAR = 24;

/** 与 NodeLayer.dynamicSize 保持一致：该日期之前的 legacy 内容退化为背景星星，不展示标签。 */
const LEGACY_CUTOFF_MS = new Date("2026-04-20T00:00:00Z").getTime();

/** 预设偏移方向，交替分配避免重叠 */
const OFFSET_PRESETS = [
  { dx: 60, dy: 40 },   // 右下
  { dx: 65, dy: -35 },  // 右上
  { dx: -60, dy: 40 },  // 左下
  { dx: -65, dy: -35 }, // 左上
  { dx: 75, dy: 10 },   // 右
  { dx: -75, dy: 10 },  // 左
];

/** 折线的垂直段长度 */
const STEM_LENGTH = 20;

function NodeLabelsImpl({
  nodes,
  camera,
  viewportWidth,
  viewportHeight,
  lodMode,
  onNodeClick,
}: Props) {
  const shouldRender = lodMode === "mid" || lodMode === "near";

  const visibleNodes: VisibleNode[] = useMemo(() => {
    if (!shouldRender) return [];

    const halfW = viewportWidth / 2;
    const halfH = viewportHeight / 2;
    const frustumW = 1600;
    const frustumH = 1200;
    const scaleX = (viewportWidth / frustumW) * camera.zoom;
    const scaleY = (viewportHeight / frustumH) * camera.zoom;
    const result: VisibleNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // 冷启动分界线前的 legacy 内容不展示标签，避免遮挡新内容
      const nodeTime = new Date(node.date).getTime();
      if (!Number.isNaN(nodeTime) && nodeTime < LEGACY_CUTOFF_MS) {
        continue;
      }

      const screenX = halfW + (node.x - camera.x) * scaleX;
      const screenY = halfH - (node.y - camera.y) * scaleY;

      if (
        screenX >= -MARGIN &&
        screenX <= viewportWidth + MARGIN &&
        screenY >= -MARGIN &&
        screenY <= viewportHeight + MARGIN
      ) {
        const preset = OFFSET_PRESETS[i % OFFSET_PRESETS.length];
        result.push({
          node,
          screenX,
          screenY,
          offsetX: preset.dx,
          offsetY: preset.dy,
        });
      }
    }

    // 超过上限就按 size 保留最重要的几个；zoom 越近标签越少，避免 .card 模式下大卡片互相堆叠
    const cap = lodMode === "near" ? MAX_LABELS_NEAR : MAX_LABELS_MID;
    if (result.length > cap) {
      result.sort((a, b) => b.node.size - a.node.size);
      result.length = cap;
    }

    return result;
  }, [
    nodes,
    camera.x,
    camera.y,
    camera.zoom,
    viewportWidth,
    viewportHeight,
    shouldRender,
    lodMode,
  ]);

  if (!shouldRender) return null;

  return (
    <div className="node-labels" aria-label="文章标签">
      {/* 折线 SVG 层 */}
      <svg className="node-labels__lines">
        {visibleNodes.map(({ node, screenX, screenY, offsetX, offsetY }) => {
          const palette = getPalette(node.cluster);
          const lineColor = palette.core[0];

          // 折线路径：星球边缘 → 垂直段 → 水平段到标签
          const stemDir = offsetY > 0 ? 1 : -1;
          const stemEndY = screenY + stemDir * STEM_LENGTH;
          const labelX = screenX + offsetX;
          const labelY = stemEndY + (offsetY - stemDir * STEM_LENGTH);

          const points = `${screenX},${screenY} ${screenX},${stemEndY} ${labelX},${labelY}`;

          return (
            <polyline
              key={node.slug}
              points={points}
              fill="none"
              stroke={lineColor}
              strokeWidth={1}
              strokeOpacity={0.35}
              className="node-labels__leader"
            />
          );
        })}
      </svg>

      {/* 标签文字层 */}
      {visibleNodes.map(({ node, screenX, screenY, offsetX, offsetY }) => {
        const palette = getPalette(node.cluster);
        const textColor = palette.core[0];
        const stemDir = offsetY > 0 ? 1 : -1;
        const stemEndY = screenY + stemDir * STEM_LENGTH;
        const labelX = screenX + offsetX;
        const labelY = stemEndY + (offsetY - stemDir * STEM_LENGTH);

        const isLeft = offsetX < 0;

        return (
          <div
            key={node.slug}
            className="node-labels__item node-labels__item--visible"
            style={{
              left: `${labelX}px`,
              top: `${labelY}px`,
              transform: isLeft ? "translate(-100%, -50%)" : "translate(0, -50%)",
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
                    {node.preview}
                  </div>
                </div>
              </div>
            ) : (
              <span
                className="node-labels__title"
                style={{ color: textColor }}
              >
                {node.title}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const NodeLabels = memo(NodeLabelsImpl);
