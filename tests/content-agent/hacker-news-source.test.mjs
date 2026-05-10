import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchHackerNewsSearchSource } from "../../scripts/content-agent/adapters/hacker-news-search.mjs";

describe("content-agent Hacker News source", () => {
  it("turns Algolia search hits into social signals with engagement metrics", async () => {
    const calls = [];
    const source = {
      id: "hn-ai",
      name: "Hacker News AI Search",
      type: "hacker-news-search",
      sourceType: "social",
      section: "social",
      queries: ["agent workflow", "AI model"],
      limit: 2,
      hours: 48,
      weight: 14,
      tags: ["HN", "开发者社区"],
    };

    const signals = await fetchHackerNewsSearchSource(source, {
      now: "2026-05-08T12:00:00.000Z",
      fetchImpl: async (url) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            hits: [
              {
                objectID: "480001",
                title: "OpenAI ships a realtime translation model",
                url: "https://openai.com/index/realtime-translation",
                points: 512,
                num_comments: 88,
                created_at: "2026-05-08T04:00:00.000Z",
                _highlightResult: {
                  title: { value: "OpenAI ships a realtime translation model" },
                },
              },
              {
                objectID: "480002",
                story_title: "Agent workflow demos in Chrome",
                story_url: "https://example.com/agent-workflow",
                points: 80,
                num_comments: 14,
                created_at: "2026-05-07T18:30:00.000Z",
              },
            ],
          }),
        };
      },
    });

    assert.equal(calls.length, 2);
    assert.match(String(calls[0]), /query=agent\+workflow/);
    assert.match(String(calls[0]), /numericFilters=created_at_i%3E/);
    assert.equal(signals.length, 2);
    assert.equal(signals[0].id, "hn-ai:480001");
    assert.equal(signals[0].sourceType, "social");
    assert.equal(signals[0].section, "social");
    assert.equal(signals[0].sourceWeight, 14);
    assert.deepEqual(signals[0].tags, ["HN", "开发者社区"]);
    assert.deepEqual(signals[0].metrics, { points: 512, comments: 88 });
  });
});
