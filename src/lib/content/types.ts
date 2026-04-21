export type CoverConfig = {
  style?: "gradient" | "image";
  accent?: string;
  imageUrl?: string;
  gradientAngle?: number;
  gradientColors?: string[];
  titleAlign?: "left" | "center" | "right";
  titlePosition?: "bottom" | "center" | "top";
  overlayOpacity?: number;
};

export type ContentType = "local" | "external";

/**
 * 信息源类型：
 * - "rss" / "atom"：原生 feed，直接用 feedUrl
 * - "rsshub"：走 RSSHub 桥接，需要 rsshubRoute，抓取时用 RSSHUB_INSTANCES 做 failover
 */
export type FeedType = "rss" | "atom" | "rsshub";

export type SourceStance =
  | "mainstream"
  | "independent"
  | "critical"
  | "progressive"
  | "conservative"
  | "academic"
  | "non-western"
  | "speculative"
  | "technical"
  | "indie";

export type ExternalSource = {
  id: string;
  name: string;
  siteUrl: string;
  feedUrl: string;
  defaultTopics: string[];
  maxItems?: number;
  enabled: boolean;
  /** 抓取方式；默认直接用 feedUrl（rss/atom 自动识别）。"rsshub" 会走 failover 实例。 */
  type?: FeedType;
  /** 仅 type="rsshub" 时用：形如 "/zhihu/daily"，抓取时自动拼 instance。 */
  rsshubRoute?: string;
  /** 源语言，影响下游 LLM 摘要策略：zh 的源跳过翻译。 */
  language?: string;
  /** 源立场，用于"今日三题"对立观点聚类。 */
  stance?: SourceStance;
};

export type ExternalContentCandidate = {
  slug: string;
  title: string;
  date: string;
  topics: string[];
  sourceName: string;
  sourceUrl: string;
  sourceDomain: string;
  rawExcerpt: string;
};

/**
 * 已入库的外部内容条目。
 *
 * 直接展示源标题和源正文 HTML，页面底部附原文链接声明——不再做中文化总结。
 * 规则过滤在抓取阶段完成，入库的都是过关内容。
 */
export type ExternalContentRecord = {
  slug: string;
  contentType: "external";
  /** 源语言：zh / en / 其他。首字符 CJK 占比自动判断。 */
  language: "zh" | "en" | "other";
  /** 原标题（保留源语言） */
  title: string;
  date: string;
  /** 继承自源的默认 topics，可不含中文分类（仍按 topics[0] 做 cluster） */
  topics: string[];
  /** 正文 HTML（已清洗），尽量是全文；抓不到全文时退回 RSS 摘录 */
  content: string;
  /** 纯文本预览（120 字以内），由 content 自动派生，用于 HUD 预览和搜索 */
  preview: string;
  sourceName: string;
  sourceUrl: string;
  sourceDomain: string;
  /** 源立场标签，从 ExternalSource 继承（供可选的立场聚类用） */
  stance?: SourceStance;
  cover?: CoverConfig;
};

export type CosmosNode = {
  slug: string;
  title: string;
  /** 120 字以内纯文本预览，用于悬停卡片和搜索摘要 */
  preview: string;
  topics: string[];
  date: string;
  contentType?: ContentType;
  /** 内容语言标签，驱动 UI 上的字体/字号差异 */
  language?: "zh" | "en" | "other";
  sourceName?: string;
  sourceUrl?: string;
  sourceDomain?: string;
  x: number;
  y: number;
  size: number;
  cluster: string;
  cover: CoverConfig;
};

export type ClusterInfo = {
  name: string;
  centerX: number;
  centerY: number;
  color: string;
};

export type CosmosData = {
  nodes: CosmosNode[];
  clusters: ClusterInfo[];
};

export type SearchIndexEntry = {
  slug: string;
  title: string;
  preview: string;
  topics: string[];
  date: string;
  cluster: string;
  body: string;
  contentType?: ContentType;
  language?: "zh" | "en" | "other";
  sourceName?: string;
  sourceUrl?: string;
  sourceDomain?: string;
};

export type ArticleFrontmatter = {
  title: string;
  slug: string;
  date: string;
  topics: string[];
  summary: string;
  cover?: CoverConfig;
  importance?: number;
};

export type ArticleRecord = ArticleFrontmatter & {
  body: string;
  htmlContent?: string;
};

export const CLUSTER_PALETTES: Record<
  string,
  { core: [string, string]; glow: string; accent: string }
