export type LodMode = "far" | "mid" | "near";

export function getLodMode(zoom: number): LodMode {
  if (zoom < 0.8) return "far";
  if (zoom < 1.8) return "mid";
  return "near";
}
