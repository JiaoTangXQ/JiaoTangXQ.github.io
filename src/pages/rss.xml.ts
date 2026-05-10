import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { dailyUrl, getPublishedDailies } from "@/lib/dailies";
import { getPublishedPosts } from "@/lib/posts";

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  const dailies = await getPublishedDailies();
  const items = [
    ...dailies.map((daily) => ({
      title: daily.data.title,
      description: daily.data.description,
      pubDate: daily.data.date,
      link: dailyUrl(daily),
      categories: ["AI日报", ...daily.data.sections.flatMap((section) => section.items.flatMap((item) => item.tags))],
    })),
    ...posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.id}/`,
      categories: post.data.tags,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: "焦糖星球",
    description: "焦糖星球的 AI 日报、工程长文和原创观察。",
    site: context.site!,
    items,
    customData: `<language>zh-CN</language><copyright>© 焦糖</copyright>`,
    stylesheet: false,
  });
}
