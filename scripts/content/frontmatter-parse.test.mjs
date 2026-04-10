import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

test("all article frontmatter parses as valid YAML", () => {
  const articlesDir = path.resolve("content/articles");
  const files = fs
    .readdirSync(articlesDir)
    .filter((file) => file.endsWith(".md"))
    .sort();

  const failures = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(articlesDir, file), "utf8");
    try {
      matter(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${file}: ${message}`);
    }
  }

  assert.deepEqual(failures, []);
});

test("all article slugs use lowercase letters, numbers, and hyphens only", () => {
  const articlesDir = path.resolve("content/articles");
  const files = fs
    .readdirSync(articlesDir)
    .filter((file) => file.endsWith(".md"))
    .sort();

  const invalidSlugs = [];
  const slugPattern = /^[a-z0-9-]+$/;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(articlesDir, file), "utf8");
    const { data } = matter(raw);
    const slug = String(data.slug ?? "");

    if (!slugPattern.test(slug)) {
      invalidSlugs.push(`${file}: ${JSON.stringify(slug)}`);
    }
  }

  assert.deepEqual(invalidSlugs, []);
});
