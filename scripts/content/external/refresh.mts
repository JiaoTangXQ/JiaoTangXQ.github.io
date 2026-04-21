/**
 * 焦糖星球外部内容刷新管线（零 LLM 版）
 *
 * 流程：
 *   1. 并行抓 RSS/Atom 所有源
 *   2. 规则过滤（qualityFilter）去掉快讯 / 空贴 / 占位符内容
 *   3. 对过关的新条目，尝试抓原文（readability）补齐正文，抓不到退回 RSS 摘录
 *   4. 清洗 HTML，派生 preview 和 language，写入 items.json
 *
 * 已存在 slug 不再抓取、不再修改。仅新增。
 */

import fs from "node:fs";
import path from "node:path";
import type {
  ExternalContentCandidate,
  ExternalContentRecord,
  ExternalSource,
} from "../../../src/lib/content/types.js";
import { readSourceRegistry } from "./readSourceRegistry.mjs";
import { normalizeFeedItems } from "./normalizeFeedItems.mjs";
import { fetchFeedXml } from "./fetchFeedXml.mjs";
import { filterByQuality } from "./qualityFilter.mjs";
import { extractFullArticle } from "./extractFullArticle.mjs";
import {
  sanitizeHtml,
  extractPreview,
  detectLanguage,
  htmlToPlainText,
} from "./sanitizeContent.mjs";

const ITEMS_PATH = path.resolve("content/external/items.json");
const FEED_CONCURRENCY = 8;
const EXTRACT_CONCURRENCY = 6;
const FULL_TEXT_MIN_CHARS = 600; // RSS 原文超过这个长度就不再抓全文

type CandidateWithSource = ExternalContentCandidate & {
  sourceLanguage?: string;
  sourceStance?: ExternalSource["stance"];
};

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await worker(items[i], i);
      } catch {
        results[i] = undefined as R;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

async function main() {
  const sources = readSourceRegistry();
  console.log(
    `📡 抓取 ${sources.length} 个信息源（并发 ${FEED_CONCURRENCY}）...`,
  );

  // 读已有 items
  let existing: ExternalContentRecord[] = [];
  if (fs.existsSync(ITEMS_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
    } catch {
      existing = [];
    }
  }
  const existingSlugs = new Set(existing.map((e) => e.slug));
  console.log(`↺ items.json 现有 ${existing.length} 条`);

  // ===== 1. 抓 feeds =====
  const allCandidates: CandidateWithSource[] = [];
  const feedErrors: Array<{ id: string; msg: string }> = [];

  await runPool(sources, FEED_CONCURRENCY, async (source) => {
    try {
      const xml = await fetchFeedXml(source);
      const items = normalizeFeedItems({ xml, source });
      for (const it of items) {
        if (existingSlugs.has(it.slug)) continue;
        allCandidates.push({
          ...it,
          sourceLanguage: source.language,
          sourceStance: source.stance,
        });
      }
    } catch (error) {
      feedErrors.push({
        id: source.id,
        msg: error instanceof Error ? error.message : String(error),
      });
    }
  });

  console.log(
    `📰 抓到 ${allCandidates.length} 条新候选（跳过已有 ${existingSlugs.size}）`,
  );
  if (feedErrors.length > 0) {
    console.log(`⚠ 失败源 ${feedErrors.length}:`);
    for (const { id, msg } of feedErrors.slice(0, 8)) {
      console.log(`   ${id}: ${msg.slice(0, 80)}`);
    }
  }

  if (allCandidates.length === 0) {
    console.log("（无新内容）");
    return;
  }

  // ===== 2. 规则过滤 =====
  const { kept, dropped } = filterByQuality(allCandidates, 0.45);
  console.log(
    `🧹 规则过滤：保留 ${kept.length} 条 / 淘汰 ${dropped.length} 条`,
  );

  // ===== 3. 并行抓全文 =====
  console.log(
    `📖 尝试抽取全文（并发 ${EXTRACT_CONCURRENCY}，短于 ${FULL_TEXT_MIN_CHARS} 字的条目才抓）...`,
  );

  let fullTextHit = 0;
  let fullTextMiss = 0;

  const enriched = await runPool(kept, EXTRACT_CONCURRENCY, async (c, i) => {
    const rawLen = htmlToPlainText(c.rawExcerpt || "").length;
    let htmlContent = c.rawExcerpt || "";

    if (rawLen < FULL_TEXT_MIN_CHARS && c.sourceUrl) {
      const fetched = await extractFullArticle(c.sourceUrl);
      if (fetched && htmlToPlainText(fetched.content).length > rawLen) {
        htmlContent = fetched.content;
        fullTextHit++;
      } else {
        fullTextMiss++;
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  全文进度: ${i + 1}/${kept.length}`);
    }

    return { candidate: c, htmlContent };
  });

  console.log(
    `✓ 全文抓取：成功 ${fullTextHit} · 退回 RSS ${fullTextMiss} · 源已足长 ${kept.length - fullTextHit - fullTextMiss}`,
  );

  // ===== 4. 清洗 + 打包 =====
  const newRecords: ExternalContentRecord[] = [];
  for (const entry of enriched) {
    if (!entry) continue;
    const { candidate, htmlContent } = entry;
    const sanitized = sanitizeHtml(htmlContent, candidate.sourceUrl);
    const preview = extractPreview(sanitized, 120);
    const plainSample = htmlToPlainText(sanitized);
    const cand = candidate as CandidateWithSource;
    const language =
      cand.sourceLanguage === "zh"
        ? "zh"
        : detectLanguage(
            candidate.title + " " + plainSample.slice(0, 200),
          );

    newRecords.push({
      slug: candidate.slug,
      contentType: "external",
      language,
      title: candidate.title,
      date: candidate.date,
      topics: candidate.topics,
      content: sanitized,
      preview,
      sourceName: candidate.sourceName,
      sourceUrl: candidate.sourceUrl,
      sourceDomain: candidate.sourceDomain,
      stance: cand.sourceStance,
    });
  }

  // ===== 5. 合并写回 =====
  const merged = [...existing, ...newRecords];
  merged.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  fs.mkdirSync(path.dirname(ITEMS_PATH), { recursive: true });
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(merged, null, 2));

  console.log(
    `\n✅ 刷新完成：新增 ${newRecords.length} 条 · items.json 总 ${merged.length} 条`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
