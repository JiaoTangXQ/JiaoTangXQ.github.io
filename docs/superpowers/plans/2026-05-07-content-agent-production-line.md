# Content Agent Production Line Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete AI-assisted content production line for JiaoTang Planet dailies and weekly posts.

**Architecture:** A repo-native Node.js CLI owns ingestion, normalization, scoring, AI rewriting, composition, review artifacts, publishing, and scheduled execution. It writes generated content into the existing Astro content collections instead of running a separate long-lived app.

**Tech Stack:** Node.js ESM, built-in `fetch`, built-in `node:test`, Astro content collections, GitHub Actions.

---

## Files

- Create `scripts/content-agent/cli.mjs`: command dispatcher.
- Create `scripts/content-agent/config.mjs`: source and runtime config.
- Create `scripts/content-agent/utils.mjs`: dates, hashes, frontmatter, markdown helpers.
- Create `scripts/content-agent/store.mjs`: JSON cache and run artifacts.
- Create `scripts/content-agent/adapters/*.mjs`: RSS, Folo, GitHub Trending, AI Search.
- Create `scripts/content-agent/score.mjs`: dedupe, classify, score.
- Create `scripts/content-agent/ai/*.mjs`: prompts and OpenAI-compatible provider.
- Create `scripts/content-agent/summarize.mjs`: per-item AI rewrite and fallback.
- Create `scripts/content-agent/compose/*.mjs`: daily and weekly generation.
- Create `scripts/content-agent/publish.mjs`: filesystem and optional git publishing.
- Create `tests/content-agent/*.test.mjs`: focused behavior tests.
- Modify `package.json`: add agent scripts and tests.
- Add `.github/workflows/content-agent.yml`: scheduled production line.
- Add `.env.example`: document required/optional credentials.
- Add `docs/content-agent.md`: operator guide.

## Tasks

- [ ] Add failing tests for normalization, scoring, summarization, daily composition, weekly composition, and filesystem publishing.
- [ ] Implement utilities, config loading, and JSON store.
- [ ] Implement adapters for RSS, Folo, GitHub Trending, and AI Search.
- [ ] Implement dedupe, section classification, and scoring.
- [ ] Implement OpenAI Responses API provider with deterministic fallback.
- [ ] Implement per-item summaries and review artifact generation.
- [ ] Implement daily and weekly composers for current Astro collections.
- [ ] Implement CLI commands: `ingest`, `summarize`, `daily`, `weekly`, `publish`, `review`, `run`.
- [ ] Add GitHub Actions schedule and docs.
- [ ] Run `npm run test:agent`, `npm run build`, and existing verification.
