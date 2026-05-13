import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const HTML_POSTS_DIR = path.join(process.cwd(), "src/content/html-posts");

const REQUIRED_META = ["title", "date", "description", "tags", "draft", "ui"];

/**
 * @typedef {Object} HtmlPost
 * @property {string} title
 * @property {string} date
 * @property {string} description
 * @property {string[]} tags
 * @property {boolean} draft
 * @property {string} ui
 * @property {string=} updated
 * @property {string=} originalUrl
 * @property {string=} canonical
 * @property {string=} cover
 * @property {string=} coverAlt
 * @property {string=} lang
 * @property {string} slug
 * @property {string} url
 * @property {string} directory
 * @property {string} html
 * @property {string} renderedHtml
 * @property {string} text
 * @property {string[]} concepts
 * @property {number} readingMinutes
 */

/**
 * @typedef {Object} GraphNode
 * @property {string} id
 * @property {"post" | "tag" | "concept"} type
 * @property {string} label
 * @property {string=} url
 */

/**
 * @typedef {Object} GraphEdge
 * @property {string} source
 * @property {string} target
 * @property {string} type
 */

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineArray(value) {
  const inner = value.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((item) => unquote(item))
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * @param {string} source
 * @param {string} [slug]
 * @returns {Pick<HtmlPost, "title" | "date" | "description" | "tags" | "draft" | "ui" | "updated" | "originalUrl" | "canonical" | "cover" | "coverAlt" | "lang">}
 */
export function parseMetaYaml(source, slug = "unknown") {
  /** @type {Record<string, unknown>} */
  const meta = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid meta.yaml line in ${slug}: ${rawLine}`);
    }
    const [, key, rawValue] = match;
    if (rawValue.trim() === "true" || rawValue.trim() === "false") {
      meta[key] = rawValue.trim() === "true";
    } else if (rawValue.trim().startsWith("[") && rawValue.trim().endsWith("]")) {
      meta[key] = parseInlineArray(rawValue);
    } else {
      meta[key] = unquote(rawValue);
    }
  }

  for (const key of REQUIRED_META) {
    if (!(key in meta)) {
      throw new Error(`Missing required meta field "${key}" in ${slug}`);
    }
  }
  if (!Array.isArray(meta.tags) || meta.tags.length === 0) {
    throw new Error(`Meta field "tags" must be a non-empty array in ${slug}`);
  }
  if (typeof meta.draft !== "boolean") {
    throw new Error(`Meta field "draft" must be boolean in ${slug}`);
  }

  return /** @type {ReturnType<typeof parseMetaYaml>} */ (meta);
}

/** @param {string} html */
export function extractConcepts(html) {
  const concepts = new Set();
  const matches = html.matchAll(/\[\[([^\]]+)\]\]/g);
  for (const match of matches) {
    const [target] = match[1].split("|").map((part) => part.trim());
    if (target) concepts.add(target);
  }
  return Array.from(concepts).map(String);
}

/** @param {string} html */
export function renderWikiLinks(html) {
  return html.replace(/\[\[([^\]]+)\]\]/g, (_, raw) => {
    const [target, label] = raw.split("|").map((part) => part.trim());
    const text = label || target;
    return `<a class="wiki-link" href="/graph/#${encodeURIComponent(target)}" data-concept="${escapeHtml(
      target,
    )}">${escapeHtml(text)}</a>`;
  });
}

/**
 * @param {string} slug
 * @param {string | undefined} assetPath
 */
export function resolvePostAssetUrl(slug, assetPath) {
  if (!assetPath) return undefined;
  if (/^(https?:)?\/\//.test(assetPath) || assetPath.startsWith("/")) return assetPath;
  const normalized = assetPath.replace(/^\.\//, "");
  if (!normalized.startsWith("assets/")) return assetPath;
  return `/posts/${slug}/${normalized}`;
}

/** @param {unknown} value */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** @param {string} html */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, "$2$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} text */
function readingMinutes(text) {
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const words = text.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  return Math.max(1, Math.ceil((cjk + words) / 300));
}

/**
 * @param {HtmlPost} a
 * @param {HtmlPost} b
 */
function byDateDesc(a, b) {
  const time = Date.parse(b.date) - Date.parse(a.date);
  return time || a.slug.localeCompare(b.slug);
}

/**
 * @param {string} [directory]
 * @returns {Promise<HtmlPost[]>}
 */
export async function readHtmlPostsFromDirectory(directory = HTML_POSTS_DIR) {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const posts = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const postDir = path.join(directory, slug);
    const [metaSource, html] = await Promise.all([
      readFile(path.join(postDir, "meta.yaml"), "utf8"),
      readFile(path.join(postDir, "index.html"), "utf8"),
    ]);
    const meta = parseMetaYaml(metaSource, slug);
    const text = stripHtml(html);
    posts.push(/** @type {HtmlPost} */ ({
      ...meta,
      slug,
      url: `/posts/${slug}/`,
      directory: postDir,
      html,
      renderedHtml: renderWikiLinks(html),
      text,
      concepts: extractConcepts(html),
      readingMinutes: readingMinutes(text),
    }));
  }

  return posts.sort(byDateDesc);
}

export async function getAllHtmlPosts() {
  return readHtmlPostsFromDirectory(HTML_POSTS_DIR);
}

/** @returns {Promise<HtmlPost[]>} */
export async function getPublishedHtmlPosts() {
  const posts = await getAllHtmlPosts();
  return posts.filter((post) => !post.draft);
}

/** @param {HtmlPost[]} posts */
export function buildGraph(posts) {
  const visiblePosts = posts.filter((post) => !post.draft);
  /** @type {Map<string, GraphNode>} */
  const nodes = new Map();
  /** @type {GraphEdge[]} */
  const edges = [];

  /** @param {GraphNode} node */
  const addNode = (node) => {
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };
  /**
   * @param {string} source
   * @param {string} target
   * @param {string} type
   */
  const addEdge = (source, target, type) => {
    edges.push({ source, target, type });
  };

  for (const post of visiblePosts) {
    const postId = `post:${post.slug}`;
    addNode({ id: postId, type: "post", label: post.title, url: post.url });

    for (const tag of post.tags) {
      const tagId = `tag:${tag}`;
      addNode({ id: tagId, type: "tag", label: tag, url: `/tags/${encodeURIComponent(tag)}/` });
      addEdge(postId, tagId, "tagged");
    }

    for (const concept of post.concepts) {
      const conceptId = `concept:${concept}`;
      addNode({ id: conceptId, type: "concept", label: concept, url: `/graph/#${encodeURIComponent(concept)}` });
      addEdge(postId, conceptId, "mentions");
    }
  }

  return { nodes: Array.from(nodes.values()), edges };
}

/** @param {HtmlPost[]} posts */
export function collectTags(posts) {
  const counts = new Map();
  for (const post of posts.filter((item) => !item.draft)) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
