#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");

if (!fs.existsSync(DIST)) {
  console.error("dist/ 不存在；先跑 npm run build");
  process.exit(1);
}

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "pagefind" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".html")) htmlFiles.push(full);
  }
}
walk(DIST);

function value(html, regex) {
  return html.match(regex)?.[1]?.trim() ?? "";
}

function isVerificationFile(rel, html) {
  if (/^google[a-f0-9]+\.html$/i.test(rel)) return true;
  return !/<html\b|<!doctype\s+html/i.test(html);
}

const errors = [];
for (const file of htmlFiles) {
  const rel = path.relative(DIST, file);
  const html = fs.readFileSync(file, "utf8");
  if (isVerificationFile(rel, html)) continue;
  if (rel === "404.html") continue;

  const checks = [
    ["title", /<title>([^<]+)<\/title>/i],
    ["meta description", /<meta\s+name=["']description["'][^>]*content=["']([^"']+)["']/i],
    ["canonical", /<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i],
  ];
  for (const [name, regex] of checks) {
    if (!value(html, regex)) errors.push(`${rel} 缺 ${name}`);
  }
}

console.log(`SEO lint: 扫描 ${htmlFiles.length} 个 HTML 文件`);
if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log("SEO lint: passed");
