import { normalizeUrl, stableHash, truncate } from "./utils.mjs";
import { githubPreviewMedia } from "./media.mjs";

const KEYWORDS = [
  ["Agent", /agent|智能体|代理|workflow|tool use|工具调用/i],
  ["模型", /model|llm|gpt|claude|gemini|deepseek|qwen|模型/i],
  ["推理", /reasoning|inference|推理|思考/i],
  ["多模态", /multimodal|vision|audio|video|image|多模态|视觉|音频|视频/i],
  ["开发者", /developer|code|coding|ide|sdk|api|mcp|开发者|代码|编程/i],
  ["AI编程", /trae|cursor|codex|copilot|claude code|vibe coding|ai\s*编程|开发助手|代码助手/i],
  ["具身智能", /robot|robotics|embodied|humanoid|机器人|具身|人形|灵巧手|机械臂|optimus|fsd/i],
  ["AI营销", /(?:^|[^a-z])geo(?:$|[^a-z])|生成式引擎|营销提示词|提示词集|短视频创作|品牌营销|(?:marketing|brand|seo).{0,24}prompt|prompt.{0,24}(?:marketing|brand|seo)/i],
  ["AI原生", /ai原生|无代码|零代码|no-code|nocode|agentic|自动化/i],
  ["研究", /paper|arxiv|benchmark|eval|research|论文|评测|基准|研究/i],
  ["开源", /github|open-source|stars|repo|开源|星标/i],
  ["商业化", /pricing|revenue|enterprise|ads|acquire|融资|估值|商业|收购/i],
  ["安全", /safety|security|privacy|risk|安全|隐私|风险/i],
];
const MAJOR_AI_ENTITY_PATTERN =
  /(OpenAI|Anthropic|Google|Meta|Microsoft|NVIDIA|DeepSeek|Claude|ChatGPT|Gemini|Cursor|GitHub Copilot|Copilot|Codex|Mythos|xAI|SpaceX|Vercel|Mistral|Perplexity|Trae|ProgramBench|NLAs|MSM|PageIndex|deer-flow|dflash|Warp|ComfyUI|Genesis|Qwen|Hunyuan|腾讯|混元|字节|阿里|月之暗面|Kimi|智谱|机器人|具身智能)/i;
const CORE_AI_TITLE_PATTERN =
  /\bAI\b|agent|智能体|模型|LLM|GPT|Claude|Gemini|DeepSeek|Codex|Copilot|Cursor|Trae|Perplexity|推理|多模态|机器人|具身|ComfyUI|PageIndex|deer-flow|dflash|Warp|GEO prompts|generative engine optimization|AI search optimization|(?:^|[^a-z])GEO(?:$|[^a-z])/i;
const RESEARCH_PROPAGATION_PATTERN =
  /ProgramBench|Natural Language Activations|\bNLAs?\b|\bMSM\b|model[-\s]?similarity map|模型激活|激活译成文本|激活值转文字|可解释|OpenSearch-VL|benchmark|评测|paper|论文|research|研究|visual protocol/i;
const PRODUCT_LAUNCH_PATTERN =
  /Perplexity.*(?:Mac|个人电脑)|Trae|Warp Skills|Warp AI|openai-cli|OpenAI.*CLI|Responses API|同传|实时翻译|实时语音/i;
const SLOW_CUSTOMER_STORY_PATTERN =
  /(?:customer story|helps bankers|rethink(?:s)? software development|Simplex|Singular Bank)/i;
const INDUSTRY_MARKET_PATTERN =
  /funding|financing|valuation|revenue|capex|unemployment|labor market|entry-level jobs|hiring|layoff|bubble|investment|融资|估值|收入|营收|资本开支|失业|就业|岗位|招聘|裁员|泡沫|投资/i;
