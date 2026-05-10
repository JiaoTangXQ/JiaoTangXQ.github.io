import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { localizeSummaryMedia } from "../../scripts/content-agent/media-assets.mjs";

async function tempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "content-agent-media-"));
}

describe("content-agent media assets", () => {
  it("downloads remote images with the source page referer and rewrites them to public URLs", async () => {
    const projectRoot = await tempRoot();
    const calls = [];
    const sourceUrl = "https://www.aibase.com/news/27750";
    const imageUrl = "https://pic.chinaz.com/picmap/thumb/example.jpg";
    const body = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    const result = await localizeSummaryMedia(
      [
        {
          title: "Aibase item",
          sourceUrl,
          media: { images: [imageUrl], videos: [] },
        },
      ],
      {
        date: "2026-05-08",
        projectRoot,
        fetchImpl: async (url, init) => {
          calls.push({ url, init });
          return new Response(body, {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        },
      },
    );

    const image = result.summaries[0].media.images[0];
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, imageUrl);
    assert.equal(calls[0].init.headers.referer, sourceUrl);
    assert.deepEqual(result.summaries[0].rawMedia.images, [imageUrl]);
    assert.match(image, /^\/generated\/content-agent\/2026-05-08\/[a-f0-9]{16}\.png$/);
    assert.deepEqual(
      new Uint8Array(await fs.readFile(path.join(projectRoot, "public", image))),
      body,
    );
    assert.equal(result.stats.downloaded, 1);
    assert.equal(result.stats.failed, 0);
  });

  it("skips broken hotlinks and keeps the next usable media candidate", async () => {
    const projectRoot = await tempRoot();
    const badUrl = "https://pic.chinaz.com/broken.jpg";
    const goodUrl = "https://cdn.example.com/usable.webp";

    const result = await localizeSummaryMedia(
      [
        {
          title: "Fallback item",
          sourceUrl: "https://www.aibase.com/news/27748",
          media: { images: [badUrl, goodUrl], videos: [] },
        },
      ],
      {
        date: "2026-05-08",
        projectRoot,
        fetchImpl: async (url) => {
          if (url === badUrl) {
            return new Response("<html>forbidden</html>", {
              status: 403,
              headers: { "content-type": "text/html" },
            });
          }
          return new Response(new Uint8Array([82, 73, 70, 70]), {
            status: 200,
            headers: { "content-type": "image/webp" },
          });
        },
      },
    );

    assert.equal(result.summaries[0].media.images.length, 1);
    assert.match(result.summaries[0].media.images[0], /\.webp$/);
    assert.equal(result.stats.downloaded, 1);
    assert.equal(result.stats.failed, 1);
  });

  it("uses the downloaded bytes to choose the asset extension", async () => {
    const projectRoot = await tempRoot();
    const result = await localizeSummaryMedia(
      [
        {
          title: "Mislabeled image",
          sourceUrl: "https://www.aibase.com/news/27741",
          media: { images: ["https://upload.chinaz.com/mislabeled.png"], videos: [] },
        },
      ],
      {
        date: "2026-05-08",
        projectRoot,
        fetchImpl: async () =>
          new Response(new Uint8Array([255, 216, 255, 224, 0, 16]), {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      },
    );

    assert.match(result.summaries[0].media.images[0], /\.jpg$/);
  });

  it("accepts image bytes when the server omits an image content type", async () => {
    const projectRoot = await tempRoot();
    const result = await localizeSummaryMedia(
      [
        {
          title: "Octet image",
          sourceUrl: "https://github.com/acme/project",
          media: { images: ["https://cdn.example.com/og"], videos: [] },
        },
      ],
      {
        date: "2026-05-08",
        projectRoot,
        fetchImpl: async () =>
          new Response(new Uint8Array([137, 80, 78, 71, 13, 10]), {
            status: 200,
            headers: { "content-type": "application/octet-stream" },
          }),
      },
    );

    assert.match(result.summaries[0].media.images[0], /\.png$/);
    assert.equal(result.stats.failed, 0);
  });

  it("reuses raw media when a cached summary already has localized media", async () => {
    const projectRoot = await tempRoot();
    const remoteUrl = "https://pic.chinaz.com/original.jpg";
    const result = await localizeSummaryMedia(
      [
        {
          title: "Cached item",
          sourceUrl: "https://www.aibase.com/news/27750",
          rawMedia: { images: [remoteUrl], videos: [] },
          media: { images: ["/generated/content-agent/old/image.jpg"], videos: [] },
        },
      ],
      {
        date: "2026-05-08",
        projectRoot,
        fetchImpl: async (url) => {
          assert.equal(url, remoteUrl);
          return new Response(new Uint8Array([255, 216, 255]), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          });
        },
      },
    );

    assert.notEqual(result.summaries[0].media.images[0], "/generated/content-agent/old/image.jpg");
    assert.match(result.summaries[0].media.images[0], /\.jpg$/);
  });
});
