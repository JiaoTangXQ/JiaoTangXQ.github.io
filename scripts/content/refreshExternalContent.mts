import fs from "node:fs";
import path from "node:path";
import type {
  ExternalContentCandidate,
  ExternalContentRecord,
} from "../../src/lib/content/types.js";
import { readSourceRegistry } from "./external/readSourceRegistry.mjs";
import { normalizeFeedItems } from "./external/normalizeFeedItems.mjs";
import { summarizeExternalItems, type AISummaryPayload } from "./external/summarizeExternalItems.mjs";
import { scoreExternalItems } from "./external/scoreExternalItems.mjs";
import { fetchFeedXml } from "./external/fetchFeedXml.mjs";

const OUT_PATH = path.resolve("content/external/items.json");
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
// No age limit — pull everything the feed exposes
const CONCURRENCY = 5;

type CliArgs = {
  fixturePath?: string;
};

type SummaryPayload = Pick<
  ExternalContentRecord,
  "summary" | "whyWorthReading" | "titleZh" | "contentCategory"
> & { topics?: string[]; qualityScore?: number };

function parseCliArgs(argv: string[]): CliArgs {
  const fixtureIndex = argv.indexOf("--fixture");
  return {
    fixturePath:
      fixtureIndex >= 0 && argv[fixtureIndex + 1]
        ? path.resolve(argv[fixtureIndex + 1])
        : undefined,
  };
}

function fallbackSummary(candidate: ExternalContentCandidate): SummaryPayload {
  const raw = candidate.rawExcerpt || "";
  // Use first paragraph as summary, capped at 400 chars
  const firstPara = raw.split(/\n\n+/)[0] ?? raw;
  const summary = firstPara.length > 400 ? firstPara.slice(0, 400) : firstPara;
  return {
    titleZh: undefined,
    summary: summary || candidate.title,
    whyWorthReading: "",
    contentCategory: "news",
  };
}

const SUMMARIZE_PROMPT = `你是一个高质量内容策展人，为中文读者提取和改写外部信息源的精华。

请基于以下信息输出严格的 JSON（不要 markdown 代码块，不要任何解释文字）：

{
  "titleZh": "简洁有力的中文标题（15字以内，不是翻译腔，要像一个好编辑写的标题）",
  "summary": "60-120字中文摘要，提炼核心信息，让读者快速理解这篇文章在说什么",
  "whyWorthReading": "30-80字，针对这篇具体内容说明为什么值得花时间看，不要泛泛而谈",
  "topics": ["从以下列表选1-2个最相关的: 技术, AI, 科学, 社会, 文化, 历史, 哲学, 经济, 法律, 环境, 健康, 思考"],
  "contentCategory": "从以下选一个: research, analysis, opinion, tutorial, news, announcement, obituary, event",
  "qualityScore": 0.0到1.0之间的数字
}

质量评分标准：
- 0.9+ 原创深度研究、独到见解、跨领域启发
- 0.75-0.9 扎实的分析或技术深潜、有信息增量
- 0.6-0.75 有用的新闻报道或教程
- 0.6以下 人事任命、活动预告、浅层新闻、重复信息

标题要求：
- 不要翻译腔，要像中文母语者写的
- 专有名词保留英文（如 Redis、React、NASA）
- 简洁有力，15 字以内

whyWorthReading 要求：
- 必须针对这篇具体内容，不能用万能句式
- 说出这篇和其他同类内容有什么不同
- 让读者产生"这个角度我没想过"的感觉`;

