/**
 * 把 items.json 拆成单文件 JSON 供前端按 slug 按需加载。
 * 避免前端为了看一条外部文章把整个 items.json（几十 MB）加载下来。
 *
 * 输出到 public/data/external/{slug}.json。
 */
import fs from "node:fs";
import path from "node:path";
import { readExternalContent } from "./readExternalContent.mjs";

const OUT_DIR = path.resolve("public/data/external");

function main() {
  const items = readExternalContent();
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const item of items) {
    const payload = {
      slug: item.slug,
      title: item.title,
      content: item.content,
      preview: item.preview,
      date: item.date,
      topics: item.topics,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      sourceDomain: item.sourceDomain,
      language: item.language,
    };
    fs.writeFileSync(
      path.join(OUT_DIR, `${item.slug}.json`),
      JSON.stringify(payload),
    );
  }

  console.log(`✓ external articles: ${items.length} 条按 slug 拆分到 ${path.relative(process.cwd(), OUT_DIR)}/`);
}

main();
