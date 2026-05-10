import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchAibaseNewsSource } from "../../scripts/content-agent/adapters/aibase-news.mjs";
import { fetchRssSource } from "../../scripts/content-agent/adapters/rss.mjs";

describe("content-agent media sources", () => {
  it("extracts images and videos from RSS content and media tags", async () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>OpenAI 发布视频 Agent 工作流</title>
          <link>https://example.com/agent-video</link>
          <pubDate>Thu, 07 May 2026 08:00:00 GMT</pubDate>
          <description><![CDATA[
            <p>带来新的 agent workflow。</p>
            <img src="https://cdn.example.com/cover.jpg" />
            <video src="https://cdn.example.com/demo.mp4"></video>
          ]]></description>
          <media:content url="https://cdn.example.com/chart.png" medium="image" />
          <enclosure url="https://cdn.example.com/trailer.mp4" type="video/mp4" />
        </item>
      </channel></rss>`;

    const signals = await fetchRssSource(
      {
        id: "example-rss",
        name: "Example RSS",
        url: "https://example.com/rss.xml",
        homepage: "https://example.com",
        sourceType: "rss",
      },
      { fetchImpl: fakeFetch(xml) },
    );

    assert.equal(signals.length, 1);
    assert.deepEqual(signals[0].media.images, [
      "https://cdn.example.com/cover.jpg",
      "https://cdn.example.com/chart.png",
    ]);
    assert.deepEqual(signals[0].media.videos, [
      "https://cdn.example.com/demo.mp4",
      "https://cdn.example.com/trailer.mp4",
    ]);
  });

  it("can enrich RSS items with media from the linked article page", async () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>一年磨一剑，今年最炸机器人Demo来了！</title>
          <link>https://www.qbitai.com/2026/05/413830.html</link>
          <pubDate>Thu, 07 May 2026 06:43:41 GMT</pubDate>
          <description><![CDATA[单个模型解锁单手打蛋解魔方弹钢琴]]></description>
        </item>
      </channel></rss>`;
    const article = `<html><body>
      <img src="/wp-content/uploads/2019/01/qrcode_QbitAI_1.jpg" />
      <img src="/wp-content/themes/liangziwei/imagesnew/head.jpg" />
      <article><img src="/wp-content/uploads/robot.jpg" /></article>
    </body></html>`;

    const signals = await fetchRssSource(
      {
        id: "qbitai-feed",
        name: "量子位",
        url: "https://www.qbitai.com/feed",
        homepage: "https://www.qbitai.com/",
        sourceType: "news",
        enrichMedia: true,
      },
      {
        fetchImpl: fakeFetchMap({
          "https://www.qbitai.com/feed": xml,
          "https://www.qbitai.com/2026/05/413830.html": article,
        }),
      },
    );

    assert.deepEqual(signals[0].media.images, ["https://www.qbitai.com/wp-content/uploads/robot.jpg"]);
  });

  it("extracts AIbase cards with article links and thumbnails", async () => {
    const html = `
      <a aria-label="阅读文章: 千问PC端上线AI语音输入，各类应用里开口直接用千问" href="/news/27744">
        <span class="font-light">AIbase</span>
        <h3>千问PC端上线AI语音输入，各类应用里“开口”直接用千问</h3>
        <div class="text-[15px] line-clamp-2 text-surface-500">千问在 PC 端推出 AI 语音输入功能。</div>
        <img alt="千问PC端上线AI语音输入" src="https://upload.chinaz.com/2026/0507/qianwen.jpg"/>
      </a>
      <script>self.__next_f.push([1,"{\\\"Id\\\":27744,\\\"addtime\\\":\\\"2026-05-07 14:25:04\\\"}"])</script>
    `;

    const signals = await fetchAibaseNewsSource(
      {
        id: "aibase-news",
        name: "AIbase",
        url: "https://www.aibase.com/zh/news",
        homepage: "https://www.aibase.com/zh/news",
        sourceType: "news",
      },
      { fetchImpl: fakeFetch(html) },
    );

    assert.equal(signals.length, 1);
    assert.equal(signals[0].title, "千问PC端上线AI语音输入，各类应用里“开口”直接用千问");
    assert.equal(signals[0].url, "https://www.aibase.com/news/27744");
    assert.equal(signals[0].publishedAt, "2026-05-07T06:25:04.000Z");
    assert.deepEqual(signals[0].media.images, ["https://upload.chinaz.com/2026/0507/qianwen.jpg"]);
  });

  it("uses AIbase embedded metadata when a card omits description text", async () => {
    const html = `
      <a aria-label="阅读文章: 腾讯发布OpenSearch-VL：开源多模态深度搜索 agent 的全家桶方案" href="/news/27741">
        <span class="font-light">AIbase</span>
        <h3>腾讯发布OpenSearch-VL：开源多模态深度搜索 agent 的“全家桶”方案</h3>
        <img alt="OpenSearch-VL" src="https://upload.chinaz.com/2026/0507/opensearch.png"/>
      </a>
      <script>self.__next_f.push([1,"{\\\"Id\\\":27741,\\\"description\\\":\\\"腾讯混元联合UCLA、港中文等机构，开源了多模态搜索智能体。\\\",\\\"tags\\\":\\\"[\\\\\\\"多模态大语言模型\\\\\\\",\\\\\\\"AI智能体\\\\\\\",\\\\\\\"腾讯混元\\\\\\\"]\\\",\\\"addtime\\\":\\\"2026-05-07 13:58:24\\\"}"])</script>
    `;

    const signals = await fetchAibaseNewsSource(
      {
        id: "aibase-news",
        name: "AIbase",
        url: "https://www.aibase.com/zh/news",
        homepage: "https://www.aibase.com/zh/news",
        sourceType: "news",
      },
      { fetchImpl: fakeFetch(html) },
    );

    assert.equal(signals[0].content, "腾讯混元联合UCLA、港中文等机构，开源了多模态搜索智能体。");
    assert.deepEqual(signals[0].tags, ["多模态大语言模型", "AI智能体", "腾讯混元"]);
  });
});

function fakeFetch(body) {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => body,
  });
}

function fakeFetchMap(responses) {
  return async (url) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => responses[String(url)] ?? "",
  });
}
