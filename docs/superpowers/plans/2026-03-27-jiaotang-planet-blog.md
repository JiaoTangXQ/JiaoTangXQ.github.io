# JiaoTang Planet Blog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `焦糖星球` as a GitHub Pages-compatible AI-first personal blog with a panoramic infinite-canvas homepage, spatially clustered article planets, premium summary cards, and static article pages.

**Architecture:** Use a static build with React + TypeScript + Vite. Precompute article metadata, summaries, search data, and 2D spatial coordinates at build time; keep the runtime focused on camera motion, rendering the cosmos layers, and loading heavier card/detail UI only in near/focus states.

**Tech Stack:** Vite, React, TypeScript, React Router, Canvas 2D + DOM overlays, Vitest, Testing Library, gray-matter, remark, MiniSearch, d3-force (for build-time layout only)

---

## Working Notes

- The worktree currently contains many deleted legacy static-export files. Do **not** restore them during implementation.
- Add `.superpowers/` to `.gitignore` before continuing feature work so brainstorming artifacts stay out of git noise.
- Treat `content/articles/*.md` as the source of truth. Everything else is generated or rendered from it.

## File Structure

### Root and tooling

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`

### Content and build pipeline

- Create: `content/articles/hello-jiaotang-planet.md`
- Create: `src/lib/content/types.ts`
- Create: `scripts/content/readArticles.mts`
- Create: `scripts/content/build-cosmos-data.mts`
- Create: `scripts/content/build-search-index.mts`
- Create: `public/data/cosmos.json`
- Create: `public/data/search-index.json`

### App shell and routes

- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/routes/CosmosPage.tsx`
- Create: `src/routes/ArticlePage.tsx`

### Cosmos feature

- Create: `src/features/cosmos/camera/cameraMath.ts`
- Create: `src/features/cosmos/camera/useCameraState.ts`
- Create: `src/features/cosmos/state/urlState.ts`
- Create: `src/features/cosmos/render/drawAtmosphere.ts`
- Create: `src/features/cosmos/render/drawNodes.ts`
- Create: `src/features/cosmos/render/useCosmosCanvas.ts`
- Create: `src/features/cosmos/nodes/nodeLod.ts`
- Create: `src/features/cosmos/components/CosmosViewport.tsx`
- Create: `src/features/cosmos/components/SearchPalette.tsx`
- Create: `src/features/cosmos/components/GalaxyCompass.tsx`
- Create: `src/features/cosmos/components/SummaryCard.tsx`
- Create: `src/features/cosmos/components/ThemeLens.tsx`

### Article feature

- Create: `src/features/articles/ArticleLayout.tsx`
- Create: `src/features/articles/NearbyPlanets.tsx`

### Tests

- Create: `tests/app/app-shell.test.tsx`
- Create: `tests/content/article-schema.test.ts`
- Create: `tests/scripts/build-cosmos-data.test.ts`
- Create: `tests/cosmos/cameraMath.test.ts`
- Create: `tests/cosmos/nodeLod.test.ts`
- Create: `tests/cosmos/summary-card.test.tsx`
- Create: `tests/cosmos/search-palette.test.tsx`
- Create: `tests/cosmos/theme-lens.test.tsx`
- Create: `tests/routes/article-page.test.tsx`
- Create: `tests/articles/nearby-planets.test.tsx`

## Chunk 1: Foundation and Content Pipeline

### Task 1: Bootstrap the app shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/router.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Test: `tests/app/app-shell.test.tsx`

- [ ] **Step 1: Write the failing app-shell test**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "../../src/app/App";

