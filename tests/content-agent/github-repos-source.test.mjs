import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchGitHubReposSource } from "../../scripts/content-agent/adapters/github-repos.mjs";

describe("content-agent GitHub curated repo source", () => {
  it("turns curated repository metadata into open-source intelligence signals", async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      const repo = String(url).endsWith("/repos/block/goose")
        ? {
            full_name: "aaif-goose/goose",
            html_url: "https://github.com/block/goose",
            description: "An open source extensible AI agent that goes beyond code suggestions.",
            pushed_at: "2026-05-08T08:00:00Z",
            updated_at: "2026-05-08T08:00:00Z",
            stargazers_count: 44643,
            forks_count: 2310,
            watchers_count: 44643,
            language: "Rust",
            topics: ["ai-agent", "developer-tools"],
          }
        : {
            full_name: "bytedance/deer-flow",
            html_url: "https://github.com/bytedance/deer-flow",
            description: "An open-source long-horizon SuperAgent harness that researches, codes, and creates.",
            pushed_at: "2026-05-08T09:00:00Z",
            updated_at: "2026-05-08T09:00:00Z",
            stargazers_count: 66006,
            forks_count: 4200,
            watchers_count: 66006,
            language: "Python",
            topics: ["deep-research", "multi-agent"],
          };
      return {
        ok: true,
        json: async () => repo,
      };
    };

    const signals = await fetchGitHubReposSource(
      {
        id: "github-curated-agent-repos",
        name: "Curated Agent Repos",
        sourceType: "github",
        weight: 18,
        repos: ["block/goose", "bytedance/deer-flow"],
        tags: ["GitHub", "精选开源"],
      },
      { fetchImpl, timeoutMs: 1000 },
    );

    assert.equal(calls.length, 2);
    assert.equal(signals.length, 2);
    assert.equal(signals[0].sourceId, "github-curated-agent-repos");
    assert.equal(signals[0].section, "opensource");
    assert.match(signals[0].title, /aaif-goose\/goose/);
    assert.ok(signals[0].metrics.stars > 40000);
    assert.ok(signals[0].media.images[0].includes("opengraph.githubassets.com"));
    assert.ok(signals[1].tags.includes("multi-agent"));
  });

  it("skips unavailable repositories without failing the full source", async () => {
    const fetchImpl = async (url) => {
      if (String(url).endsWith("/repos/missing/repo")) {
        return { ok: false, status: 404, statusText: "Not Found" };
      }
      return {
        ok: true,
        json: async () => ({
          full_name: "VectifyAI/PageIndex",
          html_url: "https://github.com/VectifyAI/PageIndex",
          description: "Document Index for Vectorless Reasoning-based RAG.",
          updated_at: "2026-05-08T10:00:00Z",
          stargazers_count: 29864,
          forks_count: 1100,
          watchers_count: 29864,
          language: "Python",
          topics: [],
        }),
      };
    };

    const signals = await fetchGitHubReposSource(
      {
        id: "github-curated-agent-repos",
        name: "Curated Agent Repos",
        repos: ["missing/repo", "VectifyAI/PageIndex"],
      },
      { fetchImpl, timeoutMs: 1000 },
    );

    assert.deepEqual(signals.map((signal) => signal.title), ["VectifyAI/PageIndex 开源项目进入重点观察"]);
  });
});
