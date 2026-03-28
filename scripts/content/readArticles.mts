import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { ArticleRecord, CoverConfig } from "../../src/lib/content/types.js";

const ARTICLES_DIR = path.resolve("content/articles");

export function readArticles(): ArticleRecord[] {
  const files = fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), "utf-8");
    const { data, content } = matter(raw);

    return {
      title: data.title as string,
      slug: data.slug as string,
      date: String(data.date),
      topics: (data.topics as string[]) ?? [],
      summary: data.summary as string,
      cover: (data.cover as CoverConfig) ?? { style: "gradient" },
      importance: (data.importance as number) ?? 1.0,
      body: content,
    };
  });
}
