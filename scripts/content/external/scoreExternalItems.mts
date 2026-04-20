import type { ExternalContentRecord, ContentCategory } from "../../../src/lib/content/types.js";

type ScoreExternalItemsOptions = {
  existingTitles?: string[];
  minScore?: number;
};

/** Content categories that should be filtered out — low information density. */
const EXCLUDED_CATEGORIES = new Set<ContentCategory>([
  "announcement",
  "obituary",
  "event",
]);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function scoreExternalItems(
  items: ExternalContentRecord[],
  options: ScoreExternalItemsOptions = {},
): ExternalContentRecord[] {
  const minScore = options.minScore ?? 0.6;
  const existingTitleSet = new Set(
    (options.existingTitles ?? []).map(normalizeKey),
  );
  const seenKeys = new Set<string>();

  return items
    .filter((item) => {
      // Filter out low-value content categories
      if (item.contentCategory && EXCLUDED_CATEGORIES.has(item.contentCategory)) {
        return false;
      }
      return true;
    })
    .map((item) => {
      let noveltyScore = item.noveltyScore;

      // Penalize duplicate titles
      if (existingTitleSet.has(normalizeKey(item.title))) {
        noveltyScore = Math.max(0, noveltyScore - 0.3);
      }

      return {
        ...item,
        noveltyScore: Number(noveltyScore.toFixed(2)),
      };
    })
    .filter((item) => {
      // Deduplicate by (sourceUrl, title) key
      const key = normalizeKey(`${item.sourceUrl}::${item.title}`);
      if (seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);

      return item.noveltyScore >= minScore;
    })
    .sort((a, b) => b.noveltyScore - a.noveltyScore);
}
