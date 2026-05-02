import type { SearchIndexEntry } from "./types";

let promise: Promise<SearchIndexEntry[]> | null = null;
let resolved: SearchIndexEntry[] | null = null;

export function loadSearchIndex(): Promise<SearchIndexEntry[]> {
  if (promise) return promise;

  promise = fetch("/data/search-index.json")
    .then((r) => {
      if (!r.ok) throw new Error(`search-index.json ${r.status}`);
      return r.json() as Promise<SearchIndexEntry[]>;
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

export function getCachedSearchIndex(): SearchIndexEntry[] | null {
  return resolved;
}
