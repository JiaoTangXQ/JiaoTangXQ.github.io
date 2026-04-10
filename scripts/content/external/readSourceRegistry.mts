import fs from "node:fs";
import path from "node:path";
import type { ExternalSource } from "../../../src/lib/content/types.js";

const SOURCES_PATH = path.resolve("content/external/sources.json");

export function readSourceRegistry(): ExternalSource[] {
  if (!fs.existsSync(SOURCES_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(SOURCES_PATH, "utf8");
  const sources = JSON.parse(raw) as ExternalSource[];

  return sources.filter((source) => source.enabled);
}
