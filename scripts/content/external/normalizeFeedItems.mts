import { createHash } from "node:crypto";
import type {
  ExternalContentCandidate,
  ExternalSource,
} from "../../../src/lib/content/types.js";

type NormalizeFeedItemsArgs = {
  xml: string;
  source: ExternalSource;
};

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function compactWhitespace(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTagValue(block: string, tag: string): string {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = block.match(pattern);
  return match ? compactWhitespace(decodeXmlEntities(match[1])) : "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

function shortUrlHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

export function normalizeFeedItems({
  xml,
  source,
}: NormalizeFeedItemsArgs): ExternalContentCandidate[] {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const sourceDomain = new URL(source.siteUrl).hostname;

  const items = itemBlocks
    .map((block) => {
      const title = extractTagValue(block, "title");
      const sourceUrl =
        extractTagValue(block, "link") || extractTagValue(block, "guid");
      const date =
        extractTagValue(block, "pubDate") ||
        extractTagValue(block, "published") ||
        extractTagValue(block, "updated");
      const rawExcerpt =
        extractTagValue(block, "description") ||
        extractTagValue(block, "content:encoded") ||
        extractTagValue(block, "summary");

      if (!title || !sourceUrl) {
        return null;
      }

      const slugBase = `ext-${source.id}-${slugify(title) || "external-item"}`;

      return {
        slug: slugBase,
        title,
        date: normalizeDate(date),
        topics: source.defaultTopics,
        sourceName: source.name,
        sourceUrl,
        sourceDomain,
        rawExcerpt,
      } satisfies ExternalContentCandidate;
    })
    .filter((item): item is ExternalContentCandidate => item !== null);

  const slugCounts = new Map<string, number>();
  for (const item of items) {
    slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
  }

  const dedupedItems = items.map((item) => {
    if ((slugCounts.get(item.slug) ?? 0) === 1) {
      return item;
    }

    return {
      ...item,
      slug: `${item.slug}-${shortUrlHash(item.sourceUrl)}`,
    };
  });

  dedupedItems.sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
  );

  const maxItems = source.maxItems ?? dedupedItems.length;
  return dedupedItems.slice(0, Math.max(maxItems, 0));
}
