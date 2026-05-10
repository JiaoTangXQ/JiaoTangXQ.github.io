import { absoluteUrl, cleanText } from "../utils.mjs";

export async function fetchGitHubTrending(source, { fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(source.url, {
      signal: controller.signal,
      headers: {
        accept: "text/html, */*;q=0.5",
        "user-agent": "JiaoTang-Content-Agent/1.0 (+https://jiaotangxq.github.io)",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return parseTrending(await response.text(), source);
  } finally {
    clearTimeout(timer);
  }
}

export function parseTrending(html, source) {
  const articles = Array.from(String(html).matchAll(/<article\b[\s\S]*?<\/article>/gi)).map((match) => match[0]);
  return articles.map((article) => parseArticle(article, source)).filter(Boolean);
}

function parseArticle(article, source) {
  const repoMatch = article.match(/<h2[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i);
  if (!repoMatch) return null;
  const repoPath = cleanText(repoMatch[2]).replace(/\s+/g, "");
  const url = absoluteUrl(repoMatch[1], "https://github.com");
  const descMatch = article.match(/<p[^>]*class=["'][^"']*col-9[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  const langMatch = article.match(/itemprop=["']programmingLanguage["'][^>]*>([\s\S]*?)<\/span>/i);
  const starsText = cleanText(article.match(/<a[^>]+href=["'][^"']+\/stargazers["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
  const todayText = cleanText(article.match(/([\d,.]+)\s+stars?\s+today/i)?.[0] ?? "");

  return {
    id: `${source.id}:${repoPath}`,
    title: `${repoPath} 开源项目冲榜`,
    url,
    sourceId: source.id,
    sourceName: source.name,
    sourceType: "github",
    sourceWeight: source.weight,
    section: "opensource",
    publishedAt: new Date().toISOString(),
    content: cleanText(descMatch?.[1] ?? ""),
    metrics: {
      stars: parseMetric(starsText),
      starsToday: parseMetric(todayText),
      language: cleanText(langMatch?.[1] ?? ""),
    },
    tags: source.tags ?? [],
    raw: { adapter: "github-trending", repo: repoPath },
  };
}

function parseMetric(value) {
  const text = String(value).replace(/,/g, "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(k)?/i);
  if (!match) return 0;
  return Math.round(Number(match[1]) * (match[2] ? 1000 : 1));
}
