/**
 * HTML 清洗：
 * - 剥离 script / style / iframe / 事件属性
 * - 只保留适合阅读的结构标签（p, h2-h4, a, img, ul, ol, li, blockquote, pre, code, strong, em, br, hr, figure, figcaption）
 * - 统一将相对链接转绝对
 * - 导出 sanitize(html, baseUrl) 和 htmlToPlainText(html)
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img",
  "ul", "ol", "li",
  "blockquote",
  "pre", "code",
  "strong", "b", "em", "i", "u",
  "figure", "figcaption",
  "span", "div",
  "table", "thead", "tbody", "tr", "td", "th",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title"]),
  // everything else strips all attributes
};

function resolveUrl(raw: string, baseUrl: string): string {
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

/** Strip all attributes except the whitelisted ones for the given tag. */
function rewriteAttrs(tag: string, attrString: string, baseUrl: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";

  const result: string[] = [];
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(attrString)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.has(name)) continue;
    let value = match[2] ?? match[3] ?? match[4] ?? "";
    if (name === "href" || name === "src") {
      // Filter dangerous protocols
      if (/^\s*(javascript|data):/i.test(value)) continue;
      value = resolveUrl(value, baseUrl);
    }
    const escaped = value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
    result.push(`${name}="${escaped}"`);
  }
  return result.join(" ");
}

/**
 * Sanitize an HTML fragment, keeping only safe tags and attributes.
 * All relative URLs are resolved against baseUrl.
 */
export function sanitizeHtml(html: string, baseUrl: string): string {
  if (!html) return "";

  // Strip obviously unsafe blocks whole
  let out = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Rewrite each tag
  out = out.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (_full, closing, rawTag, attrs) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (closing) return `</${tag}>`;
      const cleanAttrs = rewriteAttrs(tag, attrs, baseUrl);
      // Void elements self-close
      const voids = new Set(["br", "hr", "img"]);
      if (voids.has(tag)) {
        return cleanAttrs ? `<${tag} ${cleanAttrs}/>` : `<${tag}/>`;
      }
      return cleanAttrs ? `<${tag} ${cleanAttrs}>` : `<${tag}>`;
    },
  );

  // Collapse excessive whitespace between block elements
  out = out.replace(/\s{3,}/g, "\n\n").trim();

  return out;
}

/** Convert HTML to plain text for previews and search indexing. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style|iframe|noscript)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<\/?(p|div|li|h[1-6]|blockquote|tr|br|figure)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Compute a CJK-ratio-based language tag. */
export function detectLanguage(text: string): "zh" | "en" | "other" {
  const sample = text.slice(0, 500);
  if (!sample.trim()) return "other";
  const cjk = sample.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const ratio = cjk / sample.length;
  if (ratio > 0.2) return "zh";
  // Mostly ASCII letters → English
  const ascii = sample.match(/[A-Za-z]/g)?.length ?? 0;
  if (ascii / sample.length > 0.3) return "en";
  return "other";
}

/** Extract a preview snippet (plain text, truncated on word/character boundary). */
export function extractPreview(html: string, maxLen = 120): string {
  const plain = htmlToPlainText(html);
  if (plain.length <= maxLen) return plain;
  // Prefer cutting at punctuation
  const slice = plain.slice(0, maxLen);
  const lastPunct = Math.max(
    slice.lastIndexOf("。"),
    slice.lastIndexOf("."),
    slice.lastIndexOf("！"),
    slice.lastIndexOf("? "),
  );
  if (lastPunct > maxLen * 0.6) return slice.slice(0, lastPunct + 1);
  return slice.trimEnd() + "…";
}
