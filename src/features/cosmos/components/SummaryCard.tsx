import { useEffect, useRef, useState, useCallback } from "react";
import type { CosmosNode } from "@/lib/content/types";
import { getPalette, buildCoverGradient } from "@/lib/content/types";
import "@/styles/cosmos-ui.css";

type Props = {
  node: CosmosNode;
  onClose: () => void;
  /** 点击"阅读全文"时触发缩放过渡，替代直接路由跳转 */
  onNavigate?: (node: CosmosNode) => void;
  /** Current camera hash (e.g. "x=120&y=-80&z=1.5") for return navigation */
  cameraHash?: string;
};

export function SummaryCard({ node, onClose, onNavigate, cameraHash }: Props) {
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const palette = getPalette(node.cluster);
  const isExternal = node.contentType === "external";

  // Animate in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 350);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  const coverGradient = buildCoverGradient(node.cover, node.cluster);
  const ctaGradient = `linear-gradient(135deg, ${palette.core[0]}, ${palette.core[1]})`;

  const formattedDate = formatDate(node.date);

  const handleReadMore = useCallback(() => {
    if (onNavigate) {
      onNavigate(node);
    }
  }, [node, onNavigate]);

  return (
    <div
      className={`summary-card-overlay${visible ? " summary-card-overlay--visible" : ""}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={node.title}
    >
      <div
        ref={cardRef}
        className={`summary-card${visible ? " summary-card--visible" : ""}`}
      >
        {/* Cover */}
        <div
          className="summary-card__cover"
          style={{
            background:
              node.cover.style === "image" && node.cover.imageUrl
                ? `url(${node.cover.imageUrl}) center/cover no-repeat`
                : coverGradient,
          }}
        >
          <button
            className="summary-card__close"
            onClick={handleClose}
            aria-label="关闭"
          >
            ✕
          </button>
          <h2 className="summary-card__cover-title">{node.title}</h2>
        </div>

        {/* Body */}
        <div className="summary-card__body">
          <div className="summary-card__meta">
            <span className="summary-card__date">{formattedDate}</span>
            {isExternal && node.sourceName && (
              <span className="summary-card__source">
                外部来源 · {node.sourceName}
              </span>
            )}
            <div className="summary-card__tags">
              {node.topics.map((topic) => (
                <span key={topic} className="summary-card__tag">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <p className="summary-card__summary">{node.preview}</p>

          <button
            className="summary-card__cta"
            onClick={handleReadMore}
            style={{ background: ctaGradient }}
          >
            阅读全文
            <span className="summary-card__cta-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
