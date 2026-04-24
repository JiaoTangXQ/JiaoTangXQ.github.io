import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { normalizeFeedItems } from "./external/normalizeFeedItems.mts";
import { filterByQuality, scoreCandidate } from "./external/qualityFilter.mts";
import { isChinaPoliticalContent } from "./external/chinaPoliticsFilter.mts";
import {
  sanitizeHtml,
  htmlToPlainText,
  extractPreview,
  detectLanguage,
} from "./external/sanitizeContent.mts";

const TEST_SOURCE = {
  id: "test-source",
  name: "Test Source",
  siteUrl: "https://example.com",
  feedUrl: "https://example.com/feed.xml",
  defaultTopics: ["技术", "思考"],
  enabled: true,
};

test("fixture feed normalizes into ExternalContentCandidate records", () => {
  const fixturePath = path.resolve(
    "scripts/content/external/fixtures/sample-feed.xml",
  );
  const xml = fs.readFileSync(fixturePath, "utf8");

  const candidates = normalizeFeedItems({ xml, source: TEST_SOURCE });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].sourceName, TEST_SOURCE.name);
  assert.equal(
    candidates[0].sourceUrl,
    "https://example.com/library-climate-shelters",
  );
  assert.ok(candidates[0].rawExcerpt.length > 0);
});

test("source maxItems keeps only the newest feed entries", () => {
  const fixturePath = path.resolve(
    "scripts/content/external/fixtures/sample-feed.xml",
  );
  const xml = fs.readFileSync(fixturePath, "utf8");

  const candidates = normalizeFeedItems({
    xml,
    source: {
      ...TEST_SOURCE,
      id: "limited-source",
      maxItems: 1,
    },
  });

  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].sourceUrl,
    "https://example.com/library-climate-shelters",
  );
});

