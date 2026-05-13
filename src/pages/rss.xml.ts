import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedHtmlPosts } from "@/lib/html-posts.mjs";

export async function GET(context: APIContext) {
  const posts = await getPublishedHtmlPosts();
  return rss({
    title: "焦糖星球",
    description: "焦糖的个人博客更新。",
    site: context.site!,
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: new Date(`${post.date}T00:00:00+08:00`),
      link: post.url,
      categories: post.tags,
    })),
    customData: `<language>zh-CN</language>`,
    stylesheet: false,
  });
}
