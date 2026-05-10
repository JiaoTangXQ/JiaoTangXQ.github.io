import { render } from "astro:content";
import { getImage } from "astro:assets";
import type { MarkdownHeading } from "astro";
import { formatDate, isoDate, estimateReadingMinutes } from "@/lib/format";
import type { Post } from "@/lib/posts";

export type RenderedContent = Awaited<ReturnType<typeof render>>["Content"];

/**
 * 文章卡片用：不需要 render() 的轻量派生。
 * 首页 N 张卡片各自调用，避免每张卡都解析全文。
 */
export type PostSummary = {
  post: Post;
  url: string;
  minutes: number;
  dateStr: string;
  isoDateStr: string;
};

/**
 * 完整文章页用：包含 Content、headings、可选封面。
 */
export type PostView = PostSummary & {
  Content: RenderedContent;
  headings: MarkdownHeading[]; // 已过滤 h2/h3，已 trim 末尾 # 和空白
  updatedStr: string | null;
  isoUpdatedStr: string | null;
  ogPath: string;
  /** 如 frontmatter 设了 cover，这里是构建后的优化图 URL（Astro getImage 处理）；否则 null。 */
  coverPath: string | null;
  /** 与 coverPath 匹配的 alt 文案。 */
  coverAlt: string | null;
};

const summaryCache = new WeakMap<Post, PostSummary>();

export function postSummary(post: Post): PostSummary {
  const cached = summaryCache.get(post);
  if (cached) return cached;
  const summary: PostSummary = {
    post,
    url: `/blog/${post.id}/`,
    minutes: estimateReadingMinutes(post.body ?? post.data.description ?? ""),
    dateStr: formatDate(post.data.date, post.data.lang),
    isoDateStr: isoDate(post.data.date),
  };
  summaryCache.set(post, summary);
  return summary;
}

async function resolveCover(post: Post): Promise<{ path: string | null; alt: string | null }> {
  if (!post.data.cover) return { path: null, alt: null };
  const optimized = await getImage({
    src: post.data.cover,
    width: 1200,
    format: "webp",
  });
  return { path: optimized.src, alt: post.data.coverAlt ?? null };
}

export async function buildPostView(post: Post): Promise<PostView> {
  const { Content, headings } = await render(post);
  const summary = postSummary(post);
  const cover = await resolveCover(post);
  const cleanedHeadings = headings
    .filter((h) => h.depth === 2 || h.depth === 3)
    .map((h) => ({ ...h, text: h.text.replace(/[\s#]+$/, "") }));

  return {
    ...summary,
    Content,
    headings: cleanedHeadings,
    updatedStr: post.data.updated ? formatDate(post.data.updated, post.data.lang) : null,
    isoUpdatedStr: post.data.updated ? isoDate(post.data.updated) : null,
    ogPath: `/og/${post.id.replaceAll("/", "__")}.png`,
    coverPath: cover.path,
    coverAlt: cover.alt,
  };
}
