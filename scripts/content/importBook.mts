/**
 * 批量导入 Claude Code Book 文档到焦糖星球
 *
 * 读取 docs/claude-code-book 下所有 md 文件，
 * 生成带 frontmatter 的文章到 content/articles/。
 */
import fs from "fs";
import path from "path";

const SRC = "/Users/xxx/tmp/cc/docs/claude-code-book";
const DEST = path.resolve("content/articles");

// 章节 → 主题映射
const CHAPTER_TOPICS: Record<string, string[]> = {
  "01": ["工作台架构"],
  "02": ["工作台架构", "启动"],
  "03": ["输入与路由"],
  "04": ["主循环"],
  "05": ["任务与分派"],
  "06": ["治理与权限"],
  "07": ["扩展系统"],
  "08": ["远端与边界"],
  "09": ["多Agent协作"],
  "10": ["上下文管理"],
  "11": ["终端界面"],
  "12": ["外延执行"],
  "13": ["工程美学"],
  appendices: ["参考"],
};

function getChapterNum(filePath: string): string {
  if (filePath.includes("/appendices/")) return "appendices";
  const match = filePath.match(/\/(\d{2})-/);
  return match?.[1] ?? "01";
}

function getTopics(filePath: string): string[] {
  const ch = getChapterNum(filePath);
  return CHAPTER_TOPICS[ch] ?? ["工作台架构"];
}

/** 从文件名和首行标题提取文章标题 */
function extractTitle(content: string, filename: string): string {
  // 优先用 # 标题
  const h1 = content.match(/^#\s+(.+)/m);
  if (h1) return h1[1].trim();

  // fallback: 从文件名提取
  const base = path.basename(filename, ".md");
  // 去掉编号前缀 (01-01-01-)
  return base.replace(/^\d{2}-\d{2}-?\d{0,2}-?/, "").replace(/-/g, " ").trim() || base;
}

/** 生成 slug — 只保留编号和英文，中文全部去掉 */
function makeSlug(filePath: string): string {
  const base = path.basename(filePath, ".md");
  return base
    .toLowerCase()
    .replace(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, "") // 去掉中文和全角符号
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || `article-${Math.random().toString(36).slice(2, 8)}`;
}

/** 生成摘要：取正文前 100 字 */
function extractSummary(content: string): string {
  // 跳过标题行
  const lines = content.split("\n").filter((l) => !l.startsWith("#") && l.trim().length > 0);
  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  const summary = text.slice(0, 100);
  return summary + (text.length > 100 ? "..." : "");
}

/** 判断 importance */
function getImportance(filePath: string): number {
  const base = path.basename(filePath);
  // 卷导读
  if (base.includes("导读")) return 1.4;
  // 附录
  if (filePath.includes("/appendices/")) return 0.9;
  // 子节标题文件（如 01-01-xxx 但包含子文件夹）
  // 通过文件所在深度判断
  const depth = filePath.split("/").length;
  if (depth <= 6) return 1.1; // section intro
  return 1.0; // leaf article
}

// --- 主流程 ---

// 清空旧文章
const oldFiles = fs.readdirSync(DEST).filter((f) => f.endsWith(".md"));
for (const f of oldFiles) {
  fs.unlinkSync(path.join(DEST, f));
}
console.log(`✗ 删除旧文章 ${oldFiles.length} 篇`);

// 收集所有 md 文件
const allFiles: string[] = [];
function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_meta" || entry.name === "diagrams") continue;
      walk(full);
    } else if (entry.name.endsWith(".md")) {
      allFiles.push(full);
    }
  }
}
walk(SRC);
allFiles.sort();

// slug 去重
const slugs = new Set<string>();
function uniqueSlug(base: string): string {
  let slug = base;
  let i = 2;
  while (slugs.has(slug)) {
    slug = `${base}-${i}`;
    i++;
  }
  slugs.add(slug);
  return slug;
}

let count = 0;
const today = new Date().toISOString().split("T")[0];

for (const file of allFiles) {
  const raw = fs.readFileSync(file, "utf-8");
  const title = extractTitle(raw, file);
  const baseSlug = makeSlug(file);
  const slug = uniqueSlug(baseSlug);
  const topics = getTopics(file);
  const summary = extractSummary(raw);
  const importance = getImportance(file);

  const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
date: ${today}
topics: [${topics.join(", ")}]
summary: "${summary.replace(/"/g, '\\"')}"
importance: ${importance}
---

`;

  const outPath = path.join(DEST, `${slug}.md`);
  fs.writeFileSync(outPath, frontmatter + raw);
  count++;
}

console.log(`✓ 导入 ${count} 篇文章`);

// 更新已知主题列表
const allTopics = new Set<string>();
for (const file of allFiles) {
  getTopics(file).forEach((t) => allTopics.add(t));
}
console.log(`✓ 主题列表: ${[...allTopics].join(", ")}`);
