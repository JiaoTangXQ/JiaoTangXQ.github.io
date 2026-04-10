import test from "node:test";
import assert from "node:assert/strict";

import { readExternalContent } from "./readExternalContent.mts";
import { buildCosmosData } from "./buildCosmosData.mts";
import { buildSearchIndexEntries } from "./buildSearchIndex.mts";

test("cached external content is merged into cosmos and search outputs", () => {
  const externalItems = readExternalContent();
  assert.ok(externalItems.length > 0, "expected seeded external content");

  const cosmos = buildCosmosData();
  const searchEntries = buildSearchIndexEntries();

  const externalNode = cosmos.nodes.find(
    (node) => node.slug === externalItems[0].slug,
  );
  const externalSearchEntry = searchEntries.find(
    (entry) => entry.slug === externalItems[0].slug,
  );

  assert.ok(externalNode, "expected external node in cosmos data");
  assert.equal(externalNode?.contentType, "external");
  assert.equal(externalNode?.sourceName, externalItems[0].sourceName);
  assert.equal(externalNode?.sourceUrl, externalItems[0].sourceUrl);

  assert.ok(externalSearchEntry, "expected external entry in search index");
  assert.equal(externalSearchEntry?.contentType, "external");
  assert.equal(externalSearchEntry?.sourceName, externalItems[0].sourceName);
  assert.equal(externalSearchEntry?.sourceUrl, externalItems[0].sourceUrl);
});
