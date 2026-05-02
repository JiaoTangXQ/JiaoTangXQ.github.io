// @ts-check
import { defineConfig, fontProviders } from "astro/config";
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
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: "Fraunces",
        cssVariable: "--font-display",
        weights: ["300 700"],
        styles: ["normal", "italic"],
        subsets: ["latin", "latin-ext"],
        fallbacks: [
          "Source Han Serif SC",
          "Songti SC",
          "Noto Serif SC",
          "ui-serif",
          "Georgia",
          "serif",
        ],
      },
      {
        provider: fontProviders.google(),
        name: "Newsreader",
        cssVariable: "--font-serif",
        weights: ["400 700"],
        styles: ["normal", "italic"],
        subsets: ["latin", "latin-ext"],
        fallbacks: [
          "Source Han Serif SC",
          "Songti SC",
          "Noto Serif SC",
          "ui-serif",
          "Georgia",
          "serif",
        ],
      },
      {
        provider: fontProviders.google(),
        name: "Inter Tight",
        cssVariable: "--font-sans",
        weights: ["400 600"],
        styles: ["normal"],
        subsets: ["latin", "latin-ext"],
        fallbacks: [
          "PingFang SC",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    ],
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
