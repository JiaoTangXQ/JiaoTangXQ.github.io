import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = (
    await getCollection("posts", ({ data }) => !data.draft)
  ).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: "焦糖星球",
    description: "焦糖的原创写作站。只发原创长文，不转载、不聚合。",
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/posts/${post.id}`,
      categories: post.data.tags,
    })),
    customData: `<language>zh-CN</language><copyright>© 焦糖</copyright>`,
    stylesheet: false,
  });
}
