import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readSourceRegistry } from "./external/readSourceRegistry.mjs";
import { normalizeFeedItems } from "./external/normalizeFeedItems.mjs";
import { summarizeExternalItems } from "./external/summarizeExternalItems.mjs";
import { scoreExternalItems } from "./external/scoreExternalItems.mjs";

test("fixture feed can become approved external discovery items", async () => {
  const fixturePath = path.resolve("scripts/content/external/fixtures/sample-feed.xml");
  const xml = fs.readFileSync(fixturePath, "utf8");
  const [source] = readSourceRegistry();

  const candidates = normalizeFeedItems({ xml, source });
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
  assert.equal(approved[0].sourceName, source.name);
  assert.equal(approved[0].sourceUrl, "https://example.com/library-climate-shelters");
  assert.ok(approved[0].summary.length > 0);
  assert.ok(approved[0].whyWorthReading.length > 0);
});