const PARITY_WATCHLIST_PATTERN =
  /Trae mobile|字节移动端开发助手|Warp Skills|Warp AI|Warp开源高效技能库|GPT-5 visual|visual protocol|革命性交互技术|GEO prompts|generative engine optimization|AI search optimization|AI营销核心提示词|a16z|AI unemployment|AI bubble|泡沫|xAI SpaceX Colossus|xAI并入SpaceX|anthropic-compute-partnership|OpenSearch-VL|多模态搜索框架|\bMSM\b|中期训练规格对齐|ProgramBench|地狱级编程评测|Natural Language Activations|激活值转文字|自主打蛋机器人|单手打蛋|修复手指畸形|物理规律识别伪造|大模型调用量暴涨|全球三城零代码挑战赛|金融智能方案库|开源智能体模板|浏览器自动化黑科技|终端直接调用接口|机器人.*皈依|robot monk/i;

export function normalizeSignals(signals) {
  const seen = new Map();
  const out = [];
  for (const signal of signals ?? []) {
    const canonicalUrl = normalizeUrl(signal.canonicalUrl || signal.url);
    const key = canonicalUrl || stableHash(`${signal.title}:${signal.sourceName}`);
    if (!key) continue;
    const normalized = normalizeSignal(signal, canonicalUrl, key);
    if (seen.has(key)) {
      const index = seen.get(key);
      const existing = out[index];
      if (normalized.sourceType === "reference" && existing?.sourceType !== "reference") {
        out[index] = normalized;
      }
      continue;
    }
    seen.set(key, out.length);
    out.push(normalized);
  }
  return out;
}

function normalizeSignal(signal, canonicalUrl, key) {
  const text = `${signal.title ?? ""} ${signal.content ?? signal.summary ?? ""}`;
  const sourceType = signal.sourceType ?? "rss";
  const media = signal.media ?? { images: [], videos: [] };
  const githubPreview = /github\.com/i.test(canonicalUrl || signal.url || "") && !media.images?.length && !media.videos?.length
    ? githubPreviewMedia(canonicalUrl || signal.url)
    : null;
  return {
    id: signal.id || stableHash(key),
    title: String(signal.title ?? "").trim(),
    url: signal.url || canonicalUrl,
    canonicalUrl,
    sourceId: signal.sourceId ?? signal.sourceName ?? "unknown",
    sourceName: signal.sourceName ?? signal.sourceId ?? "Unknown Source",
    sourceType,
    sourceWeight: Number.isFinite(Number(signal.sourceWeight)) ? Number(signal.sourceWeight) : undefined,
    section: signal.section,
    publishedAt: signal.publishedAt ?? null,
    content: truncate(signal.content ?? signal.summary ?? "", 1200),
    metrics: signal.metrics ?? {},
    media: githubPreview ? { images: [githubPreview], videos: [] } : media,
    tags: [...new Set([...(signal.tags ?? []), ...extractTags(text)])].slice(0, 6),
    raw: signal.raw ?? {},
  };
}

