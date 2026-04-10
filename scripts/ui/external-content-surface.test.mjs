import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

test("external content surfaces are clearly labeled and link out to the source", () => {
  const articlePage = read("src/routes/ArticlePage.tsx");
  const articleLayout = read("src/features/articles/ArticleLayout.tsx");
  const nearbyPlanets = read("src/features/articles/NearbyPlanets.tsx");
  const summaryCard = read("src/features/cosmos/components/SummaryCard.tsx");
  const searchPalette = read("src/features/cosmos/components/SearchPalette.tsx");

  assert.match(articlePage, /contentType\s*===\s*"external"/);
  assert.match(articleLayout, /外部来源/);
  assert.match(articleLayout, /去看原文/);
  assert.match(summaryCard, /外部来源/);
  assert.match(searchPalette, /外部来源/);
  assert.match(nearbyPlanets, /外部来源/);
});
