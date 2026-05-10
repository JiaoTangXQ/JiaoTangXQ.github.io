import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchRssHubSource } from "../../scripts/content-agent/adapters/rsshub.mjs";

describe("content-agent RSSHub source", () => {
  it("expands social, WeChat, and video routes into RSS signals with inherited metadata", async () => {
    const rss = (url) => `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>OpenAI 发布实时模型演示</title>
          <link>${url}</link>
          <pubDate>Thu, 07 May 2026 08:00:00 GMT</pubDate>
          <description><![CDATA[
            <p>低延迟语音翻译和 API 演示。</p>
            <img src="https://pbs.twimg.com/media/demo.jpg" />
          ]]></description>
        </item>
      </channel></rss>`;
    const urls = [];

    const signals = await fetchRssHubSource(
      {
        id: "x-official-ai-rsshub",
        name: "X Official AI",
        baseUrl: "https://rsshub.example",
        routes: [
          { path: "/twitter/user/OpenAI", name: "OpenAI on X", tags: ["X", "官方"], section: "product" },
          { path: "/wechat/mp/ai", name: "AI 微信", tags: ["微信公众号"], section: "industry" },
        ],
        sourceType: "social",
        weight: 15,
        tags: ["社媒"],
      },
      {
        fetchImpl: async (url) => {
          urls.push(String(url));
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => rss(String(url).includes("wechat") ? "https://mp.weixin.qq.com/s/1" : "https://x.com/openai/status/1"),
          };
        },
      },
    );

    assert.deepEqual(urls, [
      "https://rsshub.example/twitter/user/OpenAI",
      "https://rsshub.example/wechat/mp/ai",
    ]);
    assert.equal(signals.length, 2);
    assert.equal(signals[0].sourceId, "x-official-ai-rsshub");
    assert.equal(signals[0].sourceName, "OpenAI on X");
    assert.equal(signals[0].sourceType, "social");
    assert.equal(signals[0].section, "product");
    assert.ok(signals[0].tags.includes("X"));
    assert.ok(signals[0].tags.includes("官方"));
    assert.deepEqual(signals[0].media.images, ["https://pbs.twimg.com/media/demo.jpg"]);
  });

  it("keeps fetching other RSSHub routes when one route fails", async () => {
    const rss = `<?xml version="1.0"?>
      <rss><channel><item><title>Warp 开源自动化技能库</title><link>https://github.com/warpdotdev/skills</link></item></channel></rss>`;

    const signals = await fetchRssHubSource(
      {
        id: "x-ai-keyword-rsshub",
        name: "X AI Keywords",
        baseUrl: "https://rsshub.example",
        routes: [{ path: "/broken" }, { path: "/twitter/search/AI%20agent" }],
        sourceType: "social",
      },
      {
        fetchImpl: async (url) => {
          if (String(url).includes("broken")) {
            return { ok: false, status: 502, statusText: "Bad Gateway", text: async () => "" };
          }
          return { ok: true, status: 200, statusText: "OK", text: async () => rss };
        },
      },
    );

    assert.equal(signals.length, 1);
    assert.equal(signals[0].title, "Warp 开源自动化技能库");
  });
});
