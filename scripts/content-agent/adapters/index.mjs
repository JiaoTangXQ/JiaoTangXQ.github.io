import { fetchAISearchSource } from "./ai-search.mjs";
import { fetchAibaseNewsSource } from "./aibase-news.mjs";
import { fetchFoloSource } from "./folo.mjs";
import { fetchGitHubReposSource } from "./github-repos.mjs";
import { fetchGitHubSearchSource } from "./github-search.mjs";
import { fetchGitHubTrending } from "./github-trending.mjs";
import { fetchHackerNewsSearchSource } from "./hacker-news-search.mjs";
import { fetchRssSource } from "./rss.mjs";
import { fetchRssHubSource } from "./rsshub.mjs";

export async function fetchSources(sources, options = {}) {
  const active = sources.filter((source) => source.enabled !== false);
  const batches = await Promise.allSettled(active.map((source) => fetchSource(source, options)));
  const signals = [];
  const errors = [];
  batches.forEach((batch, index) => {
    const source = active[index];
    if (batch.status === "fulfilled") {
      signals.push(...batch.value);
    } else {
      errors.push({
        sourceId: source.id,
        sourceName: source.name,
        message: batch.reason instanceof Error ? batch.reason.message : String(batch.reason),
      });
    }
  });
  return { signals, errors };
}

async function fetchSource(source, options) {
  switch (source.type) {
    case "rss":
      return fetchRssSource(source, options);
    case "github-trending":
      return fetchGitHubTrending(source, options);
    case "github-search":
      return fetchGitHubSearchSource(source, options);
    case "github-repos":
      return fetchGitHubReposSource(source, options);
    case "hacker-news-search":
      return fetchHackerNewsSearchSource(source, options);
    case "rsshub":
      return fetchRssHubSource(source, options);
    case "folo":
      return fetchFoloSource(source, options);
    case "ai-search":
      return fetchAISearchSource(source, options);
    case "aibase-news":
      return fetchAibaseNewsSource(source, options);
    default:
      throw new Error(`Unsupported source adapter: ${source.type}`);
  }
}
