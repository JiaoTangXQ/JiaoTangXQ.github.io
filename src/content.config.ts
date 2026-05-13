import { defineCollection, z } from "astro:content";

const htmlPosts = defineCollection({
  // The site reads HTML posts with src/lib/html-posts.mjs because each post is
  // a folder containing meta.yaml + index.html, not an Astro markdown entry.
  // This empty collection prevents Astro from auto-generating a deprecated
  // collection for src/content/html-posts.
  loader: () => [],
  schema: z.object({}).passthrough(),
});

export const collections = {
  "html-posts": htmlPosts,
};
