import fs from "node:fs";
import path from "node:path";
import type { ExternalContentRecord } from "../../src/lib/content/types.js";

const EXTERNAL_CONTENT_PATH = path.resolve("content/external/items.json");

function assertUniqueSlugs(items: ExternalContentRecord[]) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.slug)) {
      throw new Error(`外部内容 slug 重复：${item.slug}。请先去重后再构建。`);
    }
    seen.add(item.slug);
  }
}

/**
 * Load all external content records from items.json.
 *
 * No content filtering happens here — the refresh pipeline is expected to
 * have already applied rule-based quality filters. Anything in items.json
 * ships to the cosmos verbatim.
 */
export function readExternalContent(): ExternalContentRecord[] {
  if (!fs.existsSync(EXTERNAL_CONTENT_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(EXTERNAL_CONTENT_PATH, "utf8");
  const items = JSON.parse(raw) as ExternalContentRecord[];
  assertUniqueSlugs(items);

  return items;
}
