import fs from "fs";
import path from "path";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force";
import { readArticles } from "./readArticles.mjs";
import type { CosmosData, CosmosNode, ClusterInfo } from "../../src/lib/content/types.js";

const CLUSTER_COLORS: Record<string, string> = {
  技术: "#5cc8ff",
  AI: "#b87aff",
  思考: "#ff8a66",
  骑行: "#47d98f",
  健身: "#d8ff57",
};

function buildLinks(articles: ReturnType<typeof readArticles>) {
  const links: Array<{ source: number; target: number; strength: number }> = [];

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const shared = articles[i].topics.filter((t) =>
        articles[j].topics.includes(t),
      );
      if (shared.length > 0) {
        links.push({
          source: i,
          target: j,
          strength: shared.length * 0.3,
        });
      }
    }
  }

  return links;
}

function computeSize(article: ReturnType<typeof readArticles>[number]): number {
  const base = article.importance ?? 1.0;
  // Boost recent articles slightly
  const daysSincePublish = Math.max(
    0,
    (Date.now() - new Date(article.date).getTime()) / (1000 * 60 * 60 * 24),
  );
  const recencyBoost = Math.max(0, 1 - daysSincePublish / 365) * 0.3;
  return Math.round((base + recencyBoost) * 100) / 100;
}

function buildCosmosData(): CosmosData {
  const articles = readArticles();

  // Create simulation nodes
  type SimNode = { index: number; x: number; y: number; vx: number; vy: number };
  const simNodes: SimNode[] = articles.map((_, i) => ({
    index: i,
    x: (Math.random() - 0.5) * 800,
    y: (Math.random() - 0.5) * 600,
    vx: 0,
    vy: 0,
  }));

  const links = buildLinks(articles);

  // Run force simulation — 随机散布，同主题松散聚集但不等距
  const simulation = forceSimulation(simNodes)
    .force(
      "link",
      forceLink(links)
        .id((_d, i) => i)
        .distance(300)
        .strength((d: any) => d.strength * 0.5),
    )
    .force("charge", forceManyBody().strength(-800))
    .force("center", forceCenter(0, 0).strength(0.01))
    // 仅防止完全重叠，不强制均匀间距
    .force("collide", forceCollide(60))
    .stop();

  // 少跑几轮让布局不过度收敛，保留随机感
  for (let i = 0; i < 150; i++) {
    simulation.tick();
  }

  // Build nodes
  const nodes: CosmosNode[] = articles.map((article, i) => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    topics: article.topics,
    date: article.date,
    x: Math.round(simNodes[i].x),
    y: Math.round(simNodes[i].y),
    size: computeSize(article),
    cluster: article.topics[0] ?? "其他",
    cover: article.cover ?? { style: "gradient" },
  }));

  // Compute cluster centers
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

// Run
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
