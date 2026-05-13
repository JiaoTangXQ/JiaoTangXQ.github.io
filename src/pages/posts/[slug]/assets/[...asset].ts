import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { APIContext } from "astro";
import { getAllHtmlPosts } from "@/lib/html-posts.mjs";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

export async function getStaticPaths() {
  const paths = [];
  const posts = await getAllHtmlPosts();
  for (const post of posts) {
    const assetsDir = path.join(post.directory, "assets");
    if (!existsSync(assetsDir)) continue;
    for (const file of await walk(assetsDir)) {
      const asset = path.relative(assetsDir, file).split(path.sep).join("/");
      paths.push({
        params: { slug: post.slug, asset },
        props: { file },
      });
    }
  }
  return paths;
}

export async function GET({ props }: APIContext) {
  const file = props.file as string;
  const ext = path.extname(file).toLowerCase();
  const body = await readFile(file);
  return new Response(body, {
    headers: {
      "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
