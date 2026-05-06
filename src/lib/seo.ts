import type { PostView } from "@/lib/post-view";
import { PILLARS, type PillarSlug } from "@/lib/pillars";

export const SITE_NAME = "焦糖星球";
export const AUTHOR_NAME = "焦糖";

/**
 * Base.astro 唯一接受的 SEO 输入。
 * 所有页面的 head meta（title / description / canonical / OG / Twitter / JSON-LD / robots）
 * 都从这一个对象派生。canonical / ogImage 留 path 形式，由 Base.astro 用 Astro.site 解析为绝对 URL。
 */
export type SeoData = {
  title: string;
  description: string;
  /** 绝对 URL；若未提供，Base.astro 用 Astro.url 推算。 */
  canonical?: string;
  /** path 或绝对 URL。Base.astro 解析为绝对 URL。 */
  ogImage?: string;
  type: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  noIndex?: boolean;
  /**
   * Schema.org JSON-LD。可以是单个对象或对象数组，每个会渲染为独立 <script>。
   * Base.astro 自动 stringify 注入 head。
   */
  jsonLd?: unknown | unknown[];
};

function articleJsonLd(view: PostView, site: URL, ogImageAbsolute: string) {
  const data = view.post.data;
  const url = new URL(view.url, site).toString();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description: data.description,
    image: [ogImageAbsolute],
    datePublished: view.isoDateStr,
    dateModified: view.isoUpdatedStr ?? view.isoDateStr,
    author: { "@type": "Person", name: AUTHOR_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    inLanguage: data.lang === "en" ? "en" : "zh-CN",
    keywords: data.tags.join(", "),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

function breadcrumbJsonLd(view: PostView, site: URL) {
  const data = view.post.data;
  const items: Array<{ name: string; url: string }> = [
    { name: "归档", url: new URL("/", site).toString() },
  ];
  const pillar = data.pillar as PillarSlug | undefined;
  if (pillar && pillar !== "notes") {
    items.push({
      name: PILLARS[pillar].title,
      url: new URL(`/topics/${pillar}/`, site).toString(),
    });
  }
  items.push({
    name: data.title,
    url: new URL(view.url, site).toString(),
  });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function seoForPost(view: PostView, site: URL): SeoData {
  const data = view.post.data;
  const url = new URL(view.url, site).toString();

  // OG 图：cover 优先（手工封面），fallback 到 satori 生成的 /og/{slug}.png
  const ogImagePath = view.coverPath ?? view.ogPath;
  const ogImageAbsolute = ogImagePath.startsWith("http")
    ? ogImagePath
    : new URL(ogImagePath, site).toString();

  const article = articleJsonLd(view, site, ogImageAbsolute);
  const breadcrumb = breadcrumbJsonLd(view, site);

  return {
    title: `${data.title} — ${SITE_NAME}`,
    description: data.description,
    canonical: url,
    ogImage: ogImagePath,
    type: "article",
    publishedTime: view.isoDateStr,
    modifiedTime: view.isoUpdatedStr ?? undefined,
    tags: data.tags,
    noIndex: data.draft,
    jsonLd: [article, breadcrumb],
  };
}

export function seoForPage(input: {
  title: string;
  description: string;
  noIndex?: boolean;
  canonical?: string;
  /** 不传时使用站默认 OG /og/site.png */
  ogImage?: string;
}): SeoData {
  return {
    title: input.title,
    description: input.description,
    canonical: input.canonical,
    ogImage: input.ogImage ?? "/og/site.png",
    type: "website",
    noIndex: input.noIndex,
  };
}
