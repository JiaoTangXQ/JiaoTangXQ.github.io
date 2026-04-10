import type { ExternalContentRecord } from "../../../src/lib/content/types.js";

type ScoreExternalItemsOptions = {
  existingTitles?: string[];
  minScore?: number;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

export function scoreExternalItems(
  items: ExternalContentRecord[],
  options: ScoreExternalItemsOptions = {},
): ExternalContentRecord[] {
  const minScore = options.minScore ?? 0.5;
  const existingTitleSet = new Set(
    (options.existingTitles ?? []).map(normalizeKey),
  );
  const seenKeys = new Set<string>();

  return items
    .map((item) => {
      let noveltyScore = 0.5;

      if (!existingTitleSet.has(normalizeKey(item.title))) {
        noveltyScore += 0.35;
      }

      if (item.summary.length >= 40) {
        noveltyScore += 0.1;
      }

      if (item.topics.length > 1) {
        noveltyScore += 0.05;
      }

      return {
        ...item,
        noveltyScore: Number(noveltyScore.toFixed(2)),
      };
    })
    .filter((item) => {
      const key = normalizeKey(`${item.sourceUrl}::${item.title}`);
      if (seenKeys.has(key)) {
        return false;
      }

      seenKeys.add(key);
      return item.noveltyScore >= minScore;
    });
}
