import fs from "node:fs";
import path from "node:path";
import type {
  ExternalContentCandidate,
  ExternalContentRecord,
} from "../../src/lib/content/types.js";
import { readSourceRegistry } from "./external/readSourceRegistry.mjs";
import { normalizeFeedItems } from "./external/normalizeFeedItems.mjs";
import { summarizeExternalItems } from "./external/summarizeExternalItems.mjs";
import { scoreExternalItems } from "./external/scoreExternalItems.mjs";

const OUT_PATH = path.resolve("content/external/items.json");
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

type CliArgs = {
  fixturePath?: string;
};

type SummaryPayload = Pick<
  ExternalContentRecord,
  "summary" | "whyWorthReading"
>;

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
  const summary = candidate.rawExcerpt || `${candidate.title} 的外部内容摘要。`;
  return {
    summary: summary.length > 160 ? `${summary.slice(0, 157)}...` : summary,
    whyWorthReading: "它把一个你平时未必会主动进入的话题，变成了一个低门槛的探索入口。",
  };
}

async function callClaude(candidate: ExternalContentCandidate): Promise<SummaryPayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallbackSummary(candidate);
  }

  const prompt = `你在为一个帮助用户偶遇陌生内容的网站生成外部内容摘要。

请基于以下信息输出 JSON，不要输出 markdown 代码块：
{
  "summary": "60-120 字总结，告诉用户这篇内容在说什么",
  "whyWorthReading": "30-80 字，说明为什么值得绕路看一眼"
}

标题：${candidate.title}
来源：${candidate.sourceName}
主题：${candidate.topics.join("、")}
摘要素材：${candidate.rawExcerpt || "无"}
链接：${candidate.sourceUrl}`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    return fallbackSummary(candidate);
  }

  const data = await response.json();
  const text = String(data.content?.[0]?.text ?? "")
    .replace(/```json?\s*/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsed = JSON.parse(text) as SummaryPayload;
    if (parsed.summary && parsed.whyWorthReading) {
      return parsed;
    }
  } catch {
    // Fall back below.
  }

  return fallbackSummary(candidate);
}

async function loadSourceXml(feedUrl: string, fixturePath?: string): Promise<string> {
  if (fixturePath) {
    return fs.readFileSync(fixturePath, "utf8");
  }

  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${feedUrl}`);
  }

  return await response.text();
}

export async function refreshExternalContent(args: CliArgs = {}): Promise<ExternalContentRecord[]> {
  const sources = readSourceRegistry();
  const candidates: ExternalContentCandidate[] = [];

  for (const source of sources) {
    try {
      const xml = await loadSourceXml(source.feedUrl, args.fixturePath);
      candidates.push(...normalizeFeedItems({ xml, source }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`⚠ 跳过来源 ${source.name}: ${message}`);
    }
  }

  const summarized = await summarizeExternalItems(candidates, {
    summarizeCandidate: callClaude,
  });
  const approved = scoreExternalItems(summarized, { existingTitles: [] });

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(approved, null, 2));

  return approved;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv.slice(2));
  const items = await refreshExternalContent(args);
  console.log(`✓ external items: ${items.length}`);
}
