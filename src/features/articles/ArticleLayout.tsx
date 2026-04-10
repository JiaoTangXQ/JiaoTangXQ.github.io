import { Link } from "react-router-dom";
import { getPalette, buildCoverGradient } from "@/lib/content/types";
import type { ContentType, CoverConfig } from "@/lib/content/types";

type Props = {
  title: string;
  date: string;
  topics: string[];
  cluster: string;
  cover: CoverConfig;
  bodyHtml: string;
  contentType?: ContentType;
  sourceName?: string;
  sourceUrl?: string;
  sourceDomain?: string;
  backUrl: string;
  /** 自定义返回处理（用于过渡动画），若提供则替代默认 Link 行为 */
  onBack?: (e: React.MouseEvent) => void;
};

/**
 * Format an ISO-ish date string into a human-friendly Chinese date.
 * Handles both ISO dates ("2026-03-27") and JS Date toString() output.
 */
function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year} 年 ${month} 月 ${day} 日`;
}

/**
 * The full reading surface for a single article.
 * Provides a cover hero, metadata bar, rendered prose, and a slot for
 * a footer (NearbyPlanets is rendered by the parent route).
 */
export function ArticleLayout({
  title,
  date,
  topics,
  cluster,
  cover,
  bodyHtml,
  contentType,
  sourceName,
  sourceUrl,
  sourceDomain,
  backUrl,
  onBack,
  children,
}: Props & { children?: React.ReactNode }) {
  const palette = getPalette(cluster);
  const accent = cover.accent ?? palette.accent;

  // Build cover background
  const coverBg =
    cover.style === "image" && cover.imageUrl
      ? `url(${cover.imageUrl})`
      : buildCoverGradient(cover, cluster);

  // Title positioning
  const titleJustify =
    cover.titlePosition === "top"
      ? "flex-start"
      : cover.titlePosition === "center"
        ? "center"
        : "flex-end";
  const titleTextAlign = cover.titleAlign ?? "left";
  const overlayOpacity = cover.overlayOpacity ?? 0.85;

  return (
    <div
      className="article-scroll"
      style={{ "--article-accent": accent } as React.CSSProperties}
    >
      {/* Back button */}
      <Link to={backUrl} className="article-back" onClick={onBack}>
        <span className="article-back__arrow">&larr;</span>
        <span>返回星图</span>
      </Link>

      {/* Cover hero */}
      <header
        className="article-cover"
        style={{
          justifyContent: titleJustify,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            background: coverBg,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: overlayOpacity,
          }}
        />
        {/* Gradient fade to deep space at bottom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background: `linear-gradient(
              to bottom,
              transparent 0%,
              rgba(5, 16, 26, 0.4) 50%,
              var(--space-deep) 100%
            )`,
          }}
        />
        <div className="article-cover__inner">
          <h1
            className="article-cover__title"
            style={{ textAlign: titleTextAlign }}
          >
            {title}
          </h1>
        </div>
      </header>

      {/* Meta bar */}
      <div className="article-meta">
        <time className="article-meta__date" dateTime={date}>
          {formatDate(date)}
        </time>
        {topics.length > 0 && <span className="article-meta__sep" />}
        <div className="article-meta__topics">
          {topics.map((t) => (
            <span key={t} className="article-meta__topic">
              {t}
            </span>
          ))}
        </div>
      </div>

      {contentType === "external" && sourceName && sourceUrl && (
        <section className="article-source-card">
          <div className="article-source-card__eyebrow">外部来源</div>
          <div className="article-source-card__title-row">
            <a
              className="article-source-card__link"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {sourceName}
            </a>
            {sourceDomain && (
              <span className="article-source-card__domain">{sourceDomain}</span>
            )}
          </div>
          <p className="article-source-card__note">
            这是一条外部内容摘要页，用来帮你快速判断它值不值得继续看原文。
          </p>
        </section>
      )}

      {/* Prose body */}
      <article
        className="article-body article-enter"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {contentType === "external" && sourceUrl && (
        <div className="article-outbound">
          <a
            className="article-outbound__cta"
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            去看原文
          </a>
        </div>
      )}

      {/* Footer slot (NearbyPlanets, etc.) */}
      {children}
    </div>
  );
}
