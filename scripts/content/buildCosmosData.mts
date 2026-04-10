import fs from "fs";
import path from "path";
import { readArticles } from "./readArticles.mjs";
import { readExternalContent } from "./readExternalContent.mjs";
import type {
  CosmosData,
  CosmosNode,
  ClusterInfo,
  CoverConfig,
  ExternalContentRecord,
} from "../../src/lib/content/types.js";

const CLUSTER_COLORS: Record<string, string> = {
  // 原主题
  技术: "#5cc8ff",
  AI: "#b87aff",
  思考: "#ff8a66",
  骑行: "#47d98f",
  健身: "#d8ff57",
  // Claude Code Book 主题
  工作台架构: "#5cc8ff",
  启动: "#3a9fff",
  输入与路由: "#47c8a0",
  主循环: "#6daaff",
  任务与分派: "#b87aff",
  治理与权限: "#ff6b8a",
  扩展系统: "#47d98f",
  远端与边界: "#ff8a66",
  多Agent协作: "#d8a0ff",
  上下文管理: "#ffb347",
  终端界面: "#5ceaff",
  外延执行: "#ff6b6b",
  工程美学: "#ffd700",
  参考: "#8899aa",
};

/**
 * 宇宙布局算法
 *
 * 抛弃 d3-force 的均匀布局，改用：
 * 1. 每个主题星系有一个随机的"母星"坐标，星系间距离很远
 * 2. 同星系的节点散落在母星周围，距离随机且差异大
 * 3. 整体空间非常大（~6000x4000），给用户"遨游发现"的感觉
 * 4. 仅保证节点不重叠
 */

/** 确定性随机（基于 seed），让每次构建布局稳定 */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 构建时大小 = 纯 importance 权重（时间衰减和点击热度由运行时动态计算） */
function computeSize(article: { importance?: number }): number {
  return article.importance ?? 1.0;
}

/** 检查与已有节点的最小距离 */
function tooClose(x: number, y: number, placed: Array<{ x: number; y: number }>, minDist: number): boolean {
  for (const p of placed) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < minDist * minDist) return true;
  }
  return false;
}

type LocalBuildRecord = ReturnType<typeof readArticles>[number] & {
  contentType: "local";
};

type CosmosBuildRecord = LocalBuildRecord | ExternalContentRecord;

function readAllContent(): CosmosBuildRecord[] {
  const articles: LocalBuildRecord[] = readArticles().map((article) => ({
    ...article,
    contentType: "local",
  }));
  const externalItems = readExternalContent();

  return [...articles, ...externalItems];
}

export function buildCosmosData(): CosmosData {
  const records = readAllContent();
  const rand = seededRandom(42);

  // 所有星球完全随机散布在整个宇宙中，不按主题聚集
  const UNIVERSE_W = 12000;
  const UNIVERSE_H = 8000;
  const placed: Array<{ x: number; y: number }> = [];
  const nodePositions: Array<{ x: number; y: number }> = [];
  const minNodeDist = 70;

  for (const _record of records) {
    let x: number, y: number;
    let tries = 0;

    do {
      x = (rand() - 0.5) * UNIVERSE_W;
      y = (rand() - 0.5) * UNIVERSE_H;
      tries++;
    } while (tooClose(x, y, placed, minNodeDist) && tries < 300);

    placed.push({ x, y });
    nodePositions.push({ x: Math.round(x), y: Math.round(y) });
  }

  // Build nodes
  const nodes: CosmosNode[] = records.map((record, i) => ({
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    topics: record.topics,
    date: record.date,
    contentType: record.contentType,
    sourceName: record.contentType === "external" ? record.sourceName : undefined,
    sourceUrl: record.contentType === "external" ? record.sourceUrl : undefined,
    sourceDomain: record.contentType === "external" ? record.sourceDomain : undefined,
    whyWorthReading:
      record.contentType === "external" ? record.whyWorthReading : undefined,
    x: nodePositions[i].x,
    y: nodePositions[i].y,
    size: computeSize(record),
    cluster: record.topics[0] ?? "其他",
    cover: (record.cover ?? { style: "gradient" }) as CoverConfig,
  }));

  // Cluster centers 用实际节点的平均位置
  const clusterMap = new Map<string, { xs: number[]; ys: number[] }>();
  for (const node of nodes) {
    const entry = clusterMap.get(node.cluster) ?? { xs: [], ys: [] };
    entry.xs.push(node.x);
    entry.ys.push(node.y);
    clusterMap.set(node.cluster, entry);
  }

  const clusters: ClusterInfo[] = Array.from(clusterMap.entries()).map(
    ([name, { xs, ys }]) => ({
      name,
      centerX: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length),
      centerY: Math.round(ys.reduce((a, b) => a + b, 0) / ys.length),
      color: CLUSTER_COLORS[name] ?? "#8899aa",
    }),
  );

  return { nodes, clusters };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const data = buildCosmosData();
  const outDir = path.resolve("public/data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "cosmos.json"),
    JSON.stringify(data, null, 2),
  );
  console.log(
    `✓ cosmos.json: ${data.nodes.length} nodes, ${data.clusters.length} clusters`,
  );
}
