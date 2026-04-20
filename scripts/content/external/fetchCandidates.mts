/**
 * 第一步：抓取所有信息源，normalize + dedupe，输出候选池。
 *
 * 不调用任何 LLM —— 这一步是纯数据管道。
 * 输出：content/external/candidates.json
 *
 * 之后由 CLI agent（Claude Code / Codex）照 skill 指令读取此文件，
 * 逐篇生成中文摘要/评分/立场，最后跑 applySummaries.mts 合并进 items.json。
 */
import fs from "node:fs";
import path from "node:path";
import type { ExternalContentCandidate } from "../../../src/lib/content/types.js";
import { readSourceRegistry } from "./readSourceRegistry.mjs";
import { normalizeFeedItems } from "./normalizeFeedItems.mjs";
import { fetchFeedXml } from "./fetchFeedXml.mjs";

const OUT_PATH = path.resolve("content/external/candidates.json");
const ITEMS_PATH = path.resolve("content/external/items.json");
const CONCURRENCY = 8;

type CandidateRecord = ExternalContentCandidate & {
  /** 继承自源的语言标签 */
  sourceLanguage?: string;
  /** 继承自源的立场标签 */
  sourceStance?: string;
};

async function main() {
  const sources = readSourceRegistry();
  console.log(`📡 抓取 ${sources.length} 个信息源（并发 ${CONCURRENCY}）...`);

  // 已有 items 的 slug：用来跳过重复工作
  let existingSlugs = new Set<string>();
  if (fs.existsSync(ITEMS_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8")) as { slug: string }[];
      existingSlugs = new Set(existing.map((e) => e.slug));
      console.log(`↺ 已有 items.json 中 ${existingSlugs.size} 条（会被跳过）`);
    } catch {
      // ignore
    }
  }

  const successBySource = new Map<string, number>();
  const errorsBySource = new Map<string, string>();
  const allCandidates: CandidateRecord[] = [];

  let idx = 0;
  async function worker() {
    while (idx < sources.length) {
      const i = idx++;
      const source = sources[i];
      try {
        const xml = await fetchFeedXml(source);
        const items = normalizeFeedItems({ xml, source });
        const tagged: CandidateRecord[] = items.map((it) => ({
          ...it,
          sourceLanguage: source.language,
          sourceStance: source.stance,
        }));
        allCandidates.push(...tagged);
        successBySource.set(source.id, tagged.length);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errorsBySource.set(source.id, msg);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, sources.length) }, () => worker()),
  );

  // Filter out already-processed slugs
  const fresh = allCandidates.filter((c) => !existingSlugs.has(c.slug));

  // Sort newest first
  fresh.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  fs.writeFileSync(OUT_PATH, JSON.stringify(fresh, null, 2));

  // Report
  const totalFetched = allCandidates.length;
  const freshCount = fresh.length;
  const successCount = [...successBySource.values()].reduce((a, b) => a + b, 0);
  const failedSources = errorsBySource.size;

  console.log("");
  console.log(`✓ 抓取完成`);
  console.log(`  • 总抓取：${totalFetched} 条`);
  console.log(`  • 新增待处理：${freshCount} 条（已写入 ${path.relative(process.cwd(), OUT_PATH)}）`);
  console.log(`  • 成功源：${sources.length - failedSources}/${sources.length}`);
  if (failedSources > 0) {
    console.log(`  • 失败源：${failedSources}`);
    for (const [id, err] of errorsBySource) {
      console.log(`    - ${id}: ${err.slice(0, 80)}`);
    }
  }
  console.log(`  • 命中率（抓到条数）：${successCount} 条`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
