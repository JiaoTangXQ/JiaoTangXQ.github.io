import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function readProjectFile(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("server build uses the server URL as the default canonical site", async () => {
  const config = await readProjectFile("astro.config.mjs");
  const packageJson = await readProjectFile("package.json");

  assert.match(config, /DEFAULT_SITE = "http:\/\/121\.40\.108\.230"/);
  assert.match(config, /process\.env\.SITE_URL/);
  assert.match(packageJson, /"build:server"/);
});

test("robots.txt is generated from Astro.site instead of a hard-coded GitHub Pages URL", async () => {
  const robotsRoute = await readProjectFile("src/pages/robots.txt.ts");

  assert.match(robotsRoute, /site\?\.toString\(\)/);
  assert.match(robotsRoute, /sitemap-index\.xml/);
  assert.doesNotMatch(robotsRoute, /jiaotangxq\.github\.io/);

  await assert.rejects(access(new URL("../../public/robots.txt", import.meta.url)));
});
