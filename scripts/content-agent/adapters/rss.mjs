import { absoluteUrl, cleanText, stripHtml, toIsoDate } from "../utils.mjs";
import { extractMediaFromHtml, extractMediaFromXml, mergeMedia } from "../media.mjs";

export async function fetchRssSource(source, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const xml = await fetchText(source.url, { fetchImpl, timeoutMs });
  const rssItems = blockMatches(xml, "item").map((block) => parseRssItem(block, source));
  const atomEntries = blockMatches(xml, "entry").map((block) => parseAtomEntry(block, source));
  const items = [...rssItems, ...atomEntries].filter((item) => item.title && item.url);
  if (!source.enrichMedia) return items;
  return enrichLinkedMedia(items, source, { fetchImpl, timeoutMs });
}

async function fetchText(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
        "user-agent": "JiaoTang-Content-Agent/1.0 (+https://jiaotangxq.github.io)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseRssItem(block, source) {
  return signalFromParts({
    title: tagText(block, "title"),
    url: absoluteUrl(tagText(block, "link") || atomHref(block), source.homepage ?? source.url),
    content: tagText(block, "content:encoded") || tagText(block, "description"),
    publishedAt: tagText(block, "pubDate") || tagText(block, "dc:date"),
    source,
    block,
  });
}

function parseAtomEntry(block, source) {
  return signalFromParts({
    title: tagText(block, "title"),
    url: absoluteUrl(atomHref(block) || tagText(block, "id"), source.homepage ?? source.url),
    content: tagText(block, "content") || tagText(block, "summary"),
    publishedAt: tagText(block, "published") || tagText(block, "updated"),
    source,
    block,
  });
}

function signalFromParts({ title, url, content, publishedAt, source, block }) {
  return {
    id: `${source.id}:${url}`,
    title: cleanText(title),
    url,
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.sourceType ?? source.type,
    sourceWeight: source.weight,
    section: source.section,
    publishedAt: toIsoDate(publishedAt),
    content: stripHtml(content),
    media: extractMediaFromXml(`${content ?? ""}\n${block ?? ""}`, { baseUrl: source.homepage ?? source.url }),
    tags: source.tags ?? [],
    raw: { adapter: "rss" },
  };
}

async function enrichLinkedMedia(items, source, { fetchImpl, timeoutMs }) {
  const limit = Number.isFinite(Number(source.enrichMediaLimit)) ? Number(source.enrichMediaLimit) : 12;
  const out = [];
  for (const item of items) {
    if (out.length >= limit) {
      out.push(item);
      continue;
    }
    if (item.media?.images?.length || item.media?.videos?.length) {
      out.push(item);
      continue;
    }
    try {
      const html = await fetchText(item.url, { fetchImpl, timeoutMs });
      out.push({
        ...item,
        media: mergeMedia(item.media, extractMediaFromHtml(html, { baseUrl: item.url || source.homepage || source.url })),
      });
    } catch {
      out.push(item);
    }
  }
  return out;
}

function blockMatches(xml, tagName) {
  const escaped = escapeRegExp(tagName);
  return Array.from(String(xml).matchAll(new RegExp(`<${escaped}\\b[\\s\\S]*?</${escaped}>`, "gi"))).map(
    (match) => match[0],
  );
}

function tagText(block, tagName) {
  const escaped = escapeRegExp(tagName);
  const match = String(block).match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)</${escaped}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function atomHref(block) {
  const alternate =
    String(block).match(/<link\b(?=[^>]*rel=["']alternate["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>/i) ??
    String(block).match(/<link\b(?=[^>]*href=["']([^"']+)["'])[^>]*>/i);
  return alternate?.[1] ?? "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
