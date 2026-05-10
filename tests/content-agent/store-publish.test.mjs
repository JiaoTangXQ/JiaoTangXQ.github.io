import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { JsonStore } from "../../scripts/content-agent/store.mjs";
import { writeContentFile, writeReviewArtifact } from "../../scripts/content-agent/publish.mjs";

describe("content-agent storage and publishing", () => {
  it("persists run artifacts by date and type", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "content-agent-store-"));
    const store = new JsonStore({ root });

    await store.writeRunArtifact("2026-05-07", "signals", [{ id: "one" }]);
    const signals = await store.readRunArtifact("2026-05-07", "signals");

    assert.deepEqual(signals, [{ id: "one" }]);
  });

  it("writes content files and human review artifacts", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "content-agent-publish-"));

    const contentPath = await writeContentFile({
      projectRoot: root,
      relativePath: "src/content/dailies/2026-05-07.md",
      markdown: "---\ntitle: Test\n---\n",
      force: true,
    });
    const reviewPath = await writeReviewArtifact({
      projectRoot: root,
      date: "2026-05-07",
      summaries: [{ title: "Test", sourceUrl: "https://example.com", aiScore: 88 }],
    });

    assert.equal(await fs.readFile(contentPath, "utf8"), "---\ntitle: Test\n---\n");
    assert.match(await fs.readFile(reviewPath, "utf8"), /# 焦糖星球内容生产审核/);
  });
});
