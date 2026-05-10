import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir, stableHash } from "./utils.mjs";

const DEFAULT_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_BYTES = 48 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

const EXTENSIONS_BY_CONTENT_TYPE = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/svg+xml", "svg"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
]);

export async function localizeSummaryMedia(summaries = [], options = {}) {
  const {
    projectRoot = process.cwd(),
    date,
    publicDir = "public",
    outputDir = "generated/content-agent",
    fetchImpl = globalThis.fetch,
    maxImagesPerItem = 1,
    maxVideosPerItem = 1,
    maxImageBytes = DEFAULT_MAX_IMAGE_BYTES,
    maxVideoBytes = DEFAULT_MAX_VIDEO_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  if (!date) throw new Error("localizeSummaryMedia requires a date.");
  if (typeof fetchImpl !== "function") throw new Error("localizeSummaryMedia requires fetch.");

  const stats = {
    downloaded: 0,
    reused: 0,
    keptLocal: 0,
    failed: 0,
    skipped: 0,
  };

  const localized = [];
  for (const item of summaries ?? []) {
    const originalMedia = item.rawMedia ?? item.media ?? { images: [], videos: [] };
    const baseOptions = {
      projectRoot,
      date,
      publicDir,
      outputDir,
      fetchImpl,
      sourceUrl: item.sourceUrl,
      timeoutMs,
      stats,
    };
    const videos = await localizeMediaList(originalMedia.videos, {
      ...baseOptions,
      kind: "video",
      limit: maxVideosPerItem,
      maxBytes: maxVideoBytes,
    });
    const images = await localizeMediaList(originalMedia.images, {
      ...baseOptions,
      kind: "image",
      limit: maxImagesPerItem,
      maxBytes: maxImageBytes,
    });
    localized.push({
      ...item,
      rawMedia: originalMedia,
      media: {
        images,
        videos,
      },
    });
  }

  return { summaries: localized, stats };
}

async function localizeMediaList(urls = [], options) {
  const out = [];
  for (const url of urls ?? []) {
    if (out.length >= options.limit) break;
    const value = String(url ?? "").trim();
    if (!value) continue;
    if (isLocalPublicUrl(value)) {
      out.push(value);
      options.stats.keptLocal += 1;
      continue;
    }
    if (!isDownloadableUrl(value, options.kind)) {
      options.stats.skipped += 1;
      continue;
    }

    const localized = await downloadMediaAsset(value, options);
    if (localized) out.push(localized);
  }
  return out;
}

export async function downloadMediaAsset(url, options = {}) {
  const {
    projectRoot = process.cwd(),
    date,
    publicDir = "public",
    outputDir = "generated/content-agent",
    sourceUrl,
    kind = "image",
    fetchImpl = globalThis.fetch,
    maxBytes = kind === "video" ? DEFAULT_MAX_VIDEO_BYTES : DEFAULT_MAX_IMAGE_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    stats = null,
  } = options;

  const hash = stableHash(`${kind}:${url}`);
  const publicBase = path.posix.join("/", outputDir, date);
  const diskDir = path.join(projectRoot, publicDir, outputDir, date);
  await ensureDir(diskDir);

  const existing = await findExistingAsset(diskDir, hash, kind);
  if (existing) {
    if (stats) stats.reused += 1;
    return path.posix.join(publicBase, existing);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      signal: controller.signal,
      headers: requestHeaders(sourceUrl),
    });
    const contentType = cleanContentType(response.headers?.get?.("content-type"));
    if (!response.ok) {
      if (stats) stats.failed += 1;
      return null;
    }

    const contentLength = Number(response.headers?.get?.("content-length") ?? 0);
    if (contentLength > maxBytes) {
      if (stats) stats.skipped += 1;
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      if (stats) stats.skipped += 1;
      return null;
    }

    const detectedExtension = extensionFromBytes(buffer, kind);
    if (!contentType.startsWith(`${kind}/`) && !detectedExtension) {
      if (stats) stats.failed += 1;
      return null;
    }

    const extension = extensionFor(buffer, contentType, url, kind);
    const fileName = `${hash}.${extension}`;
    await fs.writeFile(path.join(diskDir, fileName), buffer);
    if (stats) stats.downloaded += 1;
    return path.posix.join(publicBase, fileName);
  } catch {
    if (stats) stats.failed += 1;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function requestHeaders(sourceUrl) {
  const headers = {
    accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125 Safari/537.36",
  };
  if (sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
    headers.referer = sourceUrl;
  }
  return headers;
}

function cleanContentType(value = "") {
  return String(value).split(";")[0].trim().toLowerCase();
}

function extensionFor(buffer, contentType, url, kind) {
  const fromBytes = extensionFromBytes(buffer, kind);
  if (fromBytes) return fromBytes;

  const fromContentType = EXTENSIONS_BY_CONTENT_TYPE.get(contentType);
  if (fromContentType) return fromContentType;

  const fromUrl = String(url)
    .split(/[?#]/, 1)[0]
    .match(/\.([a-z0-9]{2,5})$/i)?.[1]
    ?.toLowerCase();
  if (fromUrl) return fromUrl === "jpeg" ? "jpg" : fromUrl;
  return kind === "video" ? "mp4" : "jpg";
}

function extensionFromBytes(buffer, kind) {
  if (!buffer?.length) return "";
  if (kind === "image") {
    if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "png";
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "jpg";
    }
    const header = buffer.subarray(0, 12).toString("ascii");
    if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "gif";
    if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "webp";
    if (header.slice(4, 12).includes("ftypavif")) return "avif";
    if (buffer.subarray(0, 128).toString("utf8").trimStart().startsWith("<svg")) return "svg";
    return "";
  }

  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }
  const box = buffer.subarray(4, 12).toString("ascii");
  if (box.includes("ftypqt")) return "mov";
  if (box.startsWith("ftyp")) return "mp4";
  return "";
}

async function findExistingAsset(dir, hash, kind) {
  try {
    const entries = await fs.readdir(dir);
    const entry = entries.find((candidate) => candidate.startsWith(`${hash}.`));
    if (!entry) return null;
    const actualExtension = extensionFromBytes(await fs.readFile(path.join(dir, entry)), kind);
    const currentExtension = path.extname(entry).slice(1).toLowerCase();
    if (actualExtension && actualExtension !== currentExtension) {
      const corrected = `${hash}.${actualExtension}`;
      await fs.rename(path.join(dir, entry), path.join(dir, corrected));
      return corrected;
    }
    return entry;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function isLocalPublicUrl(url) {
  return url.startsWith("/") && !url.startsWith("//");
}

function isDownloadableUrl(url, kind) {
  if (!/^https?:\/\//i.test(url)) return false;
  if (kind === "video" && /(?:youtube\.com|youtu\.be|bilibili\.com|vimeo\.com)/i.test(url)) return false;
  return true;
}
