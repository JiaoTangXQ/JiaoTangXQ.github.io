/**
 * 本地访问历史：记录"这位用户"读过哪些星球。
 * 存在 localStorage，纯前端，不上传服务器——这是隐私友好的"个人茧房画像"。
 */

const STORAGE_KEY = "jiaotang.visited.slugs";
const MAX_KEEP = 500;

export function readVisited(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    // ignore
  }
  return new Set();
}

export function recordVisit(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = readVisited();
    if (set.has(slug)) return;
    set.add(slug);
    const arr = Array.from(set);
    // Keep only the most recent ones to bound storage
    const trimmed = arr.length > MAX_KEEP ? arr.slice(-MAX_KEEP) : arr;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota / private mode errors
  }
}
