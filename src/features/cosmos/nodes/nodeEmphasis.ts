import type { CosmosNode } from "@/lib/content/types";

export type EmphasisLevel = "active" | "related" | "default" | "muted";

/**
 * Determine the emphasis level for a node based on current interaction state.
 *
 * Priority:
 * 1. If this node is the active (clicked) node → "active"
 * 2. If a node is hovered and this node shares its cluster → "related"
 * 3. If a theme filter is active and this node is NOT in that theme → "muted"
 * 4. Otherwise → "default"
 */
export function getEmphasis(
  node: CosmosNode,
  hoveredSlug: string | null,
  activeSlug: string | null,
  activeTheme: string | null,
  /** Cluster of the hovered node, pass to avoid repeated lookups */
  hoveredCluster?: string | null,
): EmphasisLevel {
  // Active node always gets full emphasis
  if (activeSlug && node.slug === activeSlug) return "active";

  // If a node is hovered, compute relatedness
  if (hoveredSlug) {
    if (node.slug === hoveredSlug) return "active";
    if (hoveredCluster && node.cluster === hoveredCluster) return "related";
  }

  // Theme lens: mute nodes outside the active theme
  if (activeTheme && node.cluster !== activeTheme) return "muted";

  return "default";
}

/** Map emphasis level to the float value consumed by the planetNode shader. */
export function emphasisToFloat(level: EmphasisLevel): number {
  switch (level) {
    case "active":
      return 1.0;
    case "related":
      return 0.8;
    case "default":
      return 0.5;
    case "muted":
      return 0.0;
  }
}
