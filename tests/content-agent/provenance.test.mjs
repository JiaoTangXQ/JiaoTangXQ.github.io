import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();
const SCANNED_PATHS = ["package.json", "scripts", "src", "docs", "tests"];
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".astro", ".cache", ".git", "public/generated"]);
const TEXT_EXTENSIONS = new Set([
  ".astro",
  ".css",
  ".js",
  ".json",
  ".md",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
]);

const FORBIDDEN_MARKERS = [
  ["hex", "2077"].join(""),
  ["何夕", "2077"].join(""),
  ["source", ["hub", "today"].join(""), "app"].join("."),
  ["prompt", ["hub", "today"].join(""), "app"].join("."),
  ["podcast", ["hub", "today"].join(""), "app"].join("."),
  ["reference", "daily", "link", "radar"].join("-"),
  ["Reference", "Daily", "Link", "Radar"].join(" "),
  ["content:import:hex", "2077"].join(""),
  [["import", "hex"].join("-"), "2077"].join(""),
  ["VOL. ", "2077"].join(""),
];

function shouldSkip(relativePath) {
  return relativePath.split(path.sep).some((part) => SKIPPED_DIRS.has(part));
}

function collectTextFiles(relativePath) {
  if (shouldSkip(relativePath)) return [];

  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return [];

  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) {
    return fs.readdirSync(absolutePath).flatMap((entry) => collectTextFiles(path.join(relativePath, entry)));
  }

  if (relativePath === "package.json" || TEXT_EXTENSIONS.has(path.extname(relativePath))) {
    return [relativePath];
  }

  return [];
}

describe("content provenance", () => {
  it("does not retain third-party clone markers or mirrored assets", () => {
    const files = SCANNED_PATHS.flatMap(collectTextFiles);
    const failures = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(ROOT, file), "utf8");
      for (const marker of FORBIDDEN_MARKERS) {
        if (content.toLowerCase().includes(marker.toLowerCase())) {
          failures.push(`${file}: ${marker}`);
        }
      }
    }

    assert.deepEqual(failures, []);
  });
});
