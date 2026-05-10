import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function stableHash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

export function normalizeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|spm|from|ref|source|fbclid|gclid)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    const search = url.searchParams.toString();
    return `${url.protocol}//${url.host}${url.pathname}${search ? `?${search}` : ""}`;
  } catch {
    return String(value).replace(/[#?].*$/, "").replace(/\/$/, "");
  }
}

export function stripHtml(value = "") {
  return decodeEntities(String(value))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&ensp;/g, " ")
    .replace(/&emsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

export function cleanText(value = "") {
  return stripHtml(value).replace(/\s+/g, " ").trim();
}

export function absoluteUrl(url, base) {
  if (!url) return base ?? "";
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

export function toIsoDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function formatChineseDate(date) {
  const d = new Date(`${date}T00:00:00.000Z`);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function descriptionFrom(items, fallback) {
  const text = items
    .map((item) => item.title)
    .filter(Boolean)
    .slice(0, 8)
    .join("，");
  return truncate(text || fallback, 298);
}

export function truncate(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-");
}

export function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

export function yamlArray(values, indent = "") {
  const items = Array.from(values ?? []);
  if (items.length === 0) return "[]";
  return `\n${items.map((value) => `${indent}- ${yamlString(value)}`).join("\n")}`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      args._.push(arg);
      continue;
    }
    const [key, directValue] = arg.slice(2).split("=", 2);
    if (directValue !== undefined) {
      args[key] = directValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      args[key] = argv[i + 1];
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function dateRangeForWeek(week, fallbackDate = new Date().toISOString().slice(0, 10)) {
  if (!week) return lastNDates(fallbackDate, 7);
  const match = String(week).match(/^(\d{4})-?W(\d{1,2})$/i);
  if (!match) return lastNDates(fallbackDate, 7);
  const year = Number(match[1]);
  const weekNo = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (weekNo - 1) * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function lastNDates(endDate, count) {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

export async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
