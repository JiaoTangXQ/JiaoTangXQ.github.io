import fs from "fs";
import path from "path";
import { readArticles } from "./readArticles.mjs";
import { readExternalContent } from "./readExternalContent.mjs";
import type { SearchIndexEntry } from "../../src/lib/content/types.js";

export function buildSearchIndexEntries(): SearchIndexEntry[] {
  const articles = readArticles().map((article) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    topics: article.topics,
    date: article.date,
    cluster: article.topics[0] ?? "其他",
    body: article.body.slice(0, 500),
    contentType: "local" as const,
  }));

  const externalItems = readExternalContent().map((item) => ({
    slug: item.slug,
    title: item.title,
    titleZh: item.titleZh,
    summary: item.summary,
    topics: item.topics,
    date: item.date,
    cluster: item.topics[0] ?? "其他",
    body: `${item.titleZh ?? ""} ${item.summary} ${item.whyWorthReading}`.trim(),
    contentType: item.contentType,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    sourceDomain: item.sourceDomain,
    whyWorthReading: item.whyWorthReading,
  }));

  return [...articles, ...externalItems];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const entries = buildSearchIndexEntries();
  const outDir = path.resolve("public/data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "search-index.json"),
    JSON.stringify(entries, null, 2),
  );
  console.log(`✓ search-index.json: ${entries.length} entries`);
}
