import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import type { CosmosData, CosmosNode } from "@/lib/content/types";
import { ArticleLayout } from "@/features/articles/ArticleLayout";
import { NearbyPlanets } from "@/features/articles/NearbyPlanets";
import { recordVisit } from "@/features/cosmos/nodes/personalHistory";
import { loadCosmos, getCachedCosmos } from "@/lib/content/cosmosCache";
import "@/styles/article.css";

type ArticleData = {
  node: CosmosNode;
  bodyHtml: string;
};

/** Strip YAML front-matter (between opening and closing ---) from markdown. */
function stripFrontmatter(md: string): string {
  const trimmed = md.trimStart();
  if (!trimmed.startsWith("---")) return md;
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return md;
  return trimmed.slice(end + 3).trimStart();
}

/** Render markdown body to HTML using remark + rehype. */
async function renderMarkdown(md: string): Promise<string> {
  const [
    { unified },
    { default: remarkParse },
    { default: remarkRehype },
    { default: rehypeStringify },
  ] = await Promise.all([
    import("unified"),
    import("remark-parse"),
    import("remark-rehype"),
    import("rehype-stringify"),
  ]);

  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(result);
}

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [cosmos, setCosmos] = useState<CosmosData | null>(() => getCachedCosmos());
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">(
    "loading",
  );

  // 淡入/淡出动画状态
  const [fadeIn, setFadeIn] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(false), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const handleBack = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setFadeOut(true);
      fadeTimerRef.current = setTimeout(() => {
        navigate(`/${location.hash}`);
      }, 260);
    },
    [navigate, location.hash],
  );

  const backUrl = `/${location.hash}`;

  const loadArticle = useCallback(
    async (cosmosData: CosmosData, targetSlug: string) => {
      const node = cosmosData.nodes.find((n) => n.slug === targetSlug);
      if (!node) {
        setStatus("not-found");
        return;
      }

      if (node.contentType === "external") {
        // External content: fetch per-slug JSON with full HTML content
        try {
          const res = await fetch(`/data/external/${targetSlug}.json`);
          if (res.ok) {
            const data = await res.json();
            setArticle({ node, bodyHtml: data.content ?? "" });
            setStatus("ready");
            return;
          }
        } catch {
          // fall through
        }
        // Fallback: render the short preview if per-slug file is missing
        const fallback = `<p>${node.preview}</p>`;
        setArticle({ node, bodyHtml: fallback });
        setStatus("ready");
        return;
      }

      // Local articles
      try {
        const res = await fetch(`/data/articles/${targetSlug}.json`);
        if (res.ok) {
          const data = await res.json();
          setArticle({ node, bodyHtml: data.bodyHtml ?? data.body ?? "" });
          setStatus("ready");
          return;
        }
      } catch {
        // Fall through
      }

      try {
        const res = await fetch(`/articles/${targetSlug}.md`);
        if (res.ok) {
          const rawMd = await res.text();
          const body = stripFrontmatter(rawMd);
          const html = await renderMarkdown(body);
          setArticle({ node, bodyHtml: html });
          setStatus("ready");
          return;
        }
      } catch {
        // Fall through
      }

      const fallbackHtml = `<p>${node.preview}</p>`;
      setArticle({ node, bodyHtml: fallbackHtml });
      setStatus("ready");
    },
    [],
  );

  useEffect(() => {
    if (!slug) {
      setStatus("not-found");
      return;
    }

    let cancelled = false;

    (async () => {
      setStatus("loading");

      let cosmosData = cosmos ?? getCachedCosmos();
      if (!cosmosData) {
        try {
          cosmosData = await loadCosmos();
          if (!cancelled) setCosmos(cosmosData);
        } catch {
          if (!cancelled) setStatus("not-found");
          return;
        }
      }

      if (!cancelled) {
        await loadArticle(cosmosData, slug);
      }
    })();

    return () => {
      cancelled = true;
    };
    // 只依赖 slug：cosmos 被 setCosmos 后不需要再跑 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    const scrollEl = document.querySelector(".article-scroll");
    if (scrollEl) scrollEl.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (slug) recordVisit(slug);
  }, [slug]);

  if (status === "loading") {
    return (
      <div className="article-loading">
        <span>
          正在加载
          <span className="article-loading__dot">.</span>
          <span className="article-loading__dot">.</span>
          <span className="article-loading__dot">.</span>
        </span>
      </div>
    );
  }

  if (status === "not-found" || !article) {
    return (
      <div className="article-not-found">
        <div className="article-not-found__code">404</div>
        <p className="article-not-found__message">
          这颗星球似乎还未被发现
        </p>
        <Link to="/" className="article-not-found__link">
          <span>&larr;</span>
          <span>返回星图</span>
        </Link>
      </div>
    );
  }

  const { node, bodyHtml } = article;

  return (
    <>
      <div
        className="article-transition-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          backgroundColor: "var(--space-deep, #060a14)",
          opacity: fadeIn || fadeOut ? 1 : 0,
          transition: "opacity 260ms ease-in-out",
          pointerEvents: fadeIn || fadeOut ? "all" : "none",
        }}
        aria-hidden="true"
      />
      <ArticleLayout
        title={node.title}
        date={node.date}
        topics={node.topics}
        cluster={node.cluster}
        cover={node.cover}
        bodyHtml={bodyHtml}
        contentType={node.contentType}
        language={node.language}
        sourceName={node.sourceName}
        sourceUrl={node.sourceUrl}
        sourceDomain={node.sourceDomain}
        backUrl={backUrl}
        onBack={handleBack}
      >
        {cosmos && (
          <NearbyPlanets currentSlug={node.slug} nodes={cosmos.nodes} />
        )}
      </ArticleLayout>
    </>
  );
}
