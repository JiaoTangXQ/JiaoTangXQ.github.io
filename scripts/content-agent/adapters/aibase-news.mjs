import { extractMediaFromHtml, mergeMedia } from "../media.mjs";
import { absoluteUrl, cleanText, stripHtml, toIsoDate } from "../utils.mjs";

export async function fetchAibaseNewsSource(source, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const html = await fetchText(source.url, { fetchImpl, timeoutMs });
  const metadataById = extractMetadataById(html);
  const seen = new Set();
  const signals = [];

  for (const match of html.matchAll(/<a\b(?=[^>]*href=["'](\/news\/(\d+))["'])(?=[^>]*aria-label=["']阅读文章:\s*([^"']+)["'])[^>]*>[\s\S]*?<\/a>/gi)) {
    const block = match[0];
    const href = match[1];
    const id = match[2];
    if (seen.has(id)) continue;
    seen.add(id);

    const title = cleanText(tagText(block, "h3") || match[3]);
    const url = absoluteUrl(href, source.homepage ?? source.url);
    const metadata = metadataById.get(id) ?? {};
    const description = cleanText(
      metadata.description || classText(block, /text-surface-500/) || classText(block, /line-clamp-2/) || "",
    );
    const media = mergeMedia(
      extractMediaFromHtml(block, { baseUrl: source.homepage ?? source.url }),
      metadata.thumb ? { images: [absoluteUrl(metadata.thumb, source.homepage ?? source.url)], videos: [] } : null,
    );

    if (!title || !url) continue;
    signals.push({
      id: `${source.id}:${id}`,
      title,
      url,
      canonicalUrl: url,
      sourceId: source.id,
      sourceName: cleanText(classText(block, /font-light/) || source.name),
      sourceType: source.sourceType ?? "news",
      sourceWeight: source.weight,
      section: source.section,
      publishedAt: toIsoDate(metadata.addtime),
      content: stripHtml(description),
      media,
      tags: [...(source.tags ?? []), ...(metadata.tags ?? [])],
      raw: { adapter: "aibase-news", articleId: id },
    });
  }

  return signals;
}

async function fetchText(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "JiaoTang-Content-Agent/1.0 (+https://jiaotangxq.github.io)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractMetadataById(html) {
  const decoded = decodeNextChunks(html);
  const map = new Map();
  for (const match of decoded.matchAll(/"Id":(\d+)/g)) {
    const id = match[1];
    const start = match.index ?? 0;
    const next = decoded.indexOf('"Id":', start + 5);
    const segment = decoded.slice(start, next === -1 ? start + 12_000 : next);
    map.set(id, {
      addtime: jsonStringField(segment, "addtime"),
      description: jsonStringField(segment, "description"),
      thumb: jsonStringField(segment, "thumb"),
      tags: parseTags(jsonStringField(segment, "tags")),
    });
  }
  return map;
}

function decodeNextChunks(html) {
  const chunks = [];
  for (const match of String(html).matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)) {
    try {
      chunks.push(JSON.parse(`"${match[1]}"`));
    } catch {
      // Ignore chunks Next.js split in a way that is not a standalone JSON string.
    }
  }
  return chunks.length ? chunks.join("\n") : String(html).replace(/\\"/g, '"');
}

function jsonStringField(segment, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(segment).match(new RegExp(`"${escaped}":"((?:[^"\\\\]|\\\\.)*)"`));
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

function parseTags(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(cleanText).filter(Boolean) : [];
  } catch {
    return String(value)
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((tag) => cleanText(tag.replace(/^["']|["']$/g, "")))
      .filter(Boolean);
  }
}

function tagText(block, tagName) {
  const match = String(block).match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match?.[1] ?? "";
}

function classText(block, classPattern) {
  const match = String(block).match(/<([a-z0-9]+)\b(?=[^>]*class=["']([^"']*)["'])[^>]*>([\s\S]*?)<\/\1>/i);
  if (!match) return "";
  if (classPattern.test(match[2])) return match[3];
  const nested = Array.from(String(block).matchAll(/<([a-z0-9]+)\b(?=[^>]*class=["']([^"']*)["'])[^>]*>([\s\S]*?)<\/\1>/gi));
  return nested.find((item) => classPattern.test(item[2]))?.[3] ?? "";
}
