import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const githubProfileUrl = "https://github.com/JiaoTangXQ";

async function readProjectFile(relativePath) {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("site navigation sends About directly to the GitHub profile", async () => {
  const headerSource = await readProjectFile("src/components/SiteHeader.astro");

  assert.match(
    headerSource,
    new RegExp(`href: "${githubProfileUrl.replaceAll("/", "\\/")}"`),
  );
  assert.doesNotMatch(headerSource, /href: "\/about\/"/);
});

test("the legacy About route redirects to the GitHub profile", async () => {
  const aboutSource = await readProjectFile("src/pages/about.astro");

  assert.match(aboutSource, new RegExp(githubProfileUrl.replaceAll("/", "\\/")));
  assert.match(aboutSource, /http-equiv="refresh"/);
  assert.match(aboutSource, /window\.location\.replace\(githubProfileUrl\)/);
  assert.match(aboutSource, /href=\{githubProfileUrl\}/);
});
