# Remove Bottom Theme Tags Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the bottom theme tag strip from the cosmos homepage while keeping the compass and existing top-bar actions.

**Architecture:** Make a minimal change in `CosmosViewport` so the homepage no longer imports or renders `ThemeLens`. Keep the existing scene and compass wiring intact by passing no active theme to the scene.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner

---

### Task 1: Add the regression test

**Files:**
- Create: `scripts/ui/cosmos-viewport-theme-lens.test.mjs`

- [ ] **Step 1: Write the failing test**

Create a Node test that reads `src/features/cosmos/components/CosmosViewport.tsx` and asserts it does not reference `ThemeLens`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/ui/cosmos-viewport-theme-lens.test.mjs`
Expected: FAIL because `CosmosViewport.tsx` still imports or renders `ThemeLens`

### Task 2: Remove the bottom theme tags

**Files:**
- Modify: `src/features/cosmos/components/CosmosViewport.tsx`

- [ ] **Step 1: Remove `ThemeLens` import and render**

Delete the `ThemeLens` import and the bottom-left tag-control markup.

- [ ] **Step 2: Remove now-unused theme state**

Delete `themes`, `activeTheme`, and `handleThemeChange`, and pass `null` for `activeTheme` into `CosmosScene`.

- [ ] **Step 3: Keep the compass anchored at the bottom-right**

Simplify the bottom tool wrapper so it only renders `GalaxyCompass` aligned to the right.

### Task 3: Verify the change

**Files:**
- Test: `scripts/ui/cosmos-viewport-theme-lens.test.mjs`

- [ ] **Step 1: Run focused test to verify it passes**

Run: `node --test scripts/ui/cosmos-viewport-theme-lens.test.mjs`
Expected: PASS

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: exit 0
