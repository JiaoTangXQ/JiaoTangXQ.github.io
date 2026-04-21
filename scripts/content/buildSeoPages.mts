/**
 * SEO 构建脚本
 * 在 vite build 之后运行，生成：
 * - 每篇文章的预渲染 HTML（含 OG/Twitter Card + 正文内容供爬虫索引）
 * - 站点级 OG 标签注入
 * - robots.txt
 * - sitemap.xml
 */
import fs from "fs";
import path from "path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { readArticles } from "./readArticles.mjs";
import { readExternalContent } from "./readExternalContent.mjs";

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

/** 将 Markdown 正文渲染为 HTML（构建时预渲染供爬虫索引） */
async function renderMarkdown(md: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(result);
}

/** 剥离 YAML front-matter */
function stripFrontmatter(md: string): string {
  const trimmed = md.trimStart();
  if (!trimmed.startsWith("---")) return md;
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return md;
  return trimmed.slice(end + 3).trimStart();
}

// --- 读取 Vite 构建产物作为模板 ---
const template = fs.readFileSync(path.join(DIST, "index.html"), "utf-8");
const articles = readArticles();
const externalItems = readExternalContent();

// --- 为每篇文章生成预渲染 HTML ---
let count = 0;

async function buildArticlePages() {
  for (const a of articles) {
    const dir = path.join(DIST, "article", a.slug);
    fs.mkdirSync(dir, { recursive: true });

    const title = `${escapeHtml(a.title)} — ${SITE_NAME}`;
    const desc = escapeHtml(a.summary);
    const url = `${SITE_URL}/article/${a.slug}`;
    const dateStr = normalizeDate(a.date);

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

    // 预渲染文章正文
    const bodyMd = stripFrontmatter(a.body);
    const bodyHtml = await renderMarkdown(bodyMd);

    // 预渲染内容块（noscript 内，供爬虫索引；SPA hydrate 后由 React 接管）
    const prerenderedBlock = `
    <noscript>
      <article style="max-width:680px;margin:0 auto;padding:2rem;color:#ccc;font-family:sans-serif">
        <h1>${escapeHtml(a.title)}</h1>
        <time datetime="${dateStr}">${dateStr}</time>
        <p>${desc}</p>
        ${bodyHtml}
      </article>
    </noscript>`;

    let html = template;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    html = html.replace(
      /<meta name="description"[^>]*\/>/,
      `<meta name="description" content="${desc}" />`,
    );
    html = html.replace("</head>", `    ${ogBlock}\n  </head>`);
    // 在 <div id="root"></div> 后插入预渲染内容
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root"></div>${prerenderedBlock}`,
    );

    fs.writeFileSync(path.join(dir, "index.html"), html);
    count++;
  }
  console.log(`✓ SEO: ${count} 篇文章页面已预渲染`);
}

await buildArticlePages();

function buildExternalSummaryBlock(
  item: ReturnType<typeof readExternalContent>[number],
) {
  const dateStr = normalizeDate(item.date);

  return `
    <noscript>
      <article style="max-width:680px;margin:0 auto;padding:2rem;color:#ccc;font-family:sans-serif">
        <p style="margin-bottom:0.75rem;opacity:0.75">外部来源 · ${escapeHtml(item.sourceName)}</p>
        <h1>${escapeHtml(item.title)}</h1>
        <time datetime="${dateStr}">${dateStr}</time>
        ${item.content ?? ""}
        <p style="margin-top:2rem;opacity:0.75">本文原载于 ${escapeHtml(item.sourceName)}，<a href="${escapeHtml(item.sourceUrl)}" rel="noopener noreferrer">阅读原文</a></p>
      </article>
    </noscript>`;
}

function buildExternalPages() {
  for (const item of externalItems) {
    const dir = path.join(DIST, "article", item.slug);
    fs.mkdirSync(dir, { recursive: true });

    const title = `${escapeHtml(item.title)} — ${SITE_NAME}`;
    const desc = escapeHtml(item.preview);
    const localUrl = `${SITE_URL}/article/${item.slug}`;
    const dateStr = normalizeDate(item.date);

    const headBlock = [
      `<meta name="robots" content="noindex,follow" />`,
      `<link rel="canonical" href="${escapeHtml(item.sourceUrl)}" />`,
      `<meta property="og:title" content="${escapeHtml(item.title)}" />`,
      `<meta property="og:description" content="${desc}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta property="og:url" content="${localUrl}" />`,
      `<meta property="og:site_name" content="${SITE_NAME}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeHtml(item.title)}" />`,
      `<meta name="twitter:description" content="${desc}" />`,
      `<meta property="article:published_time" content="${dateStr}" />`,
    ].join("\n    ");

    let html = template;
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    html = html.replace(
      /<meta name="description"[^>]*\/>/,
      `<meta name="description" content="${desc}" />`,
    );
    html = html.replace("</head>", `    ${headBlock}\n  </head>`);
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root"></div>${buildExternalSummaryBlock(item)}`,
    );

    fs.writeFileSync(path.join(dir, "index.html"), html);
    count++;
  }

  console.log(`✓ SEO: ${externalItems.length} 篇外部摘要页已预渲染`);
}

buildExternalPages();

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