it("renders the JiaoTang Planet shell", () => {
  render(<App />);
  expect(screen.getByText("焦糖星球")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/app/app-shell.test.tsx`
Expected: FAIL because the app shell and test setup do not exist yet.

- [ ] **Step 3: Create the minimal Vite/React shell**

```tsx
export function App() {
  return <div>焦糖星球</div>;
}
```

Also add `.gitignore` entries for `node_modules/`, `dist/`, and `.superpowers/`.

- [ ] **Step 4: Run the test and typecheck**

Run: `npm run test -- tests/app/app-shell.test.tsx`
Expected: PASS

Run: `npx -y -p typescript tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json tsconfig.json vite.config.ts index.html src/main.tsx src/app/App.tsx src/app/router.tsx src/styles/tokens.css src/styles/global.css tests/app/app-shell.test.tsx
git commit -m "feat: bootstrap JiaoTang Planet app shell"
```

### Task 2: Define the article schema and sample content

**Files:**
- Create: `content/articles/hello-jiaotang-planet.md`
- Create: `src/lib/content/types.ts`
- Create: `scripts/content/readArticles.mts`
- Test: `tests/content/article-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

```ts
import { parseArticle } from "../../scripts/content/readArticles.mjs";

it("parses required article metadata", async () => {
  const article = await parseArticle("content/articles/hello-jiaotang-planet.md");
  expect(article.slug).toBe("hello-jiaotang-planet");
  expect(article.summary.length).toBeGreaterThan(40);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/content/article-schema.test.ts`
Expected: FAIL because the parser and sample article do not exist.

- [ ] **Step 3: Add the article schema and parser**

```ts
export type ArticleRecord = {
  slug: string;
  title: string;
  summary: string;
  topics: string[];
  publishedAt: string;
  body: string;
};
```

Use frontmatter fields for title, summary, topics, published date, and optional cover hints.

- [ ] **Step 4: Run the test**

Run: `npm run test -- tests/content/article-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add content/articles/hello-jiaotang-planet.md src/lib/content/types.ts scripts/content/readArticles.mts tests/content/article-schema.test.ts
git commit -m "feat: add article schema and parser"
```

### Task 3: Build the precomputed cosmos dataset

**Files:**
- Create: `scripts/content/build-cosmos-data.mts`
- Create: `scripts/content/build-search-index.mts`
- Create: `public/data/cosmos.json`
- Create: `public/data/search-index.json`
- Test: `tests/scripts/build-cosmos-data.test.ts`

- [ ] **Step 1: Write the failing dataset test**

```ts
import { buildCosmosDataset } from "../../scripts/content/build-cosmos-data.mjs";

it("assigns coordinates, size, and cluster metadata", async () => {
  const dataset = await buildCosmosDataset();
  expect(dataset.nodes[0]).toMatchObject({
    slug: expect.any(String),
    x: expect.any(Number),
    y: expect.any(Number),
    size: expect.any(Number),
    cluster: expect.any(String),
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/scripts/build-cosmos-data.test.ts`
Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement the minimal precompute pipeline**

```ts
return {
  nodes: articles.map((article, index) => ({
    slug: article.slug,
    x: index * 120,
    y: index * 80,
    size: 1,
    cluster: article.topics[0] ?? "misc",
  })),
};
```

Then replace the placeholder layout with build-time similarity scoring plus `d3-force`-generated coordinates.

- [ ] **Step 4: Run the test and generate the data files**

Run: `npm run test -- tests/scripts/build-cosmos-data.test.ts`
Expected: PASS

Run: `npm run build:data`
Expected: `public/data/cosmos.json` and `public/data/search-index.json` are generated.

- [ ] **Step 5: Commit**

```bash
git add scripts/content/build-cosmos-data.mts scripts/content/build-search-index.mts public/data/cosmos.json public/data/search-index.json tests/scripts/build-cosmos-data.test.ts
git commit -m "feat: generate precomputed cosmos and search data"
```

## Chunk 2: Infinite Canvas Engine

### Task 4: Implement camera math and persisted view state

**Files:**
- Create: `src/features/cosmos/camera/cameraMath.ts`
- Create: `src/features/cosmos/camera/useCameraState.ts`
- Create: `src/features/cosmos/state/urlState.ts`
- Test: `tests/cosmos/cameraMath.test.ts`

- [ ] **Step 1: Write the failing camera test**

```ts
import { zoomTowardPoint } from "../../src/features/cosmos/camera/cameraMath";

it("zooms toward the cursor focus", () => {
  const next = zoomTowardPoint(
    { x: 0, y: 0, scale: 1 },
    { x: 300, y: 200 },
    1.2
  );
  expect(next.scale).toBeGreaterThan(1);
  expect(next.x).not.toBe(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/cosmos/cameraMath.test.ts`
Expected: FAIL because the math helpers do not exist.

- [ ] **Step 3: Implement the minimal camera math and URL sync**

```ts
export function zoomTowardPoint(camera, point, nextScale) {
  return { ...camera, scale: nextScale };
}
```

Then expand it so drag, zoom, and reset preserve view state through URL params such as `?x=...&y=...&z=...`.

- [ ] **Step 4: Run the test**

Run: `npm run test -- tests/cosmos/cameraMath.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/cosmos/camera/cameraMath.ts src/features/cosmos/camera/useCameraState.ts src/features/cosmos/state/urlState.ts tests/cosmos/cameraMath.test.ts
git commit -m "feat: add cosmos camera math and persisted view state"
```

### Task 5: Render the atmosphere and far-view nodes

**Files:**
- Create: `src/features/cosmos/render/drawAtmosphere.ts`
- Create: `src/features/cosmos/render/drawNodes.ts`
- Create: `src/features/cosmos/render/useCosmosCanvas.ts`
- Create: `src/features/cosmos/nodes/nodeLod.ts`
- Create: `src/features/cosmos/components/CosmosViewport.tsx`
- Modify: `src/routes/CosmosPage.tsx`
- Test: `tests/cosmos/nodeLod.test.ts`

- [ ] **Step 1: Write the failing LOD test**

```ts
import { getNodeVisualMode } from "../../src/features/cosmos/nodes/nodeLod";

it("returns far mode for distant zoom levels", () => {
  expect(getNodeVisualMode(0.8)).toBe("planet");
  expect(getNodeVisualMode(2.2)).toBe("cover");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/cosmos/nodeLod.test.ts`
Expected: FAIL because the LOD helper does not exist.

- [ ] **Step 3: Implement the canvas viewport**

```ts
export function getNodeVisualMode(scale: number) {
  return scale >= 2 ? "cover" : "planet";
}
```

Use canvas for atmosphere and far nodes, and keep DOM overlays reserved for near/focus states.

- [ ] **Step 4: Run the tests and start the app**

Run: `npm run test -- tests/cosmos/nodeLod.test.ts`
Expected: PASS

Run: `npm run dev`
Expected: The homepage shows a pannable cosmic field with planet nodes.

- [ ] **Step 5: Commit**

```bash
git add src/features/cosmos/render/drawAtmosphere.ts src/features/cosmos/render/drawNodes.ts src/features/cosmos/render/useCosmosCanvas.ts src/features/cosmos/nodes/nodeLod.ts src/features/cosmos/components/CosmosViewport.tsx src/routes/CosmosPage.tsx tests/cosmos/nodeLod.test.ts
git commit -m "feat: render the cosmos atmosphere and far-view nodes"
```

### Task 6: Add hover focus and the summary card

**Files:**
- Create: `src/features/cosmos/components/SummaryCard.tsx`
- Modify: `src/features/cosmos/components/CosmosViewport.tsx`
- Test: `tests/cosmos/summary-card.test.tsx`

- [ ] **Step 1: Write the failing summary-card test**

```tsx
import { render, screen } from "@testing-library/react";
import { SummaryCard } from "../../src/features/cosmos/components/SummaryCard";

it("renders cover, summary, and read-more CTA", () => {
  render(<SummaryCard node={mockNode} />);
  expect(screen.getByText("阅读全文")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/cosmos/summary-card.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the focus state**

```tsx
export function SummaryCard({ node }) {
  return (
    <aside>
      <h2>{node.title}</h2>
      <p>{node.summary}</p>
      <button>阅读全文</button>
    </aside>
  );
}
```

Then wire it so hover wakes nearby nodes and click opens the summary card while the cosmos remains visible behind it.

- [ ] **Step 4: Run the test**

Run: `npm run test -- tests/cosmos/summary-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/cosmos/components/SummaryCard.tsx src/features/cosmos/components/CosmosViewport.tsx tests/cosmos/summary-card.test.tsx
git commit -m "feat: add node focus state and summary card"
```

## Chunk 3: Reading Surfaces

### Task 7: Build the article page shell and route transition

**Files:**
- Create: `src/routes/ArticlePage.tsx`
- Create: `src/features/articles/ArticleLayout.tsx`
- Modify: `src/app/router.tsx`
- Test: `tests/routes/article-page.test.tsx`

- [ ] **Step 1: Write the failing article-page test**

```tsx
import { render, screen } from "@testing-library/react";
import { ArticlePage } from "../../src/routes/ArticlePage";

it("renders the article title and return-to-cosmos action", () => {
  render(<ArticlePage />);
  expect(screen.getByText("返回星图")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/routes/article-page.test.tsx`
Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the reading surface**

```tsx
export function ArticlePage() {
  return (
    <article>
      <button>返回星图</button>
    </article>
  );
}
```

Then layer in the calmer reading typography, preserved cover mood, and route transition from summary CTA to article page.

- [ ] **Step 4: Run the test**

Run: `npm run test -- tests/routes/article-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/ArticlePage.tsx src/features/articles/ArticleLayout.tsx src/app/router.tsx tests/routes/article-page.test.tsx
git commit -m "feat: add article page shell and cosmos return path"
```

### Task 8: Render nearby planets on article pages

**Files:**
- Create: `src/features/articles/NearbyPlanets.tsx`
- Modify: `src/routes/ArticlePage.tsx`
- Test: `tests/articles/nearby-planets.test.tsx`

- [ ] **Step 1: Write the failing nearby-planets test**

```tsx
import { render, screen } from "@testing-library/react";
import { NearbyPlanets } from "../../src/features/articles/NearbyPlanets";

it("renders related articles as nearby planets", () => {
  render(<NearbyPlanets items={[mockNode]} />);
  expect(screen.getByText(mockNode.title)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/articles/nearby-planets.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the minimal related-content surface**

```tsx
export function NearbyPlanets({ items }) {
  return <section>{items.map((item) => <span key={item.slug}>{item.title}</span>)}</section>;
}
```

Then style it so it feels spatially linked to the cosmos rather than like a default article-footer list.

- [ ] **Step 4: Run the test**

Run: `npm run test -- tests/articles/nearby-planets.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/articles/NearbyPlanets.tsx src/routes/ArticlePage.tsx tests/articles/nearby-planets.test.tsx
git commit -m "feat: add nearby planets to article pages"
```

## Chunk 4: Discovery and Orientation

### Task 9: Add search palette and camera travel

**Files:**
- Create: `src/features/cosmos/components/SearchPalette.tsx`
- Modify: `src/routes/CosmosPage.tsx`
- Test: `tests/cosmos/search-palette.test.tsx`

- [ ] **Step 1: Write the failing search test**

```tsx
import { render, screen } from "@testing-library/react";
import { SearchPalette } from "../../src/features/cosmos/components/SearchPalette";

it("opens a command-style search surface", () => {
  render(<SearchPalette open items={[mockNode]} />);
  expect(screen.getByPlaceholderText("搜索文章")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/cosmos/search-palette.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the palette**

```tsx
export function SearchPalette({ open }) {
  if (!open) return null;
  return <input placeholder="搜索文章" />;
}
```

Then wire result selection to smooth camera travel toward the selected node.

- [ ] **Step 4: Run the test**

Run: `npm run test -- tests/cosmos/search-palette.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/cosmos/components/SearchPalette.tsx src/routes/CosmosPage.tsx tests/cosmos/search-palette.test.tsx
git commit -m "feat: add command search and camera travel"
```

### Task 10: Add theme lens and the galaxy compass

**Files:**
- Create: `src/features/cosmos/components/ThemeLens.tsx`
- Create: `src/features/cosmos/components/GalaxyCompass.tsx`
- Modify: `src/routes/CosmosPage.tsx`
- Test: `tests/cosmos/theme-lens.test.tsx`

- [ ] **Step 1: Write the failing theme-lens test**

```tsx
import { render, screen } from "@testing-library/react";
import { ThemeLens } from "../../src/features/cosmos/components/ThemeLens";

it("renders the available theme lens controls", () => {
  render(<ThemeLens themes={["技术", "思考"]} activeTheme="技术" />);
  expect(screen.getByText("技术")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/cosmos/theme-lens.test.tsx`
Expected: FAIL because the lens UI does not exist.

- [ ] **Step 3: Implement the orientation tools**

```tsx
export function ThemeLens({ themes }) {
  return <div>{themes.map((theme) => <button key={theme}>{theme}</button>)}</div>;
}
```

Add `GalaxyCompass` as a non-map orientation aid that indicates the nearest thematic region without feeling like developer tooling.

- [ ] **Step 4: Run the test**

Run: `npm run test -- tests/cosmos/theme-lens.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/cosmos/components/ThemeLens.tsx src/features/cosmos/components/GalaxyCompass.tsx src/routes/CosmosPage.tsx tests/cosmos/theme-lens.test.tsx
git commit -m "feat: add theme lens and galaxy compass"
```

## Chunk 5: Polish, Build, and Verification

### Task 11: Add performance guards and animated polish

**Files:**
- Modify: `src/features/cosmos/render/drawAtmosphere.ts`
- Modify: `src/features/cosmos/render/drawNodes.ts`
- Modify: `src/features/cosmos/components/CosmosViewport.tsx`
- Create: `tests/cosmos/performance-guards.test.ts`

- [ ] **Step 1: Write the failing performance guard test**

```ts
import { shouldRenderCoverLayer } from "../../src/features/cosmos/nodes/nodeLod";

it("disables heavy cover rendering at far zoom levels", () => {
  expect(shouldRenderCoverLayer(0.9)).toBe(false);
  expect(shouldRenderCoverLayer(2.4)).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- tests/cosmos/performance-guards.test.ts`
Expected: FAIL because the helper and guard paths do not exist.

- [ ] **Step 3: Implement guarded polish**

```ts
export function shouldRenderCoverLayer(scale: number) {
  return scale >= 2;
}
```

Then make atmospheric motion, glows, and cover reveals conditional on zoom level and device capability.

- [ ] **Step 4: Run the test**

Run: `npm run test -- tests/cosmos/performance-guards.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/cosmos/render/drawAtmosphere.ts src/features/cosmos/render/drawNodes.ts src/features/cosmos/components/CosmosViewport.tsx src/features/cosmos/nodes/nodeLod.ts tests/cosmos/performance-guards.test.ts
git commit -m "feat: add guarded cosmos polish and performance gates"
```

### Task 12: Wire the static build and GitHub Pages output

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing build verification step**

```bash
npm run build
```

Expected: FAIL until the build scripts and output paths are fully wired.

- [ ] **Step 2: Add the build scripts**

```json
{
  "scripts": {
    "build:data": "node scripts/content/build-cosmos-data.mts && node scripts/content/build-search-index.mts",
    "build": "npm run build:data && vite build"
  }
}
```

- [ ] **Step 3: Document the workflow**

Document:

- how to add a new article
- how summaries and clusters are generated
- how to regenerate the cosmos data
- how to deploy to GitHub Pages

- [ ] **Step 4: Run the full verification**

Run: `npm run test`
Expected: PASS

Run: `npm run build`
Expected: PASS and produce a deployable static site in `dist/`

- [ ] **Step 5: Commit**

```bash
git add package.json vite.config.ts README.md
git commit -m "chore: wire build pipeline and deployment docs"
```

## Plan Review Notes

- Keep canvas rendering and DOM-heavy UI separate from day one.
- Do not let cover cards render for every node at far zoom.
- Keep the article page calmer than the homepage.
- Preserve URL or local state for return-to-cosmos context before polishing atmospheric motion.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-03-27-jiaotang-planet-blog.md`. Ready to execute?
