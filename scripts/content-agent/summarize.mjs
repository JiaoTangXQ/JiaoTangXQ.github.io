import { summaryInstructions } from "./ai/prompts.mjs";
import { cleanText, truncate } from "./utils.mjs";

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    aiSummary: { type: "string" },
    aiScore: { type: "number" },
    reason: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    section: { type: "string", enum: ["product", "research", "opensource", "industry", "social"] },
  },
  required: ["title", "aiSummary", "aiScore", "reason", "tags", "section"],
};

const SUMMARY_SECTION_ORDER = ["product", "research", "opensource", "industry", "social"];
const SUMMARY_SECTION_CAPS = {
  product: 6,
  research: 8,
  opensource: 7,
  industry: 5,
  social: 6,
};
const SUMMARY_SECTION_FLOORS = {
  product: 3,
  research: 3,
  opensource: 3,
  industry: 2,
  social: 3,
};
const SUMMARY_SOURCE_ID_CAPS = {
  "openai-news": 2,
  "hn-ai-search": 2,
  "newshacker-rss": 5,
  "github-ai-project-search": 1,
  "github-agent-org-search": 3,
  "github-curated-agent-repos": 4,
};

const SUMMARY_PRIORITY_PATTERN =
  /Codex.*Chrome|Chrome.*Codex|running-codex-safely|Codex safely|GPT[-\s]?Realtime|Realtime[-\s]?2|Realtime[-\s]?Translate|Realtime[-\s]?Whisper|三款实时语音模型|StepAudio|语音竞技场|GPT[-\s]?5\.5[-\s]?Cyber|专用版GPT预览模型|Claude.*(?:Microsoft|Office|微软|全家桶)|克劳德集成全家桶|Grok.*CarPlay|苹果车载系统|GoogleDeepMind.*数学|科研数学协作系统|FrontierMath|群论|代数组合|DDPF|资源调度难题|端侧大模型|ProgramBench|地狱级编程评测|Natural Language Activations|\bNLA\b|激活值转文字|OpenSearch-VL|多模态搜索框架|\bMSM\b|中期训练规格对齐|Diffusion.*IQ|修复手指畸形|Hamiltonian|物理规律识别伪造|AstroAlertBench|FREPix|MARBLE|多维度奖励对齐|PlotPick|科研数据提取|NeRSemble|昂贵的影棚录制|4K高保真|Perplexity|智能代理个人电脑|Trae|字节移动端开发助手|openai-cli|OpenAI.*CLI|终端直接调用接口|Responses API|同传|实时翻译|GPT-Realtime|DeepSeek-TUI|9router|LobeHub|lobe-chat|hello-agents|构建智能体开源项目|goose|deer-flow|PageIndex|dflash|Vercel|开源智能体模板|Warp|Warp开源高效技能库|(?:^|[^a-z])GEO(?:$|[^a-z])|AI营销核心提示词|Akamai|18亿美元算力|Colossus|xAI并入SpaceX|anthropic-compute-partnership|Anthropic.*SpaceX|SpaceX.*Claude|Hy3preview|Hy3|混元|大模型调用量暴涨|Token调用量破140万亿|自主打蛋机器人|单手打蛋|机器人.*皈依|robot monk|a16z|AI unemployment|AI bubble|泡沫|全球三城零代码挑战赛|金融智能方案库|浏览器自动化黑科技|GPT-5 visual|visual protocol|革命性交互技术/i;

export async function summarizeSignals(signals, options = {}) {
  const provider = options.provider ?? null;
  const brand = options.brand ?? "焦糖星球";
  const limit = Number(options.limit ?? signals.length);
  const selected = selectSignalsForSummary(signals, limit);
  const out = [];

  for (const signal of selected) {
    out.push(await summarizeSignal(signal, { provider, brand }));
  }
  return out;
}

