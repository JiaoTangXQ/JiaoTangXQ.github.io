import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getPalette } from "@/lib/content/types";
import type { CosmosNode } from "@/lib/content/types";

type Props = {
  currentSlug: string;
  nodes: CosmosNode[];
};

/**
 * Finds related articles based on shared cluster and overlapping topics,
 * then renders them as small planet cards at the bottom of the article.
 */
export function NearbyPlanets({ currentSlug, nodes }: Props) {
  const related = useMemo(() => {
    const current = nodes.find((n) => n.slug === currentSlug);
    if (!current) return [];

    type Scored = CosmosNode & { _score: number };

    const scored: Scored[] = nodes
      .filter((n) => n.slug !== currentSlug)
      .map((n) => {
        let score = 0;
        // Same cluster gets a base boost
        if (n.cluster === current.cluster) score += 2;
        // Each shared topic adds weight
        const sharedTopics = n.topics.filter((t) =>
          current.topics.includes(t),
        );
        score += sharedTopics.length * 1.5;
        return { ...n, _score: score };
      })
      .filter((n) => n._score > 0);

    // Sort by score descending, take top 4
    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 4);
  }, [currentSlug, nodes]);

  if (related.length === 0) return null;

  return (
    <section className="nearby-planets">
      <h2 className="nearby-planets__title">附近的星球</h2>
      <div className="nearby-planets__grid">
        {related.map((node) => {
          const palette = getPalette(node.cluster);
          const gradient = `linear-gradient(135deg, ${palette.core[0]}, ${palette.core[1]})`;

          return (
            <Link
              key={node.slug}
              to={`/article/${node.slug}`}
              className="nearby-planet-card"
              style={
                { "--card-glow": palette.glow } as React.CSSProperties
              }
            >
              <div
                className="nearby-planet-card__orb"
                style={{ background: gradient }}
              />
              <div className="nearby-planet-card__title">{node.titleZh || node.title}</div>
              {node.contentType === "external" && node.sourceName && (
                <div className="nearby-planet-card__meta">
                  外部来源 · {node.sourceName}
                </div>
              )}
              <div className="nearby-planet-card__summary">
                {node.summary}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
