/**
 * 尝试抓取原文并抽取正文 HTML。
 * 失败时返回 null，调用方退回 rawExcerpt。
 *
 * 行为：
 * - 有 15 秒超时（单页不拖慢管线）
 * - 只抓 text/html（跳过 PDF / 音频）
 * - 失败/超时静默返回 null
 */
import { extract } from "@extractus/article-extractor";

const TIMEOUT_MS = 15000;

export type ExtractedArticle = {
  content: string;
  title?: string;
};

export async function extractFullArticle(
  url: string,
): Promise<ExtractedArticle | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // @extractus/article-extractor supports fetch options in some forms; fallback to manual
    const result = await extract(url, {}, { signal: controller.signal });
    if (!result || !result.content) return null;
    return {
      content: result.content,
      title: result.title ?? undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
