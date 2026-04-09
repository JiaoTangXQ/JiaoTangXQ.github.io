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

export type CosmosNode = {
  slug: string;
  title: string;
  summary: string;
  topics: string[];
  date: string;
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
  summary: string;
  topics: string[];
  date: string;
  cluster: string;
  body: string;
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
