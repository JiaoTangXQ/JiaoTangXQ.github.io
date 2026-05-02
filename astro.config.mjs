// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";

const SITE = "https://jiaotangxq.github.io";

export default defineConfig({
  site: SITE,
  output: "static",
  trailingSlash: "never",
  build: {
    format: "directory",
  },
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) => !page.includes("/universe"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: "github-light-default",
      wrap: true,
    },
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "append",
          properties: { className: ["heading-anchor"], "aria-hidden": "true", tabIndex: -1 },
          content: { type: "text", value: "#" },
        },
      ],
    ],
  },
});
