# External Discovery Content Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add curated external discovery content to the cosmos using cached RSS ingestion, AI-generated summaries, and clearly labeled on-site summary pages.

**Architecture:** Introduce a separate refresh pipeline that fetches and filters whitelisted external sources into `content/external/items.json`, then merge that cache into the existing static build outputs. Reuse the existing cosmos route structure by making shared content types additive and rendering external entries through the current article route with a source-attributed summary page.

**Tech Stack:** Node 20, TypeScript, tsx scripts, React 19, Vite, Node test runner

---

## Chunk 1: External Refresh Pipeline

### Task 1: Seed the source registry and write the failing refresh test

**Files:**
- Create: `content/external/sources.json`
- Create: `content/external/items.json`
- Create: `scripts/content/external/fixtures/sample-feed.xml`
- Create: `scripts/content/external-refresh.test.mjs`

- [ ] **Step 1: Add a small tracked source registry and empty cache**

Create `content/external/sources.json` with 1-2 enabled sample sources and `content/external/items.json` as an empty array so the build has a deterministic file to read before the first refresh.

- [ ] **Step 2: Write the failing refresh test**

Create `scripts/content/external-refresh.test.mjs` that uses `scripts/content/external/fixtures/sample-feed.xml` and asserts the refresh pipeline can produce an approved item with `contentType`, `sourceName`, `sourceUrl`, `summary`, and `whyWorthReading`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test scripts/content/external-refresh.test.mjs`
Expected: FAIL because the refresh helpers and external types do not exist yet.

- [ ] **Step 4: Commit the scaffolding**

```bash
git add content/external/sources.json content/external/items.json scripts/content/external/fixtures/sample-feed.xml scripts/content/external-refresh.test.mjs
git commit -m "test: add external refresh fixtures"
```

### Task 2: Implement the cached refresh pipeline

**Files:**
- Create: `scripts/content/refreshExternalContent.mts`
- Create: `scripts/content/external/readSourceRegistry.mts`
- Create: `scripts/content/external/normalizeFeedItems.mts`
- Create: `scripts/content/external/summarizeExternalItems.mts`
- Create: `scripts/content/external/scoreExternalItems.mts`
- Modify: `src/lib/content/types.ts`
- Modify: `package.json`

- [ ] **Step 1: Add external content types**

Extend `src/lib/content/types.ts` with additive shared fields for `contentType`, `sourceName`, `sourceUrl`, and `sourceDomain`, plus a dedicated `ExternalContentRecord` type for cached external entries.

- [ ] **Step 2: Implement registry, normalization, summarization, and scoring helpers**

Keep each helper narrow:
- `readSourceRegistry.mts` loads enabled sources.
- `normalizeFeedItems.mts` maps feed XML results into a stable candidate shape.
- `summarizeExternalItems.mts` produces `summary` and `whyWorthReading`.
- `scoreExternalItems.mts` rejects repetitive or weak candidates.

- [ ] **Step 3: Implement `refreshExternalContent.mts`**

Build a script that reads sources, fetches or loads fixtures, runs normalization and scoring, then writes approved items to `content/external/items.json`. Reuse the existing `ANTHROPIC_API_KEY` environment-variable pattern from `scripts/content/aiSuggest.mts`, but keep the script optional and separate from `npm run build`.

- [ ] **Step 4: Add the new refresh command**

Update `package.json` to include a command such as `refresh:external` that runs `tsx scripts/content/refreshExternalContent.mts`.

- [ ] **Step 5: Run the focused refresh test**

Run: `node --test scripts/content/external-refresh.test.mjs`
Expected: PASS

- [ ] **Step 6: Smoke-test the fixture refresh**

Run: `tsx scripts/content/refreshExternalContent.mts --fixture scripts/content/external/fixtures/sample-feed.xml`
Expected: exit 0 and `content/external/items.json` updated with approved external entries.

- [ ] **Step 7: Commit the refresh pipeline**

```bash
git add src/lib/content/types.ts package.json scripts/content/refreshExternalContent.mts scripts/content/external/readSourceRegistry.mts scripts/content/external/normalizeFeedItems.mts scripts/content/external/summarizeExternalItems.mts scripts/content/external/scoreExternalItems.mts content/external/items.json
git commit -m "feat: add cached external content refresh pipeline"
```

## Chunk 2: Merge Cached External Content Into the Static Build

### Task 3: Write the failing merge test and shared reader

**Files:**
- Create: `scripts/content/readExternalContent.mts`
- Create: `scripts/content/external-merge.test.mjs`
- Modify: `scripts/content/buildCosmosData.mts`
- Modify: `scripts/content/buildSearchIndex.mts`

- [ ] **Step 1: Write the failing merge test**

Create `scripts/content/external-merge.test.mjs` that seeds one cached external entry and asserts `buildCosmosData` and `buildSearchIndex` include it with `contentType: "external"` and source metadata.

- [ ] **Step 2: Run the merge test to verify it fails**

Run: `node --test scripts/content/external-merge.test.mjs`
Expected: FAIL because the build scripts still read only local markdown.

- [ ] **Step 3: Implement `readExternalContent.mts`**

Add a small reader for `content/external/items.json` so the existing build scripts can merge external entries without network access.

- [ ] **Step 4: Merge external items into cosmos and search outputs**

Update `buildCosmosData.mts` and `buildSearchIndex.mts` so the merged output preserves source metadata and uses the existing cluster/summary/search structure.

- [ ] **Step 5: Run the focused merge test**

Run: `node --test scripts/content/external-merge.test.mjs`
Expected: PASS

- [ ] **Step 6: Run the data build**

Run: `npm run build:data`
Expected: exit 0 and logs that include local plus external node/search counts.

- [ ] **Step 7: Commit the merged data build**

```bash
git add scripts/content/readExternalContent.mts scripts/content/external-merge.test.mjs scripts/content/buildCosmosData.mts scripts/content/buildSearchIndex.mts
git commit -m "feat: merge external content into cosmos data"
```

### Task 4: Prerender SEO-safe external summary pages

**Files:**
- Modify: `scripts/content/buildSeoPages.mts`

- [ ] **Step 1: Extend the SEO build to read cached external items**

Load `content/external/items.json` alongside local articles.

- [ ] **Step 2: Generate summary-only pages for external entries**

For each external item, prerender `/article/:slug` using summary-page content only. Do not attempt to render or copy source article bodies.

- [ ] **Step 3: Add SEO guards for external pages**

Insert `noindex,follow` and canonical back to `sourceUrl` for external summary pages, and keep external URLs out of the sitemap.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: exit 0 with local article pages plus external summary pages generated successfully.

- [ ] **Step 5: Commit the SEO build changes**

```bash
git add scripts/content/buildSeoPages.mts
git commit -m "feat: prerender external summary pages"
```

## Chunk 3: Frontend Surfaces For Mixed Content

### Task 5: Write the failing UI surface test

**Files:**
- Create: `scripts/ui/external-content-surface.test.mjs`

- [ ] **Step 1: Write the failing UI test**

Create a source-level test that verifies the external content experience references `外部来源`, source attribution, and `去看原文` in the relevant UI surfaces.

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `node --test scripts/ui/external-content-surface.test.mjs`
Expected: FAIL because the current UI treats every node as a local article.

- [ ] **Step 3: Commit the failing UI test**

```bash
git add scripts/ui/external-content-surface.test.mjs
git commit -m "test: add external content surface regression"
```

### Task 6: Add mixed-content UI behavior

**Files:**
- Modify: `src/routes/ArticlePage.tsx`
- Modify: `src/features/articles/ArticleLayout.tsx`
- Modify: `src/features/articles/NearbyPlanets.tsx`
- Modify: `src/features/cosmos/components/SummaryCard.tsx`
- Modify: `src/features/cosmos/components/SearchPalette.tsx`
- Modify: `src/styles/article.css`
- Modify: `src/styles/cosmos-ui.css`

- [ ] **Step 1: Make `ArticlePage` content-type aware**

Keep local markdown rendering unchanged. For external entries, load cached summary data and render a summary page with source name, source domain, summary, `whyWorthReading`, and an outbound CTA.

- [ ] **Step 2: Update `ArticleLayout` and article styles**

Add a compact source-attribution section and a clear `去看原文` action for external pages while preserving the current local-article layout.

- [ ] **Step 3: Update summary card, search palette, and nearby items**

Show `外部来源` and the source name anywhere an external entry appears, so users can distinguish external discovery items from local writing before navigating.

- [ ] **Step 4: Run the focused UI test**

Run: `node --test scripts/ui/external-content-surface.test.mjs`
Expected: PASS

- [ ] **Step 5: Run the full production build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 6: Manual QA**

Check one local article and one external entry in:
- cosmos summary card
- search palette
- `/article/:slug`
- nearby recommendations

Expected: local content still reads like a full article, external content reads like a clearly attributed summary page with outbound CTA.

- [ ] **Step 7: Commit the UI changes**

```bash
git add src/routes/ArticlePage.tsx src/features/articles/ArticleLayout.tsx src/features/articles/NearbyPlanets.tsx src/features/cosmos/components/SummaryCard.tsx src/features/cosmos/components/SearchPalette.tsx src/styles/article.css src/styles/cosmos-ui.css
git commit -m "feat: surface external discovery content in the UI"
```
