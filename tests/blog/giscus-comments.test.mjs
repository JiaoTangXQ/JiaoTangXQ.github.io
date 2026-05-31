import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readProjectFile(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("article pages render the Giscus comments component", async () => {
  const postPage = await readProjectFile("src/pages/posts/[slug].astro");

  assert.match(postPage, /import GiscusComments from "@\/components\/GiscusComments\.astro"/);
  assert.match(postPage, /<GiscusComments\s+\/>/);
});

test("Giscus comments target this repository discussions category", async () => {
  const component = await readProjectFile("src/components/GiscusComments.astro");

  assert.match(component, /src="https:\/\/giscus\.app\/client\.js"/);
  assert.match(component, /data-repo="JiaoTangXQ\/JiaoTangXQ\.github\.io"/);
  assert.match(component, /data-repo-id="R_kgDORzB-nw"/);
  assert.match(component, /data-category="General"/);
  assert.match(component, /data-category-id="DIC_kwDORzB-n84C9cAT"/);
  assert.match(component, /data-mapping="pathname"/);
  assert.match(component, /data-lang="zh-CN"/);
});
