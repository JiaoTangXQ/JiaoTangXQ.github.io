import type { APIRoute } from "astro";
import { generateOgPng } from "@/lib/og";
import { getAllPostsForBuild, type Post } from "@/lib/posts";
import { postSummary } from "@/lib/post-view";

export async function getStaticPaths() {
  const posts = await getAllPostsForBuild();
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: Post };
  const summary = postSummary(post);
  const png = await generateOgPng({
    title: post.data.title,
    subtitle: post.data.subtitle,
    date: summary.dateStr,
    tags: post.data.tags,
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
