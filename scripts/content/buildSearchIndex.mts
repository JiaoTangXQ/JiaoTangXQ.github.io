import fs from "fs";
import path from "path";
import { readArticles } from "./readArticles.mjs";
import type { SearchIndexEntry } from "../../src/lib/content/types.js";

const articles = readArticles();

const entries: SearchIndexEntry[] = articles.map((a) => ({
  slug: a.slug,
  title: a.title,
  summary: a.summary,
  topics: a.topics,
  date: a.date,
  cluster: a.topics[0] ?? "其他",
  body: a.body.slice(0, 500),
}));

const outDir = path.resolve("public/data");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "search-index.json"),
  JSON.stringify(entries, null, 2),
);
console.log(`✓ search-index.json: ${entries.length} entries`);
