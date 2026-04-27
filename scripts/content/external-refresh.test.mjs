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
import { normalizeExternalRecords } from "./external/normalizeExistingItems.mts";

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

test("sanitizeHtml keeps existing links stable across repeated passes", () => {
  const raw =
    '<p><a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">example</a></p>';

  const once = sanitizeHtml(raw, "https://example.com/post");
  const twice = sanitizeHtml(once, "https://example.com/post");

  assert.equal(twice, once);
  assert.match(once, /href="https:\/\/example\.com\/\?a=1&amp;b=2"/);
  assert.match(once, /target="_blank"/);
  assert.match(once, /rel="noopener noreferrer"/);
});

test("sanitizeHtml keeps generated bare-domain links stable", () => {
  const raw = "体验地址： chat.deepseek.com";

  const once = sanitizeHtml(raw, "https://example.com/post");
  const twice = sanitizeHtml(once, "https://example.com/post");

  assert.equal(twice, once);
  assert.match(once, /href="https:\/\/chat\.deepseek\.com\/"/);
});

test("sanitizeHtml structures plain text articles with URLs and numbered sections", () => {
  const raw = [
    "目前，DeepSeek-V4系列已上线官网与App，并同步开放API与模型权重。",
    "体验地址： chat.deepseek.com或DeepSeek官方APP API文档： https://api-docs.deepseek.com/zh-cn/guides/thinking_mode",
    "开源链接： https://huggingface.co/collections/deepseek-ai/deepseek-v4 https://modelscope.cn/collections/deepseek-ai/DeepSeek-V4",
    "01、Agentic编程能力提升明显，读《三体》三部曲烧了54万token 我们初步感受了下DeepSeek-V4的变化，主要测试的模型是DeepSeek-V4-Pro。",
  ].join(" ");

  const cleaned = sanitizeHtml(raw, "https://wallstreetcn.com/articles/demo");

  assert.match(cleaned, /<p>目前，DeepSeek-V4系列已上线官网与App/);
  assert.match(cleaned, /<a href="https:\/\/chat\.deepseek\.com\/"/);
  assert.match(cleaned, /<a href="https:\/\/api-docs\.deepseek\.com\/zh-cn\/guides\/thinking_mode"/);
  assert.match(cleaned, /<h2>01、Agentic编程能力提升明显，读《三体》三部曲烧了54万token<\/h2>/);
  assert.match(cleaned, /<p>我们初步感受了下DeepSeek-V4的变化/);
});

test("sanitizeHtml preserves code semantics in plain text articles", () => {
  const raw = [
    "可以用 `npm run build:data` 重建内容。",
    "```ts\nconst url = \"https://example.com/api\";\nconsole.log(url);\n```",
  ].join("\n\n");

  const cleaned = sanitizeHtml(raw, "https://example.com/post");

  assert.match(cleaned, /<code>npm run build:data<\/code>/);
  assert.match(
    cleaned,
    /<pre><code>const url = &quot;https:\/\/example\.com\/api&quot;;\nconsole\.log\(url\);<\/code><\/pre>/,
  );
  assert.doesNotMatch(cleaned, /<a href="https:\/\/example\.com\/api"/);
});

test("sanitizeHtml does not treat model versions as numbered sections", () => {
  const raw =
    "交付质量已接近Claude Opus 4.6非思考模式，但与其思考模式仍存在差距。DeepSeek-V4-Pro在数学任务中表现接近Claude Opus 4.6-Max等模型。";

  const cleaned = sanitizeHtml(raw, "https://example.com/post");

  assert.doesNotMatch(cleaned, /<h2>4\.6/);
  assert.match(cleaned, /Claude Opus 4\.6非思考模式/);
  assert.match(cleaned, /Claude Opus 4\.6-Max/);
});

