import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeDaily } from "../../scripts/content-agent/compose/daily.mjs";
import { composeWeekly } from "../../scripts/content-agent/compose/weekly.mjs";

const summaries = [
  {
    id: "agent-product",
    title: "托管智能体进入产品层",
    aiSummary: "OpenAI 将托管智能体推到开发者入口。焦糖星球关注它对长任务工作流的影响。",
    aiScore: 93,
    reason: "AI相关度高；时效性高。",
    section: "product",
    sourceName: "OpenAI News",
    sourceUrl: "https://openai.com/news/managed-agents",
    tags: ["Agent", "产品"],
    media: { images: ["https://example.com/agent.png"], videos: [] },
  },
  {
    id: "paper",
    title: "新评测刷新推理效率判断",
    aiSummary: "论文把推理效率拆成更细指标。焦糖星球会把它放进模型基建观察。",
    aiScore: 88,
    reason: "研究相关度高。",
    section: "research",
    sourceName: "arXiv",
    sourceUrl: "https://arxiv.org/abs/2605.04036",
    tags: ["研究", "推理"],
  },
  {
    id: "github",
    title: "开源 Agent 框架继续冲榜",
    aiSummary: "GitHub 项目用工作流和工具调用吸引开发者。它说明 Agent 工程化需求还在升温。",
    aiScore: 90,
    reason: "开源影响高。",
    section: "opensource",
    sourceName: "GitHub Trending",
    sourceUrl: "https://github.com/acme/agent",
    tags: ["开源", "Agent"],
  },
];

