import type { CosmosNode } from "@/lib/content/types";

type PickResult = {
  node: CosmosNode;
  /** 0-1, 越高越陌生 */
  strangeness: number;
  /** 诊断信息，UI 可选展示 */
  reason: string;
};

/**
 * 从 nodes 中选一个"离用户当前视野最远"的星球。
 *
 * 算法：
 *   1. 从已访问节点里统计 tag 权重 + cluster 集合 = 用户画像
 *   2. 对每个未访问节点评分：
 *        strangeness = tag 非重合度 × 0.6 + cluster 陌生度 × 0.4
 *   3. 取 top 20% 最陌生的，随机抽一个（保持惊喜感）
 *   4. 无历史时，退化为"在最小星系里随机"——优先展示冷门
 */
export function pickStrangestNode(
  nodes: CosmosNode[],
  visited: Set<string>,
): PickResult | null {
  if (nodes.length === 0) return null;

  const unvisited = nodes.filter((n) => !visited.has(n.slug));
  const pool = unvisited.length > 0 ? unvisited : nodes;

  // --- cold start：没有历史 ---
  if (visited.size === 0) {
    // 找星系规模最小的 —— 冷门=陌生
    const clusterCounts = new Map<string, number>();
    for (const n of nodes) {
      clusterCounts.set(n.cluster, (clusterCounts.get(n.cluster) ?? 0) + 1);
    }
    const min = Math.min(...clusterCounts.values());
    const coldClusters = new Set(
      [...clusterCounts.entries()]
        .filter(([, c]) => c <= min * 1.6)
        .map(([k]) => k),
    );
    const candidates = pool.filter((n) => coldClusters.has(n.cluster));
    const picked = pickRandom(candidates.length > 0 ? candidates : pool);
    return {
      node: picked,
      strangeness: 1,
      reason: `从冷门星系「${picked.cluster}」随机选中`,
    };
  }

  // --- 构建用户画像 ---
  const visitedNodes = nodes.filter((n) => visited.has(n.slug));
  const userTagWeight = new Map<string, number>();
  const userClusters = new Set<string>();
  for (const n of visitedNodes) {
    userClusters.add(n.cluster);
    for (const t of n.topics) {
      userTagWeight.set(t, (userTagWeight.get(t) ?? 0) + 1);
    }
  }

  // --- 打分 ---
  const scored = pool.map((n) => {
    // tag overlap: 已被用户读过的 tag 比例越高 → 越熟悉
    const overlap =
      n.topics.length === 0
        ? 0
        : n.topics.filter((t) => userTagWeight.has(t)).length / n.topics.length;
    const tagStrangeness = 1 - overlap;
    const clusterStrangeness = userClusters.has(n.cluster) ? 0 : 1;
    const strangeness = tagStrangeness * 0.6 + clusterStrangeness * 0.4;
    return { node: n, strangeness };
  });

  // --- top 20% 里抽一个，避免每次同一个 ---
  scored.sort((a, b) => b.strangeness - a.strangeness);
  const topCount = Math.max(1, Math.floor(scored.length * 0.2));
  const top = scored.slice(0, topCount);
  const picked = top[Math.floor(Math.random() * top.length)];

  const reason =
    picked.strangeness >= 0.8
      ? `这是一个你从未靠近的星系「${picked.node.cluster}」`
      : picked.strangeness >= 0.5
        ? `这颗星球的主题与你读过的几乎不重叠`
        : `系统在你阅读画像之外的边缘挑了这一颗`;

  return { node: picked.node, strangeness: picked.strangeness, reason };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
