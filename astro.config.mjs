// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://jiaotangxq.github.io";

// 收集所有 draft 文章的 slug，用于 sitemap 过滤。
// CLAUDE.md 约定：草稿 URL 仍可访问（noindex），但不进 sitemap / RSS / 列表。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, "src/content/posts");
const DAILIES_DIR = path.join(__dirname, "src/content/dailies");

/** @param {string} file */
function isDraftFile(file) {
  const content = fs.readFileSync(file, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return false;
  return /^\s*draft:\s*true\b/m.test(fmMatch[1]);
}

/** @param {string} file */
function frontmatterDate(file) {
  const content = fs.readFileSync(file, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const dateMatch = fmMatch?.[1].match(/^\s*date:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$/m);
  if (dateMatch) return dateMatch[1];
  const basename = path.basename(file).replace(/\.(mdx|md)$/, "");
  const filenameDate = basename.match(/\d{4}-\d{2}-\d{2}/);
  return filenameDate?.[0] ?? null;
}

const DRAFT_SLUGS = new Set(
  fs.existsSync(POSTS_DIR)
    ? fs
        .readdirSync(POSTS_DIR)
        .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
        .filter((f) => isDraftFile(path.join(POSTS_DIR, f)))
        .map((f) => f.replace(/\.(mdx|md)$/, ""))
    : [],
);

const DRAFT_DAILY_ROUTE_PARTS = new Set(
  fs.existsSync(DAILIES_DIR)
    ? fs
        .readdirSync(DAILIES_DIR)
        .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
        .filter((f) => isDraftFile(path.join(DAILIES_DIR, f)))
        .map((f) => frontmatterDate(path.join(DAILIES_DIR, f)))
        .filter((date) => typeof date === "string")
        .map((date) => `/docs/${date.slice(0, 7)}/${date}/`)
    : [],
);

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
      filter: (page) => {
        if (page.includes("/universe")) return false;
        const m = page.match(/\/posts\/([^/]+)\/?$/);
        if (m && DRAFT_SLUGS.has(m[1])) return false;
        for (const routePart of DRAFT_DAILY_ROUTE_PARTS) {
          if (page.includes(routePart)) return false;
        }
        return true;
      },
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
