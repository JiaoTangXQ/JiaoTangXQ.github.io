export const SITE_NAME = "焦糖星球";

export type SeoData = {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  type: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  noIndex?: boolean;
  jsonLd?: unknown | unknown[];
};

export function seoForPage(input: {
  title: string;
  description: string;
  noIndex?: boolean;
  canonical?: string;
  ogImage?: string;
}): SeoData {
  return {
    title: input.title,
    description: input.description,
    canonical: input.canonical,
    ogImage: input.ogImage,
    type: "website",
    noIndex: input.noIndex,
  };
}

export function seoForPost(input: {
  title: string;
  description: string;
  date: string;
  updated?: string;
  tags?: string[];
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}): SeoData {
  return {
    title: `${input.title} — ${SITE_NAME}`,
    description: input.description,
    canonical: input.canonical,
    ogImage: input.ogImage,
    type: "article",
    publishedTime: input.date,
    modifiedTime: input.updated,
    tags: input.tags,
    noIndex: input.noIndex,
  };
}
