/**
 * 全文抽取：readability → 启发式 fallback。
 *
 * 行为：
 *   1. 拿 fetchRawHtml（带本地缓存）拉原始 HTML
 *   2. 喂给 @extractus/article-extractor 的 extractFromHtml（Mozilla Readability）
 *   3. readability 失败或正文过短（< 400 纯文本字）→ extractByHeuristics（DOM 选择器 + 最长 p 簇）
 *   4. 两步都废时返回 null，调用方退回 RSS rawExcerpt
 *
 * 缓存让重跑 / 调策略时不用再打对方服务器。
 */
import { extractFromHtml } from "@extractus/article-extractor";
import { fetchRawHtml } from "./fetchRawHtml.mjs";
import { extractByHeuristics } from "./extractFallback.mjs";
import { htmlToPlainText } from "./sanitizeContent.mjs";

const MIN_CONTENT_CHARS = 400;

export type ExtractedArticle = {
  content: string;
  title?: string;
  strategy: "readability" | "heuristic";
};

async function tryReadability(
  html: string,
  url: string,
): Promise<ExtractedArticle | null> {
  try {
    const result = await extractFromHtml(html, url);
    if (!result || !result.content) return null;
    if (htmlToPlainText(result.content).length < MIN_CONTENT_CHARS) {
      return null;
    }
    return {
      content: result.content,
      title: result.title ?? undefined,
      strategy: "readability",
    };
  } catch {
    return null;
  }
}

function tryHeuristic(html: string): ExtractedArticle | null {
  const extracted = extractByHeuristics(html);
  if (!extracted) return null;
  if (htmlToPlainText(extracted).length < MIN_CONTENT_CHARS) return null;
  return { content: extracted, strategy: "heuristic" };
}

export async function extractFullArticle(
  url: string,
): Promise<ExtractedArticle | null> {
  const rawHtml = await fetchRawHtml(url);
  if (!rawHtml) return null;

  const viaReadability = await tryReadability(rawHtml, url);
  if (viaReadability) return viaReadability;

  return tryHeuristic(rawHtml);
}
