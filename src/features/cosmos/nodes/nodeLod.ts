export type LodMode = "far" | "mid" | "near";

export function getLodMode(zoom: number): LodMode {
  // 标签仅在 zoom ≥ 1.2 时显示，给用户探索感
  if (zoom < 1.2) return "far";
  if (zoom < 2.5) return "mid";
  return "near";
}
