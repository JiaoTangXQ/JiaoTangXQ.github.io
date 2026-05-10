import { fetchRssSource } from "./rss.mjs";

export async function fetchRssHubSource(source, options = {}) {
  const routes = normalizeRoutes(source);
  const seen = new Set();
  const signals = [];

  for (const route of routes) {
    try {
      const routeSignals = await fetchRssSource(sourceForRoute(source, route), {
        ...options,
        timeoutMs: source.routeTimeoutMs ?? options.timeoutMs,
      });
      for (const signal of routeSignals) {
        const key = signal.canonicalUrl || signal.url || signal.id;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        signals.push({
          ...signal,
          sourceId: source.id,
          sourceType: source.sourceType ?? signal.sourceType,
          sourceWeight: route.weight ?? source.weight ?? signal.sourceWeight,
          section: route.section ?? source.section ?? signal.section,
          tags: [...new Set([...(source.tags ?? []), ...(route.tags ?? []), ...(signal.tags ?? [])])],
          raw: { ...(signal.raw ?? {}), adapter: "rsshub", route: route.path ?? route.url },
        });
      }
    } catch {
      // RSSHub public routes and third-party bridges can be noisy. A dead route
      // should not take down the whole daily run.
    }
  }

  return signals;
}

function normalizeRoutes(source) {
  if (Array.isArray(source.routes)) return source.routes.filter(Boolean);
  if (Array.isArray(source.paths)) return source.paths.map((path) => ({ path }));
  return [];
}

function sourceForRoute(source, route) {
  const url = route.url || absoluteRssHubUrl(source.baseUrl, route.path);
  return {
    ...source,
    id: `${source.id}:${route.id ?? route.path ?? route.url}`,
    name: route.name ?? source.name,
    url,
    homepage: route.homepage ?? route.url ?? source.homepage ?? source.baseUrl,
    sourceType: route.sourceType ?? source.sourceType,
    sourceWeight: route.weight ?? source.weight,
    weight: route.weight ?? source.weight,
    section: route.section ?? source.section,
    tags: [...new Set([...(source.tags ?? []), ...(route.tags ?? [])])],
    enrichMedia: route.enrichMedia ?? source.enrichMedia,
    enrichMediaLimit: route.enrichMediaLimit ?? source.enrichMediaLimit,
  };
}

function absoluteRssHubUrl(baseUrl = "https://rsshub.app", routePath = "") {
  const base = String(baseUrl || "https://rsshub.app").replace(/\/+$/g, "");
  const path = String(routePath || "").replace(/^\/+/g, "");
  return `${base}/${path}`;
}
