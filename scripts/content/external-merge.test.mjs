import test from "node:test";
import assert from "node:assert/strict";

import { readExternalContent } from "./readExternalContent.mts";
import { buildCosmosData } from "./buildCosmosData.mts";
import { buildSearchIndexEntries } from "./buildSearchIndex.mts";

test("cached external content is merged into cosmos and search outputs", () => {
  const externalItems = readExternalContent();
  if (externalItems.length === 0) return; // fresh checkout, no data yet

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

test("merged cosmos and search outputs do not contain duplicate slugs", () => {
  const externalItems = readExternalContent();
  const cosmos = buildCosmosData();
  const searchEntries = buildSearchIndexEntries();

  assert.equal(
    new Set(externalItems.map((item) => item.slug)).size,
    externalItems.length,
    "expected unique external item slugs",
  );
  assert.equal(
    new Set(cosmos.nodes.map((node) => node.slug)).size,
    cosmos.nodes.length,
    "expected unique cosmos node slugs",
  );
  assert.equal(
    new Set(searchEntries.map((entry) => entry.slug)).size,
    searchEntries.length,
    "expected unique search entry slugs",
  );
});
