import { cleanText, stripHtml, toIsoDate } from "../utils.mjs";
import { extractMediaFromHtml } from "../media.mjs";

export async function fetchFoloSource(source, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  if (!source.cookie || !source.listIds?.length) return [];
  const batches = [];
  for (const listId of source.listIds) {
    batches.push(...(await fetchList(source, listId, { fetchImpl, timeoutMs })));
  }
  return batches;
}

async function fetchList(source, listId, { fetchImpl, timeoutMs }) {
  const url = new URL(source.apiUrl);
  url.searchParams.set("listId", listId);
  url.searchParams.set("limit", String(source.limit ?? 50));
  url.searchParams.set("view", source.view ?? "0");
  if (source.fetchDays) {
    const after = new Date();
    after.setUTCDate(after.getUTCDate() - Number(source.fetchDays));
    url.searchParams.set("publishedAfter", after.toISOString());
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        cookie: source.cookie,
        accept: "application/json",
        "user-agent": "JiaoTang-Content-Agent/1.0 (+https://jiaotangxq.github.io)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const json = await response.json();
    const entries = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    return entries.map((entry) => normalizeFoloEntry(entry, source, listId)).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeFoloEntry(item, source, listId) {
  const entry = item.entries ?? item.entry ?? item;
  const feed = item.feeds ?? item.feed ?? {};
  const url = entry.url || entry.url_view || entry.external_url;
  if (!url) return null;
  return {
    id: `${source.id}:${entry.id ?? url}`,
    title: cleanText(entry.title),
    url,
    sourceId: source.id,
    sourceName: feed.title || source.name,
    sourceType: source.sourceType ?? "folo",
    sourceWeight: source.weight,
    section: source.section,
    publishedAt: toIsoDate(entry.published_at ?? entry.publishedAt ?? entry.inserted_at),
    content: stripHtml(entry.content_html ?? entry.description ?? entry.content ?? ""),
    media: extractMediaFromHtml(entry.content_html ?? entry.content ?? "", { baseUrl: url }),
    tags: source.tags ?? [],
    raw: { adapter: "folo", listId },
  };
}
