export const SITE_NAME = "焦糖星球";

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
