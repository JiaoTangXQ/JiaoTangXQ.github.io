import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildGraph,
  readHtmlPostsFromDirectory,
  renderWikiLinks,
  resolvePostAssetUrl,
} from "../../src/lib/html-posts.mjs";

async function createPost(root, slug, meta, html) {
  const dir = path.join(root, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "meta.yaml"), meta, "utf8");
  await writeFile(path.join(dir, "index.html"), html, "utf8");
}

test("reads html posts with metadata, wiki concepts, and draft filtering", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "html-posts-"));
  await createPost(
    root,
    "first-note",
    [
      'title: "第一篇笔记"',
      'date: "2026-05-13"',
      'description: "这是一篇用于测试 HTML 博客内容源的说明，长度足够用于摘要展示。"',
      'tags: ["writing", "ai"]',
      "draft: false",
      'ui: "notebook"',
    ].join("\n"),
    "<article><p>这篇文章讨论 [[知识图谱]] 和 [[HTML 博客]]。</p></article>",
  );
  await createPost(
    root,
    "draft-note",
    [
      'title: "草稿"',
      'date: "2026-05-12"',
      'description: "这是一篇不会出现在公开列表里的草稿文章摘要。"',
      'tags: ["draft"]',
      "draft: true",
      'ui: "minimal-essay"',
    ].join("\n"),
    "<article><p>draft</p></article>",
  );

  const posts = await readHtmlPostsFromDirectory(root);
  assert.equal(posts.length, 2);
  assert.deepEqual(
    posts.map((post) => post.slug),
    ["first-note", "draft-note"],
  );
  assert.deepEqual(posts[0].concepts, ["知识图谱", "HTML 博客"]);
  assert.equal(posts[0].url, "/posts/first-note/");
  assert.equal(posts[0].draft, false);
  assert.equal(posts[1].draft, true);
});

test("builds a graph from published posts, tags, and wiki concepts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "html-posts-"));
  await createPost(
    root,
    "first-note",
    [
      'title: "第一篇笔记"',
      'date: "2026-05-13"',
      'description: "这是一篇用于测试 HTML 博客内容源的说明，长度足够用于摘要展示。"',
      'tags: ["writing", "ai"]',
      "draft: false",
      'ui: "notebook"',
    ].join("\n"),
    "<article><p>这篇文章讨论 [[知识图谱]]。</p></article>",
  );

  const graph = buildGraph(await readHtmlPostsFromDirectory(root));
  assert.deepEqual(
    graph.nodes.map((node) => node.id).sort(),
    ["concept:知识图谱", "post:first-note", "tag:ai", "tag:writing"],
  );
  assert.ok(graph.edges.some((edge) => edge.source === "post:first-note" && edge.target === "tag:ai"));
  assert.ok(
    graph.edges.some((edge) => edge.source === "post:first-note" && edge.target === "concept:知识图谱"),
  );
});

test("renders wiki concepts as navigable inline links", () => {
  const html = renderWikiLinks("<p>连接 [[知识图谱]] 和 [[HTML 博客|HTML posts]]。</p>");
  assert.match(html, /href="\/graph\/#%E7%9F%A5%E8%AF%86%E5%9B%BE%E8%B0%B1"/);
  assert.match(html, />知识图谱<\/a>/);
  assert.match(html, /href="\/graph\/#HTML%20%E5%8D%9A%E5%AE%A2"/);
  assert.match(html, />HTML posts<\/a>/);
});

test("resolves local post assets to the public post URL", () => {
  assert.equal(resolvePostAssetUrl("first-note", "./assets/cover.jpg"), "/posts/first-note/assets/cover.jpg");
  assert.equal(resolvePostAssetUrl("first-note", "/images/cover.jpg"), "/images/cover.jpg");
  assert.equal(resolvePostAssetUrl("first-note", "https://example.com/cover.jpg"), "https://example.com/cover.jpg");
});
