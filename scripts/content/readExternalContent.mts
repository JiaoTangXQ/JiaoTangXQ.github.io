import fs from "node:fs";
import path from "node:path";
import type { ExternalContentRecord } from "../../src/lib/content/types.js";

const EXTERNAL_CONTENT_PATH = path.resolve("content/external/items.json");

function isLocalizedChineseSummary(summary: string): boolean {
  return /[\u4e00-\u9fff]/.test(summary) && !/的外部内容摘要。$/.test(summary);
}

function assertUniqueSlugs(items: ExternalContentRecord[]) {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.slug)) {
      throw new Error(`外部内容 slug 重复：${item.slug}。请先去重后再构建。`);
    }

    seen.add(item.slug);
  }
}

export function readExternalContent(): ExternalContentRecord[] {
  if (!fs.existsSync(EXTERNAL_CONTENT_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(EXTERNAL_CONTENT_PATH, "utf8");
  const items = JSON.parse(raw) as ExternalContentRecord[];
  assertUniqueSlugs(items);

  const badItems: string[] = [];
  for (const item of items) {
    if (!isLocalizedChineseSummary(item.summary)) {
      badItems.push(item.slug);
    }
  }

  if (badItems.length > 0) {
    console.warn(
      `⚠ ${badItems.length} 条外部内容的 summary 不是中文摘要，将在构建中跳过：\n  ${badItems.slice(0, 5).join("\n  ")}${badItems.length > 5 ? `\n  ...及其他 ${badItems.length - 5} 条` : ""}`,
    );
    return items.filter((item) => isLocalizedChineseSummary(item.summary));
  }

  return items;
}
