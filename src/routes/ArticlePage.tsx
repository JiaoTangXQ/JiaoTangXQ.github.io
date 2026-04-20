import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation, Link, useNavigate } from "react-router-dom";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { CosmosData, CosmosNode } from "@/lib/content/types";
import { ArticleLayout } from "@/features/articles/ArticleLayout";
import { NearbyPlanets } from "@/features/articles/NearbyPlanets";
import { recordVisit } from "@/features/cosmos/nodes/personalHistory";
import "@/styles/article.css";

type ArticleData = {
  node: CosmosNode;
  bodyHtml: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(result);
}

function renderExternalSummary(node: CosmosNode): string {
  const summary = `<p>${escapeHtml(node.summary)}</p>`;
  const whyWorthReading = node.whyWorthReading
    ? `<h2>为什么值得看</h2><p>${escapeHtml(node.whyWorthReading)}</p>`
    : "";

  return [
    "<h2>内容总结</h2>",
    summary,
    whyWorthReading,
  ].join("");
}

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [cosmos, setCosmos] = useState<CosmosData | null>(null);
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">(
    "loading",
  );

  // 淡入/淡出动画状态
  const [fadeIn, setFadeIn] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 页面加载完成后淡入
  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(false), 50);
    return () => clearTimeout(timer);
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  /** 返回宇宙：先淡出再导航 */
  const handleBack = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setFadeOut(true);
      fadeTimerRef.current = setTimeout(() => {
        navigate(`/${location.hash}`);
      }, 450);
    },
    [navigate, location.hash],
  );

  // Compute back URL: return to cosmos root, preserving camera hash from URL
  const backUrl = `/${location.hash}`;

  const loadArticle = useCallback(
    async (cosmosData: CosmosData, targetSlug: string) => {
      const node = cosmosData.nodes.find((n) => n.slug === targetSlug);
      if (!node) {
        setStatus("not-found");
        return;
      }

      if (node.contentType === "external") {
        setArticle({ node, bodyHtml: renderExternalSummary(node) });
        setStatus("ready");
        return;
      }

      // Strategy 1: Try fetching a prebuilt article JSON
      try {
        const res = await fetch(`/data/articles/${targetSlug}.json`);
        if (res.ok) {
          const data = await res.json();
          setArticle({ node, bodyHtml: data.bodyHtml ?? data.body ?? "" });
          setStatus("ready");
          return;
        }
      } catch {
        // Fall through to next strategy
      }

      // Strategy 2: Fetch the raw markdown and render client-side
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
        // Fall through to fallback
      }

      // Strategy 3: Fallback to summary as body
      const fallbackHtml = `<p>${node.summary}</p>`;
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

      // Fetch cosmos data
      let cosmosData = cosmos;
      if (!cosmosData) {
        try {
          const res = await fetch("/data/cosmos.json");
          cosmosData = (await res.json()) as CosmosData;
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
  }, [slug, cosmos, loadArticle]);

  // Scroll to top on slug change
  useEffect(() => {
    const scrollEl = document.querySelector(".article-scroll");
    if (scrollEl) scrollEl.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [slug]);

  // 记录本地阅读历史，驱动"异星跃迁"和未来的"盲区地图"
  useEffect(() => {
    if (slug) recordVisit(slug);
  }, [slug]);

  // ---- Loading state ----
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

  // ---- 404 state ----
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

  // ---- Article ready ----
  const { node, bodyHtml } = article;

  return (
    <>
      {/* 过渡遮罩 */}
      <div
        className="article-transition-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          backgroundColor: "var(--space-deep, #060a14)",
          opacity: fadeIn || fadeOut ? 1 : 0,
          transition: "opacity 450ms ease-in-out",
          pointerEvents: fadeIn || fadeOut ? "all" : "none",
        }}
        aria-hidden="true"
      />
      <ArticleLayout
        title={node.titleZh || node.title}
        date={node.date}
        topics={node.topics}
        cluster={node.cluster}
        cover={node.cover}
        bodyHtml={bodyHtml}
        contentType={node.contentType}
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
