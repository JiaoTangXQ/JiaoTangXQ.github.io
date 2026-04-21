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
  language?: "zh" | "en" | "other";
  sourceName?: string;
  sourceUrl?: string;
  sourceDomain?: string;
  backUrl: string;
  /** 自定义返回处理（用于过渡动画），若提供则替代默认 Link 行为 */
  onBack?: (e: React.MouseEvent) => void;
};

/**
 * Format an ISO-ish date string into a human-friendly Chinese date.
 */
function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${year} 年 ${month} 月 ${day} 日`;
}

export function ArticleLayout({
  title,
  date,
  topics,
  cluster,
  cover,
  bodyHtml,
  contentType,
  language,
  sourceName,
  sourceUrl,
  sourceDomain,
  backUrl,
  onBack,
  children,
}: Props & { children?: React.ReactNode }) {
  const palette = getPalette(cluster);
  const accent = cover.accent ?? palette.accent;

  const coverBg =
    cover.style === "image" && cover.imageUrl
      ? `url(${cover.imageUrl})`
      : buildCoverGradient(cover, cluster);

  const titleJustify =
    cover.titlePosition === "top"
      ? "flex-start"
      : cover.titlePosition === "center"
        ? "center"
        : "flex-end";
  const titleTextAlign = cover.titleAlign ?? "left";
  const overlayOpacity = cover.overlayOpacity ?? 0.85;

  const isExternal = contentType === "external" && !!sourceUrl;

  return (
    <div
      className="article-scroll"
      style={{ "--article-accent": accent } as React.CSSProperties}
      lang={language === "en" ? "en" : "zh-CN"}
    >
      <Link to={backUrl} className="article-back" onClick={onBack}>
        <span className="article-back__arrow">&larr;</span>
        <span>返回星图</span>
      </Link>

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

      <div className="article-meta">
        <time className="article-meta__date" dateTime={date}>
          {formatDate(date)}
        </time>
        {isExternal && sourceName && (
          <>
            <span className="article-meta__sep" />
            <a
              className="article-meta__source"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={sourceUrl}
            >
              {sourceName}
            </a>
          </>
        )}
        {topics.length > 0 && <span className="article-meta__sep" />}
        <div className="article-meta__topics">
          {topics.map((t) => (
            <span key={t} className="article-meta__topic">
              {t}
            </span>
          ))}
        </div>
      </div>

      <article
        className={`article-body article-enter${language === "en" ? " article-body--en" : ""}`}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {isExternal && (
        <aside className="article-attribution">
          <div className="article-attribution__row">
            <span className="article-attribution__label">本文原载于</span>
            <a
              className="article-attribution__source"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {sourceName}
            </a>
            {sourceDomain && (
              <span className="article-attribution__domain">
                ({sourceDomain})
              </span>
            )}
          </div>
          <a
            className="article-attribution__cta"
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            阅读原文 →
          </a>
          <p className="article-attribution__note">
            版权归原作者所有。这里只是让你在不离开焦糖星球的情况下通读一遍。
          </p>
        </aside>
      )}

      {children}
    </div>
  );
}