test("sanitizeHtml separates numbered conclusion headings from following body", () => {
  const raw =
    "05、结语：DeepSeek-V4亮相，国产算力与开源路线的落地之光 DeepSeek-V4的发布不仅展现了团队在技术和架构上的积淀，也标志着开源大模型在国产算力生态下的实际落地能力。";

  const cleaned = sanitizeHtml(raw, "https://example.com/post");

  assert.match(
    cleaned,
    /<h2>05、结语：DeepSeek-V4亮相，国产算力与开源路线的落地之光<\/h2>/,
  );
  assert.match(cleaned, /<p>DeepSeek-V4的发布不仅展现了团队/);
});

test("sanitizeHtml strips Solidot navigation chrome from article pages", () => {
  const raw = `
    <div>
      <div><p><a href="/login">登录</a> <a href="/register">注册</a></p></div>
      <ul>
        <li><span>文章</span></li>
        <li><span>皮肤</span></li>
      </ul>
      <ul>
        <li>分类: </li>
        <li><a href="https://www.solidot.org/">首页</a></li>
        <li><a href="https://science.solidot.org/">科学</a></li>
      </ul>
      <h2>消息</h2>
      <p><b>本文已被查看 2925 次</b></p>
      <h2>好奇号在火星上发现新有机分子</h2>
      <p><a href="https://www.solidot.org/~Edwards">Edwards</a> (42866)发表于 2026年04月22日 18时38分 星期三</p>
      <p><b>来自尘埃记</b></p>
      <p>根据发表在《Nature Communications》期刊上的一项研究，科学家从好奇号在火星盖尔陨石坑采集的岩石样本中发现了 20 多种有机分子。</p>
      <p>https://www.nature.com/articles/s41467-026-70656-0</p>
    </div>
  `;

  const cleaned = sanitizeHtml(raw, "https://www.solidot.org/story?sid=84117");

  assert.doesNotMatch(cleaned, /登录|注册|分类:|本文已被查看|Edwards|来自尘埃记/);
  assert.match(cleaned, /<p>根据发表在《Nature Communications》期刊上的一项研究/);
  assert.match(
    cleaned,
    /<a href="https:\/\/www\.nature\.com\/articles\/s41467-026-70656-0"/,
  );
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

test("normalizeExternalRecords prunes China politics and re-applies content structure", () => {
  const { records, stats } = normalizeExternalRecords([
    {
      slug: "ext-scmp-china-xi-jinping-meets-foreign-leaders-tracker-2026",
      contentType: "external",
      language: "en",
      title: "Xi Jinping meets foreign leaders: tracker 2026",
      date: "2026-04-24T00:00:00Z",
      topics: ["社会"],
      content:
        "Mozambique President Daniel Chapo became the first African head of state to meet with Chinese President Xi Jinping this year.",
      preview: "Mozambique President Daniel Chapo...",
      sourceName: "South China Morning Post",
      sourceUrl: "https://www.scmp.com/news/china/diplomacy/article/foo",
      sourceDomain: "scmp.com",
    },
    {
      slug: "ext-rsshub-wallstreetcn-global-deepseek-v4-ai",
      contentType: "external",
      language: "zh",
      title: "DeepSeek V4初体验",
      date: "2026-04-24T00:00:00Z",
      topics: ["经济", "社会"],
      content:
        "体验地址： chat.deepseek.com 01、Agentic编程能力提升明显 我们初步感受了下DeepSeek-V4的变化。",
      preview: "体验地址： chat.deepseek.com",
      sourceName: "华尔街见闻 · 全球",
      sourceUrl: "https://wallstreetcn.com/articles/foo",
      sourceDomain: "wallstreetcn.com",
    },
  ]);

  assert.equal(stats.total, 2);
  assert.equal(stats.kept, 1);
  assert.equal(stats.droppedChinaPolitics, 1);
  assert.equal(records[0].slug, "ext-rsshub-wallstreetcn-global-deepseek-v4-ai");
  assert.match(records[0].content, /<a href="https:\/\/chat\.deepseek\.com\/"/);
  assert.match(records[0].content, /<h2>01、Agentic编程能力提升明显<\/h2>/);
});
