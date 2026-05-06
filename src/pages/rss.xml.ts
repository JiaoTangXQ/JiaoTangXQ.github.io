import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getPublishedPosts } from "@/lib/posts";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();

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
