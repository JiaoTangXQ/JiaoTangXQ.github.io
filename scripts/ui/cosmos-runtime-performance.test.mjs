import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

test("cosmos home does not load the full search index on first paint", () => {
  const cosmosPage = read("src/routes/CosmosPage.tsx");

  assert.equal(cosmosPage.includes("search-index.json"), false);
  assert.doesNotMatch(cosmosPage, /setSearchIndex/);
});

test("article route and markdown fallback stay out of the initial route bundle", () => {
  const app = read("src/app/App.tsx");
  const articlePage = read("src/routes/ArticlePage.tsx");

  assert.match(app, /const ArticlePage = lazy\(\(\) =>\s*import\("\.\.\/routes\/ArticlePage"\)/s);
  assert.doesNotMatch(app, /import \{ ArticlePage \} from/);
  assert.doesNotMatch(articlePage, /^import .* from "unified";/m);
  assert.match(articlePage, /import\("unified"\)/);
});

test("search palette is mounted only while open and caps rendered results", () => {
  const viewport = read("src/features/cosmos/components/CosmosViewport.tsx");
  const searchPalette = read("src/features/cosmos/components/SearchPalette.tsx");

  assert.match(viewport, /searchOpen\s*&&\s*\(/);
  assert.match(searchPalette, /SEARCH_RESULT_LIMIT/);
  assert.match(searchPalette, /\.slice\(0,\s*SEARCH_RESULT_LIMIT\)/);
  assert.match(searchPalette, /Math\.max\(results\.length - 1,\s*0\)/);
});

test("repeated hover events do not schedule redundant React updates", () => {
  const viewport = read("src/features/cosmos/components/CosmosViewport.tsx");

  assert.match(viewport, /hoveredSlugRef/);
  assert.match(viewport, /hoveredSlugRef\.current\s*===\s*slug/);
});

test("dom camera sync starts from a real camera value", () => {
  const viewport = read("src/features/cosmos/components/CosmosViewport.tsx");

  assert.doesNotMatch(viewport, /prevDomCamRef\s*=\s*useRef\(\{\s*x:\s*NaN/);
  assert.match(viewport, /const s = cam\._stateRef\.current;\s*return \{ x: s\.x, y: s\.y, zoom: s\.zoom \};/s);
});

test("search index loading and MiniSearch construction are lazy", () => {
  const searchPalette = read("src/features/cosmos/components/SearchPalette.tsx");
  const buildSearchIndex = read("scripts/content/buildSearchIndex.mts");

  assert.match(searchPalette, /loadSearchIndex/);
  assert.match(searchPalette, /if\s*\(!open\)\s*return/);
  assert.match(searchPalette, /if\s*\(!hasQuery\)\s*return/);
  assert.match(searchPalette, /if\s*\(!searchIndex\.length/);
  assert.match(searchPalette, /const hasQuery = deferredQuery\.trim\(\)\.length > 0/);
  assert.match(searchPalette, /!searchIndex\.length\s*\|\|\s*!hasQuery/);
  assert.match(searchPalette, /\}, \[searchIndex,\s*hasQuery\]\)/);
  assert.match(buildSearchIndex, /const SEARCH_BODY_SNIPPET_LENGTH = 360/);
});

test("node emphasis animation does not scan every node forever", () => {
  const nodeLayer = read("src/features/cosmos/scene/NodeLayer.tsx");

  assert.match(nodeLayer, /emphasisTargets/);
  assert.match(nodeLayer, /emphasisAnimatingRef/);
  assert.match(nodeLayer, /if\s*\(!emphasisAnimatingRef\.current\)\s*return/);
});

test("heavy scene and label trees are memoized from unrelated UI updates", () => {
  const cosmosScene = read("src/features/cosmos/scene/CosmosScene.tsx");
  const nodeLabels = read("src/features/cosmos/components/NodeLabels.tsx");

  assert.match(cosmosScene, /export const CosmosScene = memo\(CosmosSceneImpl\)/);
  assert.match(nodeLabels, /export const NodeLabels = memo\(NodeLabelsImpl\)/);
});

test("cosmos canvas uses a bounded production quality budget", () => {
  const cosmosScene = read("src/features/cosmos/scene/CosmosScene.tsx");
  const starField = read("src/features/cosmos/scene/StarFieldLayer.tsx");

  assert.match(cosmosScene, /dpr=\{\[1,\s*1\.5\]\}/);
  assert.match(starField, /const STAR_COUNT = 8000/);
});

test("article transition keeps navigation responsive", () => {
  const transition = read("src/features/cosmos/camera/useZoomTransition.ts");
  const articlePage = read("src/routes/ArticlePage.tsx");

  assert.match(transition, /const ZOOM_DURATION = 420/);
  assert.match(transition, /const FADE_DURATION = 260/);
  assert.match(articlePage, /setTimeout\(\(\) => \{\s*navigate\(`\/\$\{location\.hash\}`\);\s*\}, 260\)/s);
});
