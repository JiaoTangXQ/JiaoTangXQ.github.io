import fs from "fs";
import path from "path";
import { readArticles } from "./readArticles.mjs";
import { readExternalContent } from "./readExternalContent.mjs";
import type { SearchIndexEntry } from "../../src/lib/content/types.js";

/** Extract a plain-text snippet from HTML for search indexing. */
function htmlToSnippet(html: string, maxLen = 800): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function buildSearchIndexEntries(): SearchIndexEntry[] {
  const articles: SearchIndexEntry[] = readArticles().map((article) => ({
    slug: article.slug,
    title: article.title,
    preview: article.summary ?? "",
    topics: article.topics,
    date: article.date,
    cluster: article.topics[0] ?? "其他",
    body: article.body.slice(0, 800),
    contentType: "local" as const,
    language: "zh",
  }));

  const externalItems: SearchIndexEntry[] = readExternalContent().map((item) => ({
    slug: item.slug,
    title: item.title,
    preview: item.preview,
    topics: item.topics,
    date: item.date,
    cluster: item.topics[0] ?? "其他",
    body: htmlToSnippet(item.content ?? "", 800),
    contentType: item.contentType,
    language: item.language,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    sourceDomain: item.sourceDomain,
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
