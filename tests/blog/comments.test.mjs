import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readProjectFile(relativePath) {
  try {
    return await readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
  } catch {
    assert.fail(`${relativePath} should exist`);
  }
}

test("post pages render giscus comments with the generated repository config", async () => {
  const postPageSource = await readProjectFile("src/pages/posts/[slug].astro");

  assert.match(postPageSource, /import GiscusComments from "@\/components\/GiscusComments\.astro";/);
  assert.match(postPageSource, /<GiscusComments\s*\/>/);

  const commentsSource = await readProjectFile("src/components/GiscusComments.astro");

  assert.match(commentsSource, /src="https:\/\/giscus\.app\/client\.js"/);
  assert.match(commentsSource, /data-repo="JiaoTangXQ\/JiaoTangXQ\.github\.io"/);
  assert.match(commentsSource, /data-repo-id="R_kgDORzB-nw"/);
  assert.match(commentsSource, /data-category="Announcements"/);
  assert.match(commentsSource, /data-category-id="DIC_kwDORzB-n84C9cAS"/);
  assert.match(commentsSource, /data-mapping="pathname"/);
  assert.match(commentsSource, /data-strict="1"/);
  assert.match(commentsSource, /data-theme="preferred_color_scheme"/);
  assert.match(commentsSource, /data-lang="zh-CN"/);
  assert.match(commentsSource, /data-loading="lazy"/);
});
