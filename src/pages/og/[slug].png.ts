import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { generateOgPng } from "@/lib/og";
import { formatDate } from "@/lib/format";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: CollectionEntry<"posts"> };
  const png = await generateOgPng({
    title: post.data.title,
    subtitle: post.data.subtitle,
    date: formatDate(post.data.date, post.data.lang),
    tags: post.data.tags,
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
