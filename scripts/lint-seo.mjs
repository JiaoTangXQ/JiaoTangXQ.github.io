#!/usr/bin/env node
/**
 * 构建期 SEO 体检：扫描 dist/**.html，断言每页都有：
 *   - <title>（非空）
 *   - <meta name="description">（非空）
 *   - <link rel="canonical">
 *   - <meta property="og:image">（详情页强制；其它页只警告）
 *
 * 失败时 exit 1，让 GitHub Actions / CI 可见。
 */

import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");

if (!fs.existsSync(DIST)) {
  console.error(`✗ dist/ 不存在；先跑 npm run build`);
  process.exit(1);
}

/** @type {string[]} */
const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "pagefind") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".html")) htmlFiles.push(full);
  }
}
walk(DIST);

/** @param {string} html */
function getTag(html, regex) {
  const m = html.match(regex);
  return m ? (m[1] ?? "").trim() : null;
}

const RULES = [
  {
    name: "title",
    re: /<title>([^<]*)<\/title>/i,
    require: true,
    nonEmpty: true,
  },
  {
    name: "meta description",
    re: /<meta\s+name=["']description["'][^>]*content=["']([^"']*)["']/i,
    require: true,
    nonEmpty: true,
  },
  {
    name: "canonical",
    re: /<link\s+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i,
    require: true,
    nonEmpty: true,
  },
];

const OG_IMAGE_RE = /<meta\s+property=["']og:image["'][^>]*content=["']([^"']*)["']/i;

const errors = [];
const warnings = [];

/**
 * 站根目录下的"非页面 HTML"白名单：搜索引擎站点验证文件、ads.txt 等。
 * 这些文件不是真正的 HTML 页面，lint 时跳过。
 */
function isVerificationFile(rel, html) {
  // Google Search Console / Bing Webmaster 等的 verification 文件
  if (/^google[a-f0-9]+\.html$/i.test(rel)) return true;
  if (/^BingSiteAuth\.xml$/i.test(rel)) return true;
  // 内容里没有 <html / <!doctype 的，肯定不是真页面
  if (!/<html\b|<!doctype\s+html/i.test(html)) return true;
  return false;
}

for (const file of htmlFiles) {
  const rel = path.relative(DIST, file);
  const html = fs.readFileSync(file, "utf8");

  if (isVerificationFile(rel, html)) continue;

  // 404 页不在 sitemap 里，弱要求
  const is404 = rel === "404.html";
  const isArticle = /^docs\/\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}\/index\.html$/.test(rel);

  for (const rule of RULES) {
    const v = getTag(html, rule.re);
    if (rule.require && (v === null || (rule.nonEmpty && v === ""))) {
      const list = is404 ? warnings : errors;
      list.push(`${rel} — 缺 ${rule.name}`);
    }
  }

  const og = getTag(html, OG_IMAGE_RE);
  if (isArticle && (og === null || og === "")) {
    errors.push(`${rel} — 详情页缺 og:image（社交分享会没图）`);
  } else if (!isArticle && !is404 && (og === null || og === "")) {
    warnings.push(`${rel} — 缺 og:image（非文章页可选）`);
  }
}

console.log(`SEO lint: 扫描 ${htmlFiles.length} 个 HTML 文件`);
if (warnings.length) {
  console.log(`\n⚠️  ${warnings.length} 个警告：`);
  for (const w of warnings) console.log(`   ${w}`);
}
if (errors.length) {
  console.log(`\n✗ ${errors.length} 个错误：`);
  for (const e of errors) console.log(`   ${e}`);
  process.exit(1);
}
console.log(`✓ 全部 ${htmlFiles.length} 页 SEO meta 完整`);
