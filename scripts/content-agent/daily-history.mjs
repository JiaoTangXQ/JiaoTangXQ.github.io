import fs from "node:fs/promises";
import path from "node:path";
import { normalizeUrl } from "./utils.mjs";

export async function readRecentDailySourceUrls({
  projectRoot = process.cwd(),
  dailiesDir = "src/content/dailies",
  date,
  days = 7,
} = {}) {
  const target = dateToTime(date);
  if (!Number.isFinite(target)) return [];
  const earliest = target - Number(days) * 86_400_000;
  const dir = path.join(projectRoot, dailiesDir);
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const urls = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(md|mdx)$/.test(entry.name)) continue;
    const fileDate = entry.name.match(/^(\d{4}-\d{2}-\d{2})\.(?:md|mdx)$/)?.[1];
    const fileTime = dateToTime(fileDate);
    if (!Number.isFinite(fileTime) || fileTime >= target || fileTime < earliest) continue;

    const content = await fs.readFile(path.join(dir, entry.name), "utf8");
    for (const url of extractSourceUrls(content)) {
      urls.push(url);
    }
  }

  return [...new Set(urls)].sort();
}

function extractSourceUrls(content) {
  return Array.from(String(content).matchAll(/^\s*sourceUrl:\s*["']?([^"'\n]+)["']?\s*$/gm))
    .map((match) => normalizeUrl(match[1]))
    .filter(Boolean);
}

function dateToTime(date) {
  if (!date) return NaN;
  return new Date(`${date}T00:00:00.000Z`).getTime();
}
