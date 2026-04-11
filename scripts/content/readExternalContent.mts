import fs from "node:fs";
import path from "node:path";
import type { ExternalContentRecord } from "../../src/lib/content/types.js";

const EXTERNAL_CONTENT_PATH = path.resolve("content/external/items.json");

function isLocalizedChineseSummary(summary: string): boolean {
  return /[\u4e00-\u9fff]/.test(summary) && !/的外部内容摘要。$/.test(summary);
}

export function readExternalContent(): ExternalContentRecord[] {
  if (!fs.existsSync(EXTERNAL_CONTENT_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(EXTERNAL_CONTENT_PATH, "utf8");
  const items = JSON.parse(raw) as ExternalContentRecord[];

  for (const item of items) {
    if (!isLocalizedChineseSummary(item.summary)) {
      throw new Error(
        `外部内容 ${item.slug} 的 summary 必须是 AI 自行归纳后的中文摘要，不能直接发布英文摘录或占位文本。`,
      );
    }
  }

  return items;
}
