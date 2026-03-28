import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import type { CosmosNode } from "@/lib/content/types";
import { getPalette } from "@/lib/content/types";
import "@/styles/cosmos-ui.css";

type Props = {
  node: CosmosNode;
  onClose: () => void;
  /** Current camera hash (e.g. "x=120&y=-80&z=1.5") for return navigation */
  cameraHash?: string;
};

export function SummaryCard({ node, onClose, cameraHash }: Props) {
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const palette = getPalette(node.cluster);

  // Animate in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  });

  const handleClose = useCallback(() => {
    setVisible(false);
    // Wait for exit animation before unmounting
    setTimeout(onClose, 350);
  }, [onClose]);

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  const coverGradient = `linear-gradient(135deg, ${palette.core[0]} 0%, ${palette.core[1]} 100%)`;
  const ctaGradient = `linear-gradient(135deg, ${palette.core[0]}, ${palette.core[1]})`;

  // Use current camera hash for return navigation
  const articlePath = `/article/${node.slug}`;
  const articleHash = cameraHash ? `#${cameraHash}` : "";

  const formattedDate = formatDate(node.date);

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
            <div className="summary-card__tags">
              {node.topics.map((topic) => (
                <span key={topic} className="summary-card__tag">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <p className="summary-card__summary">{node.summary}</p>

          <Link
            className="summary-card__cta"
            to={`${articlePath}${articleHash}`}
            style={{ background: ctaGradient }}
          >
            阅读全文
            <span className="summary-card__cta-arrow" aria-hidden="true">
              →
            </span>
          </Link>
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
