import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { filterRecentCandidates } from "./refreshExternalContent.mts";
import { normalizeFeedItems } from "./external/normalizeFeedItems.mts";
import { summarizeExternalItems } from "./external/summarizeExternalItems.mts";
import { scoreExternalItems } from "./external/scoreExternalItems.mts";

const TEST_SOURCE = {
  id: "test-source",
  name: "Test Source",
  siteUrl: "https://example.com",
  feedUrl: "https://example.com/feed.xml",
  defaultTopics: ["技术", "思考"],
  enabled: true,
};

test("fixture feed can become approved external discovery items", async () => {
  const fixturePath = path.resolve("scripts/content/external/fixtures/sample-feed.xml");
  const xml = fs.readFileSync(fixturePath, "utf8");

  const candidates = normalizeFeedItems({ xml, source: TEST_SOURCE });
  const summarized = await summarizeExternalItems(candidates, {
    summarizeCandidate: async (candidate) => ({
      summary: `${candidate.title} 的摘要`,
      whyWorthReading: `${candidate.title} 值得一读，因为它把陌生议题带进日常视野。`,
    }),
  });
  const approved = scoreExternalItems(summarized, {
    existingTitles: [],
    minScore: 0,
  });

  assert.equal(approved.length, 2);
  assert.equal(approved[0].contentType, "external");
  assert.equal(approved[0].sourceName, TEST_SOURCE.name);
  assert.equal(approved[0].sourceUrl, "https://example.com/library-climate-shelters");
  assert.ok(approved[0].summary.length > 0);
  assert.ok(approved[0].whyWorthReading.length > 0);
});

test("source maxItems keeps only the newest feed entries", () => {
  const fixturePath = path.resolve("scripts/content/external/fixtures/sample-feed.xml");
  const xml = fs.readFileSync(fixturePath, "utf8");

  const candidates = normalizeFeedItems({
    xml,
    source: {
      ...TEST_SOURCE,
      id: "limited-source",
      maxItems: 1,
    },
  });

  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].sourceUrl,
    "https://example.com/library-climate-shelters",
  );
});

test("recentness filter keeps only candidates from the last 30 days", () => {
  const recentCandidates = filterRecentCandidates(
    [
      {
        slug: "recent-item",
        title: "Recent item",
        date: "2026-04-05T08:00:00.000Z",
        topics: ["技术"],
        sourceName: "Recent Source",
        sourceUrl: "https://example.com/recent",
        sourceDomain: "example.com",
        rawExcerpt: "Recent content",
      },
      {
        slug: "stale-item",
        title: "Stale item",
        date: "2026-02-20T08:00:00.000Z",
        topics: ["技术"],
        sourceName: "Recent Source",
        sourceUrl: "https://example.com/stale",
        sourceDomain: "example.com",
        rawExcerpt: "Older content",
      },
    ],
    30,
    new Date("2026-04-10T08:00:00.000Z"),
  );

  assert.deepEqual(
    recentCandidates.map((candidate) => candidate.slug),
    ["recent-item"],
  );
});

test("same-source repeated titles get stable unique slugs", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title>Methodology</title>
        <link>https://example.com/global/2026/04/07/methodology-us-views-of-iran/</link>
        <pubDate>Fri, 10 Apr 2026 08:00:00 GMT</pubDate>
        <description>First methodology article.</description>
      </item>
      <item>
        <title>Methodology</title>
        <link>https://example.com/science/2026/04/07/health-information-methodology/</link>
        <pubDate>Fri, 10 Apr 2026 07:00:00 GMT</pubDate>
        <description>Second methodology article.</description>
      </item>
    </channel>
  </rss>`;

  const candidates = normalizeFeedItems({
    xml,
    source: {
      ...TEST_SOURCE,
      id: "repeated-title-source",
    },
  });

  assert.equal(candidates.length, 2);
  assert.notEqual(candidates[0].slug, candidates[1].slug);
  assert.match(candidates[0].slug, /^ext-repeated-title-source-methodology/);
  assert.match(candidates[1].slug, /^ext-repeated-title-source-methodology/);
});
