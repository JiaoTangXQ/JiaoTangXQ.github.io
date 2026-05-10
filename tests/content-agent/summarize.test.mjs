import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeSignals } from "../../scripts/content-agent/summarize.mjs";

const signal = {
  id: "openai-agents",
  title: "OpenAI releases managed agents",
  url: "https://openai.com/news/managed-agents",
  canonicalUrl: "https://openai.com/news/managed-agents",
  sourceName: "OpenAI News",
  sourceType: "rss",
  section: "product",
  publishedAt: "2026-05-07T02:00:00.000Z",
  content: "OpenAI released managed agents for developers building long running tool workflows.",
  score: 91,
  scoreReason: "AI相关度高；时效性高；影响力高。",
  tags: ["Agent", "产品"],
};

describe("content-agent summarization", () => {
  it("uses a provider JSON result and preserves the original source URL", async () => {
    const provider = {
      generateJSON: async () => ({
        title: "托管智能体开始进入产品层",
        aiSummary:
          "**托管智能体开始进入产品层。** OpenAI 把长任务和工具调用收进云端入口。开发者可以少搭一层后台，把精力放回真实业务。焦糖星球会继续观察它对 Agent 工程化的影响。",
        aiScore: 93,
        reason: "AI相关度:100；时效性:95；行业影响:90；可操作性:85。",
        tags: ["Agent", "产品更新", "开发者工具"],
        section: "product",
      }),
    };

    const result = await summarizeSignals([signal], { provider, brand: "焦糖星球" });

    assert.equal(result.length, 1);
    assert.equal(result[0].sourceUrl, signal.canonicalUrl);
    assert.equal(result[0].title, "托管智能体开始进入产品层");
    assert.equal(result[0].section, "product");
    assert.ok(result[0].aiScore >= 90);
    assert.match(result[0].aiSummary, /AI资讯/);
    assert.match(result[0].aiSummary, /(🚀|✨|🤖|⚡|🌟|ಠ_ಠ|\(๑•̀ㅂ•́\)و✧|\(o_o\))/);
  });

  it("falls back to deterministic rewriting when no API key is configured", async () => {
    const [result] = await summarizeSignals([signal], { provider: null, brand: "焦糖星球" });

    assert.equal(result.sourceUrl, signal.canonicalUrl);
    assert.notEqual(result.title, signal.title);
    assert.match(result.aiSummary, /焦糖星球/);
    assert.match(result.aiSummary, /AI资讯/);
    assert.match(result.aiSummary, /(🚀|✨|🤖|⚡|🌟|ಠ_ಠ|\(๑•̀ㅂ•́\)و✧|\(o_o\))/);
    assert.ok(result.tags.includes("Agent"));
  });

  it("keeps the concrete event subject in local fallback titles", async () => {
    const [result] = await summarizeSignals(
      [
        {
          id: "aibase-opensearch",
          title: "腾讯发布OpenSearch-VL：开源多模态深度搜索 agent 的“全家桶”方案",
          url: "https://www.aibase.com/news/27741",
          sourceName: "AIbase",
          sourceType: "news",
          section: "opensource",
          content: "腾讯混元联合 UCLA、港中文等机构开源多模态搜索智能体，补齐数据、轨迹合成和训练配方。",
          score: 89,
          tags: ["多模态", "Agent", "开源"],
        },
      ],
      { provider: null, brand: "焦糖星球" },
    );

    assert.match(result.title, /腾讯|OpenSearch-VL/);
    assert.doesNotMatch(result.title, /快讯进入今日观察|方向又有新动作|释放.*新信号/);
    assert.match(result.aiSummary, /腾讯混元|多模态搜索智能体|OpenSearch-VL/);
    assert.doesNotMatch(result.aiSummary, /新的产品或工程变化/);
  });

  it("balances the final summary set across sections", async () => {
    const research = Array.from({ length: 12 }, (_, index) => ({
      id: `research-${index}`,
      title: `Research item ${index}`,
      url: `https://arxiv.org/abs/2605.${index}`,
      sourceName: "arXiv",
      sourceType: "paper",
      section: "research",
      content: "Research content about AI agents.",
      score: 100 - index,
      tags: ["研究"],
    }));
    const product = Array.from({ length: 4 }, (_, index) => ({
      id: `product-${index}`,
      title: `Product update ${index}`,
      url: `https://www.aibase.com/news/${index}`,
      sourceName: "AIbase",
      sourceType: "news",
      section: "product",
      content: "Product update about a new AI model.",
      score: 70 - index,
      tags: ["模型"],
    }));
    const social = Array.from({ length: 4 }, (_, index) => ({
      id: `social-${index}`,
      title: `Social discussion ${index}`,
      url: `https://newshacker.me/story?id=${index}`,
      sourceName: "News Hacker",
      sourceType: "social",
      section: "social",
      content: "Developer discussion about AI workflow.",
      score: 65 - index,
      tags: ["开发者"],
    }));

    const result = await summarizeSignals([...research, ...product, ...social], {
      provider: null,
      brand: "焦糖星球",
      limit: 12,
    });

    const counts = result.reduce((out, item) => {
      out[item.section] = (out[item.section] ?? 0) + 1;
      return out;
    }, {});

    assert.ok(counts.research <= 8);
    assert.ok(counts.product >= 3);
    assert.ok(counts.social >= 3);
  });

  it("deduplicates the same event across multiple sources before summarizing", async () => {
    const result = await summarizeSignals(
      [
        {
          id: "openai-voice-official",
          title: "Advancing voice intelligence with new models in the API",
          url: "https://openai.com/index/advancing-voice-intelligence-with-new-models-in-the-api",
          sourceName: "OpenAI News",
          sourceType: "official",
          section: "product",
          content: "OpenAI introduces GPT-Realtime-2, GPT-Realtime-Translate, and GPT-Realtime-Transcribe.",
          score: 99,
          tags: ["官方", "模型"],
        },
        {
          id: "openai-voice-media",
          title: "OpenAI's new voice model brings GPT-5-level reasoning to real-time conversations",
          url: "https://the-decoder.com/openais-new-voice-model-brings-gpt-5-level-reasoning-to-real-time-conversations",
          sourceName: "The Decoder",
          sourceType: "rss",
          section: "product",
          content: "OpenAI is shipping three new realtime voice models for conversations and translation.",
          score: 95,
          tags: ["模型"],
        },
        {
          id: "alphaevolve-hn",
          title: "AlphaEvolve: Gemini-powered coding agent scaling impact across fields",
          url: "https://deepmind.google/blog/alphaevolve-impact",
          sourceName: "Hacker News AI Search",
          sourceType: "social",
          section: "social",
          content: "HN discussion about AlphaEvolve.",
          score: 91,
          tags: ["HN", "Gemini"],
        },
        {
          id: "alphaevolve-newshacker",
          title: "🤔 AlphaEvolve 热议：LLM 擅长窄优化，Gemini 代码工具仍被吐槽",
          url: "https://newshacker.me/story?id=48050278",
          sourceName: "News Hacker",
          sourceType: "social",
          section: "social",
          content: "原标题：《AlphaEvolve: Gemini-powered coding agent scaling impact across fields》",
          score: 84,
          tags: ["Gemini"],
        },
      ],
      { provider: null, brand: "焦糖星球", limit: 4 },
    );

    assert.equal(result.filter((item) => /voice|语音/i.test(`${item.title} ${item.originalTitle}`)).length, 1);
    assert.equal(result.filter((item) => /AlphaEvolve/i.test(`${item.title} ${item.originalTitle}`)).length, 1);
  });

  it("deduplicates StepAudio coverage across Chinese media and reference sources", async () => {
    const result = await summarizeSignals(
      [
        {
          id: "stepaudio-leiphone",
          title: "阶跃语音生成模型，拿下 AA 榜语音竞技场国产第一，全球第三",
          url: "https://www.leiphone.com/category/industrynews/ZrhId0k9AjggOERD.html",
          sourceName: "雷峰网",
          sourceType: "rss",
          section: "product",
          content:
            "Artificial Analysis Speech Arena Leaderboard 更新，阶跃语音生成模型 StepAudio 2.5 TTS 跻身全球前三。",
          score: 97,
          tags: ["中文媒体", "模型", "多模态"],
        },
        {
          id: "stepaudio-aibase",
          title: "阶跃星辰推出 StepAudio 2.5 Realtime，实时语音 AI 再升级！",
          url: "https://www.aibase.com/news/27810",
          sourceName: "AIbase",
          sourceType: "news",
          section: "product",
          content: "阶跃星辰发布新一代实时语音大模型 StepAudio 2.5 Realtime，已开放给开发者。",
          score: 90,
          tags: ["阶跃星辰", "模型"],
        },
        {
          id: "openai-cyber",
          title: "OpenAI发布安全预览模型",
          url: "https://www.aibase.com/zh/news/27787",
          sourceName: "Independent Link Review",
          sourceType: "reference",
          section: "product",
          content: "OpenAI 限量开放 GPT-5.5-Cyber 安全预览。",
          score: 89,
          tags: ["安全", "模型"],
        },
      ],
      { provider: null, brand: "焦糖星球", limit: 4 },
    );

    assert.equal(result.filter((item) => /StepAudio|阶跃|语音竞技场/i.test(`${item.title} ${item.originalTitle}`)).length, 1);
    assert.ok(result.some((item) => item.sourceUrl === "https://www.leiphone.com/category/industrynews/ZrhId0k9AjggOERD.html"));
  });

  it("deduplicates Perplexity Personal Computer coverage across media sources", async () => {
    const result = await summarizeSignals(
      [
        {
          id: "perplexity-aibase",
          title: "Perplexity 个人电脑正式上线，为 Mac 用户带来本地 AI 助手",
          url: "https://www.aibase.com/news/27770",
          sourceName: "AIbase",
          sourceType: "news",
          section: "product",
          content: "Perplexity Personal Computer is now available on Mac.",
          score: 96,
          tags: ["Perplexity"],
        },
        {
          id: "perplexity-techcrunch",
          title: "Perplexity’s Personal Computer is now available everyone on Mac",
          url: "https://techcrunch.com/2026/05/07/perplexitys-personal-computer-is-now-available-everyone-on-mac",
          sourceName: "TechCrunch AI",
          sourceType: "news",
          section: "product",
          content: "Perplexity rolls out its Mac assistant to everyone.",
          score: 95,
          tags: ["Perplexity"],
        },
      ],
      { provider: null, brand: "焦糖星球", limit: 4 },
    );

    assert.equal(result.filter((item) => /Perplexity|Personal Computer|个人电脑/i.test(`${item.title} ${item.originalTitle}`)).length, 1);
  });

  it("deduplicates primary-source, developer-community, and reddit mirrors of the same research event", async () => {
    const result = await summarizeSignals(
      [
        {
          id: "reference-programbench",
          title: "地狱级编程评测",
          url: "https://programbench.com/static/paper.pdf",
          sourceName: "Independent Link Review",
          sourceId: "independent-link-review",
          sourceType: "reference",
          section: "research",
          content: "Meta发布ProgramBench，顶尖模型在重建任务中全线拿零分。",
          score: 100,
          tags: ["原始信源", "研究"],
        },
        {
          id: "newshacker-programbench",
          title: "🤨 ProgramBench：LLM 从黑盒重建程序，是否太苛刻？",
          url: "https://newshacker.me/story?id=48045174",
          sourceName: "News Hacker",
          sourceId: "newshacker-rss",
          sourceType: "social",
          section: "research",
          content: "ProgramBench tests whether LLMs understand whole-program architecture reconstruction.",
          score: 96,
          tags: ["开发者社区", "评测"],
        },
        {
          id: "reddit-programbench",
          title: "META Superintelligence Lab Presents: ProgramBench",
          url: "https://www.reddit.com/r/MachineLearning/comments/1t5zdg5/meta_superintelligence_lab_presents_programbench",
          sourceName: "Reddit MachineLearning",
          sourceId: "reddit-machinelearning",
          sourceType: "social",
          section: "research",
          content: "Reddit discussion of the ProgramBench paper.",
          score: 94,
          tags: ["Reddit", "研究"],
        },
      ],
      { provider: null, brand: "焦糖星球", limit: 6 },
    );

    assert.equal(result.filter((item) => /ProgramBench|地狱级编程评测/i.test(`${item.title} ${item.originalTitle}`)).length, 1);
    assert.equal(result[0].sourceName, "Independent Link Review");
  });

  it("deduplicates mixed news digests when a cleaner reference story covers the same robot-monk event", async () => {
    const result = await summarizeSignals(
      [
        {
          id: "reference-robot-monk",
          title: "韩国机器人完成庄严皈依",
          url: "https://the-express.com/tech/tech-news/206676/south-korea-first-robot-monk",
          sourceName: "Independent Link Review",
          sourceId: "independent-link-review",
          sourceType: "reference",
          section: "industry",
          content: "韩国首位人形机器人僧侣正式受戒入寺。",
          score: 100,
          tags: ["原始信源", "具身智能"],
        },
        {
          id: "leiphone-mixed-digest",
          title: "总部人均奖金610万，中国厂却一毛不拔！三星、SK海力士国内员工集体求涨薪；昆仑芯启动A股IPO",
          url: "https://www.leiphone.com/category/zaobao/tqf2pEDQn63OH1d6.html",
          sourceName: "雷峰网",
          sourceId: "leiphone-rss",
          sourceType: "news",
          section: "industry",
          content: "国内资讯 宇树G1人形机器人在韩国出家：法名「迦悲」，需遵守不过度充电等戒律。",
          score: 98,
          tags: ["中文媒体", "产业"],
        },
      ],
      { provider: null, brand: "焦糖星球", limit: 6 },
    );

    assert.equal(result.length, 1);
    assert.equal(result[0].sourceName, "Independent Link Review");
  });

  it("deduplicates open-source and course discussion mirrors while preferring primary sources", async () => {
    const result = await summarizeSignals(
      [
        {
          id: "reference-dflash",
          title: "模型推理加速器",
          url: "https://github.com/z-lab/dflash",
          sourceName: "Independent Link Review",
          sourceId: "independent-link-review",
          sourceType: "reference",
          section: "opensource",
          content: "dflash投机采样加速工具。",
          score: 100,
          tags: ["原始信源", "开源"],
        },
        {
          id: "reddit-dflash",
          title: "z-lab released gemma-4-26B-A4B-it-DFlash. Anybody tried it?",
          url: "https://www.reddit.com/r/LocalLLaMA/comments/1t79ayh/zlab_released_gemma426ba4bitdflash_anybody_tried",
          sourceName: "Reddit LocalLLaMA",
          sourceId: "reddit-localllama",
          sourceType: "social",
          section: "social",
          content: "Past few days, its all been about MTPs.",
          score: 99,
          tags: ["Reddit", "开源模型"],
        },
        {
          id: "course-ask-hn",
          title: "Ask HN: Is anyone interested in engineering focused coding agent course?",
          url: "https://news.ycombinator.com/item?id=48062726",
          sourceName: "Hacker News AI Search",
          sourceId: "hn-ai-search",
          sourceType: "social",
          section: "social",
          content: "I've built a Claude Code course initially to help out my friends, see it at https://code-agents.ai",
          score: 100,
          tags: ["HN", "AI编程"],
        },
        {
          id: "course-direct",
          title: "The complete Claude Code course for engineers and technical founders",
          url: "https://code-agents.ai/",
          sourceName: "Hacker News AI Search",
          sourceId: "hn-ai-search",
          sourceType: "social",
          section: "social",
          content: "The complete Claude Code course for engineers and technical founders.",
          score: 100,
          tags: ["HN", "AI编程"],
        },
      ],
      { provider: null, brand: "焦糖星球", limit: 6 },
    );

    assert.equal(result.filter((item) => /dflash/i.test(`${item.title} ${item.originalTitle} ${item.sourceUrl}`)).length, 1);
    assert.equal(result.filter((item) => /Claude Code course|code-agents/i.test(`${item.title} ${item.originalTitle} ${item.sourceUrl}`)).length, 1);
    assert.ok(result.some((item) => item.sourceUrl === "https://code-agents.ai/"));
    assert.ok(!result.some((item) => item.sourceUrl === "https://news.ycombinator.com/item?id=48062726"));
  });

  it("does not let generic GitHub search crowd out curated open-source sources", async () => {
    const trending = Array.from({ length: 3 }, (_, index) => ({
      id: `trending-${index}`,
      title: `Trending Agent Project ${index}`,
      url: `https://github.com/trending/project-${index}`,
      sourceName: "GitHub Trending",
      sourceId: "github-trending",
      sourceType: "github",
      section: "opensource",
      content: "Trending AI agent project.",
      score: 100,
      tags: ["GitHub", "开源"],
    }));
    const generic = Array.from({ length: 5 }, (_, index) => ({
      id: `generic-${index}`,
      title: `Generic AI Project ${index}`,
      url: `https://github.com/generic/project-${index}`,
      sourceName: "GitHub AI Project Search",
      sourceId: "github-ai-project-search",
      sourceType: "github",
      section: "opensource",
      content: "Generic GitHub search result about AI agents.",
      score: 100,
      tags: ["GitHub", "增量发现"],
    }));
    const org = Array.from({ length: 3 }, (_, index) => ({
      id: `org-${index}`,
      title: `Curated Org Agent Project ${index}`,
      url: `https://github.com/anthropics/project-${index}`,
      sourceName: "GitHub Agent Org Search",
      sourceId: "github-agent-org-search",
      sourceType: "github",
      section: "opensource",
      content: "Curated organization AI agent project.",
      score: 100,
      tags: ["GitHub", "组织监听"],
    }));

    const result = await summarizeSignals([...trending, ...generic, ...org], {
      provider: null,
      brand: "焦糖星球",
      limit: 12,
    });

    const sourceNames = result.map((item) => item.sourceName);
    assert.ok(sourceNames.includes("GitHub Trending"));
    assert.ok(sourceNames.includes("GitHub Agent Org Search"));
    assert.ok(sourceNames.filter((sourceName) => sourceName === "GitHub AI Project Search").length <= 1);
  });

  it("selects broadcast-grade research, product, and curated repo signals before filler", async () => {
    const officialCases = ["simplex", "singular-bank", "generic-enterprise"].map((slug, index) => ({
      id: `case-${slug}`,
      title: `${slug} customer story with Codex`,
      url: `https://openai.com/index/${slug}`,
      sourceName: "OpenAI News",
      sourceId: "openai-news",
      sourceType: "official",
      section: "product",
      content: "Customer story about ChatGPT Enterprise and Codex.",
      score: 100 - index,
      tags: ["官方", "开发者"],
    }));
    const signals = [
      ...officialCases,
      {
        id: "perplexity-mac",
        title: "Perplexity 个人电脑正式上线，为 Mac 用户带来本地 AI 助手",
        url: "https://www.aibase.com/news/27770",
        sourceName: "AIbase",
        sourceId: "aibase-news",
        sourceType: "news",
        section: "product",
        content: "Perplexity 在 Mac 推出常驻本地 AI 助手，能访问本地文件和应用。",
        score: 93,
        tags: ["产品", "Perplexity"],
      },
      {
        id: "openai-cli",
        title: "OpenAI 官方 CLI 工具 openai-cli 发布：一行命令即刻调用 Responses API 与全套 Agent 工具",
        url: "https://www.aibase.com/news/27769",
        sourceName: "AIbase",
        sourceId: "aibase-news",
        sourceType: "news",
        section: "product",
        content: "开发者可以在终端直接调用 Responses API、文件检索、图像生成和 Agent 工具。",
        score: 92,
        tags: ["开发者", "AI编程"],
      },
      {
        id: "programbench",
        title: "ProgramBench：LLM 从黑盒重建程序，是否太苛刻？",
        url: "https://newshacker.me/story?id=48045174",
        sourceName: "News Hacker",
        sourceId: "newshacker-rss",
        sourceType: "social",
        section: "research",
        content: "ProgramBench tests whether LLMs understand whole-program architecture reconstruction.",
        score: 90,
        tags: ["开发者社区", "评测"],
      },
      {
        id: "nla",
        title: "Anthropic NLA：把模型激活译成文本，开权重与真实性争议并存",
        url: "https://newshacker.me/story?id=48052537",
        sourceName: "News Hacker",
        sourceId: "newshacker-rss",
        sourceType: "social",
        section: "research",
        content: "Anthropic open-sources Natural Language Activations to explain model internals.",
        score: 89,
        tags: ["开发者社区", "可解释性"],
      },
      {
        id: "goose",
        title: "aaif-goose/goose 开源项目进入重点观察",
        url: "https://github.com/block/goose",
        sourceName: "GitHub Curated Agent Repos",
        sourceId: "github-curated-agent-repos",
        sourceType: "github",
        section: "opensource",
        content: "An open source extensible AI agent that goes beyond code suggestions.",
        score: 88,
        tags: ["GitHub", "精选开源"],
      },
      {
        id: "deer",
        title: "bytedance/deer-flow 开源项目进入重点观察",
        url: "https://github.com/bytedance/deer-flow",
        sourceName: "GitHub Curated Agent Repos",
        sourceId: "github-curated-agent-repos",
        sourceType: "github",
        section: "opensource",
        content: "An open-source long-horizon SuperAgent harness that researches, codes, and creates.",
        score: 87,
        tags: ["GitHub", "精选开源"],
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `hn-filler-${index}`,
        title: `Show HN: Generic coding agent ${index}`,
        url: `https://news.ycombinator.com/item?id=${index}`,
        sourceName: "Hacker News AI Search",
        sourceId: "hn-ai-search",
        sourceType: "social",
        section: "social",
        content: "Generic coding agent discussion.",
        score: 96 - index,
        tags: ["HN", "开发者社区"],
      })),
    ];

    const result = await summarizeSignals(signals, { provider: null, brand: "焦糖星球", limit: 32 });
    const text = result.map((item) => `${item.originalTitle} ${item.sourceUrl}`).join("\n");

    assert.match(text, /Perplexity/);
    assert.match(text, /openai-cli/);
    assert.match(text, /ProgramBench/);
    assert.match(text, /Anthropic NLA/);
    assert.match(text, /aaif-goose\/goose/);
    assert.match(text, /bytedance\/deer-flow/);
    assert.ok(result.filter((item) => item.sourceName === "Hacker News AI Search").length <= 2);
  });

  it("reserves slots for high-value primary-source signals before generic filler", async () => {
    const filler = Array.from({ length: 10 }, (_, index) => ({
      id: `paper-${index}`,
      title: `Generic agent benchmark paper ${index}`,
      url: `https://arxiv.org/abs/2605.${index}`,
      sourceName: "arXiv",
      sourceId: "arxiv-ai",
      sourceType: "paper",
      section: "research",
      content: "Generic research about AI agents.",
      score: 100,
      tags: ["论文"],
    }));
    const reference = [
      {
        id: "reference-hand-fix",
        title: "修复手指畸形",
        url: "https://arxiv.org/abs/2605.05026",
        sourceName: "Independent Link Review",
        sourceId: "independent-link-review",
        sourceType: "reference",
        section: "research",
        content: "Diffusion-IQ fixes hand anomalies in generated images.",
        score: 70,
        tags: ["原始信源", "论文"],
      },
      {
        id: "reference-spacex",
        title: "xAI并入SpaceX",
        url: "https://x.ai/news/anthropic-compute-partnership",
        sourceName: "Independent Link Review",
        sourceId: "independent-link-review",
        sourceType: "reference",
        section: "industry",
        content: "Anthropic compute partnership with SpaceX affects Claude Code capacity.",
        score: 70,
        tags: ["原始信源", "算力"],
      },
    ];

    const result = await summarizeSignals([...filler, ...reference], {
      provider: null,
      brand: "焦糖星球",
      limit: 5,
    });
    const text = result.map((item) => `${item.originalTitle} ${item.sourceUrl}`).join("\n");

    assert.match(text, /修复手指畸形/);
    assert.match(text, /xAI并入SpaceX|anthropic-compute-partnership/);
  });

  it("keeps May 9 parity watchlist hotspots when the daily pool is crowded", async () => {
    const filler = Array.from({ length: 36 }, (_, index) => ({
      id: `generic-${index}`,
      title: `Generic AI agent story ${index}`,
      url: `https://example.com/generic-${index}`,
      sourceName: "Generic Source",
      sourceId: "generic-source",
      sourceType: "rss",
      section: index % 5 === 0 ? "product" : index % 5 === 1 ? "research" : index % 5 === 2 ? "opensource" : "social",
      content: "Generic AI agent and model update with moderate relevance.",
      score: 88,
      tags: ["Agent"],
    }));
    const parity = [
      ["claude-office", "克劳德集成全家桶", "Claude深度集成微软全家桶。Excel 已经能辅助构建复杂模型。", "https://www.aibase.com/zh/news/27793", "product"],
      ["grok-carplay", "苹果车载系统", "Grok 接入 CarPlay，马斯克旗下 Grok 入驻苹果车载系统。", "https://www.aibase.com/zh/news/27797", "product"],
      ["google-math", "科研数学协作系统", "谷歌 DeepMind 发布 AI 数学协作系统，覆盖 FrontierMath、群论和代数组合任务。", "https://x.com/GoogleDeepMind/status/2052836125866127617", "research"],
      ["ddpf", "资源调度难题", "抖音发布DDPF性能框架，端侧大模型诊断性能瓶颈。", "https://mp.weixin.qq.com/s/example", "product"],
      ["ners", "昂贵的影棚录制", "手机录制4K数字人技术获突破，普通手机视频即可生成 4K 高保真数字人。", "https://arxiv.org/abs/2605.05636", "research"],
      ["marble", "多维度奖励对齐", "MARBLE算法平衡多维奖励，解决扩散模型强化学习难题。", "https://arxiv.org/abs/2605.06507", "research"],
      ["plotpick", "科研数据提取", "科研图谱数据提取神器 PlotPick 发布，将论文图表转为表格。", "https://arxiv.org/abs/2605.06021", "research"],
      ["deepseek-tui", "DeepSeek-TUI终端助手爆火", "DeepSeek-TUI 基于 DeepSeek 模型快速生成代码，终端开发工作流升温。", "https://github.com/Hmbown/DeepSeek-TUI", "opensource"],
      ["lobehub", "LobeHub开启多智能体协作", "LobeHub 多智能体协作平台用于搭建 AI 队友和工作流。", "https://github.com/lobehub/lobe-chat", "opensource"],
      ["hello-agents", "从零构建智能体系统化教程", "hello-agents 系统梳理 Agent 核心原理与实战案例。", "https://github.com/datawhalechina/hello-agents", "opensource"],
    ].map(([id, title, content, url, section]) => ({
      id,
      title,
      url,
      sourceName: "Independent Link Review",
      sourceId: "independent-link-review",
      sourceType: "reference",
      section,
      content,
      score: 66,
      tags: ["原始信源", section === "opensource" ? "GitHub" : "模型"],
    }));

    const result = await summarizeSignals([...filler, ...parity], {
      provider: null,
      brand: "焦糖星球",
      limit: 32,
    });
    const text = result.map((item) => `${item.originalTitle} ${item.sourceUrl}`).join("\n");

    for (const { title } of parity) {
      assert.match(text, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
});
