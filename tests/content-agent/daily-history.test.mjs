import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { readRecentDailySourceUrls } from "../../scripts/content-agent/daily-history.mjs";

describe("content-agent daily history", () => {
  it("reads source URLs from recent dailies before the target date", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "content-agent-history-"));
    const dailiesDir = "src/content/dailies";
    await fs.mkdir(path.join(root, dailiesDir), { recursive: true });
    await fs.writeFile(
      path.join(root, dailiesDir, "2026-05-09.md"),
      `---
title: "日报"
date: "2026-05-09"
sections:
  - title: "产品与功能更新"
    items:
      - title: "旧条目"
        sourceUrl: "https://openai.com/news/repeated?utm_source=rss"
---
`,
      "utf8",
    );
    await fs.writeFile(
      path.join(root, dailiesDir, "2026-05-10.md"),
      `---
title: "当天日报"
date: "2026-05-10"
sections:
  - title: "产品与功能更新"
    items:
      - title: "当天条目"
        sourceUrl: "https://example.com/current"
---
`,
      "utf8",
    );

    const urls = await readRecentDailySourceUrls({
      projectRoot: root,
      dailiesDir,
      date: "2026-05-10",
      days: 7,
    });

    assert.deepEqual(urls, ["https://openai.com/news/repeated"]);
  });
});
