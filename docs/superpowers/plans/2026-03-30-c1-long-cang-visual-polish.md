# JiaoTang Planet C1 Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved `C1` atmosphere direction and restrained `Long Cang` title system to the homepage and article covers without changing product structure.

**Architecture:** Keep the current React + R3F structure intact. Introduce one explicit display-font pipeline, refresh global visual tokens, then update the homepage chrome, article cover hero, and atmosphere shader tuning in small verified slices.

**Tech Stack:** Vite, React, TypeScript, React Router, Three.js / @react-three/fiber, CSS, local `woff2` font asset, optional Vitest + Testing Library smoke coverage for title hooks

---

## File Structure

### Typography and Tokens

- Create: `src/assets/fonts/LongCang-Regular.woff2`
- Create: `src/styles/font-faces.css`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/global.css`

### Homepage Chrome and Overlay UI

- Modify: `src/features/cosmos/components/CosmosChrome.tsx`
- Modify: `src/styles/cosmos-ui.css`

### Article Cover Identity

- Modify: `src/features/articles/ArticleLayout.tsx`
- Modify: `src/styles/article.css`

### Atmosphere Rendering

- Modify: `src/features/cosmos/scene/DeepSpaceLayer.tsx`
- Modify: `src/features/cosmos/scene/NebulaLayer.tsx`
- Modify: `src/features/cosmos/scene/StarFieldLayer.tsx`
- Modify: `src/features/cosmos/shaders/deepSpace.ts`
- Modify: `src/features/cosmos/shaders/nebula.ts`
- Modify: `src/features/cosmos/shaders/starField.ts`
- Modify: `src/features/cosmos/shaders/planetNode.ts`

### Verification

- Optional Create: `tests/ui/branding-smoke.test.tsx`
- Optional Create: `tests/setup.ts`
- Optional Create: `vitest.config.ts`

## Chunk 1: Display Font Plumbing

### Task 1: Introduce a local `Long Cang` display font pipeline

**Files:**
- Create: `src/assets/fonts/LongCang-Regular.woff2`
- Create: `src/styles/font-faces.css`
- Modify: `src/styles/global.css`
- Modify: `src/styles/tokens.css`
- Optional Test: `tests/ui/branding-smoke.test.tsx`

- [ ] **Step 1: Add the font asset**

Copy the approved `Long Cang` font into `src/assets/fonts/LongCang-Regular.woff2`.

- [ ] **Step 2: Register the display font**

Create `src/styles/font-faces.css` with:

```css
@font-face {
  font-family: "Long Cang Display";
  src: url("../assets/fonts/LongCang-Regular.woff2") format("woff2");
  font-display: swap;
}
```

- [ ] **Step 3: Wire typography tokens**

Update `src/styles/tokens.css` so the display system is explicit:

```css
--font-display: "Long Cang Display", "Songti SC", serif;
--font-title-ui: "Hiragino Sans GB", "PingFang SC", sans-serif;
--font-body: "Hiragino Sans GB", "PingFang SC", sans-serif;
```

- [ ] **Step 4: Import font faces globally**

Ensure `src/styles/global.css` imports `font-faces.css` before token use.

- [ ] **Step 5: Verify the font is bundled**

Run: `npm run build`

Expected:
- build passes
- `dist/assets` contains a `woff2` font asset

- [ ] **Step 6: Commit**

```bash
git add src/assets/fonts/LongCang-Regular.woff2 src/styles/font-faces.css src/styles/tokens.css src/styles/global.css
git commit -m "feat: add long cang display font pipeline"
```

## Chunk 2: Homepage Brand System

### Task 2: Rebuild the homepage masthead with restrained display type

**Files:**
- Modify: `src/features/cosmos/components/CosmosChrome.tsx`
- Modify: `src/styles/cosmos-ui.css`

- [ ] **Step 1: Add explicit brand structure hooks**

Update `CosmosChrome` so the brand block separates:

- eyebrow
- display title
- optional brand microcopy / descriptor

Example target markup:

```tsx
<div className="cosmos-chrome__brand">
  <div className="cosmos-chrome__eyebrow">JiaoTang Planet</div>
  <div className="cosmos-chrome__title-wrap">
    <div className="cosmos-chrome__title">焦糖星球</div>
    <div className="cosmos-chrome__descriptor">living thought cosmos</div>
  </div>
