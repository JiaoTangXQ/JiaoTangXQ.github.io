import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifySignal, normalizeSignals, scoreSignals, selectCoreSignals } from "../../scripts/content-agent/score.mjs";

const date = "2026-05-07";

describe("content-agent scoring", () => {
  it("normalizes duplicate URLs and keeps source evidence", () => {
    const normalized = normalizeSignals([
      {
        id: "a",
        title: "OpenAI ships a managed agent platform",
        url: "https://openai.com/news/agents?utm_source=x",
        sourceName: "OpenAI",
        publishedAt: "2026-05-07T02:00:00.000Z",
        content: "New managed agents for developers.",
      },
      {
        id: "b",
        title: "OpenAI ships a managed agent platform",
        url: "https://openai.com/news/agents#comments",
        sourceName: "Mirror",
        publishedAt: "2026-05-07T03:00:00.000Z",
        content: "Duplicate mirror.",
      },
    ]);

    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].canonicalUrl, "https://openai.com/news/agents");
    assert.equal(normalized[0].sourceName, "OpenAI");
  });

  it("classifies product, research, open source, and social signals", () => {
    assert.equal(classifySignal({ title: "Claude launches managed agents", sourceType: "rss" }), "product");
    assert.equal(classifySignal({ title: "New arXiv paper improves inference", sourceType: "paper" }), "research");
    assert.equal(classifySignal({ title: "vercel-labs/open-agents gains 900 stars", sourceType: "github" }), "opensource");
    assert.equal(classifySignal({ title: "Karpathy explains AI app design", sourceType: "social" }), "social");
    assert.equal(
      classifySignal({
        title: "ProgramBench shows LLMs fail architecture reconstruction",
        sourceType: "social",
        section: "social",
      }),
      "research",
    );
    assert.equal(
      classifySignal({
        title: "OpenAI official CLI tool openai-cli launches for Responses API",
        sourceType: "news",
        section: "opensource",
        content: "The Apache 2.0 open-source project supports Homebrew and Go installs.",
      }),
      "product",
    );
    assert.equal(
      classifySignal({
        title: "GPT-Image-2 in the Wild: A Twitter Dataset for Visual Reasoning",
        sourceType: "paper",
        section: "opensource",
        content: "A research paper introduces an open dataset for GPT-image model behavior.",
      }),
      "research",
    );
    assert.equal(
      classifySignal({
        title: "Anthropic NLA turns model activations into text",
        sourceType: "social",
        section: "opensource",
        content: "Natural Language Autoencoders release open-weight checkpoints for interpretability research.",
      }),
      "research",
    );
    assert.equal(
      classifySignal({
        title: "激活值转文字",
        sourceType: "reference",
        section: "opensource",
        content: "Anthropic开源NLAs解释技术，用自然语言解释模型激活。",
      }),
      "research",
    );
  });

  it("scores by freshness, AI relevance, source weight, and impact", () => {
    const [top] = scoreSignals(
      normalizeSignals([
        {
          title: "Local newsletter update",
          url: "https://example.com/news",
          sourceName: "Example",
          sourceType: "rss",
          publishedAt: "2026-05-01T00:00:00.000Z",
          content: "General software notes.",
        },
        {
          title: "Open-source AI agent framework hits 45k stars",
          url: "https://github.com/acme/agent",
          sourceName: "GitHub Trending",
          sourceType: "github",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "Agent workflow framework with RAG and tool use.",
          metrics: { stars: 45000, starsToday: 900 },
        },
      ]),
      { now: `${date}T08:00:00.000Z` },
    );

    assert.equal(top.sourceType, "github");
    assert.equal(top.section, "opensource");
    assert.ok(top.score >= 85);
    assert.match(top.scoreReason, /AI相关度/);
  });

  it("preserves source-specific weight and tags for pool curation", () => {
    const [top] = scoreSignals(
      normalizeSignals([
        {
          title: "AI agent workflow from a niche source",
          url: "https://example.com/agent-workflow",
          sourceName: "Niche Source",
          sourceType: "rss",
          sourceWeight: 30,
          tags: ["信源精选"],
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "Agent workflow model update for developers.",
        },
        {
          title: "AI agent workflow from a default source",
          url: "https://example.com/default-agent-workflow",
          sourceName: "Default Source",
          sourceType: "rss",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "Agent workflow model update for developers.",
        },
      ]),
      { now: `${date}T08:00:00.000Z` },
    );

    assert.equal(top.sourceName, "Niche Source");
    assert.equal(top.sourceWeight, 30);
    assert.ok(top.tags.includes("信源精选"));
    assert.match(top.scoreReason, /来源权重:30/);
  });

  it("penalizes tangential social posts when the title is not AI-centered", () => {
    const scored = scoreSignals(
      normalizeSignals([
        {
          title: "Dirtyfrag: Universal Linux LPE",
          url: "https://newshacker.me/story?id=48053623",
          sourceName: "News Hacker",
          sourceType: "social",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content:
            "Linux kernel vulnerability discussion with a paragraph about LLM-assisted vuln research, GitHub Actions, and developer workflow.",
        },
        {
          title: "Show HN: Agentctl, a local control plane for coding agents",
          url: "https://news.ycombinator.com/item?id=480001",
          sourceName: "Hacker News AI Search",
          sourceType: "social",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "A local AI coding agent workflow tool for developers.",
        },
      ]),
      { now: `${date}T08:00:00.000Z` },
    );
    const tangential = scored.find((signal) => signal.title.startsWith("Dirtyfrag"));

    assert.equal(scored[0].title, "Show HN: Agentctl, a local control plane for coding agents");
    assert.ok(tangential.score < 80);
  });

  it("promotes embodied AI and Chinese media buzz that would otherwise look tangential", () => {
    const scored = scoreSignals(
      normalizeSignals([
        {
          title: "一年磨一剑，今年最炸机器人Demo来了！",
          url: "https://www.qbitai.com/2026/05/robot-demo.html",
          sourceName: "量子位",
          sourceType: "news",
          sourceWeight: 15,
          publishedAt: "2026-05-07T06:43:41.000Z",
          content: "1亿美元种子轮团队出手，单个模型解锁单手打蛋、解魔方、弹钢琴，展示具身智能迁移到实物。",
          tags: ["中文媒体", "量子位"],
        },
        {
          title: "新款手机壳发布，外观设计升级",
          url: "https://example.com/phone-case",
          sourceName: "General Tech",
          sourceType: "news",
          publishedAt: "2026-05-07T06:43:41.000Z",
          content: "普通消费电子配件更新。",
        },
      ]),
      { now: `${date}T08:00:00.000Z` },
    );
    const robotics = scored.find((signal) => signal.title.includes("机器人Demo"));
    const generic = scored.find((signal) => signal.title.includes("手机壳"));

    assert.equal(scored[0].title, robotics.title);
    assert.ok(robotics.score >= 84);
    assert.ok(robotics.tags.includes("具身智能"));
    assert.ok(robotics.score - generic.score >= 20);
    assert.match(robotics.scoreReason, /传播热度/);
  });

  it("recognizes Chinese AI product and creator-economy signals as AI-centered", () => {
    const scored = scoreSignals(
      normalizeSignals([
        {
          title: "字节Trae移动端上线，手机远程操作电脑 IDE",
          url: "https://example.com/trae-mobile",
          sourceName: "社媒观察",
          sourceType: "social",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "开发者可以自由配置第三方模型和密钥，深度绑定飞书处理复杂任务。",
          tags: ["X", "开发者社区"],
        },
        {
          title: "姚金刚开源GEO营销提示词集",
          url: "https://github.com/example/geo-prompts",
          sourceName: "GitHub",
          sourceType: "social",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "25 个生成式引擎优化、短视频创作和品牌营销提示词，适配 AI 搜索优化。",
          tags: ["开源", "营销"],
        },
      ]),
      { now: `${date}T08:00:00.000Z` },
    );

    assert.ok(scored.every((signal) => signal.score >= 82));
    assert.ok(scored.some((signal) => signal.tags.includes("AI编程")));
    assert.ok(scored.some((signal) => signal.tags.includes("AI营销")));
  });

  it("routes market, labor, and financing signals to industry instead of open-source or generic social", () => {
    assert.equal(
      classifySignal({
        title: "Kimi new financing values open-source model company above $20B",
        sourceType: "news",
        section: "opensource",
        content: "Moonshot AI is raising financing at a higher valuation while investors compare open-source model economics.",
      }),
      "industry",
    );

    assert.equal(
      classifySignal({
        title: "a16z warns AI unemployment could reshape entry-level jobs",
        sourceType: "social",
        section: "social",
        content: "The discussion centers on labor-market pressure, hiring, and AI automation rather than a product launch.",
      }),
      "industry",
    );

    assert.equal(
      classifySignal({
        title: "AI bubble debate returns as model-company revenue and capex diverge",
        sourceType: "social",
        section: "social",
        content: "Investors debate valuations, datacenter capex, and whether AI startup funding is overheating.",
      }),
      "industry",
    );

    assert.equal(
      classifySignal({
        title: "block/goose open-source agent adds desktop automation",
        sourceType: "github",
        section: "opensource",
        content: "A GitHub repository for an open-source AI agent.",
      }),
      "opensource",
    );
  });

  it("promotes missing parity-watchlist signals from X and developer communities", () => {
    const scored = scoreSignals(
      normalizeSignals([
        {
          title: "Trae mobile lets developers control their IDE from iPhone",
          url: "https://x.com/example/status/1",
          sourceName: "X AI Keyword Watch",
          sourceType: "social",
          publishedAt: "2026-05-08T04:00:00.000Z",
          content: "ByteDance Trae mobile app connects to the desktop IDE, supports remote coding, and keeps agent tasks running.",
          tags: ["X", "AI编程"],
        },
        {
          title: "Warp Skills package repeatable terminal workflows for agents",
          url: "https://x.com/example/status/2",
          sourceName: "X AI Keyword Watch",
          sourceType: "social",
          publishedAt: "2026-05-08T04:00:00.000Z",
          content: "Warp AI turns shell commands, repo context, and team runbooks into reusable Skills for agentic terminal work.",
          tags: ["X", "AI编程"],
        },
        {
          title: "GEO prompts help brands optimize for generative engine answers",
          url: "https://github.com/example/geo-prompts",
          sourceName: "X AI Keyword Watch",
          sourceType: "social",
          publishedAt: "2026-05-08T04:00:00.000Z",
          content: "A prompt pack for generative engine optimization, AI search optimization, and content workflow automation.",
          tags: ["AI营销"],
        },
      ]),
      { now: "2026-05-08T23:59:59.000Z" },
    );

    assert.ok(scored.every((signal) => signal.score >= 82));
    assert.ok(scored.some((signal) => signal.tags.includes("AI编程")));
    assert.ok(scored.some((signal) => signal.tags.includes("AI营销")));
  });

  it("prioritizes launch-grade signals over slower official customer stories", () => {
    const scored = scoreSignals(
      normalizeSignals([
        {
          title: "Simplex rethinks software development with Codex",
          url: "https://openai.com/index/simplex",
          sourceName: "OpenAI News",
          sourceType: "official",
          sourceWeight: 19,
          publishedAt: "2026-05-08T04:00:00.000Z",
          content: "OpenAI customer story about ChatGPT Enterprise and Codex.",
          tags: ["官方", "开发者"],
        },
        {
          title: "Perplexity 个人电脑正式上线，为 Mac 用户带来本地 AI 助手",
          url: "https://www.aibase.com/news/27770",
          sourceName: "AIbase",
          sourceType: "news",
          sourceWeight: 15,
          publishedAt: "2026-05-08T04:00:00.000Z",
          content: "Perplexity 在 Mac 推出常驻本地 AI 助手，能访问本地文件和应用。",
          tags: ["中文媒体", "产品"],
        },
        {
          title: "OpenAI 官方 CLI 工具 openai-cli 发布：一行命令即刻调用 Responses API 与全套 Agent 工具",
          url: "https://www.aibase.com/news/27769",
          sourceName: "AIbase",
          sourceType: "news",
          sourceWeight: 15,
          publishedAt: "2026-05-08T04:00:00.000Z",
          content: "开发者可以在终端直接调用 Responses API、文件检索、图像生成和 Agent 工具。",
          tags: ["中文媒体", "开发者"],
        },
      ]),
      { now: "2026-05-08T23:59:59.000Z" },
    );

    assert.ok(scored.findIndex((signal) => signal.title.includes("Perplexity")) < scored.findIndex((signal) => signal.title.includes("Simplex")));
    assert.ok(scored.findIndex((signal) => signal.title.includes("openai-cli")) < scored.findIndex((signal) => signal.title.includes("Simplex")));
  });

  it("does not confuse geometry or usernames with GEO marketing signals", () => {
    const scored = scoreSignals(
      normalizeSignals([
        {
          title: "Geometry-Aware State Space Model",
          url: "https://arxiv.org/abs/2605.05164",
          sourceName: "arXiv",
          sourceType: "paper",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "Whole-slide image representation research with geometric structure.",
        },
        {
          title: "PySimpleGUI 6 回归开源：商业化争议与资金困境",
          url: "https://newshacker.me/story?id=1",
          sourceName: "News Hacker",
          sourceType: "social",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "评分: 21 | 作者: geophph。讨论 GUI 库商业化后重新开源。",
          tags: ["开发者社区"],
        },
        {
          title: "In-Context Prompting Obsoletes Agent Orchestration Frameworks",
          url: "https://arxiv.org/abs/2604.27891",
          sourceName: "arXiv",
          sourceType: "paper",
          publishedAt: "2026-05-07T04:00:00.000Z",
          content: "Research on agent orchestration frameworks and in-context prompting.",
        },
      ]),
      { now: `${date}T08:00:00.000Z` },
    );

    assert.ok(scored.every((signal) => !signal.tags.includes("AI营销")));
    assert.ok(scored.find((signal) => signal.title.startsWith("PySimpleGUI")).score < 80);
  });

  it("adds a GitHub social preview image when repository items have no media", () => {
    const [signal] = normalizeSignals([
      {
        title: "acme/agent gains 900 stars",
        url: "https://github.com/acme/agent",
        sourceName: "GitHub Trending",
        sourceType: "github",
      },
    ]);

    assert.deepEqual(signal.media.images, ["https://opengraph.githubassets.com/1e1e8d8f/acme/agent"]);
  });

  it("selects core signals without letting one source type flood the run", () => {
    const papers = Array.from({ length: 20 }, (_, index) => ({
      id: `paper-${index}`,
      title: `arXiv AI paper ${index}`,
      url: `https://arxiv.org/abs/2605.${String(index).padStart(5, "0")}`,
      sourceType: "paper",
      sourceId: "arxiv-ai",
      score: 95 - index,
    }));
    const official = Array.from({ length: 4 }, (_, index) => ({
      id: `official-${index}`,
      title: `OpenAI product update ${index}`,
      url: `https://openai.com/news/${index}`,
      sourceType: "official",
      sourceId: "openai-news",
      score: 80 - index,
    }));
    const github = Array.from({ length: 4 }, (_, index) => ({
      id: `github-${index}`,
      title: `GitHub agent project ${index}`,
      url: `https://github.com/acme/agent-${index}`,
      sourceType: "github",
      sourceId: "github-trending",
      score: 76 - index,
    }));

    const selected = selectCoreSignals([...papers, ...official, ...github], {
      limit: 12,
      sourceTypeCaps: { paper: 5 },
      maxPerSourceId: 6,
    });

    assert.equal(selected.length, 12);
    assert.equal(selected.filter((signal) => signal.sourceType === "paper").length, 5);
    assert.ok(selected.some((signal) => signal.sourceType === "official"));
    assert.ok(selected.some((signal) => signal.sourceType === "github"));
  });

  it("filters stale dated signals from the daily core pool", () => {
    const selected = selectCoreSignals(
      [
        {
          id: "old-official",
          title: "Old official model launch",
          url: "https://openai.com/news/old",
          sourceType: "official",
          sourceId: "openai-news",
          publishedAt: "2026-04-01T00:00:00.000Z",
          score: 99,
        },
        {
          id: "fresh-news",
          title: "Fresh AIbase model update",
          url: "https://www.aibase.com/news/27741",
          sourceType: "news",
          sourceId: "aibase-news",
          publishedAt: "2026-05-07T09:00:00.000Z",
          score: 76,
        },
      ],
      {
        limit: 2,
        now: "2026-05-08T23:59:59.000Z",
        maxAgeHours: 24 * 7,
      },
    );

    assert.deepEqual(selected.map((signal) => signal.id), ["fresh-news"]);
  });

  it("excludes URLs that already appeared in recent published dailies", () => {
    const selected = selectCoreSignals(
      [
        {
          id: "repeat",
          title: "Repeated OpenAI launch",
          url: "https://openai.com/news/repeated?utm_source=rss",
          canonicalUrl: "https://openai.com/news/repeated",
          sourceType: "official",
          sourceId: "openai-news",
          score: 99,
        },
        {
          id: "fresh",
          title: "Fresh Anthropic launch",
          url: "https://www.anthropic.com/news/fresh",
          sourceType: "official",
          sourceId: "anthropic-news",
          score: 91,
        },
      ],
      {
        limit: 2,
        excludeUrls: ["https://openai.com/news/repeated"],
      },
    );

    assert.deepEqual(selected.map((signal) => signal.id), ["fresh"]);
  });
});
