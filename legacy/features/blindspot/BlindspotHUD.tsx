import { useMemo } from "react";
import type { CosmosNode } from "@/lib/content/types";
import { getPalette } from "@/lib/content/types";
import "@/styles/blindspot.css";

type Props = {
  nodes: CosmosNode[];
  visited: Set<string>;
  active: boolean;
  onToggle: () => void;
  onJumpToBlindspot: () => void;
};

type ClusterStat = {
  name: string;
  total: number;
  visited: number;
};

export function BlindspotHUD({
  nodes,
  visited,
  active,
  onToggle,
  onJumpToBlindspot,
}: Props) {
  const stats = useMemo(() => {
    const visitedCount = nodes.filter((n) => visited.has(n.slug)).length;
    const clusterMap = new Map<string, ClusterStat>();
    for (const n of nodes) {
      let s = clusterMap.get(n.cluster);
      if (!s) {
        s = { name: n.cluster, total: 0, visited: 0 };
        clusterMap.set(n.cluster, s);
      }
      s.total += 1;
      if (visited.has(n.slug)) s.visited += 1;
    }
    const clusters = [...clusterMap.values()];
    const exploredClusters = clusters.filter((c) => c.visited > 0).length;

    // Top 3 most explored (by visited count, min 1)
    const topExplored = clusters
      .filter((c) => c.visited > 0)
      .sort((a, b) => b.visited - a.visited)
      .slice(0, 3);

    // Top 3 biggest blind clusters (by total, visited = 0)
    const topBlind = clusters
      .filter((c) => c.visited === 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    return {
      visitedCount,
      total: nodes.length,
      exploredClusters,
      totalClusters: clusters.length,
      topExplored,
      topBlind,
    };
  }, [nodes, visited]);

  return (
    <>
      {/* Toggle pill */}
      <button
        type="button"
        className={`blindspot-toggle${active ? " blindspot-toggle--active" : ""}`}
        onClick={onToggle}
        aria-pressed={active}
        aria-label={active ? "关闭盲区地图" : "打开盲区地图"}
        title={active ? "关闭盲区地图" : "看看你的阅读盲区"}
      >
        <span className="blindspot-toggle__icon" aria-hidden="true">
          {active ? "◉" : "◐"}
        </span>
        <span className="blindspot-toggle__label">
          {active ? "盲区地图 · 开" : "盲区地图"}
        </span>
      </button>

      {/* Stats panel — only when active */}
      <div
        className={`blindspot-panel${active ? " blindspot-panel--visible" : ""}`}
        aria-hidden={!active}
      >
        <div className="blindspot-panel__header">
          <div className="blindspot-panel__eyebrow">你的阅读画像</div>
          <div className="blindspot-panel__stat">
            已探索{" "}
            <span className="blindspot-panel__num">{stats.visitedCount}</span>
            <span className="blindspot-panel__slash">/</span>
            <span className="blindspot-panel__total">{stats.total}</span>{" "}
            颗星球 ·{" "}
            <span className="blindspot-panel__num">
              {stats.exploredClusters}
            </span>
            <span className="blindspot-panel__slash">/</span>
            <span className="blindspot-panel__total">
              {stats.totalClusters}
            </span>{" "}
            个星系
          </div>
        </div>

        {stats.visitedCount === 0 ? (
          <div className="blindspot-panel__empty">
            你还没读过任何一颗星球 · 整片宇宙都是未知
          </div>
        ) : (
          stats.topExplored.length > 0 && (
            <div className="blindspot-panel__section">
              <div className="blindspot-panel__section-title">你的舒适圈</div>
              <div className="blindspot-panel__chips">
                {stats.topExplored.map((c) => (
                  <span
                    key={c.name}
                    className="blindspot-chip blindspot-chip--explored"
                    style={
                      {
                        ["--chip-color" as never]: getPalette(c.name).core[0],
                      } as React.CSSProperties
                    }
                  >
                    {c.name}
                    <span className="blindspot-chip__count">
                      {c.visited}/{c.total}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )
        )}

        {stats.topBlind.length > 0 && (
          <div className="blindspot-panel__section">
            <div className="blindspot-panel__section-title">完全的盲区</div>
            <div className="blindspot-panel__chips">
              {stats.topBlind.map((c) => (
                <span
                  key={c.name}
                  className="blindspot-chip blindspot-chip--blind"
                  style={
                    {
                      ["--chip-color" as never]: getPalette(c.name).core[0],
                    } as React.CSSProperties
                  }
                >
                  {c.name}
                  <span className="blindspot-chip__count">0/{c.total}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="blindspot-panel__cta"
          onClick={onJumpToBlindspot}
        >
          ✧ 跃迁至盲区
        </button>
      </div>
    </>
  );
}