function selectSignalsForSummary(signals, limit) {
  const sorted = [...(signals ?? [])].sort((a, b) => summaryRank(b) - summaryRank(a));
  const selected = [];
  const selectedIds = new Set();
  const selectedEventKeys = new Set();
  const selectedSourceCounts = new Map();
  const selectedSectionCounts = new Map();
  const buckets = new Map();
  for (const signal of sorted) {
    const section = validSection(signal.section) ? signal.section : "industry";
    buckets.set(section, [...(buckets.get(section) ?? []), signal]);
  }

  for (const signal of sorted.filter(isSummaryPriority)) {
    if (selected.length >= limit) return selected;
    selectSignal(signal, { ignoreSectionCap: true });
  }

  for (const section of SUMMARY_SECTION_ORDER) {
    const floor = Math.min(SUMMARY_SECTION_FLOORS[section] ?? 0, SUMMARY_SECTION_CAPS[section] ?? limit);
    for (const signal of buckets.get(section) ?? []) {
      if (selected.length >= limit) return selected;
      if ((selectedSectionCounts.get(section) ?? 0) >= floor) break;
      selectSignal(signal);
    }
  }

  for (const section of SUMMARY_SECTION_ORDER) {
    const cap = SUMMARY_SECTION_CAPS[section] ?? limit;
    for (const signal of buckets.get(section) ?? []) {
      if (selected.length >= limit) return selected;
      if ((selectedSectionCounts.get(section) ?? 0) >= cap) break;
      selectSignal(signal);
    }
  }

  return selected;

  function selectSignal(signal, { ignoreSectionCap = false } = {}) {
    const section = validSection(signal.section) ? signal.section : "industry";
    if (selectedIds.has(signal.id)) return false;
    if (isOffTopicMixedDigest(signal)) return false;
    const eventKey = eventClusterKey(signal);
    if (eventKey && selectedEventKeys.has(eventKey)) return false;
    const sourceId = signal.sourceId ?? signal.sourceName ?? "unknown";
    const sourceCap = SUMMARY_SOURCE_ID_CAPS[sourceId] ?? Infinity;
    if ((selectedSourceCounts.get(sourceId) ?? 0) >= sourceCap) return false;
    if (!ignoreSectionCap && (selectedSectionCounts.get(section) ?? 0) >= (SUMMARY_SECTION_CAPS[section] ?? limit)) {
      return false;
    }
    selected.push(signal);
    selectedIds.add(signal.id);
    if (eventKey) selectedEventKeys.add(eventKey);
    selectedSourceCounts.set(sourceId, (selectedSourceCounts.get(sourceId) ?? 0) + 1);
    selectedSectionCounts.set(section, (selectedSectionCounts.get(section) ?? 0) + 1);
    return true;
  }
}

function summaryRank(signal) {
  return (signal.score ?? 0) + summaryPriority(signal);
}

