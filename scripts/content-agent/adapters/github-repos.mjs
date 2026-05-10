import { githubPreviewMedia } from "../media.mjs";
import { cleanText, toIsoDate } from "../utils.mjs";

const DEFAULT_API_BASE = "https://api.github.com";

export async function fetchGitHubReposSource(
  source,
  { fetchImpl = fetch, timeoutMs = 15_000 } = {},
) {
  const repos = normalizeRepos(source.repos);
  const signals = [];
  const seen = new Set();

  for (const repo of repos) {
    try {
      const data = await fetchRepo(source, repo, { fetchImpl, timeoutMs });
      const signal = signalFromRepo(data, source, repo);
      if (!signal || seen.has(signal.id)) continue;
      seen.add(signal.id);
      signals.push(signal);
    } catch {
      // Curated repo monitoring should be resilient to renamed, private, or
      // temporarily rate-limited repositories.
    }
  }

  return signals;
}

function normalizeRepos(repos) {
  return (Array.isArray(repos) ? repos : [])
    .map((repo) => (typeof repo === "string" ? { repo } : repo))
    .filter((repo) => repo?.repo);
}

async function fetchRepo(source, repo, { fetchImpl, timeoutMs }) {
  const apiBase = String(source.apiBase || DEFAULT_API_BASE).replace(/\/+$/g, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      accept: "application/vnd.github+json",
      "user-agent": "JiaoTang-Content-Agent/1.0 (+https://jiaotangxq.github.io)",
    };
    const token = source.token || process.env.GITHUB_TOKEN || process.env.CONTENT_AGENT_GITHUB_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetchImpl(`${apiBase}/repos/${repo.repo}`, { signal: controller.signal, headers });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

function signalFromRepo(repo, source, route) {
  const fullName = cleanText(repo.full_name);
  const url = cleanText(repo.html_url);
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
    title: route.title || `${fullName} 开源项目进入重点观察`,
    url,
    canonicalUrl: url,
    sourceId: source.id,
    sourceName: source.name,
    sourceType: "github",
    sourceWeight: route.weight ?? source.weight,
    section: route.section ?? source.section ?? "opensource",
    publishedAt: toIsoDate(repo.pushed_at || repo.updated_at || repo.created_at),
    content,
    metrics: {
      stars: Number(repo.stargazers_count ?? 0),
      forks: Number(repo.forks_count ?? 0),
      watchers: Number(repo.watchers_count ?? 0),
      language,
    },
    media: { images: [githubPreviewMedia(url)].filter(Boolean), videos: [] },
    tags: [...new Set([...(source.tags ?? []), ...(route.tags ?? []), ...topics])],
    raw: { adapter: "github-repos", repo: fullName, configuredRepo: route.repo },
  };
}
