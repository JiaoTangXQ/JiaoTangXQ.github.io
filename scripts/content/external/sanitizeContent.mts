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

const BLOCK_TAG_PATTERN =
  /<\/?(?:article|section|main|p|div|br|hr|h[1-6]|ul|ol|li|blockquote|pre|table|figure)\b/i;

const RESOURCE_LABELS = [
  "体验地址：",
  "体验地址:",
  "官网：",
  "官网:",
  "API文档：",
  "API文档:",
  "API 文档：",
  "API 文档:",
  "开源链接：",
  "开源链接:",
  "技术报告：",
  "技术报告:",
  "论文：",
  "论文:",
  "项目地址：",
  "项目地址:",
  "GitHub：",
  "GitHub:",
  "原文链接：",
  "原文链接:",
  "Article URL:",
  "Comments URL:",
  "Original Text:",
  "Tags:",
  "风险提示及免责条款",
];

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"'，。！？；：、（）()【】\[\]{}]+|(?<![A-Za-z0-9@._-])(?:[A-Za-z0-9-]+\.)+(?:com|cn|org|net|io|ai|dev|site|app|co|me|edu|gov|info|tech|cloud|xyz|top|link|news|tv|cc)(?:\/[^\s<>"'，。！？；：、（）()【】\[\]{}]*)?/gi;

function resolveUrl(raw: string, baseUrl: string): string {
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_m, code) =>
      String.fromCharCode(Number(code)),
    );
}

function normalizeTextForStructure(raw: string): string {
  let text = decodeHtmlEntities(raw)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\u3000/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  for (const label of RESOURCE_LABELS) {
    text = text.replace(
      new RegExp(`\\s*${escapeRegExp(label)}\\s*`, "g"),
      `\n${label} `,
    );
  }

  text = text
    .replace(/\s+((?:0[1-9]|[1-9]\d?)、\s*)/g, "\n\n$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function isNumberedSection(line: string): boolean {
  return /^(?:0[1-9]|[1-9]\d?)、\s*\S+/.test(line);
}

function splitNumberedSection(line: string): { heading: string; rest: string } {
  const match = line.match(/^((?:0[1-9]|[1-9]\d?)、\s*)([\s\S]+)$/);
  if (!match) return { heading: line, rest: "" };

  const marker = match[1];
  const body = match[2].trim();
  const bodyStart = body.search(
    /\s+(?=(?:我们|我|作者|主要|在|进入|由于|同时|不过|最终|其中|可以|通过|这|其|随着|对于|此外|值得|一是|二是|三是|首先|其次|最后|然而|但是|但|而|从|如果|目前|今天|未来|为了|具体|执行|测试|分析|观察|选择|比如|例如|另外|随后|[A-Za-z][A-Za-z0-9-]{1,40}(?:的|在|是|将|已|会|或许)))/,
  );

  if (bodyStart > 5 && bodyStart < 90) {
    return {
      heading: `${marker}${body.slice(0, bodyStart).trim()}`,
      rest: body.slice(bodyStart).trim(),
    };
  }

  const sentenceEnd = body.search(/[。！？!?]\s+/);
  if (sentenceEnd > 12 && sentenceEnd < 90) {
    const end = sentenceEnd + 1;
    return {
      heading: `${marker}${body.slice(0, end).trim()}`,
      rest: body.slice(end).trim(),
    };
  }

  return { heading: `${marker}${body}`, rest: "" };
}

function trimUrlToken(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl;
  let trailing = "";
  while (/[.,!?;:]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

function hrefForUrl(rawUrl: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(rawUrl)) return resolveUrl(rawUrl, baseUrl);
  if (/^www\./i.test(rawUrl)) return `https://${rawUrl}`;
  return `https://${rawUrl}`;
}

function linkifyText(text: string, baseUrl: string): string {
  let out = "";
  let lastIndex = 0;
  URL_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const rawToken = match[0];
    const { url, trailing } = trimUrlToken(rawToken);
    if (!url) continue;

    out += escapeHtmlText(text.slice(lastIndex, match.index));
    const href = hrefForUrl(url, baseUrl);
    out += `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(url)}</a>`;
    out += escapeHtmlText(trailing);
    lastIndex = match.index + rawToken.length;
  }

  out += escapeHtmlText(text.slice(lastIndex));
  return out;
}

function renderInline(text: string, baseUrl: string): string {
  return text
    .split(/(`[^`\n]+`)/g)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return `<code>${escapeHtmlText(part.slice(1, -1))}</code>`;
      }
      return linkifyText(part, baseUrl);
    })
    .join("");
}

function splitParagraphs(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  if (trimmed.length <= 220) {
    return [trimmed];
  }

  const sentences =
    trimmed.match(/[^。！？!?]+[。！？!?]?/g)?.map((s) => s.trim()).filter(Boolean) ??
    [trimmed];
  const paragraphs: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current}${sentence}` : sentence;
    if (current && next.length > 180) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs;
}

function renderPlainTextBlock(text: string, baseUrl: string): string[] {
  const html: string[] = [];

  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isNumberedSection(line)) {
      const { heading, rest } = splitNumberedSection(line);
      html.push(`<h2>${renderInline(heading, baseUrl)}</h2>`);
      for (const paragraph of splitParagraphs(rest)) {
        html.push(`<p>${renderInline(paragraph, baseUrl)}</p>`);
      }
      continue;
    }

    for (const paragraph of splitParagraphs(line)) {
      html.push(`<p>${renderInline(paragraph, baseUrl)}</p>`);
    }
  }

  return html;
}

function structurePlainTextArticle(raw: string, baseUrl: string): string {
  const text = normalizeTextForStructure(raw);
  if (!text) return "";

  const html: string[] = [];
  const codeFencePattern = /```[ \t]*([A-Za-z0-9_-]*)?[ \t]*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeFencePattern.exec(text)) !== null) {
    html.push(...renderPlainTextBlock(text.slice(lastIndex, match.index), baseUrl));
    html.push(`<pre><code>${escapeHtmlText(match[2].trim())}</code></pre>`);
    lastIndex = match.index + match[0].length;
  }

  html.push(...renderPlainTextBlock(text.slice(lastIndex), baseUrl));

  return html.join("\n");
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

  if (!BLOCK_TAG_PATTERN.test(out)) {
    return structurePlainTextArticle(out, baseUrl);
  }

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