> = {
  技术: {
    core: ["#5cc8ff", "#3a7fff"],
    glow: "rgba(92,200,255,0.5)",
    accent: "#7dd8ff",
  },
  AI: {
    core: ["#b87aff", "#6d61ff"],
    glow: "rgba(109,97,255,0.5)",
    accent: "#c88aff",
  },
  思考: {
    core: ["#ff8a66", "#ff4fb8"],
    glow: "rgba(255,138,102,0.5)",
    accent: "#ffa088",
  },
  骑行: {
    core: ["#47d98f", "#2ab878"],
    glow: "rgba(71,217,143,0.5)",
    accent: "#6de8a8",
  },
  健身: {
    core: ["#d8ff57", "#a8e600"],
    glow: "rgba(216,255,87,0.5)",
    accent: "#e2ff7a",
  },
  科学: {
    core: ["#4dd0e1", "#2b90d9"],
    glow: "rgba(77,208,225,0.45)",
    accent: "#84e4ef",
  },
  社会: {
    core: ["#ff7a90", "#ff5f6d"],
    glow: "rgba(255,122,144,0.45)",
    accent: "#ff9eb0",
  },
  环境: {
    core: ["#3fd18a", "#1ea672"],
    glow: "rgba(63,209,138,0.45)",
    accent: "#6ee5aa",
  },
  健康: {
    core: ["#73d9a7", "#43b581"],
    glow: "rgba(115,217,167,0.45)",
    accent: "#97e8bf",
  },
  历史: {
    core: ["#caa65c", "#8f6d2d"],
    glow: "rgba(202,166,92,0.42)",
    accent: "#dbbe82",
  },
  文化: {
    core: ["#f28cc8", "#d860aa"],
    glow: "rgba(242,140,200,0.42)",
    accent: "#f6aedb",
  },
  哲学: {
    core: ["#9d8cff", "#6f61d8"],
    glow: "rgba(157,140,255,0.45)",
    accent: "#b3a7ff",
  },
  经济: {
    core: ["#f2c14e", "#d4951d"],
    glow: "rgba(242,193,78,0.42)",
    accent: "#f7d27a",
  },
  法律: {
    core: ["#6f86ff", "#4d5fd1"],
    glow: "rgba(111,134,255,0.42)",
    accent: "#93a5ff",
  },
  工作台架构: { core: ["#5cc8ff", "#3a7fff"], glow: "rgba(92,200,255,0.5)", accent: "#7dd8ff" },
  启动: { core: ["#3a9fff", "#2070dd"], glow: "rgba(58,159,255,0.5)", accent: "#5cb0ff" },
  输入与路由: { core: ["#47c8a0", "#2a9878"], glow: "rgba(71,200,160,0.5)", accent: "#6dd8b8" },
  主循环: { core: ["#6daaff", "#4080dd"], glow: "rgba(109,170,255,0.5)", accent: "#8dc0ff" },
  任务与分派: { core: ["#b87aff", "#8050dd"], glow: "rgba(184,122,255,0.5)", accent: "#c88aff" },
  治理与权限: { core: ["#ff6b8a", "#dd4060"], glow: "rgba(255,107,138,0.5)", accent: "#ff8da8" },
  扩展系统: { core: ["#47d98f", "#2ab878"], glow: "rgba(71,217,143,0.5)", accent: "#6de8a8" },
  远端与边界: { core: ["#ff8a66", "#dd6040"], glow: "rgba(255,138,102,0.5)", accent: "#ffa088" },
  多Agent协作: { core: ["#d8a0ff", "#a070dd"], glow: "rgba(216,160,255,0.5)", accent: "#e0b8ff" },
  上下文管理: { core: ["#ffb347", "#dd8820"], glow: "rgba(255,179,71,0.5)", accent: "#ffc870" },
  终端界面: { core: ["#5ceaff", "#30c8dd"], glow: "rgba(92,234,255,0.5)", accent: "#7cf0ff" },
  外延执行: { core: ["#ff6b6b", "#dd4040"], glow: "rgba(255,107,107,0.5)", accent: "#ff8d8d" },
  工程美学: { core: ["#ffd700", "#ddaa00"], glow: "rgba(255,215,0,0.5)", accent: "#ffe040" },
  参考: { core: ["#8899aa", "#667788"], glow: "rgba(136,153,170,0.4)", accent: "#99aabb" },
  _fallback: {
    core: ["#8899aa", "#667788"],
    glow: "rgba(136,153,170,0.4)",
    accent: "#99aabb",
  },
};

export function getPalette(cluster: string) {
  return CLUSTER_PALETTES[cluster] ?? CLUSTER_PALETTES._fallback;
}

/** Build a CSS gradient string from cover config + cluster palette. */
export function buildCoverGradient(
  cover: CoverConfig,
  cluster: string,
): string {
  const palette = getPalette(cluster);
  const angle = cover.gradientAngle ?? 135;
  const colors = cover.gradientColors ?? [
    palette.core[0],
    palette.core[1],
    "var(--space-deep)",
  ];
  return `linear-gradient(${angle}deg, ${colors.join(", ")})`;
}