function summaryPriority(signal) {
  const text = `${signal.title ?? ""} ${signal.originalTitle ?? ""} ${signal.content ?? signal.aiSummary ?? ""} ${signal.url ?? ""} ${signal.sourceUrl ?? ""}`;
  const url = String(signal.url ?? signal.sourceUrl ?? "");
  let priority = 0;
  if (SUMMARY_PRIORITY_PATTERN.test(text)) priority += 18;
  if (/ProgramBench|Natural Language Activations|\bNLA\b|模型激活|可解释|OpenSearch-VL|MSM|benchmark|评测/i.test(text)) priority += 12;
  if (/Codex.*Chrome|Chrome.*Codex|running-codex-safely|OpenAI.*Codex|Perplexity|Trae|openai-cli|OpenAI.*CLI|Responses API|同传|实时翻译|GPT-Realtime|Realtime[-\s]?(?:2|Translate|Whisper)|三款实时语音模型/i.test(text)) priority += 16;
  if (/Claude.*(?:Microsoft|Office|微软|全家桶)|克劳德集成全家桶|Grok.*CarPlay|苹果车载系统|DDPF|资源调度难题|端侧大模型/i.test(text)) priority += 16;
  if (/GoogleDeepMind.*数学|科研数学协作系统|FrontierMath|群论|代数组合/i.test(text)) priority += 16;
  if (/MARBLE|多维度奖励对齐|PlotPick|科研数据提取|NeRSemble|昂贵的影棚录制|4K高保真/i.test(text)) priority += 16;
  if (/DeepSeek-TUI|9router|LobeHub|lobe-chat|hello-agents|构建智能体开源项目|goose|deer-flow|PageIndex|dflash|Vercel|Warp|(?:^|[^a-z])GEO(?:$|[^a-z])/i.test(text)) priority += 14;
  if (/StepAudio|Speech Arena|语音竞技场|GPT[-\s]?5\.5[-\s]?Cyber|专用版GPT预览模型|Akamai|18亿美元算力|Token调用量破140万亿/i.test(text)) priority += 12;
  if (/^https:\/\/code-agents\.ai\/?$/i.test(url)) priority += 20;
  if (/ask hn:.*coding agent course|i['’]?ve built a claude code course/i.test(text) && !/^https:\/\/code-agents\.ai\/?$/i.test(url)) {
    priority -= 20;
  }
  if (/Colossus|Anthropic.*SpaceX|SpaceX.*Claude|anthropic-compute-partnership|Hy3preview|Hy3|混元|十倍|暴涨/i.test(text)) priority += 8;
  if (/customer story|helps bankers|rethink(?:s)? software development|Simplex|Singular Bank/i.test(text)) priority -= 16;
  if (/三星|SK海力士|中国厂|涨薪|男子五一加班|家电业务|总部人均奖金/i.test(text)) priority -= 80;
  return priority;
}

function isSummaryPriority(signal) {
  const text = `${signal.title ?? ""} ${signal.originalTitle ?? ""} ${signal.content ?? signal.aiSummary ?? ""} ${signal.url ?? ""} ${signal.sourceUrl ?? ""}`;
  return SUMMARY_PRIORITY_PATTERN.test(text);
}

function eventClusterKey(signal) {
  const text = normalizeEventText(
    `${signal.title ?? ""} ${signal.originalTitle ?? ""} ${signal.content ?? signal.summary ?? ""} ${signal.url ?? ""} ${signal.canonicalUrl ?? ""}`,
  );
  const hasOpenAI = /\bopenai\b/.test(text);

  if (/alphaevolve|gemini powered coding agent/.test(text)) return "event:alphaevolve";
  if (/stepaudio|step audio|阶跃.*语音|语音竞技场|speech arena/.test(text)) {
    return "event:stepaudio-voice-model";
  }
  if (/gpt 5\.5 cyber|gpt5\.5 cyber|专用版gpt预览模型|安全预览模型/.test(text)) {
    return "event:openai-gpt55-cyber";
  }
  if (/codex.*chrome|chrome.*codex|chrome扩展|codex for chrome|接管浏览器|浏览器操作效率/.test(text)) {
    return "event:openai-codex-chrome";
  }
  if (/unreasonable effectiveness of html|simon willison.*html|html.*claude code/.test(text)) {
    return "event:simon-html-llm-output";
  }
  if (/running codex safely|codex safely|codex securely|sandboxing.*approvals|agent native telemetry/.test(text)) {
    return "event:openai-codex-safety";
  }
  if (/克劳德集成全家桶|claude.*(microsoft|office|excel|powerpoint)|microsoft 365.*claude/.test(text)) {
    return "event:claude-microsoft-365";
  }
  if (/grok.*carplay|苹果车载系统|carplay.*grok/.test(text)) return "event:grok-carplay";
  if (/googledeepmind.*数学|科研数学协作系统|frontiermath|群论|代数组合/.test(text)) {
    return "event:google-deepmind-math-collab";
  }
  if (/ddpf|资源调度难题|端侧大模型.*性能/.test(text)) return "event:douyin-ddpf-performance";
  if (/programbench|地狱级编程评测|黑盒重建程序|whole program architecture reconstruction/.test(text)) {
    return "event:programbench";
  }
  if (/nerssemble|昂贵的影棚录制|4k高保真|面部捕捉技术/.test(text)) return "event:mobile-4k-digital-human";
  if (/marble|多维度奖励对齐|扩散模型强化学习/.test(text)) return "event:marble-reward-alignment";
  if (/plotpick|科研数据提取|论文图表.*表格|图谱数据提取/.test(text)) return "event:plotpick-chart-data";
  if (/natural language activations|\bnla\b|激活值转文字|激活译成文本|模型激活/.test(text)) {
    return "event:anthropic-nla";
  }
  if (/\bmsm\b|model similarity map|model similarity maps|中期训练规格对齐/.test(text)) {
    return "event:anthropic-msm";
  }
  if (/opensearch vl|opensearch-vl|多模态搜索框架/.test(text)) return "event:opensearch-vl";
  if (/diffusion iq|diffusion-iq|修复手指畸形|hand anomal/.test(text)) return "event:diffusion-iq";
  if (/hamiltonian|物理规律识别伪造|deepfake.*physical|forgery/.test(text)) return "event:hamiltonian-deepfake";
  if (/韩国.*机器人.*(僧|皈依|出家)|robot monk|宇树g1.*(韩国|出家|皈依)|first robot monk/.test(text)) {
    return "event:robot-monk";
  }
  if (/hy3preview|腾讯混元.*调用量|大模型调用量暴涨/.test(text)) return "event:hunyuan-hy3preview";
  if (/trae mobile|trae.*(iphone|android|移动端)|字节移动端开发助手/.test(text)) return "event:trae-mobile";
  if (/warp skills|warp开源高效技能库|oz skills/.test(text)) return "event:warp-skills";
  if (/geo prompts|generative engine optimization|ai search optimization|ai营销核心提示词/.test(text)) {
    return "event:geo-prompts";
  }
  if (/dflash|z lab.*dflash|z-lab.*dflash|gemma.*dflash|模型推理加速器/.test(text)) return "event:dflash";
  if (/deepseek tui|deepseek-tui|高效终端助手/.test(text)) return "event:deepseek-tui";
  if (/9router|免费编程网关/.test(text)) return "event:9router";
  if (/lobehub|lobe-chat|多智能体协作平台/.test(text)) return "event:lobehub-agent-workbench";
  if (/hello agents|hello-agents|构建智能体开源项目|从零构建智能体/.test(text)) return "event:hello-agents";
  if (/claude code course|code agents\.ai|code-agents\.ai|engineering focused coding agent course/.test(text)) {
    return "event:claude-code-course";
  }
  if (/浏览器自动化黑科技|codex.*chrome|chrome.*codex|background tabs|browser automation/.test(text)) {
    return "event:browser-agent-automation";
  }
  if (/gpt 5 visual|visual protocol|革命性交互技术|computer use visual/.test(text)) return "event:gpt5-visual-protocol";
  if (/openai cli|openai-cli|终端直接调用接口/.test(text)) return "event:openai-cli";
  if (/anthropics\/financial services|financial services.*anthropic|金融智能方案库/.test(text)) {
    return "event:anthropic-financial-services";
  }
  if (/perplexity/.test(text) && /(personal computer|个人电脑|mac assistant|mac 应用|mac用户|mac 用户)/.test(text)) {
    return "event:perplexity-personal-computer";
  }
  if (
    hasOpenAI &&
    /(gpt realtime|realtime voice|real time conversations|voice intelligence|实时语音模型|实时翻译|实时转录|new voice model)/.test(text)
  ) {
    return "event:openai-realtime-voice";
  }
  if (/testing ads in chatgpt/.test(text)) return "event:chatgpt-ad-testing";
  if (/new ways to buy chatgpt ads|ads manager|cpc bidding/.test(text)) return "event:chatgpt-ads-buying";
  if (
    /(anthropic.*spacex|spacex.*anthropic|claude code.*spacex|spacex.*claude code|anthropic compute partnership|colossus.*anthropic)/.test(text)
  ) {
    return "event:claude-code-spacex-limits";
  }
  if (/claude managed agents|can now dream|托管智能体.*梦境/.test(text)) return "event:claude-managed-agents-dream";
  if (/rubber duck/.test(text) && /github copilot cli/.test(text)) return "event:github-copilot-cli-rubber-duck";
  if (/secret scanning/.test(text) && /github mcp server/.test(text)) return "event:github-mcp-secret-scanning";
  return "";
}

function isOffTopicMixedDigest(signal) {
  const title = normalizeEventText(signal.title ?? "");
  return /总部人均奖金|sk海力士|中国厂.*涨薪|男子五一加班|三星.*家电业务|linux内核|内核接口提权/.test(title);
}

function normalizeEventText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function summarizeSignal(signal, { provider, brand }) {
  if (!provider) return fallbackSummary(signal, { brand });
  try {
    const result = await provider.generateJSON({
      instructions: summaryInstructions({ brand }),
      input: renderSignalForPrompt(signal),
      schema: SUMMARY_SCHEMA,
      name: "content_agent_summary",
    });
    return normalizeSummary(signal, result, { brand });
  } catch (error) {
    return {
      ...fallbackSummary(signal, { brand }),
      reason: `${signal.scoreReason ?? ""} 远程 AI 摘要失败，已使用本地改写：${error.message}`,
    };
  }
}

function normalizeSummary(signal, result, { brand }) {
  const fallback = fallbackSummary(signal, { brand });
  const title = safeString(result.title) || fallback.title;
  return {
    id: signal.id,
    title: title === signal.title ? fallback.title : title,
    aiSummary: ensureBroadcastStyle(safeString(result.aiSummary) || fallback.aiSummary, signal),
    aiScore: clampScore(result.aiScore ?? signal.score ?? fallback.aiScore),
    reason: safeString(result.reason) || signal.scoreReason || fallback.reason,
    section: validSection(result.section) ? result.section : signal.section ?? fallback.section,
    sourceName: signal.sourceName,
    sourceUrl: signal.canonicalUrl || signal.url,
    publishedAt: signal.publishedAt,
    tags: Array.from(new Set([...(result.tags ?? []), ...(signal.tags ?? [])])).filter(Boolean).slice(0, 6),
    originalTitle: signal.title,
    score: signal.score,
    media: signal.media ?? { images: [], videos: [] },
  };
}

function ensureBroadcastStyle(value, signal) {
  let text = value.trim();
  if (!/AI资讯/.test(text)) {
    text += " 这条 AI资讯 值得继续盯。";
  }
  if (!/(🚀|✨|🤖|⚡|🌟|ಠ_ಠ|\(๑•̀ㅂ•́\)و✧|\(o_o\))/.test(text)) {
    const faces = ["🚀", "✨", "🤖", "⚡", "(๑•̀ㅂ•́)و✧", "(o_o)"];
    text += ` ${faces[Math.abs(stableIndex(`${signal.id}:style`)) % faces.length]}`;
  }
  return text;
}

function fallbackSummary(signal, { brand }) {
  const section = validSection(signal.section) ? signal.section : "industry";
  const focus = signal.tags?.[0] ?? "AI";
  const title = titleForFallback(signal, focus);
  return {
    id: signal.id,
    title: truncate(title, 42),
    aiSummary: buildFallbackBroadcast(signal, { brand, focus }),
    aiScore: clampScore(signal.score ?? 70),
    reason: signal.scoreReason ?? "本地规则评分；等待人工复核。",
    section,
    sourceName: signal.sourceName,
    sourceUrl: signal.canonicalUrl || signal.url,
    publishedAt: signal.publishedAt,
    tags: Array.from(new Set([...(signal.tags ?? []), "AI资讯"])).slice(0, 6),
    originalTitle: signal.title,
    score: signal.score,
    media: signal.media ?? { images: [], videos: [] },
  };
}

function titleForFallback(signal, focus) {
  return rewriteHeadline(signal.title, focus);
}

function buildFallbackBroadcast(signal, { brand, focus }) {
  const source = signal.sourceName ?? "公开信源";
  const title = rewriteHeadline(signal.title, focus);
  const fact = firstFact(signal.content || signal.summary || "");
  const faces = ["🚀", "✨", "🤖", "⚡", "(๑•̀ㅂ•́)و✧", "(o_o)"];
  const face = faces[Math.abs(stableIndex(`${signal.id}:face`)) % faces.length];
  const secondFace = faces[Math.abs(stableIndex(`${signal.id}:face2`)) % faces.length];
  const factLine = fact ? `${fact}。` : `${source} 更新了这条 ${focus} 相关进展。`;
  return `**${truncate(title, 34)}。** ${factLine} ${brand}把它归入今日 AI资讯 观察 ${face}。重点不是标题热闹，而是它可能改变产品、研究或开发者工作流。开发者 ${secondFace} 可以先看来源细节，发布前仍会复核事实。`;
}

function renderSignalForPrompt(signal) {
  return JSON.stringify(
    {
      title: signal.title,
      url: signal.canonicalUrl || signal.url,
      sourceName: signal.sourceName,
      sourceType: signal.sourceType,
      publishedAt: signal.publishedAt,
      section: signal.section,
      score: signal.score,
      scoreReason: signal.scoreReason,
      tags: signal.tags,
      content: signal.content,
      metrics: signal.metrics,
    },
    null,
    2,
  );
}

function rewriteHeadline(title, focus = "AI") {
  const text = String(title ?? "")
    .replace(/\b(releases?|launches?|ships?|announces?)\b/gi, "发布")
    .replace(/\b(introducing|introduces?)\b/gi, "推出")
    .replace(/\bbrings?\b/gi, "带来")
    .replace(/\bwith\b/gi, "联手")
    .replace(/\bfor\b/gi, "面向")
    .replace(/\s+/g, " ")
    .trim();
  return text || `${focus}进展值得关注`;
}

function firstFact(value) {
  const text = cleanText(value)
    .replace(/\s+/g, " ")
    .replace(/([。！？.!?])\s+/g, "$1")
    .trim();
  if (!text) return "";
  const match = text.match(/^(.{18,110}?[。！？.!?])/);
  return stripEnding(match ? match[1] : truncate(text, 88));
}

function stripEnding(value) {
  return String(value ?? "").replace(/[。！？.!?]+$/g, "").trim();
}

function stableIndex(value) {
  return Array.from(String(value)).reduce((sum, char) => sum + char.codePointAt(0), 0);
}

function clampScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(100, Math.round(number))) : 70;
}

function safeString(value) {
  return String(value ?? "").trim();
}

function validSection(value) {
  return ["product", "research", "opensource", "industry", "social"].includes(value);
}