test("same-source repeated titles get stable unique slugs", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title>Methodology</title>
        <link>https://example.com/global/2026/04/07/methodology-us-views-of-iran/</link>
        <pubDate>Fri, 10 Apr 2026 08:00:00 GMT</pubDate>
        <description>First methodology article.</description>
      </item>
      <item>
        <title>Methodology</title>
        <link>https://example.com/science/2026/04/07/health-information-methodology/</link>
        <pubDate>Fri, 10 Apr 2026 07:00:00 GMT</pubDate>
        <description>Second methodology article.</description>
      </item>
    </channel>
  </rss>`;

  const candidates = normalizeFeedItems({
    xml,
    source: {
      ...TEST_SOURCE,
      id: "repeated-title-source",
    },
  });

  assert.equal(candidates.length, 2);
  assert.notEqual(candidates[0].slug, candidates[1].slug);
});

test("qualityFilter drops short placeholder Reddit posts", () => {
  const junk = {
    slug: "ext-reddit-foo",
    title: "My awesome post",
    date: "2026-04-20T00:00:00Z",
    topics: ["技术"],
    sourceName: "Reddit",
    sourceUrl: "https://reddit.com/r/foo",
    sourceDomain: "reddit.com",
    rawExcerpt: "submitted by /u/foo [link] [comments]",
  };
  const good = {
    slug: "ext-blog-foo",
    title: "Reading about distributed systems",
    date: "2026-04-20T00:00:00Z",
    topics: ["技术"],
    sourceName: "Blog",
    sourceUrl: "https://example.com/post",
    sourceDomain: "example.com",
    rawExcerpt:
      "<p>This is a longish article about distributed systems and how they handle partitioning under load. It goes into some detail on Raft and Paxos and what makes consensus protocols hard in practice. The author spends several paragraphs going through the tradeoffs with clear examples and references prior work in the field.</p>",
  };
  const { kept, dropped } = filterByQuality([junk, good]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].slug, "ext-blog-foo");
  assert.equal(dropped.length, 1);
});

test("sanitizeHtml strips script and resolves relative urls", () => {
  const raw = `<p>Hello <a href="/about">world</a></p><script>alert(1)</script>`;
  const cleaned = sanitizeHtml(raw, "https://example.com/post");
  assert.ok(!cleaned.includes("<script"));
  assert.ok(cleaned.includes("https://example.com/about"));
});

test("extractPreview caps length and trims on punctuation when possible", () => {
  const plain = "这是第一句话。这是第二句话，应该更长一些，以测试截断逻辑的行为。第三句话。";
  const preview = extractPreview(`<p>${plain}</p>`, 20);
  assert.ok(preview.length <= 22);
});

test("detectLanguage returns zh when CJK dominates", () => {
  assert.equal(detectLanguage("今天的天气真不错，我们去散步吧"), "zh");
  assert.equal(detectLanguage("Hello world, this is an english post"), "en");
});

test("htmlToPlainText decodes entities and collapses whitespace", () => {
  const raw = "<p>Hello&nbsp;world &amp; friends</p>";
  assert.equal(htmlToPlainText(raw), "Hello world & friends");
});

test("scoreCandidate recognizes weekly round-up open threads as junk", () => {
  const openThread = {
    slug: "ext-lw-my-last-7-posts",
    title: "My Last 7 Blog Posts: a weekly round-up",
    date: "2026-04-20T00:00:00Z",
    topics: ["思考"],
    sourceName: "LessWrong",
    sourceUrl: "https://lesswrong.com/x",
    sourceDomain: "lesswrong.com",
    rawExcerpt:
      "This is a weekly round-up of things I've posted in the last week and a half on my blog. I hope you enjoy them.",
  };
  const { score } = scoreCandidate(openThread);
  assert.ok(score < 0.45, `expected junk score, got ${score}`);
});

test("china politics filter drops PRC politics and cross-strait security coverage", () => {
  const xiTracker = {
    slug: "ext-scmp-china-xi-jinping-meets-foreign-leaders-tracker-2026",
    title: "Xi Jinping meets foreign leaders: tracker 2026",
    date: "2026-04-24T00:00:00Z",
    topics: ["社会"],
    sourceName: "South China Morning Post",
    sourceUrl: "https://www.scmp.com/news/china/diplomacy/article/foo",
    sourceDomain: "scmp.com",
    rawExcerpt:
      "Mozambique President Daniel Chapo became the first African head of state to meet with Chinese President Xi Jinping this year.",
  };
  const taiwanSecurity = {
    slug: "ext-scmp-china-could-thousands-of-us-hellscape-drone-boats-mess-with-pla-plans-for-taiwan",
    title: "Could thousands of US hellscape drone boats mess with PLA plans for Taiwan?",
    date: "2026-04-24T00:00:00Z",
    topics: ["社会"],
    sourceName: "South China Morning Post",
    sourceUrl: "https://www.scmp.com/news/china/military/article/foo",
    sourceDomain: "scmp.com",
    rawExcerpt:
      "Taiwanese analysts welcomed a US Navy plan to deploy uncrewed vessels across the Indo-Pacific.",
  };

  assert.equal(isChinaPoliticalContent(xiTracker), true);
  assert.equal(isChinaPoliticalContent(taiwanSecurity), true);
  assert.ok(scoreCandidate(xiTracker).score < 0.45);
  assert.ok(scoreCandidate(taiwanSecurity).score < 0.45);
});

test("china politics filter keeps China business and technology coverage", () => {
  const deepseek = {
    slug: "ext-rsshub-wallstreetcn-global-deepseek-v4-ai",
    title: "DeepSeek V4编程能力“大幅领先”，外媒称中国开源AI正获得全球影响力",
    date: "2026-04-24T00:00:00Z",
    topics: ["经济", "社会"],
    sourceName: "华尔街见闻 · 全球",
    sourceUrl: "https://wallstreetcn.com/articles/foo",
    sourceDomain: "wallstreetcn.com",
    rawExcerpt:
      "DeepSeek正式发布旗下最新大语言模型V4的预览版本，并计划以开源形式向公众发布。",
  };
  const supplyChain = {
    slug: "ext-scmp-china-inside-tesla-s-hidden-supply-chain-how-a-chinese-town-shapes-the-modern-world",
    title: "Inside Tesla’s hidden supply chain: how a Chinese town shapes the modern world",
    date: "2026-04-24T00:00:00Z",
    topics: ["社会"],
    sourceName: "South China Morning Post",
    sourceUrl: "https://www.scmp.com/economy/china-economy/article/foo",
    sourceDomain: "scmp.com",
    rawExcerpt:
      "A booming industrial district of Taizhou has become a critical node in the global electric vehicle supply chain.",
  };

  assert.equal(isChinaPoliticalContent(deepseek), false);
  assert.equal(isChinaPoliticalContent(supplyChain), false);
});
