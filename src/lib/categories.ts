import type { Post } from "@/lib/posts";

export type BlogCategory = "root" | "weekly";

export const BLOG_CATEGORIES = {
  root: { label: "Root", title: "全部文章" },
  weekly: { label: "AI 资讯周报", title: "周报" },
} satisfies Record<BlogCategory, { label: string; title: string }>;

export function postCategories(post: Post): BlogCategory[] {
  const normalizedTags = post.data.tags.map((tag) => tag.toLowerCase());
  const categories: BlogCategory[] = ["root"];
  if (
    post.id.includes("weekly") ||
    normalizedTags.some((tag) => tag.includes("weekly") || tag.includes("周报"))
  ) {
    categories.push("weekly");
  }
  return categories;
}

export function allPostTags(posts: Post[]): string[] {
  return Array.from(new Set(posts.flatMap((post) => post.data.tags))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
}
