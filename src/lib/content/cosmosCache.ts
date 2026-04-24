import type { CosmosData } from "./types";

/**
 * 全局单次加载缓存，CosmosPage 和 ArticlePage 共享。
 * 避免切换页面时 490KB 的 cosmos.json 被重复下载+解析。
 */
let promise: Promise<CosmosData> | null = null;
let resolved: CosmosData | null = null;

export function loadCosmos(): Promise<CosmosData> {
  if (promise) return promise;
  promise = fetch("/data/cosmos.json")
    .then((r) => {
      if (!r.ok) throw new Error(`cosmos.json ${r.status}`);
      return r.json() as Promise<CosmosData>;
    })
    .then((data) => {
      resolved = data;
      return data;
    })
    .catch((err) => {
      promise = null;
      throw err;
    });
  return promise;
}

export function getCachedCosmos(): CosmosData | null {
  return resolved;
}
