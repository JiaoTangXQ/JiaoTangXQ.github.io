import { SOURCES } from "./sources.mjs";

const SECTION_META = {
  models: {
    title: "模型与产品信号",
    tags: ["模型", "产品"],
    angle: "能力边界、入口变化和成本结构",
  },
  tools: {
    title: "开发者工具链",
    tags: ["工具链", "开发者"],
    angle: "工程工作流、协作方式和交付效率",
  },
  research: {
    title: "研究与基建",
    tags: ["研究", "基础设施"],
    angle: "评测方法、推理效率和系统实现路线",
  },
};

export function rewriteSignals(input, options = {}) {
  const signals = Array.isArray(input) ? input : input.signals ?? [];
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const selected = dedupeSignals(signals).slice(0, options.limit ?? 9);

  const sections = ["models", "tools", "research"]
    .map((section) => buildSection(section, selected))
    .filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    sections.push(fallbackSection());
  }

  return {
    title: `AI日报 // ${date} 焦糖信号`,
    description: `从公开原始信源抽取 ${selected.length || SOURCES.length} 条候选信号，改写为焦糖星球自己的 AI 日报摘要。`,
    date,
    draft: true,
    sections,
  };
}

function buildSection(sectionKey, signals) {
  const meta = SECTION_META[sectionKey];
  const items = signals
    .filter((signal) => normalizedSection(signal) === sectionKey)
    .slice(0, 3)
    .map((signal, index) => rewriteSignal(signal, meta, index));

  return {
    title: meta.title,
    items,
  };
}

function rewriteSignal(signal, meta, index) {
  const keywords = keywordsFor(signal);
  const title = titleFor(signal, meta, keywords, index);
  const tagSet = new Set([...meta.tags, ...keywords.slice(0, 3)]);

  return {
    title,
    summary: `这条来自 ${signal.sourceName} 的信号被归入「${meta.title}」。焦糖星球不复述原文摘要，而是把关键词压缩为 ${keywords.join(" / ") || "AI 变化"}，重点观察它对${meta.angle}的影响。`,
    whyItMatters: `值得关注的不是单条新闻本身，而是它是否会改变接下来一到两个季度的${meta.angle}。`,
    sourceName: signal.sourceName,
    sourceUrl: signal.url || signal.sourceHomepage,
    tags: Array.from(tagSet).slice(0, 5),
  };
}

function titleFor(signal, meta, keywords, index) {
  const source = signal.sourceName.replace(/\s+(News|Blog|Changelog)$/i, "");
  const focus = keywords[0] ?? "AI";
  const variants = [
    `${source} 新信号：先看 ${focus}，再看落地入口`,
    `${focus} 方向继续升温，${source} 提供了新的观察点`,
    `${meta.title}更新：${focus} 值得放进下一轮技术判断`,
  ];
  return variants[index % variants.length];
}

function normalizedSection(signal) {
  if (signal.sourceSection && SECTION_META[signal.sourceSection]) return signal.sourceSection;
  const haystack = `${signal.title} ${signal.summary}`.toLowerCase();
  if (/paper|arxiv|research|benchmark|eval|论文|研究|评测/.test(haystack)) return "research";
  if (/github|code|developer|tool|ide|mcp|workflow|开发者|工具/.test(haystack)) return "tools";
  return "models";
}

function keywordsFor(signal) {
  const text = `${signal.title} ${signal.summary}`;
  const candidates = [
    ["Agent", /agent|智能体/i],
    ["MCP", /\bmcp\b|model context protocol/i],
    ["API", /\bapi\b/i],
    ["评测", /eval|benchmark|评测|基准/i],
    ["推理", /reasoning|inference|推理/i],
    ["代码", /code|coding|developer|代码|开发者/i],
    ["多模态", /multimodal|vision|audio|video|多模态|视觉|音频|视频/i],
    ["模型", /model|llm|模型/i],
    ["安全", /safety|security|安全/i],
  ];
  const found = candidates.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  return found.length > 0 ? found : ["AI", "信号"];
}

function dedupeSignals(signals) {
  const seen = new Set();
  const out = [];
  for (const signal of signals) {
    const key = normalizeKey(signal.url || signal.title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(signal);
  }
  return out;
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/$/, "");
}

function fallbackSection() {
  return {
    title: "信源池状态",
    items: SOURCES.slice(0, 3).map((source) => ({
      title: `${source.name} 已进入日报候选池`,
      summary: `当前抓取没有拿到可用条目，先保留 ${source.name} 作为原始信源入口。下一次生成会继续尝试抓取并重新组织摘要。`,
      whyItMatters: "日报应该从原始来源开始，而不是复刻其他站点已经整理好的内容。",
      sourceName: source.name,
      sourceUrl: source.homepage,
      tags: ["信源", "管线"],
    })),
  };
}
