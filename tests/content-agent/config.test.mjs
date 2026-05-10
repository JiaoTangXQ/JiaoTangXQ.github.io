import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CONFIG } from "../../scripts/content-agent/config.mjs";

describe("content-agent default source pool", () => {
  it("limits the daily core pool to the last 24 hours by default", () => {
    assert.equal(DEFAULT_CONFIG.scoring.coreSelection.maxAgeHours, 24);
  });

  it("includes Chinese tech and creator-economy feeds for bursty AI stories", () => {
    const activeIds = DEFAULT_CONFIG.sources.filter((source) => source.enabled !== false).map((source) => source.id);

    for (const id of ["ithome-rss", "infoq-cn", "geekpark-rss", "leiphone-rss", "36kr-rss", "oschina-news"]) {
      assert.ok(activeIds.includes(id), `${id} should be enabled by default`);
    }
    assert.ok(DEFAULT_CONFIG.scoring.coreSelection.sourceTypeCaps.news >= 36);
  });

  it("includes the full intelligence pool needed for social, private, project, changelog, paper, and video signals", () => {
    const ids = DEFAULT_CONFIG.sources.map((source) => source.id);

    for (const id of [
      "x-official-ai-rsshub",
      "x-ai-keyword-rsshub",
      "wechat-ai-rsshub",
      "github-ai-project-search",
      "github-agent-org-search",
      "github-curated-agent-repos",
      "product-changelog-rss",
      "ai-newsletter-rss",
      "paper-trend-rss",
      "video-ai-rsshub",
    ]) {
      assert.ok(ids.includes(id), `${id} should be part of the default source pool`);
    }

    assert.ok(DEFAULT_CONFIG.scoring.coreSelection.sourceTypeCaps.social >= 24);
    assert.ok(DEFAULT_CONFIG.scoring.coreSelection.sourceTypeCaps.github >= 18);
    assert.ok(DEFAULT_CONFIG.scoring.coreSelection.sourceTypeCaps.rss >= 24);
    assert.ok(DEFAULT_CONFIG.scoring.coreSelection.sourceIdCaps["x-official-ai-rsshub"] >= 12);
    assert.ok(DEFAULT_CONFIG.scoring.coreSelection.sourceIdCaps["github-ai-project-search"] >= 10);
    assert.ok(DEFAULT_CONFIG.scoring.coreSelection.sourceIdCaps["github-curated-agent-repos"] >= 8);
  });

  it("does not depend on cloned third-party daily pages as an intelligence source", () => {
    const configText = JSON.stringify(DEFAULT_CONFIG);
    const forbiddenMarkers = [
      ["hex", "2077"].join(""),
      ["reference", "daily", "link", "radar"].join("-"),
      ["Reference", "Daily", "Link", "Radar"].join(" "),
    ];

    for (const marker of forbiddenMarkers) {
      assert.ok(!configText.toLowerCase().includes(marker.toLowerCase()), `${marker} should not be configured`);
    }

    assert.ok(!DEFAULT_CONFIG.sources.some((source) => source.type === "reference-page"));
  });

  it("keeps the parity watchlist broad enough for fast-moving X, WeChat, and GitHub gaps", () => {
    const byId = new Map(DEFAULT_CONFIG.sources.map((source) => [source.id, source]));
    const routeText = (sourceId) => (byId.get(sourceId)?.routes ?? []).map((route) => decodeURIComponent(route.path ?? "")).join("\n");
    const repoText = (byId.get("github-curated-agent-repos")?.repos ?? [])
      .map((entry) => (typeof entry === "string" ? entry : entry.repo))
      .join("\n");

    const xOfficialRoutes = routeText("x-official-ai-rsshub");
    const xKeywordRoutes = routeText("x-ai-keyword-rsshub");

    for (const account of ["/twitter/user/a16z", "/twitter/user/karpathy", "/twitter/user/SpaceX"]) {
      assert.match(xOfficialRoutes, new RegExp(account.replaceAll("/", "\\/")));
    }

    for (const keyword of [
      "Trae mobile",
      "Warp Skills",
      "GPT-5 visual",
      "GEO prompts",
      "AI bubble",
      "a16z AI unemployment",
      "xAI SpaceX Colossus",
      "OpenSearch-VL",
      "MSM alignment",
    ]) {
      assert.match(xKeywordRoutes, new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    assert.match(repoText, /vercel\/ai\b/);
    assert.match(repoText, /block\/goose\b/);
  });
});
