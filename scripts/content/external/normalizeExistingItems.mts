/**
 * Re-apply the current external-content rules to the checked-in cache.
 *
 * Use this after changing sanitizeContent / chinaPoliticsFilter / quality rules,
 * or when auditing legacy content. The live refresh pipeline only processes new
 * slugs, so existing records need this explicit pass to pick up rule changes.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ExternalContentRecord } from "../../../src/lib/content/types.js";
import {
  detectLanguage,
  extractPreview,
  htmlToPlainText,
  sanitizeHtml,
} from "./sanitizeContent.mjs";
import { getChinaPoliticalContentReason } from "./chinaPoliticsFilter.mjs";

const ITEMS_PATH = path.resolve("content/external/items.json");

export type NormalizeExistingStats = {
  total: number;
  kept: number;
  droppedChinaPolitics: number;
  sanitized: number;
  previewChanged: number;
  languageChanged: number;
  dropped: Array<{
    slug: string;
    title: string;
    reason: string;
  }>;
};

export function normalizeExternalRecords(records: ExternalContentRecord[]): {
  records: ExternalContentRecord[];
  stats: NormalizeExistingStats;
} {
  const normalized: ExternalContentRecord[] = [];
  const stats: NormalizeExistingStats = {
    total: records.length,
    kept: 0,
    droppedChinaPolitics: 0,
    sanitized: 0,
    previewChanged: 0,
    languageChanged: 0,
    dropped: [],
  };

  for (const item of records) {
    const politicalReason = getChinaPoliticalContentReason(item);
    if (politicalReason) {
      stats.droppedChinaPolitics += 1;
      stats.dropped.push({
        slug: item.slug,
        title: item.title,
        reason: politicalReason,
      });
      continue;
    }

    const content = sanitizeHtml(item.content ?? "", item.sourceUrl);
    const preview = extractPreview(content, 120);
    const plainSample = htmlToPlainText(content);
    const language =
      item.language ??
      detectLanguage(`${item.title} ${plainSample.slice(0, 200)}`);

    if (content !== item.content) stats.sanitized += 1;
    if (preview !== item.preview) stats.previewChanged += 1;
    if (language !== item.language) stats.languageChanged += 1;

    normalized.push({
      ...item,
      language,
      content,
      preview,
    });
  }

  normalized.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  stats.kept = normalized.length;

  return { records: normalized, stats };
}

function readItems(): ExternalContentRecord[] {
  if (!fs.existsSync(ITEMS_PATH)) return [];
  return JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
}

function writeItems(records: ExternalContentRecord[]) {
  fs.mkdirSync(path.dirname(ITEMS_PATH), { recursive: true });
  fs.writeFileSync(ITEMS_PATH, JSON.stringify(records, null, 2));
}

function printStats(stats: NormalizeExistingStats) {
  console.log(
    `✓ external items normalized: kept ${stats.kept}/${stats.total}; ` +
      `dropped China politics ${stats.droppedChinaPolitics}; ` +
      `content changed ${stats.sanitized}; preview changed ${stats.previewChanged}`,
  );

  for (const item of stats.dropped.slice(0, 12)) {
    console.log(`  - ${item.slug}: ${item.reason} · ${item.title}`);
  }
  if (stats.dropped.length > 12) {
    console.log(`  ... ${stats.dropped.length - 12} more dropped items`);
  }
}

async function main() {
  const current = readItems();
  const { records, stats } = normalizeExternalRecords(current);
  writeItems(records);
  printStats(stats);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
