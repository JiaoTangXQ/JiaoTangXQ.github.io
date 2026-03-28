import { Link } from "react-router-dom";
import { getPalette } from "@/lib/content/types";
import type { CoverConfig } from "@/lib/content/types";

type Props = {
  title: string;
  date: string;
  topics: string[];
  cluster: string;
  cover: CoverConfig;
  bodyHtml: string;
  backUrl: string;
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
  backUrl,
  children,
}: Props & { children?: React.ReactNode }) {
  const palette = getPalette(cluster);
  const accent = cover.accent ?? palette.accent;

  // Build cover gradient
  const coverGradient =
    cover.style === "image" && cover.imageUrl
      ? `url(${cover.imageUrl})`
      : `linear-gradient(135deg, ${palette.core[0]} 0%, ${palette.core[1]} 50%, var(--space-deep) 100%)`;

  return (
    <div
      className="article-scroll"
      style={{ "--article-accent": accent } as React.CSSProperties}
    >
      {/* Back button */}
      <Link to={backUrl} className="article-back">
        <span className="article-back__arrow">&larr;</span>
        <span>返回星图</span>
      </Link>

      {/* Cover hero */}
      <header
        className="article-cover"
        style={{
          "--cover-bg": coverGradient,
        } as React.CSSProperties}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            background: coverGradient,
            opacity: 0.85,
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
              rgba(6, 13, 24, 0.4) 50%,
              var(--space-deep) 100%
            )`,
          }}
        />
        <div className="article-cover__inner">
          <h1 className="article-cover__title">{title}</h1>
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

      {/* Prose body */}
      <article
        className="article-body article-enter"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {/* Footer slot (NearbyPlanets, etc.) */}
      {children}
    </div>
  );
}
