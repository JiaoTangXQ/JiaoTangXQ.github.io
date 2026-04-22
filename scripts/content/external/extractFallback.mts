/**
 * readability 抓不到正文时的兜底启发式。
 *
 * 策略（按顺序）：
 *   1. 剥掉 head / script / style / noscript / nav / aside / header / footer / form
 *   2. 优先匹配常见正文容器：
 *        <article>
 *        <main>
 *        [role="main"]
 *        .post-content / .entry-content / .post-body / .article-body / .content / #content
 *   3. 都没有时 → 找最长的 <p> 簇（连续 P 标签的总字符数最多的一段）
 *
 * 返回原始 HTML 片段（未清洗），交给 sanitizeHtml 统一处理。
 */

const STRIP_BLOCKS = [
  "head",
  "script",
  "style",
  "noscript",
  "nav",
  "aside",
  "header",
  "footer",
  "form",
  "svg",
  "iframe",
];

const CONTAINER_SELECTORS: Array<{ name: string; pattern: RegExp }> = [
  // <article>
  { name: "<article>", pattern: /<article\b[^>]*>([\s\S]*?)<\/article>/i },
  // <main>
  { name: "<main>", pattern: /<main\b[^>]*>([\s\S]*?)<\/main>/i },
  // role="main"
  {
    name: 'role="main"',
    pattern:
      /<(div|section)\b[^>]*\brole\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/\1>/i,
  },
];

const CLASS_ID_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: ".post-content",
    pattern:
      /<(div|section|article)\b[^>]*\bclass\s*=\s*["'][^"']*\bpost-content\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i,
  },
  {
    name: ".entry-content",
    pattern:
      /<(div|section|article)\b[^>]*\bclass\s*=\s*["'][^"']*\bentry-content\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i,
  },
  {
    name: ".post-body",
    pattern:
      /<(div|section|article)\b[^>]*\bclass\s*=\s*["'][^"']*\bpost-body\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i,
  },
  {
    name: ".article-body",
    pattern:
      /<(div|section|article)\b[^>]*\bclass\s*=\s*["'][^"']*\barticle-body\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i,
  },
  {
    name: "#content",
    pattern:
      /<(div|section|article|main)\b[^>]*\bid\s*=\s*["']content["'][^>]*>([\s\S]*?)<\/\1>/i,
  },
];

function stripBlocks(html: string): string {
  let out = html;
  for (const tag of STRIP_BLOCKS) {
    const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");
    out = out.replace(re, " ");
    // Also strip self-closing / unclosed common offenders
    out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/>`, "gi"), " ");
  }
  return out;
}

function plainLen(html: string): number {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Try selectors in order; return the first one that yields something non-trivial. */
function selectContainer(stripped: string): string | null {
  for (const { pattern } of CONTAINER_SELECTORS) {
    const match = stripped.match(pattern);
    if (match && match[1] && plainLen(match[1]) > 200) {
      return match[1];
    }
  }
  for (const { pattern } of CLASS_ID_PATTERNS) {
    const match = stripped.match(pattern);
    // These patterns have 2 capture groups (tag, content)
    const content = match?.[2] ?? match?.[1];
    if (content && plainLen(content) > 200) {
      return content;
    }
  }
  return null;
}

/**
 * Find the longest run of consecutive <p> tags, measured by total plain-text length.
 * Returns the HTML of that run, or null if not enough content.
 */
function longestParagraphCluster(stripped: string): string | null {
  const paragraphs = Array.from(
    stripped.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),
  );
  if (paragraphs.length === 0) return null;

  // Use positions to detect "runs" (paragraphs close together in the source,
  // not separated by big chunks like headers/sidebars).
  // Heuristic: a gap < 400 chars counts as same cluster.
  type Run = { start: number; end: number; total: number; html: string[] };
  const runs: Run[] = [];
  let current: Run | null = null;

  for (const m of paragraphs) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const plain = plainLen(m[1] ?? "");
    if (plain < 20) continue; // skip tiny <p>

    if (!current) {
      current = { start, end, total: plain, html: [m[0]] };
    } else if (start - current.end < 400) {
      current.end = end;
      current.total += plain;
      current.html.push(m[0]);
    } else {
      runs.push(current);
      current = { start, end, total: plain, html: [m[0]] };
    }
  }
  if (current) runs.push(current);

  if (runs.length === 0) return null;
  runs.sort((a, b) => b.total - a.total);
  const best = runs[0];
  if (best.total < 300) return null;
  return best.html.join("\n");
}

/**
 * Heuristic article extraction. Returns an HTML fragment suitable for downstream
 * sanitization, or null if nothing plausible was found.
 */
export function extractByHeuristics(rawHtml: string): string | null {
  if (!rawHtml) return null;
  const stripped = stripBlocks(rawHtml);

  const container = selectContainer(stripped);
  if (container) return container;

  return longestParagraphCluster(stripped);
}
