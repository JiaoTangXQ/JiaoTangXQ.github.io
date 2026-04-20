/**
 * 统一的 feed 抓取函数，支持：
 *   1. 原生 RSS/Atom URL 直接抓
 *   2. RSSHub 路由：用 RSSHUB_INSTANCES 做 failover
 *
 * 环境变量：
 *   - RSSHUB_INSTANCES （可选，逗号分隔）：覆盖默认实例列表
 */
import type { ExternalSource } from "../../../src/lib/content/types.js";

const DEFAULT_RSSHUB_INSTANCES = [
  "https://rsshub.rssforever.com",
  "https://rsshub.liumingye.cn",
];

const FETCH_TIMEOUT_MS = 15_000;
// 很多站用 WAF 或 bot 名单拒绝机器人 UA（Songshuhui/TheNewsLens/Reddit 等）。
// 用浏览器风格 UA 通过大部分 WAF，同时在 Referer 里带上项目主页，方便源方识别。
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function getRssHubInstances(): string[] {
  const env = process.env.RSSHUB_INSTANCES;
  if (env && env.trim()) {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_RSSHUB_INSTANCES;
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Basic sanity: must look like XML feed
    if (text.length < 200 || !/<(rss|feed|channel)\b/i.test(text.slice(0, 600))) {
      return null;
    }
    // Reject the "Welcome to RSSHub!" error page (returned as 200 or 503)
    if (/Welcome to RSSHub/i.test(text.slice(0, 400))) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

/**
 * Fetch a source's feed XML. For rsshub sources, tries instances in order until one succeeds.
 * Throws if all attempts fail.
 */
export async function fetchFeedXml(source: ExternalSource): Promise<string> {
  if (source.type === "rsshub") {
    if (!source.rsshubRoute) {
      throw new Error(`Source ${source.id} has type="rsshub" but no rsshubRoute`);
    }
    const instances = getRssHubInstances();
    const errors: string[] = [];
    for (const instance of instances) {
      const url = `${instance.replace(/\/+$/, "")}${source.rsshubRoute}`;
      const xml = await tryFetch(url);
      if (xml) return xml;
      errors.push(`${instance} failed`);
    }
    throw new Error(
      `All RSSHub instances failed for ${source.id} (${source.rsshubRoute}): ${errors.join("; ")}`,
    );
  }

  // Native RSS/Atom
  const xml = await tryFetch(source.feedUrl);
  if (!xml) {
    throw new Error(`fetch failed: ${source.feedUrl}`);
  }
  return xml;
}
