import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEFAULT_KEYWORDS, SOURCES } from "./sources.mjs";

const DEFAULT_LIMIT = 24;

export async function fetchSignals(options = {}) {
  const {
    sources = SOURCES,
    keywords = DEFAULT_KEYWORDS,
    perSource = 8,
    timeoutMs = 12_000,
  } = options;

  const batches = await Promise.allSettled(
    sources.map(async (source) => {
      const rawSignals = await fetchSource(source, timeoutMs);
      return rawSignals
        .map((signal) => ({
          ...signal,
          score: scoreSignal(signal, keywords),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, perSource);
    }),
  );

  const signals = [];
  const errors = [];

  batches.forEach((batch, index) => {
    if (batch.status === "fulfilled") {
      signals.push(...batch.value);
    } else {
      const source = sources[index];
      errors.push({
        source: source.name,
        url: source.feedUrl ?? source.homepage,
        message: batch.reason instanceof Error ? batch.reason.message : String(batch.reason),
      });
    }
  });

  const sortedSignals = signals.sort((a, b) => b.score - a.score);
  return {
    generatedAt: new Date().toISOString(),
    errors,
    signals: selectDiverse(sortedSignals, options.limit ?? DEFAULT_LIMIT),
  };
}

async function fetchSource(source, timeoutMs) {
  if (source.feedUrl) {
    try {
      const xml = await fetchWithTimeout(source.feedUrl, timeoutMs);
      return parseFeed(xml, source);
    } catch (error) {
      if (!source.homepage) throw error;
      const html = await fetchWithTimeout(source.homepage, timeoutMs);
      return parseHtmlIndex(html, source);
    }
  }

  const html = await fetchWithTimeout(source.homepage, timeoutMs);
  return parseHtmlIndex(html, source);
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "JiaoTangXQ-AI-Daily/1.0 (+https://jiaotangxq.github.io)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseFeed(xml, source) {
  const rssItems = blockMatches(xml, "item").map((block) => parseRssItem(block, source));
  const atomEntries = blockMatches(xml, "entry").map((block) => parseAtomEntry(block, source));
  return [...rssItems, ...atomEntries].filter((item) => item.title && item.url);
}

function parseHtmlIndex(html, source) {
  const items = [];
  const seen = new Set();
  const anchors = html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);

  for (const anchor of anchors) {
    const url = absoluteUrl(anchor[1], source.homepage);
    const title = cleanText(anchor[2]);
    if (!isLikelySourceLink(url, title, source)) continue;
    const key = url.replace(/[#?].*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(
      signalFromParts({
        title,
        url,
        summary: "",
        publishedAt: null,
        source,
      }),
    );
  }

  return items.slice(0, 12);
}

function parseRssItem(block, source) {
  const title = textFromTag(block, "title");
  const url = absoluteUrl(textFromTag(block, "link") || atomHref(block), source.homepage);
  const summary = textFromTag(block, "description") || textFromTag(block, "content:encoded");
  const publishedAt = dateValue(textFromTag(block, "pubDate") || textFromTag(block, "dc:date"));

  return signalFromParts({ title, url, summary, publishedAt, source });
}

function parseAtomEntry(block, source) {
  const title = textFromTag(block, "title");
  const url = absoluteUrl(atomHref(block) || textFromTag(block, "id"), source.homepage);
  const summary = textFromTag(block, "summary") || textFromTag(block, "content");
  const publishedAt = dateValue(textFromTag(block, "updated") || textFromTag(block, "published"));

  return signalFromParts({ title, url, summary, publishedAt, source });
}

function signalFromParts({ title, url, summary, publishedAt, source }) {
  return {
    title: cleanText(title),
    url,
    summary: cleanText(summary),
    publishedAt,
    sourceId: source.id,
    sourceName: source.name,
    sourceSection: source.section,
    sourceHomepage: source.homepage,
  };
}

function blockMatches(xml, tagName) {
  return Array.from(xml.matchAll(new RegExp(`<${escapeRegExp(tagName)}\\b[\\s\\S]*?</${escapeRegExp(tagName)}>`, "gi"))).map(
    (match) => match[0],
  );
}

function textFromTag(block, tagName) {
  const escaped = escapeRegExp(tagName);
  const match = block.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, "i"));
  if (!match) return "";
  return cleanText(match[1]);
}

function atomHref(block) {
  const alternate =
    block.match(/<link\b(?=[^>]*rel=["']alternate["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i) ??
    block.match(/<link\b(?=[^>]*href=["']([^"']+)["'])[^>]*>/i);
  return alternate?.[1] ?? "";
}

function cleanText(value = "") {
  return decodeEntities(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function absoluteUrl(url, base) {
  if (!url) return base;
  try {
    return new URL(url, base).toString();
  } catch {
    return base;
  }
}

function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function scoreSignal(signal, keywords) {
  const haystack = `${signal.title} ${signal.summary}`.toLowerCase();
  const keywordScore = keywords.reduce((score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 3 : 0), 0);
  const published = signal.publishedAt ? new Date(signal.publishedAt).getTime() : 0;
  const ageHours = published ? Math.max(0, (Date.now() - published) / 3_600_000) : 240;
  const recencyScore = Math.max(0, 12 - ageHours / 12);
  const sourceWeight = signal.sourceSection === "models" ? 3 : signal.sourceSection === "tools" ? 2 : 1;
  return keywordScore + recencyScore + sourceWeight;
}

function selectDiverse(sortedSignals, limit) {
  const selected = [];
  const bySource = new Map();
  const bySection = new Map();

  for (const signal of sortedSignals) {
    if (selected.length >= limit) break;
    const sourceCount = bySource.get(signal.sourceName) ?? 0;
    const sectionCount = bySection.get(signal.sourceSection) ?? 0;
    if (sourceCount >= 3 || sectionCount >= Math.max(3, Math.ceil(limit / 2))) continue;
    selected.push(signal);
    bySource.set(signal.sourceName, sourceCount + 1);
    bySection.set(signal.sourceSection, sectionCount + 1);
  }

  for (const signal of sortedSignals) {
    if (selected.length >= limit) break;
    if (selected.includes(signal)) continue;
    selected.push(signal);
  }

  return selected;
}

function isLikelySourceLink(url, title, source) {
  if (!title || title.length < 8) return false;
  if (safeHost(url) !== safeHost(source.homepage)) return false;
  const pathname = new URL(url).pathname;
  return pathname.includes("/news/") || pathname.includes("/blog/") || pathname.includes("/changelog/");
}

function safeHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function runCli() {
  const outPath = path.join(process.cwd(), ".cache/ai-daily/signals.json");
  const result = await fetchSignals();
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(`Fetched ${result.signals.length} signals into ${path.relative(process.cwd(), outPath)}.`);
  for (const error of result.errors) {
    console.warn(`Skipped ${error.source}: ${error.message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
