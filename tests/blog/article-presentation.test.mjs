import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = new URL("../../", import.meta.url);

async function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, repoRoot), "utf8");
}

test("html post fragments do not duplicate the page-level article header", async () => {
  const postsRoot = new URL("src/content/html-posts/", repoRoot);
  const entries = await readdir(postsRoot, { withFileTypes: true });
  const offenders = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const source = await readFile(path.join(postsRoot.pathname, entry.name, "index.html"), "utf8");
    if (/<header\s+class="html-post__header"|<h1[\s>]/.test(source)) offenders.push(entry.name);
  }

  assert.deepEqual(offenders, []);
});

test("article page titles use article-scale type, not hero-scale type", async () => {
  const css = await readProjectFile("src/styles/global.css");

  assert.match(css, /\.article-header h1\s*\{[^}]*font-size:\s*clamp\(2\.1rem,\s*4\.2vw,\s*3\.8rem\)/s);
  assert.doesNotMatch(css, /\.article-header h1\s*\{[^}]*font-size:\s*clamp\(2\.4rem,\s*6vw,\s*5rem\)/s);
});
