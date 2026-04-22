import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { ArticleRecord, CoverConfig } from "../../src/lib/content/types.js";

const ARTICLES_DIR = path.resolve("content/articles");

/**
 * Derive a plain-text preview from raw Markdown body.
 * Strips headings, code fences, inline markup and HTML tags, then truncates to maxLen.
 */
function derivePreview(body: string, maxLen = 120): string {
  const plain = body
    // Drop fenced code blocks entirely
    .replace(/```[\s\S]*?```/g, " ")
    // Drop inline code
    .replace(/`[^`]*`/g, " ")
    // Drop HTML tags
    .replace(/<[^>]+>/g, " ")
    // Drop markdown images ![alt](url) and links, keep link text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Strip heading markers, blockquote markers, list markers, hr
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*[-*_]{3,}\s*$/gm, " ")
    // Strip emphasis markers
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLen) return plain;
  const slice = plain.slice(0, maxLen);
  const lastPunct = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("."),
    slice.lastIndexOf("！"),
    slice.lastIndexOf("? "),
  );
  if (lastPunct > maxLen * 0.6) return slice.slice(0, lastPunct + 1);
  return slice.trimEnd() + "…";
}

export function readArticles(): ArticleRecord[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
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
      cover: (data.cover as CoverConfig) ?? { style: "gradient" },
      importance: (data.importance as number) ?? 1.0,
      body: content,
      preview: derivePreview(content),
    };
  });
}
