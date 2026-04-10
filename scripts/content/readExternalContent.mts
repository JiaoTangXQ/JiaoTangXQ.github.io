import fs from "node:fs";
import path from "node:path";
import type { ExternalContentRecord } from "../../src/lib/content/types.js";

const EXTERNAL_CONTENT_PATH = path.resolve("content/external/items.json");

export function readExternalContent(): ExternalContentRecord[] {
  if (!fs.existsSync(EXTERNAL_CONTENT_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(EXTERNAL_CONTENT_PATH, "utf8");
  return JSON.parse(raw) as ExternalContentRecord[];
}