export function scoreSignals(signals, options = {}) {
  const now = new Date(options.now ?? Date.now()).getTime();
  const sourceWeights = options.sourceWeights ?? {};
  return signals
    .map((signal) => {
      const section = classifySignal(signal);
      const relevance = aiRelevance(signal);
      const freshness = freshnessScore(signal.publishedAt, now);
      const source = Number.isFinite(Number(signal.sourceWeight))
        ? Number(signal.sourceWeight)
        : sourceWeights[signal.sourceType] ?? defaultSourceWeight(signal.sourceType);
      const impact = impactScore(signal);
      const buzz = buzzScore(signal);
      const adjustment = editorialScoreAdjustment(signal);
      const score = Math.max(1, Math.min(100, Math.round(relevance * 0.5 + freshness * 0.2 + source + impact * 0.3 + adjustment)));
      return {
        ...signal,
        section,
        score,
        scoreReason: `AI相关度:${Math.round(relevance)}；时效性:${Math.round(freshness)}；来源权重:${Math.round(source)}；影响力:${Math.round(impact)}；传播热度:${Math.round(buzz)}${adjustment ? `；编辑修正:${adjustment}` : ""}。`,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function selectCoreSignals(signals, options = {}) {
  const limit = Number(options.limit ?? signals?.length ?? 0);
  const sourceTypeCaps = options.sourceTypeCaps ?? {};
  const sourceIdCaps = options.sourceIdCaps ?? {};
  const maxPerSourceId = Number.isFinite(Number(options.maxPerSourceId))
    ? Number(options.maxPerSourceId)
    : Infinity;
  const now = new Date(options.now ?? Date.now()).getTime();
  const maxAgeHours = Number.isFinite(Number(options.maxAgeHours)) ? Number(options.maxAgeHours) : Infinity;
  const sourceTypeCounts = new Map();
  const sourceIdCounts = new Map();
  const selected = [];
  const selectedIds = new Set();
  const sorted = [...(signals ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  for (const signal of sorted.filter(isCorePrioritySignal)) {
    if (selected.length >= limit) break;
    selectSignal(signal);
  }

  for (const signal of sorted) {
    if (selected.length >= limit) break;
    selectSignal(signal);
  }

  return selected;

  function selectSignal(signal) {
    if (!signal?.id || selectedIds.has(signal.id)) return false;
    if (isTooOld(signal.publishedAt, now, maxAgeHours)) return false;
    const sourceType = signal.sourceType ?? "rss";
    const sourceId = signal.sourceId ?? signal.sourceName ?? "unknown";
    const typeCount = sourceTypeCounts.get(sourceType) ?? 0;
    const idCount = sourceIdCounts.get(sourceId) ?? 0;
    const typeCap = Number(sourceTypeCaps[sourceType] ?? Infinity);
    const idCap = Number(sourceIdCaps[sourceId] ?? maxPerSourceId);
    if (typeCount >= typeCap || idCount >= idCap) return false;
    selected.push(signal);
    selectedIds.add(signal.id);
    sourceTypeCounts.set(sourceType, typeCount + 1);
    sourceIdCounts.set(sourceId, idCount + 1);
    return true;
  }
}

function isCorePrioritySignal(signal) {
  const text = `${signal.title ?? ""} ${signal.content ?? ""} ${signal.url ?? ""} ${signal.canonicalUrl ?? ""}`;
  return PARITY_WATCHLIST_PATTERN.test(text);
}

function isTooOld(publishedAt, now, maxAgeHours) {
  if (!Number.isFinite(maxAgeHours)) return false;
  if (!publishedAt) return false;
  const published = new Date(publishedAt).getTime();
  if (!Number.isFinite(published) || !Number.isFinite(now)) return false;
  return (now - published) / 3_600_000 > maxAgeHours;
}

export function classifySignal(signal) {
  const sourceType = String(signal.sourceType ?? "").toLowerCase();
  const text = `${signal.title ?? ""} ${signal.content ?? ""}`;
  if (sourceType === "paper") return "research";
  if (sourceType === "github") return "opensource";
  if (INDUSTRY_MARKET_PATTERN.test(text)) return "industry";
  if ((sourceType === "social" || sourceType === "reference") && RESEARCH_PROPAGATION_PATTERN.test(text)) return "research";
  if (PRODUCT_LAUNCH_PATTERN.test(text)) return "product";
  if (/github|open-source|repo|stars|开源|星标/.test(text.toLowerCase())) return "opensource";
  if (signal.section && ["product", "research", "opensource", "industry", "social"].includes(signal.section)) {
    return signal.section;
  }
  const lowerText = text.toLowerCase();
  if (/arxiv|paper|benchmark|research|eval|论文|评测|研究/.test(lowerText)) return "research";
  if (sourceType === "social" || /x\.com|twitter|reddit|即刻|karpathy|sama|社媒|推文/.test(lowerText)) return "social";
  if (/funding|revenue|ads|lawsuit|regulation|融资|估值|广告|监管|收购|商业/.test(lowerText)) return "industry";
  return "product";
}

function editorialScoreAdjustment(signal) {
  const text = `${signal.title ?? ""} ${signal.content ?? ""} ${signal.url ?? ""}`;
  const sourceType = String(signal.sourceType ?? "").toLowerCase();
  let adjustment = 0;
  if (PRODUCT_LAUNCH_PATTERN.test(text)) adjustment += 8;
  if (RESEARCH_PROPAGATION_PATTERN.test(text) && sourceType === "social") adjustment += 6;
  if (/goose|deer-flow|PageIndex|dflash|openai-cli|Perplexity/i.test(text)) adjustment += 6;
  if (PARITY_WATCHLIST_PATTERN.test(text)) adjustment += 8;
  if (sourceType === "reference") adjustment += 18;
  if (sourceType === "reference" && PARITY_WATCHLIST_PATTERN.test(text)) adjustment += 18;
  if (SLOW_CUSTOMER_STORY_PATTERN.test(text)) adjustment -= 18;
  return adjustment;
}

function aiRelevance(signal) {
  const title = String(signal.title ?? "");
  const content = String(signal.content ?? signal.summary ?? "");
  const titleHits = KEYWORDS.filter(([, pattern]) => pattern.test(title)).length;
  const contentHits = KEYWORDS.filter(([, pattern]) => pattern.test(content)).length;
  let score = Math.min(100, 32 + titleHits * 16 + contentHits * 7);

  if (
    /机器人|具身|Trae|Perplexity|AI原生|无代码|零代码|生成式引擎|营销提示词|GEO prompts|generative engine optimization|AI search optimization|PageIndex|deer-flow|dflash|Warp|Warp Skills|GPT-5 visual|visual protocol|OpenSearch-VL|\bMSM\b|a16z|AI bubble|Colossus|ComfyUI|Codex|Claude Code/i.test(
      title,
    )
  ) {
    score = Math.min(100, score + 20);
  }

  if (!CORE_AI_TITLE_PATTERN.test(title) && !MAJOR_AI_ENTITY_PATTERN.test(title)) {
    const sourceType = String(signal.sourceType ?? "").toLowerCase();
    score = Math.min(score, sourceType === "social" || sourceType === "rss" ? 55 : 72);
  }

  return score;
}

function freshnessScore(publishedAt, now) {
  if (!publishedAt) return 35;
  const published = new Date(publishedAt).getTime();
  if (!Number.isFinite(published)) return 35;
  const hours = Math.max(0, (now - published) / 3_600_000);
  if (hours <= 12) return 100;
  if (hours <= 48) return 82;
  if (hours <= 96) return 65;
  return 35;
}

function defaultSourceWeight(sourceType) {
  switch (sourceType) {
    case "official":
      return 18;
    case "github":
      return 15;
    case "paper":
      return 14;
    case "social":
      return 11;
    case "search":
      return 9;
    case "news":
      return 12;
    default:
      return 10;
  }
}

function impactScore(signal) {
  const stars = Number(signal.metrics?.stars ?? 0);
  const starsToday = Number(signal.metrics?.starsToday ?? 0);
  const mediaBoost = (signal.media?.images?.length || signal.media?.videos?.length) ? 8 : 0;
  const text = `${signal.title ?? ""} ${signal.content ?? ""}`;
  const socialBoost = Math.min(16, Number(signal.metrics?.points ?? 0) / 50)
    + Math.min(12, Number(signal.metrics?.comments ?? 0) / 20);
  const entityBoost = MAJOR_AI_ENTITY_PATTERN.test(text)
    ? 18
    : 0;
  return Math.min(
    100,
    45 + entityBoost + mediaBoost + socialBoost + buzzScore(signal) + Math.min(20, stars / 3000) + Math.min(18, starsToday / 80),
  );
}

function buzzScore(signal) {
  const text = `${signal.title ?? ""} ${signal.content ?? ""}`;
  const tags = signal.tags ?? [];
  let score = 0;
  if (tags.some((tag) => /中文媒体|开发者社区|HN|Reddit|X|社媒/.test(String(tag)))) score += 4;
  if (/最炸|震撼|爆火|火热|重磅|火速|正式|上线|首位|首个|暴涨|十倍|百万|一亿美元|热议|刷屏|冲榜/.test(text)) score += 10;
  if (
    /机器人|具身|灵巧手|单手打蛋|解魔方|弹钢琴|Optimus|FSD|Trae|Perplexity|(?:^|[^a-z])GEO(?:$|[^a-z])|生成式引擎|提示词|无代码|零代码|AI原生|ComfyUI|PageIndex|deer-flow|dflash|Warp|Warp Skills|GPT-5 visual|visual protocol|OpenSearch-VL|\bMSM\b|a16z|AI bubble|Colossus/i.test(
      text,
    )
  ) score += 10;
  return Math.min(24, score);
}

function extractTags(text) {
  return KEYWORDS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
}
