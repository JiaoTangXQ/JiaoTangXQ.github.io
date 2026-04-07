export type LodMode = "far" | "mid" | "near";

export function getLodMode(zoom: number): LodMode {
  if (zoom < 0.6) return "far";
  if (zoom < 1.5) return "mid";
  return "near";
}
