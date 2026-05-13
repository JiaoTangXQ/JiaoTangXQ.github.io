import { buildGraph, getPublishedHtmlPosts } from "@/lib/html-posts.mjs";

export async function GET() {
  const graph = buildGraph(await getPublishedHtmlPosts());
  return new Response(JSON.stringify(graph, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
