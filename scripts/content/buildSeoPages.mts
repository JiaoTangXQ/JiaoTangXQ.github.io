/**
 * SEO 构建脚本
 * 在 vite build 之后运行，生成：
 * - 每篇文章的独立 HTML（含 OG/Twitter Card 标签）
 * - 站点级 OG 标签注入
 * - robots.txt
 * - sitemap.xml
 */
import fs from "fs";
import path from "path";
import { readArticles } from "./readArticles.mjs";

const SITE_URL = "https://jiaotangxq.github.io";
const SITE_NAME = "焦糖星球";
const SITE_DESC = "焦糖星球 — 个人思想宇宙";
const DIST = path.resolve("dist");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 将日期字符串（可能是 Date.toString() 格式）规范化为 YYYY-MM-DD */
function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().split("T")[0];
}

// --- 读取 Vite 构建产物作为模板 ---
const template = fs.readFileSync(path.join(DIST, "index.html"), "utf-8");
const articles = readArticles();

// --- A1: 为每篇文章生成独立 HTML ---
let count = 0;
for (const a of articles) {
  const dir = path.join(DIST, "article", a.slug);
  fs.mkdirSync(dir, { recursive: true });

  const title = `${escapeHtml(a.title)} — ${SITE_NAME}`;
  const desc = escapeHtml(a.summary);
  const url = `${SITE_URL}/article/${a.slug}`;

  const ogBlock = [
    `<meta property="og:title" content="${escapeHtml(a.title)}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(a.title)}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
  ].join("\n    ");

  let html = template;
  // 替换 title
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  // 替换 description
  html = html.replace(
    /<meta name="description"[^>]*\/>/,
    `<meta name="description" content="${desc}" />`,
  );
  // 在 </head> 前插入 OG 标签
  html = html.replace("</head>", `    ${ogBlock}\n  </head>`);

  fs.writeFileSync(path.join(dir, "index.html"), html);
  count++;
}
console.log(`✓ SEO: ${count} 篇文章页面已生成`);

// --- A1: 站点级 OG 标签 ---
const siteOg = [
  `<meta property="og:title" content="${SITE_NAME}" />`,
  `<meta property="og:description" content="${escapeHtml(SITE_DESC)}" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:url" content="${SITE_URL}" />`,
  `<meta property="og:site_name" content="${SITE_NAME}" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${SITE_NAME}" />`,
  `<meta name="twitter:description" content="${escapeHtml(SITE_DESC)}" />`,
].join("\n    ");

let indexHtml = fs.readFileSync(path.join(DIST, "index.html"), "utf-8");
indexHtml = indexHtml.replace("</head>", `    ${siteOg}\n  </head>`);
fs.writeFileSync(path.join(DIST, "index.html"), indexHtml);
console.log(`✓ 站点级 OG 标签已注入 index.html`);

// --- A2: robots.txt ---
fs.writeFileSync(
  path.join(DIST, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);
console.log(`✓ robots.txt 已生成`);

// --- A2: sitemap.xml ---
const today = new Date().toISOString().split("T")[0];
const urls = [
  `  <url>\n    <loc>${SITE_URL}/</loc>\n    <lastmod>${today}</lastmod>\n    <priority>1.0</priority>\n  </url>`,
  ...articles.map(
    (a) =>
      `  <url>\n    <loc>${SITE_URL}/article/${escapeXml(a.slug)}</loc>\n    <lastmod>${normalizeDate(a.date)}</lastmod>\n    <priority>0.8</priority>\n  </url>`,
  ),
];

fs.writeFileSync(
  path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
);
console.log(`✓ sitemap.xml 已生成（${urls.length} 个 URL）`);