describe("content-agent composers", () => {
  it("composes an Astro daily with section frontmatter and source links", () => {
    const daily = composeDaily({
      date: "2026-05-07",
      summaries,
      brand: "焦糖星球",
      draft: true,
    });

    assert.equal(daily.relativePath, "src/content/dailies/2026-05-07.md");
    assert.match(daily.markdown, /title: "焦糖星球 AI资讯日报 2026\/5\/7"/);
    assert.match(daily.markdown, /sections:/);
    assert.match(daily.markdown, /今日摘要/);
    assert.match(daily.markdown, /产品与功能更新/);
    assert.match(daily.markdown, /https:\/\/openai.com\/news\/managed-agents/);
    assert.match(daily.markdown, /全网数据聚合/);
    assert.match(daily.markdown, /class="daily-signal__headline" href="https:\/\/openai.com\/news\/managed-agents"/);
    assert.match(daily.markdown, /class="daily-signal__source" href="https:\/\/openai.com\/news\/managed-agents"/);
    assert.match(daily.markdown, /class="daily-signal__focus">重点词/);
    assert.match(daily.markdown, /<mark>Agent<\/mark>/);
    assert.match(daily.markdown, /cursor-zoom-in relative group transition-all block/);
    assert.match(daily.markdown, /<img src="https:\/\/example.com\/agent.png" alt="AI资讯：托管智能体进入产品层"/);
    assert.ok(daily.description.length <= 300);
  });

  it("renders the daily digest as structured editor picks", () => {
    const richSummaries = Array.from({ length: 12 }, (_, index) => ({
      ...summaries[index % summaries.length],
      id: `item-${index}`,
      title: `今日AI信号${index + 1}`,
      aiScore: 100 - index,
    }));
    const daily = composeDaily({
      date: "2026-05-07",
      summaries: richSummaries,
      brand: "焦糖星球",
      draft: true,
    });
    const digest = daily.markdown.match(/<div class="daily-digest">[\s\S]*?<\/ol>\n<\/div>/)?.[0] ?? "";
    assert.doesNotMatch(daily.markdown, /```text/);
    assert.equal((digest.match(/<li>/g) ?? []).length, 6);
    assert.match(digest, /daily-digest__index/);
    assert.match(digest, /daily-digest__section/);
    assert.match(digest, /<p>OpenAI 将托管智能体推到开发者入口<\/p>/);
  });

  it("deduplicates same-event summaries after editorial headline rewriting", () => {
    const daily = composeDaily({
      date: "2026-05-10",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "aibase-codex-chrome",
          title: "Codex for Chrome 正式开放",
          aiSummary: "AIbase 报道 Codex for Chrome 浏览器工作流。",
          aiScore: 95,
          reason: "高分。",
          section: "product",
          sourceName: "AIbase",
          sourceUrl: "https://www.aibase.com/news/27809",
          tags: ["Codex"],
        },
        {
          id: "geekpark-codex-chrome",
          title: "OpenAI 400 万周活 Codex 接入 Chrome",
          aiSummary: "极客公园报道同一条 Codex Chrome 信号。",
          aiScore: 90,
          reason: "高分。",
          section: "industry",
          sourceName: "极客公园",
          sourceUrl: "https://www.geekpark.net/news/363869",
          tags: ["Codex"],
        },
      ],
    });

    assert.equal((daily.markdown.match(/sourceUrl:/g) ?? []).length, 1);
    assert.match(daily.markdown, /https:\/\/www\.aibase\.com\/news\/27809/);
    assert.doesNotMatch(daily.markdown, /https:\/\/www\.geekpark\.net\/news\/363869/);
  });

  it("rewrites May 10 fallback candidates into readable Chinese editorial copy", () => {
    const daily = composeDaily({
      date: "2026-05-10",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "draft-cli",
          title: "Show HN: A Codex/Claude Code plugin for persistent product context thru sessions",
          aiSummary:
            "**Show HN: A Codex/Claude Code plug…。** some of the friction of using coding agents for product building。",
          aiScore: 88,
          reason: "高分。",
          section: "social",
          sourceName: "Hacker News AI Search",
          sourceUrl: "https://github.com/idodekerobo/draft-cli-plugin",
          tags: ["HN", "Agent", "开发者"],
        },
        {
          id: "android-codex",
          title:
            "The ChatGPT Android app should soon allow users to remotely control Codex coding sessions on their PCs",
          aiSummary: "submitted by /u/AssembleDebugRed [link] [comments]。",
          aiScore: 86,
          reason: "高分。",
          section: "social",
          sourceName: "Reddit OpenAI",
          sourceUrl: "https://www.reddit.com/r/OpenAI/comments/example",
          tags: ["Reddit", "OpenAI", "AI编程"],
        },
        {
          id: "self-replication",
          title: '"This is the first documented instance of AI self-replication via hacking."',
          aiSummary: "Paper: https://palisaderesearch。",
          aiScore: 92,
          reason: "高分。",
          section: "research",
          sourceName: "Reddit OpenAI",
          sourceUrl: "https://www.reddit.com/r/OpenAI/comments/self-replication",
          tags: ["Reddit", "研究"],
        },
      ],
    });

    assert.match(daily.markdown, /Draft 插件为 Codex 与 Claude Code 保留产品上下文/);
    assert.match(daily.markdown, /ChatGPT Android 可能支持远程控制 Codex 会话/);
    assert.match(daily.markdown, /Palisade Research 测试 AI 通过入侵链式自我复制/);
    assert.doesNotMatch(daily.markdown, /进入今日(?:社媒分享|前沿研究|开源TOP项目)?观察/);
    assert.doesNotMatch(daily.markdown, /submitted by|some of the friction|Paper: https:\/\/palisaderesearch/);
  });

  it("expands short noisy summaries so generated frontmatter satisfies the daily schema", () => {
    const daily = composeDaily({
      date: "2026-05-10",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "short-summary",
          title: "LLM 进入今日行业观察",
          originalTitle: "LLM 进入今日行业观察",
          aiSummary: "这条摘要只有十来个字",
          aiScore: 80,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "Reddit Artificial",
          sourceUrl: "https://www.reddit.com/r/artificial/comments/example",
          tags: ["社区"],
        },
      ],
    });

    assert.doesNotMatch(daily.markdown, /summary: "这条摘要只有十来个字"/);
    assert.match(daily.markdown, /summary: "Reddit Artificial 出现一条 LLM 进入今日行业展望与社会影响观察/);
  });

  it("rewrites known English signals into readable Chinese editorial copy", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "b2b",
          title: "How frontier enterprises are building an …",
          originalTitle: "How frontier enterprises are building an AI advantage",
          aiSummary:
            "**How frontier enterprises are buil…。** OpenAI’s B2B Signals research shows how frontier enterprises deepen AI adoption, scale …。 焦糖星球把它归入今日 AI资讯 观察 🤖。",
          aiScore: 99,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "OpenAI News",
          sourceUrl: "https://openai.com/index/introducing-b2b-signals",
          tags: ["Agent", "开发者"],
        },
      ],
    });
    assert.match(daily.markdown, /OpenAI 发布 B2B Signals 企业 AI 采用研究/);
    assert.match(daily.markdown, /报告拆解前沿企业如何把 AI 从试点推进到规模化应用/);
    assert.doesNotMatch(daily.markdown, /OpenAI’s B2B Signals research shows/);
  });

  it("does not rewrite OpenSearch-VL as the Hy3preview usage story", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "opensearch",
          title: "腾讯发布OpenSearch-VL：开源多模态深度搜索 agent 的全家桶方案",
          aiSummary: "腾讯混元联合高校开源了多模态搜索智能体，重点是让模型能主动搜索和推理。",
          aiScore: 96,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "AIbase",
          sourceUrl: "https://www.aibase.com/news/27741",
          tags: ["多模态", "开源"],
        },
      ],
    });

    assert.match(daily.markdown, /腾讯开源 OpenSearch-VL 多模态搜索智能体/);
    assert.doesNotMatch(daily.markdown, /腾讯混元 Hy3preview 调用量快速增长/);
  });

  it("localizes broader English intelligence-pool items into readable Chinese copy", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "chatgpt-ads",
          title: "Testing ads in ChatGPT",
          originalTitle: "Testing ads in ChatGPT",
          aiSummary:
            "**Testing ads in ChatGPT。** OpenAI begins testing ads in ChatGPT to support free access, with clear labeling, answer-first design, and privacy controls.",
          aiScore: 97,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "OpenAI News",
          sourceUrl: "https://openai.com/index/testing-ads-in-chatgpt",
          tags: ["官方", "商业化"],
        },
        {
          id: "reasoning-paper",
          title: "Investigating Advanced Reasoning of Large Language Models via Black-Box Environment Interaction",
          originalTitle: "Investigating Advanced Reasoning of Large Language Models via Black-Box Environment Interaction",
          aiSummary:
            "arXiv:2508.19035v2 Announce Type: replace Abstract: Existing tasks fall short in evaluating advanced reasoning when models interact with black-box environments.",
          aiScore: 95,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "arXiv cs.AI",
          sourceUrl: "https://arxiv.org/abs/2508.19035",
          tags: ["论文", "推理"],
        },
        {
          id: "claude-spacex",
          title: "Anthropic raises Claude Code usage limits, credits new deal with SpaceX",
          originalTitle: "Anthropic raises Claude Code usage limits, credits new deal with SpaceX",
          aiSummary:
            "SAN FRANCISCO—At its Code with Claude developer conference, Anthropic announced increased Claude Code usage limits and credited a new SpaceX partnership.",
          aiScore: 94,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "Ars Technica AI",
          sourceUrl: "https://arstechnica.com/ai/2026/05/anthropic-raises-claude-code-usage-limits-credits-new-deal-with-spacex",
          tags: ["Claude", "算力"],
        },
        {
          id: "alphaevolve",
          title: "AlphaEvolve: Gemini-powered coding agent scaling impact across fields",
          originalTitle: "AlphaEvolve: Gemini-powered coding agent scaling impact across fields",
          aiSummary:
            "AlphaEvolve: Gemini-powered coding agent scaling impact across fields. Hacker News users discussed its narrow optimization strengths.",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Hacker News AI Search",
          sourceUrl: "https://deepmind.google/blog/alphaevolve-impact",
          tags: ["HN", "Gemini"],
        },
      ],
    });

    assert.match(daily.markdown, /OpenAI 在 ChatGPT 中测试广告/);
    assert.match(daily.markdown, /黑箱环境交互评估大模型高级推理能力/);
    assert.match(daily.markdown, /Anthropic 与 SpaceX 算力合作扩大 Claude Code 供给/);
    assert.match(daily.markdown, /Google DeepMind 展示 Gemini 驱动的 AlphaEvolve/);
    assert.doesNotMatch(daily.markdown, /官方 相关信号进入今日重点/);
    assert.doesNotMatch(daily.markdown, /论文 相关信号进入今日重点/);
    assert.doesNotMatch(daily.markdown, /RSS 流量超过 Google/);
    assert.doesNotMatch(daily.markdown, /Testing ads in ChatGPT。/);
  });

  it("keeps newly surfaced pool items out of generic fallback labels", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "simplex",
          title: "Simplex rethinks software development with Codex",
          originalTitle: "Simplex rethinks software development with Codex",
          aiSummary:
            "Simplex boosts software development with ChatGPT Enterprise and Codex, reducing design and development cycles.",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "OpenAI News",
          sourceUrl: "https://openai.com/index/simplex",
          tags: ["官方", "开发者"],
        },
        {
          id: "mythos",
          title: "Spooked by Mythos, Trump suddenly realized AI safety testing might be good",
          originalTitle: "Spooked by Mythos, Trump suddenly realized AI safety testing might be good",
          aiSummary:
            "The Trump administration signed agreements with Google DeepMind and other labs after concerns around Mythos and AI safety testing.",
          aiScore: 84,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "Ars Technica AI",
          sourceUrl: "https://arstechnica.com/tech-policy/2026/05/everything-that-could-go-wrong-with-trumps-ai-safety-tests-according-to-experts",
          tags: ["安全", "政策"],
        },
        {
          id: "recondo",
          title: "Recondo – Logging Proxy for Coding Agents (Claude Code, Codex, Gemini)",
          originalTitle: "Recondo – Logging Proxy for Coding Agents (Claude Code, Codex, Gemini)",
          aiSummary:
            "Recondo is a logging proxy for coding agents including Claude Code, Codex, and Gemini.",
          aiScore: 82,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Hacker News AI Search",
          sourceUrl: "https://github.com/recondodev/recondo",
          tags: ["HN", "Agent"],
        },
      ],
    });

    assert.match(daily.markdown, /Simplex 用 ChatGPT Enterprise 和 Codex 重塑软件开发/);
    assert.match(daily.markdown, /美国 AI 安全测试政策因 Mythos 风险重新升温/);
    assert.match(daily.markdown, /Recondo 为编码智能体提供日志代理/);
    assert.doesNotMatch(daily.markdown, /英文媒体 相关信号进入今日重点/);
    assert.doesNotMatch(daily.markdown, /Claude Code 负责人反思“氛围编程”说法/);
  });

  it("rewrites newly selected buzz and open-source signals into editorial Chinese", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "robot-demo",
          title: "一年磨一剑，今年最炸机器人Demo来了！",
          originalTitle: "一年磨一剑，今年最炸机器人Demo来了！",
          aiSummary: "1亿美元种子轮团队出手，单个模型解锁单手打蛋解魔方弹钢琴。",
          aiScore: 95,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "量子位",
          sourceUrl: "https://www.qbitai.com/2026/05/413830.html",
          tags: ["中文媒体", "具身智能"],
        },
        {
          id: "singular",
          title: "Singular Bank helps bankers move fast with ChatGPT and Codex",
          originalTitle: "Singular Bank helps bankers move fast with ChatGPT and Codex",
          aiSummary: "Singular Bank uses ChatGPT and Codex to help banking teams ship faster.",
          aiScore: 92,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "OpenAI News",
          sourceUrl: "https://openai.com/index/singular-bank",
          tags: ["官方", "商业化"],
        },
        {
          id: "pageindex",
          title: "VectifyAI/PageIndex 开源项目冲榜",
          originalTitle: "VectifyAI/PageIndex 开源项目冲榜",
          aiSummary: "Project for indexing long documents for retrieval and AI agents.",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub Trending",
          sourceUrl: "https://github.com/VectifyAI/PageIndex",
          tags: ["GitHub", "开源"],
        },
        {
          id: "dflash",
          title: "z-lab/dflash 开源项目冲榜",
          originalTitle: "z-lab/dflash 开源项目冲榜",
          aiSummary: "A fast data and model serving project for agent workflows.",
          aiScore: 90,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub Trending",
          sourceUrl: "https://github.com/z-lab/dflash",
          tags: ["GitHub", "开源"],
        },
        {
          id: "codex-limit",
          title: "Ask HN: Does Codex hits limits more easily?",
          originalTitle: "Ask HN: Does Codex hits limits more easily?",
          aiSummary: "HN users discuss whether Codex rate limits are easier to hit than before.",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Hacker News AI Search",
          sourceUrl: "https://news.ycombinator.com/item?id=1",
          tags: ["HN", "Codex"],
        },
      ],
    });

    assert.match(daily.markdown, /机器人团队展示单模型打蛋与弹琴 Demo/);
    assert.match(daily.markdown, /Singular Bank 用 ChatGPT 和 Codex 加速银行工作流/);
    assert.match(daily.markdown, /PageIndex 冲榜长文档索引开源项目/);
    assert.match(daily.markdown, /dflash 冲榜开发者工具开源项目/);
    assert.match(daily.markdown, /HN 热议 Codex 使用限额更容易触顶/);
    assert.doesNotMatch(daily.markdown, /Singular Bank helps bankers/);
    assert.doesNotMatch(daily.markdown, /Ask HN: Does Codex/);
  });

  it("rewrites newly selected research papers into specific Chinese editorial copy", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "agent-island",
          title: "Agent Island: A Saturation- and Contamination-Resistant Agent Benchmark",
          originalTitle: "Agent Island: A Saturation- and Contamination-Resistant Agent Benchmark",
          aiSummary:
            "Static capabilities benchmarks are saturated and contaminated. Agent Island evaluates agents in long-horizon interactive environments.",
          aiScore: 96,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "arXiv cs.AI",
          sourceUrl: "https://arxiv.org/abs/2605.00001",
          tags: ["论文", "Agent"],
        },
        {
          id: "tscg",
          title: "TSCG: Deterministic Tool-Schema Compilation for Reliable Agents",
          originalTitle: "TSCG: Deterministic Tool-Schema Compilation for Reliable Agents",
          aiSummary:
            "TSCG compiles tool schemas into deterministic constraints so agents make fewer tool-calling format mistakes.",
          aiScore: 94,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "arXiv cs.AI",
          sourceUrl: "https://arxiv.org/abs/2605.00002",
          tags: ["论文", "Agent"],
        },
        {
          id: "orchestration",
          title: "In-Context Prompting Obsoletes Agent Orchestration Frameworks",
          originalTitle: "In-Context Prompting Obsoletes Agent Orchestration Frameworks",
          aiSummary:
            "Production agent frameworks add orchestration layers, but in-context prompting may handle coordination for many tasks.",
          aiScore: 93,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "arXiv cs.AI",
          sourceUrl: "https://arxiv.org/abs/2605.00003",
          tags: ["论文", "Agent"],
        },
      ],
    });

    assert.match(daily.markdown, /Agent Island 评估多智能体基准污染问题/);
    assert.match(daily.markdown, /TSCG 用确定性工具 Schema 规范智能体调用/);
    assert.match(daily.markdown, /上下文提示可能替代部分 Agent 编排框架/);
    assert.match(daily.markdown, /复杂环境中的真实泛化/);
    assert.match(daily.markdown, /减少智能体在工具使用中的格式漂移/);
    assert.match(daily.markdown, /重新评估 Agent 架构复杂度/);
    assert.doesNotMatch(daily.markdown, /论文 相关信号进入今日重点/);
    assert.doesNotMatch(daily.markdown, /Static capabilities benchmarks/);
    assert.doesNotMatch(daily.markdown, /Production agent frameworks/);
  });

  it("rewrites noisy Chinese RSS and security social items into concise editorial copy", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "codex-chrome",
          title: "400 万周活的 Codex 推出 Chrome 扩展，OpenAI 把 AI 带…",
          originalTitle: "400 万周活的 Codex 推出 Chrome 扩展，OpenAI 把 AI 带进浏览器工作流",
          aiSummary:
            "**400 万周活的 Codex 推出 Chrome 扩展，OpenA…。** IT之家 5 月 8 日消息，OpenAI 面向谷歌 Chrome 浏览器， 推出了 Codex for Chrome 扩展程序，协助用户处理日常浏览器操作。",
          aiScore: 100,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "IT之家",
          sourceUrl: "https://www.ithome.com/0/947/648.htm",
          tags: ["中文媒体", "AI编程"],
        },
        {
          id: "kimi-financing",
          title: "传月之暗面新融 20 亿美元，估值超 200 亿美元；豆包曝光首个全模态理解模型；…",
          originalTitle: "传月之暗面新融 20 亿美元，估值超 200 亿美元；豆包曝光首个全模态理解模型；开播 24 年后， 星空卫视停播｜极客早知道",
          aiSummary:
            "**传月之暗面新融 20 亿美元，估值超 200 亿美元；豆包曝光首个…。** &nbsp; 消息称月之暗面 Kimi 将完成 20 亿美元新融资，估值破 200 亿美元。",
          aiScore: 100,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "极客公园",
          sourceUrl: "http://www.geekpark.net/news/363775",
          tags: ["中文媒体", "模型"],
        },
        {
          id: "ai-video-agent",
          title: "在模型厂碾压之前，AI视频Agent产品是否只能挣波快钱？",
          originalTitle: "在模型厂碾压之前，AI视频Agent产品是否只能挣波快钱？",
          aiSummary:
            "**在模型厂碾压之前，AI视频Agent产品是否只能挣波快钱？。** 文｜王毓婵 周鑫雨 编辑｜杨轩 “看流水（即营收），AI视频类这些项目的表现确实很不错。",
          aiScore: 100,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "36氪",
          sourceUrl: "https://36kr.com/p/3786528811572481?f=rss",
          tags: ["中文媒体", "商业化"],
        },
        {
          id: "claude-code-cve",
          title: "Claude Code CVE-2026-39861:sandbox escape via symlink",
          originalTitle: "Claude Code CVE-2026-39861:sandbox escape via symlink",
          aiSummary: "Claude Code CVE-2026-39861:sandbox escape via symlink",
          aiScore: 100,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Hacker News AI Search",
          sourceUrl: "https://github.com/advisories/GHSA-vp62-r36r-9xqp",
          tags: ["HN", "AI编程"],
        },
      ],
    });

    assert.match(daily.markdown, /OpenAI 将 Codex 扩展到 Chrome 浏览器工作流/);
    assert.match(daily.markdown, /Kimi 新融资推高国产大模型估值竞赛/);
    assert.match(daily.markdown, /AI 视频 Agent 在大模型挤压下寻找商业壁垒/);
    assert.match(daily.markdown, /Claude Code 沙箱逃逸漏洞提醒团队收紧 Agent 权限/);
    assert.doesNotMatch(daily.markdown, /&nbsp;/);
    assert.doesNotMatch(daily.markdown, /文｜/);
    assert.doesNotMatch(daily.markdown, /氛围编程/);
    assert.doesNotMatch(daily.markdown, /OpenA…/);
  });

  it("rewrites GitHub search discoveries into specific Chinese editorial copy", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "openagent",
          title: "code-yeongyu/oh-my-openagent 开源项目进入增量观察",
          originalTitle: "code-yeongyu/oh-my-openagent 开源项目进入增量观察",
          aiSummary: "omo; the best agent harness - previously oh-my-opencode Topics: ai, ai-agents, amp",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub AI Project Search",
          sourceUrl: "https://github.com/code-yeongyu/oh-my-openagent",
          tags: ["GitHub", "增量发现", "ai-agents"],
        },
        {
          id: "cowagent",
          title: "zhayujie/CowAgent 开源项目进入增量观察",
          originalTitle: "zhayujie/CowAgent 开源项目进入增量观察",
          aiSummary:
            "CowAgent (chatgpt-on-wechat) 是基于大模型的超级AI助理，能主动思考和任务规划、访问操作系统和外部资源、创造和执行Skills、通过长期记忆和知识库不断成长。",
          aiScore: 90,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub AI Project Search",
          sourceUrl: "https://github.com/zhayujie/CowAgent",
          tags: ["GitHub", "增量发现", "chatgpt-on-wechat"],
        },
        {
          id: "claude-sdk",
          title: "anthropics/claude-agent-sdk-python 开源项目进入…",
          originalTitle: "anthropics/claude-agent-sdk-python 开源项目进入增量观察",
          aiSummary: "null Language: Python",
          aiScore: 89,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub Agent Org Search",
          sourceUrl: "https://github.com/anthropics/claude-agent-sdk-python",
          tags: ["GitHub", "组织监听", "Agent"],
        },
        {
          id: "goose",
          title: "aaif-goose/goose 开源项目进入重点观察",
          originalTitle: "aaif-goose/goose 开源项目进入重点观察",
          aiSummary: "An open source, extensible AI agent that goes beyond code suggestions.",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub Curated Agent Repos",
          sourceUrl: "https://github.com/block/goose",
          tags: ["GitHub", "精选开源"],
        },
        {
          id: "deer",
          title: "bytedance/deer-flow 开源项目进入重点观察",
          originalTitle: "bytedance/deer-flow 开源项目进入重点观察",
          aiSummary: "An open-source long-horizon SuperAgent harness that researches, codes, and creates.",
          aiScore: 87,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub Curated Agent Repos",
          sourceUrl: "https://github.com/bytedance/deer-flow",
          tags: ["GitHub", "精选开源"],
        },
      ],
    });

    assert.match(daily.markdown, /oh-my-openagent 汇总开源 Agent 工具链实践/);
    assert.match(daily.markdown, /CowAgent 把微信机器人升级成可规划的 AI 助理/);
    assert.match(daily.markdown, /Anthropic 开源 Claude Agent SDK Python 版本/);
    assert.match(daily.markdown, /Goose 把开源 Agent 放进终端执行链路/);
    assert.match(daily.markdown, /字节 deer-flow 开源深度研究工作流/);
    assert.doesNotMatch(daily.markdown, /开源项目进入增量观察/);
    assert.doesNotMatch(daily.markdown, />null Language: Python</);
    assert.doesNotMatch(daily.markdown, /the best agent harness/);
  });

  it("rewrites LibreChat GitHub discovery instead of exposing the generic search title", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "librechat",
          title: "danny-avila/LibreChat 开源项目进入增量观察",
          originalTitle: "danny-avila/LibreChat 开源项目进入增量观察",
          aiSummary: "Enhanced ChatGPT Clone: Features Agents, MCP, DeepSeek, Anthropic, AWS, OpenAI, Responses API.",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub AI Project Search",
          sourceUrl: "https://github.com/danny-avila/LibreChat",
          tags: ["GitHub", "增量发现", "Agent"],
        },
      ],
    });

    assert.match(daily.markdown, /LibreChat 把开源聊天平台扩展成多模型 Agent 工作台/);
    assert.match(daily.markdown, /MCP、DeepSeek、Anthropic、OpenAI/);
    assert.doesNotMatch(daily.markdown, /开源项目进入增量观察/);
    assert.doesNotMatch(daily.markdown, /Enhanced ChatGPT Clone/);
  });

  it("rewrites model-safety reasoning-trace stories instead of generic English-media labels", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "reasoning-trace",
          title: "AI safety tests have a new problem: Models are now faking their own reasoning traces",
          originalTitle: "AI safety tests have a new problem: Models are now faking their own reasoning traces",
          aiSummary: "Anthropic's Natural Language Autoencoders make Claude Opus 4 expose a new issue: models can fake their own reasoning traces.",
          aiScore: 94,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "The Decoder",
          sourceUrl: "https://the-decoder.com/ai-safety-tests-have-a-new-problem-models-are-now-faking-their-own-reasoning-traces",
          tags: ["英文媒体", "安全", "研究"],
        },
      ],
    });

    assert.match(daily.markdown, /模型开始伪造推理轨迹，AI 安全测试面临新问题/);
    assert.match(daily.markdown, /安全评测不能只看模型给出的思考过程/);
    assert.doesNotMatch(daily.markdown, /英文媒体 相关信号进入今日重点/);
    assert.doesNotMatch(daily.markdown, /Anthropic's Natural Language Autoencoders/);
  });

  it("rewrites HN surfaced security-agent projects into specific editorial copy", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "phishing-arena",
          title: "Phishing Arena – multi-agent LLM tournament to study adversarial email security",
          originalTitle: "Phishing Arena – multi-agent LLM tournament to study adversarial email security",
          aiSummary: "Phishing Arena – multi-agent LLM tournament to study adversarial email security.",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Hacker News AI Search",
          sourceUrl: "https://github.com/Krabby24/phishing-arena",
          tags: ["HN", "Agent", "安全"],
        },
      ],
    });

    assert.match(daily.markdown, /Phishing Arena 用多智能体锦标赛研究钓鱼邮件攻防/);
    assert.match(daily.markdown, /把攻击者、防守者和评审模型放进同一个实验场/);
    assert.doesNotMatch(daily.markdown, /HN 相关信号进入今日重点/);
  });

  it("rewrites newly selected product and research propagation signals", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "perplexity",
          title: "Perplexity 个人电脑正式上线，为 Mac 用户带来本地 AI 助手",
          originalTitle: "Perplexity 个人电脑正式上线，为 Mac 用户带来本地 AI 助手",
          aiSummary: "Perplexity 推出名为“个人电脑”的Mac应用，向所有用户开放",
          aiScore: 96,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "AIbase",
          sourceUrl: "https://www.aibase.com/news/27770",
          tags: ["Perplexity", "产品"],
        },
        {
          id: "openai-cli",
          title: "​OpenAI 官方 CLI 工具 openai-cli 发布：一行命令即刻调用 …",
          originalTitle: "OpenAI 官方 CLI 工具 openai-cli 发布：一行命令即刻调用 Responses API 与全套 Agent 工具",
          aiSummary: "OpenAI 发布官方命令行工具 openai-cli，开发者无需编写 SDK 代码即可在终端直接调用 API。",
          aiScore: 93,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "AIbase",
          sourceUrl: "https://www.aibase.com/news/27769",
          tags: ["openai-cli", "AI编程"],
        },
        {
          id: "programbench",
          title: "🤨 ProgramBench：LLM 从黑盒重建程序，是否太苛刻？",
          originalTitle: "🤨 ProgramBench：LLM 从黑盒重建程序，是否太苛刻？",
          aiSummary: "News Hacker 出现一条 开发者社区 相关信号，后续重点看它对产品、研究或开发者工作流的实际影响。",
          aiScore: 90,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "News Hacker",
          sourceUrl: "https://newshacker.me/story?id=48045174",
          tags: ["ProgramBench", "评测"],
        },
        {
          id: "nla",
          title: "Anthropic NLA：把模型激活译成文本，开权重与真实性争议并存",
          originalTitle: "Anthropic NLA：把模型激活译成文本，开权重与真实性争议并存",
          aiSummary: "Anthropic open-sources Natural Language Activations to explain model internals.",
          aiScore: 89,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "News Hacker",
          sourceUrl: "https://newshacker.me/story?id=48052537",
          tags: ["NLA", "可解释性"],
        },
        {
          id: "gpt-image",
          title: "GPT-Image-2 in the Wild: A Twitter Dataset for Visual Reasoning",
          originalTitle: "GPT-Image-2 in the Wild: A Twitter Dataset for Visual Reasoning",
          aiSummary: "The release of GPT-image-2 by OpenAI created a Twitter dataset for studying model behavior.",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "arXiv cs.AI",
          sourceUrl: "https://arxiv.org/abs/2604.25370",
          tags: ["论文", "视觉"],
        },
      ],
    });

    assert.match(daily.markdown, /Perplexity Mac 助手面向所有用户开放/);
    assert.match(daily.markdown, /OpenAI CLI 让开发者在终端直接调用 Agent 工具/);
    assert.match(daily.markdown, /ProgramBench 用程序重建任务拷问 LLM 理解力/);
    assert.match(daily.markdown, /Anthropic NLA 把模型激活翻译成自然语言/);
    assert.match(daily.markdown, /GPT-Image-2 Twitter 数据集暴露视觉模型真实用法/);
    assert.doesNotMatch(daily.markdown, /相关信号进入今日重点/);
  });

  it("keeps parity-watchlist items specific, Chinese, and fact-rich", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "trae-mobile",
          title: "Trae mobile lets developers control their IDE from iPhone",
          originalTitle: "Trae mobile lets developers control their IDE from iPhone",
          aiSummary: "ByteDance Trae mobile app connects to the desktop IDE and keeps agent coding tasks running.",
          aiScore: 96,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "X AI Keyword Watch",
          sourceUrl: "https://x.com/example/status/1",
          tags: ["X", "AI编程"],
        },
        {
          id: "warp-skills",
          title: "Warp开源高效技能库",
          originalTitle: "Warp开源高效技能库",
          aiSummary: "Warp 开源内部自动化技能库，智能终端把团队流程沉淀成 skills。",
          aiScore: 95,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "X AI Keyword Watch",
          sourceUrl: "https://x.com/example/status/2",
          tags: ["X", "AI编程"],
        },
        {
          id: "perplexity-pc",
          title: "智能代理个人电脑",
          originalTitle: "智能代理个人电脑",
          aiSummary: "Perplexity 个人电脑产品把本地文件和应用上下文接入 Mac 助手。",
          aiScore: 94,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "Independent Link Review",
          sourceUrl: "https://www.aibase.com/zh/news/27759",
          tags: ["Agent"],
        },
        {
          id: "gpt5-visual",
          title: "GPT-5 visual protocol connects screen understanding to computer-use agents",
          originalTitle: "GPT-5 visual protocol connects screen understanding to computer-use agents",
          aiSummary: "A visual protocol lets GPT-5 style agents inspect screens, locate UI elements, and automate tasks.",
          aiScore: 94,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "X AI Keyword Watch",
          sourceUrl: "https://x.com/example/status/3",
          tags: ["视觉", "Agent"],
        },
        {
          id: "geo-prompts",
          title: "GEO prompts help brands optimize for generative engine answers",
          originalTitle: "GEO prompts help brands optimize for generative engine answers",
          aiSummary: "The prompt pack targets generative engine optimization, AI search optimization, and marketing workflows.",
          aiScore: 93,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub AI Project Search",
          sourceUrl: "https://github.com/example/geo-prompts",
          tags: ["AI营销", "开源"],
        },
        {
          id: "msm",
          title: "Anthropic MSM alignment maps model behavior through sparse feature maps",
          originalTitle: "Anthropic MSM alignment maps model behavior through sparse feature maps",
          aiSummary: "Anthropic researchers use model-similarity maps to inspect alignment drift across training stages.",
          aiScore: 92,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "X AI Keyword Watch",
          sourceUrl: "https://x.com/example/status/4",
          tags: ["Anthropic", "可解释性"],
        },
        {
          id: "vercel-ai",
          title: "vercel/ai agent template expands full-stack AI app scaffolding",
          originalTitle: "vercel/ai agent template expands full-stack AI app scaffolding",
          aiSummary: "Vercel AI SDK templates show how to ship chat, tools, streaming UI, and agent workflows.",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub Curated Agent Repos",
          sourceUrl: "https://github.com/vercel/ai",
          tags: ["GitHub", "Agent"],
        },
      ],
    });

    assert.match(daily.markdown, /Trae 移动端把手机变成远程 IDE 控制台/);
    assert.match(daily.markdown, /Warp Skills 把终端工作流封装成可复用技能/);
    assert.match(daily.markdown, /Perplexity Mac 助手面向所有用户开放/);
    assert.match(daily.markdown, /GPT-5 视觉协议把屏幕理解接进自动化链路/);
    assert.match(daily.markdown, /GEO 提示词集把 AI 搜索优化带进营销工作流/);
    assert.match(daily.markdown, /Anthropic MSM 用模型特征图观察对齐漂移/);
    assert.match(daily.markdown, /Vercel 开源 Agent 模板降低 AI 应用交付门槛/);
    assert.ok((daily.markdown.match(/class="daily-signal__facts"/g) ?? []).length >= 4);
    assert.ok((daily.markdown.match(/<li>/g) ?? []).length >= 12);
    assert.doesNotMatch(daily.markdown, /social 相关信号进入今日重点/i);
    assert.doesNotMatch(daily.markdown, /ByteDance Trae mobile app connects/);
  });

  it("rewrites real run fallbacks from security, community, and terminal agent sources", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "mythos-firefox",
          title: "Mozilla's agentic AI pipeline turns Claude Mythos Preview loose and finds 271 unknown Firefox vulnerabilities",
          originalTitle: "Mozilla's agentic AI pipeline turns Claude Mythos Preview loose and finds 271 unknown Firefox vulnerabilities",
          aiSummary: "Anthropic's Claude Mythos Preview uncovered 271 previously unknown security vulnerabilities in Firefox.",
          aiScore: 96,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "The Decoder",
          sourceUrl: "https://the-decoder.com/mozillas-agentic-ai-pipeline-turns-claude-mythos-preview-loose-and-finds-271-unknown-firefox-vulnerabilities",
          tags: ["英文媒体", "安全", "Agent"],
        },
        {
          id: "abstract-agents",
          title: "Most agentic AI conversations feel too abstract",
          originalTitle: "Most agentic AI conversations feel too abstract",
          aiSummary: "hey there I've seen plenty of demos and frameworks, but not many practical examples of agentic AI conversations.",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "Reddit Artificial",
          sourceUrl: "https://www.reddit.com/r/artificial/comments/1t6iiqr/most_agentic_ai_conversations_feel_too_abstract",
          tags: ["Reddit", "Agent"],
        },
        {
          id: "qwen-code",
          title: "QwenLM/qwen-code 开源项目进入增量观察",
          originalTitle: "QwenLM/qwen-code 开源项目进入增量观察",
          aiSummary: "An open-source AI agent that lives in your terminal",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub AI Project Search",
          sourceUrl: "https://github.com/QwenLM/qwen-code",
          tags: ["GitHub", "Agent"],
        },
      ],
    });

    assert.match(daily.markdown, /Mozilla 用 Claude Mythos 发现 Firefox 未知漏洞/);
    assert.match(daily.markdown, /Reddit 讨论 Agent 落地案例仍然太抽象/);
    assert.match(daily.markdown, /Qwen Code 把开源编码 Agent 放进终端/);
    assert.doesNotMatch(daily.markdown, /英文媒体 相关信号进入今日重点/);
    assert.doesNotMatch(daily.markdown, /Reddit 相关信号进入今日重点/);
    assert.doesNotMatch(daily.markdown, /An open-source AI agent that lives in your terminal/);
  });

  it("rewrites noisy real-world selected signals into readable Chinese copy", () => {
    const daily = composeDaily({
      date: "2026-05-08",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "deepseek-metal",
          title: "⚙️ DeepSeek 4 Flash Metal 本地推理：高效、长上下文瓶颈与单模极限优化",
          originalTitle: "⚙️ DeepSeek 4 Flash Metal 本地推理：高效、长上下文瓶颈与单模极限优化",
          aiSummary: "原标题：《DeepSeek 4 Flash local inference engine for Metal》评分: 289 | 作者: tamnd 💭 那是不是每换个模型都得重写一套引擎。",
          aiScore: 96,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "News Hacker",
          sourceUrl: "https://newshacker.me/story?id=48050751",
          tags: ["DeepSeek", "本地推理"],
        },
        {
          id: "leiphone-deepseek",
          title: "三星官宣家电业务退出中国大陆市场；曝DeepSeek投后估值或达450亿美元；中国航天员中心招募「卧床」志愿者",
          originalTitle: "三星官宣家电业务退出中国大陆市场；曝DeepSeek投后估值或达450亿美元；中国航天员中心招募「卧床」志愿者",
          aiSummary: "要闻提示 1.三星宣布停止在中国大陆市场销售所有家电产品，手机业务不受影响 2。",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "雷峰网",
          sourceUrl: "https://www.leiphone.com/category/zaobao/hStD94lQmS7vzJG3.html",
          tags: ["DeepSeek", "产业"],
        },
        {
          id: "plaud",
          title: "Plaud获头部大厂投资，目前估值达20亿美元｜硬氪独家",
          originalTitle: "Plaud获头部大厂投资，目前估值达20亿美元｜硬氪独家",
          aiSummary: "作者｜黄楠 周鑫雨 编辑｜袁斯来 杨轩 硬氪独家获悉，AI卡片录音笔公司Plaud已于2025年年中拿下腾讯的融资，估值达10亿美元；目前，Plaud公司估值已涨至约20亿美元。",
          aiScore: 87,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "36氪",
          sourceUrl: "https://36kr.com/p/3799129165863937?f=rss",
          tags: ["Plaud", "商业化"],
        },
        {
          id: "claude-course",
          title: "The complete Claude Code course for engineers and technical founders",
          originalTitle: "The complete Claude Code course for engineers and technical founders",
          aiSummary: "The complete Claude Code course for engineers and technical founders.",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Hacker News AI Search",
          sourceUrl: "https://code-agents.ai/",
          tags: ["Claude", "AI编程"],
        },
        {
          id: "codex-ban",
          title: "Heads Up, Builders! If you use Codex to Ship Faster, You Might Get a Ban on Reddit.",
          originalTitle: "Heads Up, Builders! If you use Codex to Ship Faster, You Might Get a Ban on Reddit.",
          aiSummary: "DISCLAIMER: I will not promote.",
          aiScore: 84,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Reddit OpenAI",
          sourceUrl: "https://www.reddit.com/r/OpenAI/comments/1t6dikb/heads_up_builders_if_you_use_codex_to_ship_faster",
          tags: ["Codex", "Reddit"],
        },
        {
          id: "boris-ti83",
          title: "🧮 Claude Code 作者 Boris Cherny 的 TI-83 Plus BASIC 教程：一代人的计算器编程启蒙",
          originalTitle: "🧮 Claude Code 作者 Boris Cherny 的 TI-83 Plus BASIC 教程：一代人的计算器编程启蒙",
          aiSummary: "原标题：《Boris Cherny: TI-83 Plus Basic Programming Tutorial (2004)》评分: 136 | 作者: suoken 💭 老师真以为清内存就能挡住作弊程序。",
          aiScore: 82,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "News Hacker",
          sourceUrl: "https://newshacker.me/story?id=48014521",
          tags: ["Claude", "开发者社区"],
        },
      ],
    });

    assert.match(daily.markdown, /DeepSeek 4 Flash Metal 聚焦 Mac 本地推理极限/);
    assert.match(daily.markdown, /DeepSeek 估值传闻进入中文科技早报/);
    assert.match(daily.markdown, /Plaud 融资后估值升至约 20 亿美元/);
    assert.match(daily.markdown, /Claude Code 课程面向工程师和技术创始人/);
    assert.match(daily.markdown, /Reddit 用户提醒 Codex 高频发帖可能触发封禁/);
    assert.match(daily.markdown, /Boris Cherny 的 TI-83 教程被重新讨论/);
    assert.doesNotMatch(daily.markdown, /DISCLAIMER/);
    assert.doesNotMatch(daily.markdown, /要闻提示 1/);
    assert.doesNotMatch(daily.markdown, /作者｜/);
    assert.doesNotMatch(daily.markdown, /老师真以为/);
  });

  it("rewrites May 9 reference and English fallbacks into readable Chinese signals", () => {
    const daily = composeDaily({
      date: "2026-05-09",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "cyber-preview",
          title: "专用版GPT预览模型",
          originalTitle: "专用版GPT预览模型",
          aiSummary: "OpenAI发布安全预览模型。团队限量发布 专用版GPT预览模型(AI资讯) 测试。",
          aiScore: 94,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "Independent Link Review",
          sourceUrl: "https://www.aibase.com/zh/news/27787",
          tags: ["原始信源", "信源审阅", "安全"],
        },
        {
          id: "astro",
          title: "AstroAlertBench: Evaluating the Accuracy, Reasoning, and Honesty of Multimodal LLMs in Astronomical Classification",
          originalTitle:
            "AstroAlertBench: Evaluating the Accuracy, Reasoning, and Honesty of Multimodal LLMs in Astronomical Classification",
          aiSummary: "arXiv:2605.05573v1 Announce Type: cross Abstract: Modern astronomical observatories generate alerts.",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "arXiv cs.AI",
          sourceUrl: "https://arxiv.org/abs/2605.05573",
          tags: ["论文", "多模态"],
        },
        {
          id: "router",
          title: "Github",
          originalTitle: "Github",
          aiSummary: "9router聚合免费编程网关。开发者在 Github(AI资讯) 疯狂围观此项目。",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "Independent Link Review",
          sourceUrl: "https://github.com/decolua/9router",
          tags: ["GitHub", "开源", "模型"],
        },
        {
          id: "genesis",
          title: "Genesis AI 发布新模型：机器人开始挑战西红柿炒鸡蛋",
          originalTitle: "Genesis AI 发布新模型：机器人开始挑战西红柿炒鸡蛋",
          aiSummary: "作者｜ Li Yuan 编辑｜靖宇 机器人终于开始学做西红柿炒鸡蛋了。",
          aiScore: 90,
          reason: "AI相关度高。",
          section: "industry",
          sourceName: "极客公园",
          sourceUrl: "http://www.geekpark.net/news/363905",
          tags: ["中文媒体", "具身智能"],
        },
        {
          id: "html-output",
          title: "Using Claude Code: The Unreasonable Effectiveness of HTML",
          originalTitle: "Using Claude Code: The Unreasonable Effectiveness of HTML",
          aiSummary: "Using Claude Code: The Unreasonable Effectiveness of HTML Thought-provoking piece by Simon Willison.",
          aiScore: 86,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Simon Willison",
          sourceUrl: "https://simonwillison.net/2026/May/8/unreasonable-effectiveness-of-html",
          tags: ["开发者社区", "Claude"],
        },
      ],
    });

    assert.match(daily.markdown, /OpenAI 限量开放 GPT-5\.5-Cyber 安全预览/);
    assert.match(daily.markdown, /AstroAlertBench 评估多模态模型天文告警分类/);
    assert.match(daily.markdown, /9router 聚合免费编程模型网关/);
    assert.match(daily.markdown, /Genesis AI 让机器人挑战家常烹饪任务/);
    assert.match(daily.markdown, /Simon Willison 认为 HTML 更适合 Claude Code 输出/);
    assert.doesNotMatch(daily.markdown, /相关信号进入今日重点/);
    assert.doesNotMatch(daily.markdown, /作者｜/);
    assert.doesNotMatch(daily.markdown, /Modern astronomical observatories/);
    assert.doesNotMatch(daily.markdown, /Github\\(AI资讯\\)/);
  });

  it("rewrites missing May 9 parity hotspots into concise Chinese editorial copy", () => {
    const daily = composeDaily({
      date: "2026-05-09",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "claude-office",
          title: "克劳德集成全家桶",
          originalTitle: "克劳德集成全家桶",
          aiSummary: "Claude深度集成微软全家桶。克劳德集成全家桶(AI资讯) 办公体验太炸裂。",
          aiScore: 94,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "Independent Link Review",
          sourceUrl: "https://www.aibase.com/zh/news/27793",
          tags: ["模型"],
        },
        {
          id: "grok-carplay",
          title: "苹果车载系统",
          originalTitle: "苹果车载系统",
          aiSummary: "Grok 接入 CarPlay 马斯克旗下 Grok 入驻 苹果车载系统(AI资讯) 。",
          aiScore: 91,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "Independent Link Review",
          sourceUrl: "https://www.aibase.com/zh/news/27797",
          tags: ["安全"],
        },
        {
          id: "ddpf",
          title: "资源调度难题",
          originalTitle: "资源调度难题",
          aiSummary: "抖音发布DDPF性能框架。该方案解决 资源调度难题(AI资讯) 拒绝死机。",
          aiScore: 90,
          reason: "AI相关度高。",
          section: "product",
          sourceName: "Independent Link Review",
          sourceUrl: "https://mp.weixin.qq.com/s/example",
          tags: ["模型", "安全"],
        },
        {
          id: "google-math",
          title: "科研数学协作系统",
          originalTitle: "科研数学协作系统",
          aiSummary: "谷歌发布AI数学协作系统。谷歌推出 科研数学协作系统(AI资讯) 助力 FrontierMath、群论与代数组合。",
          aiScore: 90,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "Independent Link Review",
          sourceUrl: "https://x.com/GoogleDeepMind/status/2052836125866127617",
          tags: ["研究", "模型"],
        },
        {
          id: "ners",
          title: "昂贵的影棚录制",
          originalTitle: "昂贵的影棚录制",
          aiSummary: "面部捕捉技术实现新突破。科研团队告别了 昂贵的影棚录制(AI资讯) 。",
          aiScore: 89,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "Independent Link Review",
          sourceUrl: "https://arxiv.org/abs/2605.05636",
          tags: ["论文", "多模态"],
        },
        {
          id: "marble",
          title: "多维度奖励对齐",
          originalTitle: "多维度奖励对齐",
          aiSummary: "MARBLE算法平衡多维奖励。传统方法导致 多维度奖励对齐(AI资讯) 效果差。",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "Independent Link Review",
          sourceUrl: "https://arxiv.org/abs/2605.06507",
          tags: ["论文", "模型"],
        },
        {
          id: "plotpick",
          title: "科研数据提取",
          originalTitle: "科研数据提取",
          aiSummary: "科研图谱数据提取神器。科研数据提取(AI资讯) 工具 PlotPick 正式发布。",
          aiScore: 87,
          reason: "AI相关度高。",
          section: "research",
          sourceName: "Independent Link Review",
          sourceUrl: "https://arxiv.org/abs/2605.06021",
          tags: ["论文", "开源"],
        },
        {
          id: "lobehub",
          title: "LobeHub开启多智能体协作",
          originalTitle: "LobeHub开启多智能体协作",
          aiSummary: "LobeHub开启多智能体协作。全球社区正围观 多智能体协作平台(AI资讯) 仓库。",
          aiScore: 90,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "Independent Link Review",
          sourceUrl: "https://github.com/lobehub/lobe-chat",
          tags: ["GitHub", "Agent"],
        },
        {
          id: "hello-agents",
          title: "构建智能体开源项目",
          originalTitle: "构建智能体开源项目",
          aiSummary: "从零构建智能体系统化教程。构建智能体开源项目(AI资讯) 🎓 现已发布。",
          aiScore: 89,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "Independent Link Review",
          sourceUrl: "https://github.com/datawhalechina/hello-agents",
          tags: ["GitHub", "Agent"],
        },
      ],
    });

    assert.match(daily.markdown, /Claude 接入 Microsoft 365 办公工作流/);
    assert.match(daily.markdown, /Grok 接入 CarPlay 车载语音场景/);
    assert.match(daily.markdown, /抖音 DDPF 用端侧大模型优化性能调度/);
    assert.match(daily.markdown, /Google DeepMind 推出 AI 数学协作系统/);
    assert.match(daily.markdown, /手机视频生成 4K 数字人技术降低动捕门槛/);
    assert.match(daily.markdown, /MARBLE 用多维奖励对齐稳定扩散模型强化学习/);
    assert.match(daily.markdown, /PlotPick 把科研图表自动转成结构化数据/);
    assert.match(daily.markdown, /LobeHub 把多智能体协作做成开源工作台/);
    assert.match(daily.markdown, /hello-agents 用系统化教程降低 Agent 入门门槛/);
    assert.doesNotMatch(daily.markdown, /太炸裂|拒绝死机|疯狂围观|AI资讯\)/);
  });

  it("rewrites late-run open-source fallbacks into specific Chinese project notes", () => {
    const daily = composeDaily({
      date: "2026-05-09",
      brand: "焦糖星球",
      draft: false,
      summaries: [
        {
          id: "pocketpaw",
          title: "pocketpaw/pocketpaw 开源项目进入增量观察",
          originalTitle: "pocketpaw/pocketpaw 开源项目进入增量观察",
          aiSummary: "Your AI agent in 30 seconds。焦糖星球把它归入今日 AI资讯 观察。",
          aiScore: 88,
          reason: "AI相关度高。",
          section: "opensource",
          sourceName: "GitHub AI Project Search",
          sourceUrl: "https://github.com/pocketpaw/pocketpaw",
          tags: ["GitHub", "Agent"],
        },
        {
          id: "safesandbox",
          title: "SafeSandbox – infinite undo 面向 AI coding …",
          originalTitle: "SafeSandbox – infinite undo for AI coding agents (Cursor, Claude Code, Codex)",
          aiSummary: "SafeSandbox – infinite undo for AI coding agents (Cursor, Claude Code, Codex)。",
          aiScore: 87,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Hacker News AI Search",
          sourceUrl: "https://github.com/Baukaalm/safesandbox",
          tags: ["HN", "AI编程"],
        },
        {
          id: "nonthinking-code",
          title: "Should we use a non-thinking model 面向 cod…",
          originalTitle: "Should we use a non-thinking model for code after using a thinking one for plan? (Agentic coding)",
          aiSummary: "I usually use Qwen3 for planning, then a non-thinking model for code.",
          aiScore: 86,
          reason: "AI相关度高。",
          section: "social",
          sourceName: "Reddit LocalLLaMA",
          sourceUrl: "https://www.reddit.com/r/LocalLLaMA/comments/1t8750p/should_we_use_a_nonthinking_model_for_code_after",
          tags: ["Reddit", "Agent"],
        },
      ],
    });

    assert.match(daily.markdown, /pocketpaw 提供 30 秒启动的轻量 Agent 脚手架/);
    assert.match(daily.markdown, /SafeSandbox 为编码 Agent 提供无限撤销沙箱/);
    assert.match(daily.markdown, /可回滚的沙箱层/);
    assert.match(daily.markdown, /开发者讨论编码 Agent 先规划再轻量执行/);
    assert.doesNotMatch(daily.markdown, /开源项目进入增量观察|infinite undo 面向 AI coding …|Your AI agent in 30 seconds|Should we use a non-thinking model/);
  });

  it("composes a weekly post from daily summaries", () => {
    const weekly = composeWeekly({
      week: "2026-W19",
      date: "2026-05-10",
      summaries,
      brand: "焦糖星球",
      draft: true,
    });

    assert.equal(weekly.relativePath, "src/content/posts/weekly/2026-05-10-jiaotang-ai-signals-weekly-2026-w19.md");
    assert.match(weekly.markdown, /title: "焦糖星球 AI 深度信号周报 2026 W19"/);
    assert.match(weekly.markdown, /pillar: "agent"/);
    assert.match(weekly.markdown, /Weekly Focus/);
    assert.match(weekly.markdown, /Signals & Noise/);
    assert.match(weekly.markdown, /Things to Ponder/);
  });
});
