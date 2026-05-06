import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"posts">;

const byDateDesc = (a: Post, b: Post) => b.data.date.getTime() - a.data.date.getTime();

/**
 * 已发布文章：用于首页列表、RSS。
 * 草稿（draft: true）从这里隐身——这是站点对读者的承诺。
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  return posts.sort(byDateDesc);
}

/**
 * 全部文章（含草稿）：用于 build 期生成静态路由——
 * 草稿 URL 仍可访问，但页面层会打 noIndex，列表/RSS 不会暴露。
 */
export async function getAllPostsForBuild(): Promise<Post[]> {
  const posts = await getCollection("posts");
  return posts.sort(byDateDesc);
}
