/**
 * 带本地缓存的 HTML 抓取。
 *
 * 语义：给定 URL 总是返回它的原始 HTML 字符串（或 null）。
 * 首次命中落盘到 content/external/.cache/<hash>.html，重复调用零外网。
 *
 * 用途：extractFullArticle 的 readability 阶段和 fallback 阶段共享同一份原始 HTML，
 * 调参 / 换策略重跑时不用反复拉远端。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const CACHE_DIR = path.resolve("content/external/.cache");
const TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function cacheKey(url: string): string {
  return createHash("sha1").update(url).digest("hex");
}

function cachePath(url: string): string {
  return path.join(CACHE_DIR, `${cacheKey(url)}.html`);
}

/** 读缓存；不存在返回 null。 */
export function readCachedHtml(url: string): string | null {
  const p = cachePath(url);
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** 写缓存；静默失败。 */
function writeCache(url: string, html: string): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath(url), html);
  } catch {
    // 磁盘满 / 权限问题时不中断管线
  }
}

/**
 * 优先读缓存；miss 时发请求、存盘、返回。
 * 只接受 text/html；非 HTML、4xx/5xx、超时都返回 null。
 */
export async function fetchRawHtml(url: string): Promise<string | null> {
  const cached = readCachedHtml(url);
  if (cached) return cached;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !ct.includes("html") && !ct.includes("xml")) return null;
    const html = await res.text();
    if (!html || html.length < 200) return null;
    writeCache(url, html);
    return html;
  } catch {
    return null;
  }
}
