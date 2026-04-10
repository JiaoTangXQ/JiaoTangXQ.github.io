# External Discovery Content Design

## Goal

Turn the site from a single-author content universe into a static discovery system that can surface curated external writing. External items should help users encounter topics they would not normally click into, while staying understandable at a glance through short on-site summaries.

## Product Constraints

- Keep GitHub Pages deployment and the existing static-site architecture.
- Do not store or serve full external articles.
- Clearly label external items as not written by the site owner.
- Give users enough summary context before sending them away to the source site.
- Avoid turning the normal deploy build into a network-dependent or API-key-dependent process.

## Recommended Architecture

Use a two-stage pipeline:

1. A separate `refresh:external` step fetches whitelisted sources, normalizes feed items, generates AI summaries, filters low-value or repetitive entries, and writes a checked-in cache file.
2. The existing `build` step reads local markdown articles plus the cached external items and merges them into the cosmos dataset, search index, and summary-page outputs.

This preserves the current static deployment flow. `npm run build` stays deterministic, while external discovery content can be refreshed manually or later by a scheduled workflow.

## Source Registry

Store external sources in a tracked registry file such as `content/external/sources.json`.

Each source entry should include:

- `id`
- `name`
- `siteUrl`
- `feedUrl`
- `defaultTopics`
- `enabled`

The MVP should stay whitelist-only. No user submissions, open crawling, or automatic domain discovery.

## Content Model

Add a first-class external content record instead of trying to squeeze everything into the local article shape.

### ExternalContentRecord

```ts
type ExternalContentRecord = {
  slug: string;
  contentType: "external";
  title: string;
  date: string;
  topics: string[];
  summary: string;
  whyWorthReading: string;
  sourceName: string;
  sourceUrl: string;
  sourceDomain: string;
  importance: number;
  cover?: CoverConfig;
};
```

### Shared node/search fields

`CosmosNode` and `SearchIndexEntry` should become additive rather than local-only. They should carry:

- `contentType: "local" | "external"`
- `sourceName?`
- `sourceUrl?`
- `sourceDomain?`

This lets the existing canvas, summary card, search palette, and article route work with mixed content.

## Refresh Pipeline

The refresh pipeline should do five things:

1. Read source registry entries.
2. Fetch and normalize RSS/blog/media items into one internal shape.
3. Generate `summary` and `whyWorthReading`.
4. Score entries for novelty and repetition.
5. Persist approved items to `content/external/items.json`.

### AI summary behavior

Each accepted item should get:

- `summary`: what the piece is broadly about
- `whyWorthReading`: why it is worth a detour for this product

This is the core “you probably would not have clicked this otherwise” layer.

### Filtering behavior

The filter should prefer items that are:

- across a wider range of topics
- not too similar to already accepted items
- not too similar to recent local articles
- concrete and readable enough to summarize well

The filter does not need personalization in MVP. It only needs to keep the universe from collapsing into noisy aggregation.

## Build Integration

The normal build should read `content/external/items.json` and merge those entries with local articles when producing:

- `public/data/cosmos.json`
- `public/data/search-index.json`

The local article markdown copy step should remain local-only. External items are summary pages, not markdown article files.

## User Experience

External content should be mixed into the same universe as local writing, but always visibly marked.

### In the cosmos

- External nodes appear beside local nodes.
- Summary cards show `外部来源` and the source name.
- The card CTA should not imply authorship. For external items it should read as a summary/detail action rather than “full article written here”.

### In search

- External items appear in the same result list.
- Every external result should show source attribution.
- A user should be able to distinguish local writing from external findings without opening the result.

### In the reading surface

Reuse the existing `/article/:slug` route, but make it content-type aware:

- Local items render the full markdown article.
- External items render an on-site summary page with:
  - title
  - source name
  - source domain
  - publish date
  - AI summary
  - `whyWorthReading`
  - `去看原文` CTA

This keeps the current route structure and preserves the “enter a planet” feeling even for external links.

## SEO and Attribution

External summary pages should be treated as discovery surfaces, not origin pages.

- Always show explicit source attribution.
- Do not copy full article bodies.
- Prefer prerendering the summary page only.
- Mark external summary pages with `noindex,follow` and canonical back to the source URL.
- Exclude external summary pages from the sitemap in MVP.

## Error Handling

- If one source fails to fetch, keep the last good cache and continue.
- If AI summarization fails, fall back to feed excerpt plus a generic `whyWorthReading` message.
- If scoring fails, drop the item rather than publishing a low-confidence entry.
- If the source URL is dead later, keep the summary page but show the outbound link as unavailable.

## Validation

The MVP should be considered correct when:

1. A refresh test can turn fixture feed data into approved external items with source metadata and summary fields.
2. A merge test proves external items appear in `cosmos.json` and `search-index.json`.
3. A UI test proves external surfaces show `外部来源`, source attribution, and `去看原文`.
4. `npm run build` still succeeds without fetching live feeds or calling an AI API.

## Implementation Boundaries

MVP includes:

- whitelist source registry
- cached refresh command
- AI summary generation
- novelty/repetition filter
- merged cosmos/search datasets
- external summary pages
- clear source labeling

MVP explicitly excludes:

- full-text external hosting
- real-time fetching at page load
- user personalization
- comments, likes, saves, or reading history
- open submission or crawling outside the whitelist
