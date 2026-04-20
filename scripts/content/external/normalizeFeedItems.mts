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
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}

function compactWhitespace(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTagValue(block: string, tag: string): string {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = block.match(pattern);
  return match ? compactWhitespace(decodeXmlEntities(match[1])) : "";
}

/** Extract href from Atom <link> elements. */
function extractAtomLink(block: string): string {
  // Prefer rel="alternate", fall back to first <link> with href
  const altMatch = block.match(
    /<link[^>]*\brel\s*=\s*["']alternate["'][^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?>/i,
  );
  if (altMatch) return decodeXmlEntities(altMatch[1]);

  const altMatch2 = block.match(
    /<link[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\brel\s*=\s*["']alternate["'][^>]*\/?>/i,
  );
  if (altMatch2) return decodeXmlEntities(altMatch2[1]);

  // Any <link href="...">
  const hrefMatch = block.match(
    /<link[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*\/?>/i,
  );
  return hrefMatch ? decodeXmlEntities(hrefMatch[1]) : "";
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

function isAtomFeed(xml: string): boolean {
  return /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
}

/** Parse an RSS <item> block into a candidate. */
function parseRssItem(
  block: string,
  source: ExternalSource,
  sourceDomain: string,
): ExternalContentCandidate | null {
  const title = extractTagValue(block, "title");
  const sourceUrl =
    extractTagValue(block, "link") || extractTagValue(block, "guid");
  const date =
    extractTagValue(block, "pubDate") ||
    extractTagValue(block, "published") ||
    extractTagValue(block, "updated") ||
    extractTagValue(block, "dc:date");
  const description = extractTagValue(block, "description");
  const contentEncoded = extractTagValue(block, "content:encoded");
  const summary = extractTagValue(block, "summary");
  // Prefer the longest available field — content:encoded usually has the full article
  const rawExcerpt = [contentEncoded, description, summary].reduce(
    (best, cur) => (cur.length > best.length ? cur : best),
    "",
  );

  if (!title || !sourceUrl) return null;

  const slugBase = `ext-${source.id}-${slugify(title) || "external-item"}`;
  return { slug: slugBase, title, date: normalizeDate(date), topics: source.defaultTopics, sourceName: source.name, sourceUrl, sourceDomain, rawExcerpt };
}

/** Parse an Atom <entry> block into a candidate. */
function parseAtomEntry(
  block: string,
  source: ExternalSource,
  sourceDomain: string,
): ExternalContentCandidate | null {
  const title = extractTagValue(block, "title");
  const sourceUrl = extractAtomLink(block) || extractTagValue(block, "id");
  const date =
    extractTagValue(block, "published") ||
    extractTagValue(block, "updated");
  const summary = extractTagValue(block, "summary");
  const content = extractTagValue(block, "content");
  // Prefer the longest available field
  const rawExcerpt = content.length >= summary.length ? content : summary;

  if (!title || !sourceUrl) return null;

  const slugBase = `ext-${source.id}-${slugify(title) || "external-item"}`;
  return { slug: slugBase, title, date: normalizeDate(date), topics: source.defaultTopics, sourceName: source.name, sourceUrl, sourceDomain, rawExcerpt };
}

export function normalizeFeedItems({
  xml,
  source,
}: NormalizeFeedItemsArgs): ExternalContentCandidate[] {
  const sourceDomain = new URL(source.siteUrl).hostname;
  const useAtom = isAtomFeed(xml);

  let items: (ExternalContentCandidate | null)[];

  if (useAtom) {
    const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
    items = entryBlocks.map((block) =>
      parseAtomEntry(block, source, sourceDomain),
    );
  } else {
    const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
    items = itemBlocks.map((block) =>
      parseRssItem(block, source, sourceDomain),
    );
  }

  const validItems = items.filter(
    (item): item is ExternalContentCandidate => item !== null,
  );

  // Deduplicate by slug
  const slugCounts = new Map<string, number>();
  for (const item of validItems) {
    slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
  }

  const dedupedItems = validItems.map((item) => {
    if ((slugCounts.get(item.slug) ?? 0) === 1) {
      return item;
    }
    return {
      ...item,
      slug: `${item.slug}-${shortUrlHash(item.sourceUrl)}`,
    };
  });

  dedupedItems.sort(
    (left, right) =>
      new Date(right.date).getTime() - new Date(left.date).getTime(),
  );

  const maxItems = source.maxItems ?? dedupedItems.length;
  return dedupedItems.slice(0, Math.max(maxItems, 0));
}