async function callClaude(candidate: ExternalContentCandidate): Promise<SummaryPayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackSummary(candidate);
  }

  const userMessage = `标题：${candidate.title}
来源：${candidate.sourceName}
来源默认主题：${candidate.topics.join("、")}
摘要素材：${candidate.rawExcerpt?.slice(0, 1500) || "无"}
链接：${candidate.sourceUrl}`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: SUMMARIZE_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      console.warn(`⚠ API ${response.status} for: ${candidate.title}`);
      return fallbackSummary(candidate);
    }

    const data = await response.json();
    const text = String(data.content?.[0]?.text ?? "")
      .replace(/```json?\s*/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(text) as AISummaryPayload;

    // Validate required fields
    if (!parsed.summary || !parsed.whyWorthReading) {
      console.warn(`⚠ 解析不完整: ${candidate.title}`);
      return fallbackSummary(candidate);
    }

    return {
      titleZh: parsed.titleZh || undefined,
      summary: parsed.summary,
      whyWorthReading: parsed.whyWorthReading,
      topics: parsed.topics,
      contentCategory: parsed.contentCategory,
      qualityScore: typeof parsed.qualityScore === "number"
        ? Math.max(0, Math.min(1, parsed.qualityScore))
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠ 摘要失败 ${candidate.title}: ${message}`);
    return fallbackSummary(candidate);
  }
}

/** Run summarization with concurrency limit. */
async function callClaudeWithConcurrency(
  candidates: ExternalContentCandidate[],
  concurrency: number,
): Promise<Map<string, SummaryPayload>> {
  const results = new Map<string, SummaryPayload>();
  let idx = 0;

  async function worker() {
    while (idx < candidates.length) {
      const i = idx++;
      const candidate = candidates[i];
      const payload = await callClaude(candidate);
      results.set(candidate.slug, payload);
      if ((i + 1) % 10 === 0) {
        console.log(`  摘要进度: ${i + 1}/${candidates.length}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function loadSourceXml(
  source: { feedUrl: string; type?: string; rsshubRoute?: string; id: string; name: string; siteUrl: string; defaultTopics: string[]; enabled: boolean },
  fixturePath?: string,
): Promise<string> {
  if (fixturePath) {
    return fs.readFileSync(fixturePath, "utf8");
  }
  // Delegate to unified fetcher (supports RSSHub failover)
  return fetchFeedXml(source as never);
}

export function filterRecentCandidates(
  candidates: ExternalContentCandidate[],
  maxAgeDays: number,
  now: Date = new Date(),
): ExternalContentCandidate[] {
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  return candidates.filter((candidate) => {
    const publishedMs = new Date(candidate.date).getTime();
    if (Number.isNaN(publishedMs)) {
      return false;
    }

    return nowMs - publishedMs <= maxAgeMs;
  });
}

export async function refreshExternalContent(args: CliArgs = {}): Promise<ExternalContentRecord[]> {
  const sources = readSourceRegistry();
  const candidates: ExternalContentCandidate[] = [];

  console.log(`📡 抓取 ${sources.length} 个信息源...`);

  // Fetch all sources with concurrency
  const fetchResults = await Promise.allSettled(
    sources.map(async (source) => {
      try {
        const xml = await loadSourceXml(source, args.fixturePath);
        return normalizeFeedItems({ xml, source });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠ 跳过来源 ${source.name}: ${message}`);
        return [];
      }
    }),
  );

  for (const result of fetchResults) {
    if (result.status === "fulfilled") {
      candidates.push(...result.value);
    }
  }

  console.log(`📰 共抓取 ${candidates.length} 条候选内容`);

  // Check if API key exists to decide summarization strategy
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  let summarized: ExternalContentRecord[];
  if (hasApiKey) {
    console.log(`🤖 AI 摘要中 (并发=${CONCURRENCY})...`);
    const summaryMap = await callClaudeWithConcurrency(candidates, CONCURRENCY);
    summarized = await summarizeExternalItems(candidates, {
      summarizeCandidate: async (candidate) => summaryMap.get(candidate.slug) ?? fallbackSummary(candidate),
    });
  } else {
    console.log(`⚠ 未设置 ANTHROPIC_API_KEY，使用 fallback 摘要`);
    summarized = await summarizeExternalItems(candidates);
  }

  const approved = scoreExternalItems(summarized, { existingTitles: [] });

  console.log(`✅ 通过质量过滤: ${approved.length} 条 (淘汰 ${summarized.length - approved.length} 条)`);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(approved, null, 2));

  return approved;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv.slice(2));
  const items = await refreshExternalContent(args);
  console.log(`✓ external items: ${items.length}`);
}
