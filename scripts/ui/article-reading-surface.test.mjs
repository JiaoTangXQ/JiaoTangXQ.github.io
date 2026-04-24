import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

test("article layout exposes a dedicated reading surface and prose wrapper", () => {
  const layout = read("src/features/articles/ArticleLayout.tsx");

  assert.match(layout, /className="article-reading-shell"/);
  assert.match(layout, /className="article-body-wrap"/);
  assert.match(layout, /className=\{`article-body article-enter article-body--prose/);
  assert.match(layout, /article-body--external/);
});

test("article reading surface uses production reading typography", () => {
  const css = read("src/styles/article.css");

  assert.match(css, /--article-measure:\s*760px/);
  assert.match(css, /--article-prose-size:\s*clamp\(17px,\s*1\.08vw,\s*18\.5px\)/);
  assert.match(css, /line-height:\s*1\.92/);
  assert.match(css, /text-wrap:\s*pretty/);
  assert.match(css, /hanging-punctuation:\s*allow-end/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
});

test("article prose handles rich content without overflowing the viewport", () => {
  const css = read("src/styles/article.css");

  assert.match(css, /\.article-body a[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.article-body :where\(pre\)[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.article-body :where\(table\)[\s\S]*display:\s*block/);
  assert.match(css, /\.article-body :where\(table\)[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.article-body :where\(iframe,\s*video,\s*embed,\s*object\)/);
  assert.match(css, /\.article-body :where\(img,\s*svg,\s*canvas,\s*video,\s*iframe\)[\s\S]*max-width:\s*100%/);
});

test("article prose includes deliberate treatments for code, quotes, figures, and details", () => {
  const css = read("src/styles/article.css");

  assert.match(css, /\.article-body :where\(code\):not\(pre code\)/);
  assert.match(css, /\.article-body :where\(blockquote\)::before/);
  assert.match(css, /\.article-body :where\(figure\)/);
  assert.match(css, /\.article-body :where\(figcaption\)/);
  assert.match(css, /\.article-body :where\(details\)/);
  assert.match(css, /\.article-body :where\(kbd\)/);
  assert.match(css, /\.article-body :where\(mark\)/);
});
