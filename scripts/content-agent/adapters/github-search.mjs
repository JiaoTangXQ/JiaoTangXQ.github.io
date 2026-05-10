import { cleanText, toIsoDate } from "../utils.mjs";
import { githubPreviewMedia } from "../media.mjs";

const DEFAULT_API_URL = "https://api.github.com/search/repositories";

export async function fetchGitHubSearchSource(
  source,
  { fetchImpl = fetch, timeoutMs = 15_000, now = Date.now() } = {},
) {
  const queries = Array.isArray(source.queries) ? source.queries.filter(Boolean) : [];
  const seen = new Set();
  const signals = [];

  for (const query of queries) {
    const json = await fetchQuery(source, buildQuery(query, source, now), { fetchImpl, timeoutMs });
    for (const repo of Array.isArray(json?.items) ? json.items : []) {
      const signal = signalFromRepo(repo, source);
      if (!signal || seen.has(signal.id)) continue;
      seen.add(signal.id);
      signals.push(signal);
    }
  }

  return signals;
}

async function fetchQuery(source, query, { fetchImpl, timeoutMs }) {
  const url = new URL(source.apiUrl || DEFAULT_API_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("sort", source.sort || "updated");
  url.searchParams.set("order", source.order || "desc");
  url.searchParams.set("per_page", String(source.limit ?? 10));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      accept: "application/vnd.github+json",
      "user-agent": "JiaoTang-Content-Agent/1.0 (+https://jiaotangxq.github.io)",
    };
    const token = source.token || process.env.GITHUB_TOKEN || process.env.CONTENT_AGENT_GITHUB_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetchImpl(url, { signal: controller.signal, headers });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) return { items: [] };
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildQuery(query, source, now) {
  const text = String(query ?? "").trim();
  const days = Number(source.pushedWithinDays ?? 0);
  if (!days || /\bpushed:/.test(text)) return text;
  const date = new Date(new Date(now).getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return `${text} pushed:>=${date}`;
}

function signalFromRepo(repo, source) {
  const fullName = cleanText(repo.full_name);
  const url = repo.html_url;
  if (!fullName || !url) return null;
  const topics = Array.isArray(repo.topics) ? repo.topics.map(cleanText).filter(Boolean) : [];
  const language = cleanText(repo.language);
  const content = [
    cleanText(repo.description),
    topics.length ? `Topics: ${topics.join(", ")}` : "",
    language ? `Language: ${language}` : "",
  ].filter(Boolean).join(" ");

  return {
    id: `${source.id}:${fullName}`,
    title: `${fullName} 开源项目进入增量观察`,
    url,
    canonicalUrl: url,
    sourceId: source.id,
    sourceName: source.name,
    sourceType: "github",
    sourceWeight: source.weight,
    section: source.section ?? "opensource",
    publishedAt: toIsoDate(repo.pushed_at || repo.updated_at || repo.created_at),
    content,
    metrics: {
      stars: Number(repo.stargazers_count ?? 0),
      forks: Number(repo.forks_count ?? 0),
      watchers: Number(repo.watchers_count ?? 0),
      language,
    },
    media: { images: [githubPreviewMedia(url)].filter(Boolean), videos: [] },
    tags: [...new Set([...(source.tags ?? []), ...topics])],
    raw: { adapter: "github-search", repo: fullName },
  };
}