</div>
```

- [ ] **Step 2: Apply restrained `Long Cang` styling**

Update `src/styles/cosmos-ui.css` so:

- the title uses `var(--font-display)`
- the eyebrow and descriptor use neutral sans-serif
- placement feels sparse and intentional
- the title is no longer visually attached to any node

- [ ] **Step 3: Keep controls subordinate**

Retune button spacing, opacity, border strength, and hover contrast so the action cluster does not compete with the masthead.

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`

Manual check:
- masthead feels like a brand mark, not a default label
- action buttons remain secondary
- the title does not overwhelm the viewport

- [ ] **Step 5: Build verification**

Run: `npm run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/cosmos/components/CosmosChrome.tsx src/styles/cosmos-ui.css
git commit -m "feat: redesign cosmos masthead with restrained long cang"
```

## Chunk 3: Article Cover Title Identity

### Task 3: Apply `Long Cang` only to article cover hero titles

**Files:**
- Modify: `src/features/articles/ArticleLayout.tsx`
- Modify: `src/styles/article.css`

- [ ] **Step 1: Keep structure minimal**

Do not change the article route shape. Only add the hooks needed for title treatment and spacing control.

- [ ] **Step 2: Restyle the cover hero**

Update `.article-cover__title` so it uses the display font with:

- larger but controlled scale
- tighter line height
- stronger theatrical presence
- enough overlay support to keep contrast stable

- [ ] **Step 3: Leave body typography neutral**

Do not spread `Long Cang` into:

- metadata
- prose body
- headings inside the article body
- nearby planets UI

- [ ] **Step 4: Verify across multiple articles**

Run: `npm run dev`

Manual check:
- the cover title feels connected to the homepage brand
- long titles still wrap acceptably
- the reading surface remains calm after the cover hero

- [ ] **Step 5: Build verification**

Run: `npm run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/articles/ArticleLayout.tsx src/styles/article.css
git commit -m "feat: apply long cang to article cover titles"
```

## Chunk 4: Atmosphere Color and Shader Tuning

### Task 4: Shift the cosmos from blue-purple demo to `C1` fresh premium

**Files:**
- Modify: `src/features/cosmos/scene/DeepSpaceLayer.tsx`
- Modify: `src/features/cosmos/scene/NebulaLayer.tsx`
- Modify: `src/features/cosmos/scene/StarFieldLayer.tsx`
- Modify: `src/features/cosmos/shaders/deepSpace.ts`
- Modify: `src/features/cosmos/shaders/nebula.ts`
- Modify: `src/features/cosmos/shaders/starField.ts`
- Modify: `src/features/cosmos/shaders/planetNode.ts`
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Tune deep-space color temperature**

Adjust the deep-space shader toward:

- darker teal-black base
- mint light pockets
- restrained warm amber accents

- [ ] **Step 2: Soften nebula presence**

Reduce synthetic-looking opacity spikes. Favor broader atmospheric fog over obvious color clouds.

- [ ] **Step 3: Clean up star energy**

Keep scale and depth, but reduce noisy sparkle patterns that make the scene read like a graphics demo.

- [ ] **Step 4: Rebalance node glow**

Adjust glow behavior in `planetNode.ts` so nodes feel cleaner and more premium against the refreshed background.

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`

Manual check:
- first impression feels fresher and more premium
- teal / amber atmosphere is noticeable but not loud
- nodes remain readable and attractive at far and mid zoom

- [ ] **Step 6: Build verification**

Run: `npm run build`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/cosmos/scene/DeepSpaceLayer.tsx src/features/cosmos/scene/NebulaLayer.tsx src/features/cosmos/scene/StarFieldLayer.tsx src/features/cosmos/shaders/deepSpace.ts src/features/cosmos/shaders/nebula.ts src/features/cosmos/shaders/starField.ts src/features/cosmos/shaders/planetNode.ts src/styles/tokens.css
git commit -m "feat: tune cosmos atmosphere toward c1 visual direction"
```

## Chunk 5: Final QA Pass

### Task 5: Verify the system reads as one coherent visual language

**Files:**
- Verify only

- [ ] **Step 1: Run typecheck**

Run: `npx -y -p typescript tsc --noEmit`

Expected: PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS

- [ ] **Step 3: Manually inspect key views**

Check:

- homepage first load
- homepage idle drift
- mid zoom with labels visible
- summary card open state
- article cover hero
- article return path back to cosmos

- [ ] **Step 4: Capture before/after screenshots for review**

Store visual evidence alongside the branch discussion or PR.

- [ ] **Step 5: Commit final polish**

```bash
git add .
git commit -m "feat: polish c1 atmosphere and long cang title system"
```
