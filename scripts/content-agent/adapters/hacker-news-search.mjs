import { cleanText, toIsoDate } from "../utils.mjs";

const DEFAULT_API_URL = "https://hn.algolia.com/api/v1/search_by_date";
const DEFAULT_QUERIES = ["AI agent", "LLM", "OpenAI", "Claude", "Gemini"];

export async function fetchHackerNewsSearchSource(
  source,
  { fetchImpl = fetch, timeoutMs = 15_000, now = Date.now() } = {},
) {
  const queries = Array.isArray(source.queries) && source.queries.length ? source.queries : DEFAULT_QUERIES;
  const seen = new Set();
  const signals = [];

  for (const query of queries) {
    const json = await fetchQuery(source, query, { fetchImpl, timeoutMs, now });
    const hits = Array.isArray(json?.hits) ? json.hits : [];
    for (const hit of hits) {
      const signal = signalFromHit(hit, source);
      if (!signal || seen.has(signal.id)) continue;
      seen.add(signal.id);
      signals.push(signal);
    }
  }

  return signals;
}

async function fetchQuery(source, query, { fetchImpl, timeoutMs, now }) {
  const url = new URL(source.apiUrl || DEFAULT_API_URL);
  const since = Math.floor((new Date(now).getTime() - Number(source.hours ?? 72) * 3_600_000) / 1000);
  url.searchParams.set("query", query);
  url.searchParams.set("tags", source.tagsFilter || "story");
  url.searchParams.set("numericFilters", `created_at_i>${since}`);
  url.searchParams.set("hitsPerPage", String(source.limit ?? 20));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "JiaoTang-Content-Agent/1.0 (+https://jiaotangxq.github.io)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function signalFromHit(hit, source) {
  const objectId = hit.objectID || hit.story_id || hit.id;
  const title = cleanText(hit.title || hit.story_title || hit._highlightResult?.title?.value || "");
  const url = hit.url || hit.story_url || (objectId ? `https://news.ycombinator.com/item?id=${objectId}` : "");
  if (!objectId || !title || !url) return null;

  return {
    id: `${source.id}:${objectId}`,
    title,
    url,
    canonicalUrl: url,
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.sourceType ?? "social",
    sourceWeight: source.weight,
    section: source.section ?? "social",
    publishedAt: toIsoDate(hit.created_at),
    content: cleanText(hit.story_text || hit.comment_text || title),
    metrics: {
      points: Number(hit.points ?? 0),
      comments: Number(hit.num_comments ?? hit.children?.length ?? 0),
    },
    tags: source.tags ?? [],
    raw: { adapter: "hacker-news-search", objectId },
  };
}
