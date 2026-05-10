import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchGitHubSearchSource } from "../../scripts/content-agent/adapters/github-search.mjs";

describe("content-agent GitHub search source", () => {
  it("turns repository search results into open-source intelligence signals", async () => {
    const requested = [];
    const signals = await fetchGitHubSearchSource(
      {
        id: "github-ai-project-search",
        name: "GitHub AI Project Search",
        queries: ["agent stars:>500 pushed:>2026-05-01", "MCP stars:>100"],
        limit: 2,
        weight: 15,
        tags: ["GitHub", "开源"],
      },
      {
        fetchImpl: async (url) => {
          requested.push(String(url));
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              items: [
                {
                  full_name: "block/goose",
                  html_url: "https://github.com/block/goose",
                  description: "An open-source AI agent that can run terminal tasks.",
                  stargazers_count: 12800,
                  forks_count: 500,
                  language: "Rust",
                  pushed_at: "2026-05-07T08:00:00Z",
                  topics: ["agent", "llm", "mcp"],
                },
              ],
            }),
          };
        },
      },
    );

    assert.equal(requested.length, 2);
    assert.match(requested[0], /api\.github\.com\/search\/repositories/);
    assert.match(requested[0], /agent/);
    assert.equal(signals.length, 1);
    assert.equal(signals[0].id, "github-ai-project-search:block/goose");
    assert.equal(signals[0].title, "block/goose 开源项目进入增量观察");
    assert.equal(signals[0].sourceType, "github");
    assert.equal(signals[0].section, "opensource");
    assert.equal(signals[0].metrics.stars, 12800);
    assert.equal(signals[0].metrics.forks, 500);
    assert.equal(signals[0].metrics.language, "Rust");
    assert.ok(signals[0].tags.includes("mcp"));
    assert.match(signals[0].media.images[0], /^https:\/\/opengraph\.githubassets\.com\/[a-f0-9]{8}\/block\/goose$/);
  });

  it("degrades to an empty result set when unauthenticated GitHub search is rate limited", async () => {
    const signals = await fetchGitHubSearchSource(
      {
        id: "github-ai-project-search",
        name: "GitHub AI Project Search",
        queries: ["AI agent stars:>300"],
      },
      {
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          statusText: "rate limit exceeded",
          json: async () => ({ message: "API rate limit exceeded" }),
        }),
      },
    );

    assert.deepEqual(signals, []);
  });
});
