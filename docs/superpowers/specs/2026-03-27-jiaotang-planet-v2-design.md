# JiaoTang Planet v2 Design Spec

## Goal

Build 焦糖星球 as a high-end personal thought universe deployed on GitHub Pages. The homepage is a GPU-rendered infinite canvas where articles exist as glowing planets clustered by theme. The site must feel like an art-directed editorial object, not a blog template.

## Decisions

- Rendering: Three.js with custom GLSL shaders
- Content: fresh start, no migration from old Hexo blog
- Hosting: GitHub Pages static site
- Framework: React 19 + Vite + TypeScript

## Product Intent

The site is a spatial reading environment. It should feel like exploring a living thought universe — not browsing a list of posts.

It should feel like:
- a personal thought cosmos with scale and atmosphere
- a high-end digital editorial object
- an invitation to explore

It should not feel like:
- a blog template with fancy animations
- a knowledge graph tool
- a dashboard with pan/zoom

## Rendering Pipeline

Five GPU layers composited in a single Three.js scene using OrthographicCamera (true 2D, no perspective distortion).

### Layer 1: Deep Space Background

Full-screen quad with a fragment shader. Produces a rich dark gradient with subtle color variation. No static image — the shader generates depth through overlapping radial color fields that drift slowly over time.

Colors: deep navy (#060d18) through midnight (#030711) with subtle blue and purple radial accents.

### Layer 2: Star Field

Three.js Points geometry. 3000–5000 particles with varying size (0.5–2.5px), brightness, and subtle color temperature (cool white, warm white, faint blue). A vertex shader attribute controls per-star twinkle phase and speed. Stars move with the camera but at a slightly different rate (parallax) to create depth.

### Layer 3: Nebula Clouds

2–4 large transparent planes with fragment shaders using simplex noise to generate soft, volumetric cloud shapes. Each nebula has a dominant hue (blue, purple, teal) with low opacity (0.06–0.15). They drift slowly and independently. Nebulae are positioned near article clusters to give thematic regions a visual identity without explicit labels.

### Layer 4: Article Nodes

Each article is a mesh (PlaneGeometry or custom) with a ShaderMaterial that renders a glowing sphere. The shader produces:
- radial gradient core with per-cluster color palette
- soft outer glow (additive blending)
- subtle inner light variation (noise-based)
- size proportional to article importance/recency

Node visual states:
- **Default**: glowing sphere, full color
- **Hovered**: brightens, scale +15%, nearby related nodes brighten slightly
- **Muted**: when theme filter is active, non-matching nodes fade to 15% opacity
- **Active**: strong glow, ring pulse animation

### Layer 5: DOM Overlay

HTML elements positioned via Three.js worldToScreen projection. Handles:
- Article title labels (appear at mid-zoom)
- Summary cards (on node click)
- Search palette
- Theme lens controls
- Galaxy compass
- Site chrome (焦糖星球 title, search button, reset button)

DOM overlay receives pointer events. The Three.js canvas handles camera gestures (drag, zoom, touch).

## Camera System

### State

```typescript
type CameraState = { x: number; y: number; zoom: number }
```

Zoom range: 0.3 (full universe view) to 4.0 (single node focus). Default: 1.0.

### Auto-Cruise

On load and when idle (no user input for 5 seconds), the camera enters a slow drift:
- gentle sinusoidal path through the universe
- speed: ~20 world-units per second
- rotation: none (always axis-aligned)

When the user touches/clicks, auto-cruise stops immediately. When the user stops interacting, auto-cruise resumes after a 5-second grace period with a smooth ease-in.

### User Control

- **Drag**: pan (delta / zoom to maintain consistent speed at all zoom levels)
- **Wheel**: zoom toward cursor position (focal-point zoom, not center zoom)
- **Pinch**: zoom toward pinch center (mobile)
- **Touch drag**: pan (mobile)
- All transitions use spring-based easing (not linear lerp)

### State Persistence

Camera state encoded in URL hash: `#x=120&y=-80&z=1.5`. Navigating back from an article page restores the exact camera position.

## Node LOD System

Four visual modes determined by camera zoom level:

| Zoom | Mode | Rendering |
|------|------|-----------|
| 0.3–0.8 | far | Shader sphere only. No text. Communicates color, size, energy. |
| 0.8–1.8 | mid | Shader sphere + DOM title label fades in. |
| 1.8–3.0 | near | Sphere shrinks, editorial cover card fades in (DOM). |
| click | focus | Summary card overlay opens. Universe dims and slows. |

LOD transitions use opacity crossfade over 300ms. No hard switches.

## Color System

Each topic cluster has a palette:

| Cluster | Core | Glow | Accent |
|---------|------|------|--------|
| 技术 | #5cc8ff → #3a7fff | rgba(92,200,255,0.5) | #7dd8ff |
| AI | #b87aff → #6d61ff | rgba(109,97,255,0.5) | #c88aff |
| 思考 | #ff8a66 → #ff4fb8 | rgba(255,138,102,0.5) | #ffa088 |
| 骑行 (future) | #47d98f → #2ab878 | rgba(71,217,143,0.5) | #6de8a8 |
| 健身 (future) | #d8ff57 → #a8e600 | rgba(216,255,87,0.5) | #e2ff7a |
| fallback | #8899aa → #667788 | rgba(136,153,170,0.4) | #99aabb |

Nebula clouds near a cluster adopt that cluster's hue at very low opacity.

## Summary Card

Opens when a node is clicked. Not a generic modal — a premium reading object that emerges from the universe.

Contents:
- Article cover (gradient background using cluster palette)
- Title (serif font, large)
- Published date + topic tags
- Summary text (2–3 sentences)
- CTA button: 阅读全文
- Close action returns to the exact camera position

When the card is open:
- Universe remains visible behind it
- Background dims to ~40% brightness
- Auto-cruise pauses
- Camera does not move

## Article Page

A separate route (`/article/:slug`) that loads the full article content.

### Transition

Entering the article page plays a brief zoom-in animation: the camera accelerates toward the selected node, the universe blurs, and the article page fades in over the blur.

### Reading Surface

- Clean, calm typography (system serif for headings, system sans for body)
- Max-width 720px, generous line-height (1.8)
- Subtle dark theme consistent with the universe (not pure black, not white)
- Code blocks with syntax highlighting

### Navigation

- Top: back button (返回星图) that returns to the cosmos at the saved camera position
- Bottom: "nearby planets" section showing 3–5 related articles as small interactive planet nodes (not a flat list)

## Search

Command-palette style overlay (Cmd/Ctrl + K or click search button).

- Input with instant filtering
- Scoring: title match > tags > summary > body
- Results show title + cluster badge + date
- Selecting a result: closes palette, camera travels smoothly to that node, opens summary card
- Escape or click outside to close

## Theme Lens

Small pill buttons at the bottom of the viewport. Selecting a theme:
- Brightens nodes in that cluster
- Fades others to 15% opacity
- Camera gently pans toward the cluster center
- Does not remove non-matching nodes from the scene

"全域" button resets the lens.

## Galaxy Compass

A subtle orientation widget (bottom-right) showing which thematic region the camera is closest to. Not a minimap — a single label with a soft indicator. Updates as the camera moves.

## Content System

### Article Format

```markdown
---
title: "文章标题"
slug: article-slug
date: 2026-03-27
topics: [技术, AI]
summary: "一句话摘要，用于 Summary Card 和搜索。"
cover:
  style: gradient
  accent: "#5cc8ff"
importance: 1.2
---

Article body in markdown...
```

Fields:
- `title`, `slug`, `date`, `topics`, `summary`: required
- `cover`: optional customization hints for the cover card
- `importance`: optional float (default 1.0) that affects node size

### Build Pipeline

Node.js scripts run at build time:

1. `readArticles.mts` — reads all `content/articles/*.md`, parses frontmatter + body
2. `buildCosmosData.mts` — generates 2D positions:
   - articles with shared topics attract each other (d3-force links)
   - articles repel non-related articles (d3-force charge)
   - cluster centers emerge naturally
   - output: `public/data/cosmos.json`
3. `buildSearchIndex.mts` — generates MiniSearch-compatible index → `public/data/search-index.json`
4. `buildArticlePages.mts` — renders each article's markdown to HTML (remark + rehype) → `public/articles/:slug.html`

### cosmos.json Schema

```typescript
type CosmosData = {
  nodes: Array<{
    slug: string
    title: string
    summary: string
    topics: string[]
    date: string
    x: number
    y: number
    size: number        // computed from importance + recency
    cluster: string     // primary topic
    cover: CoverConfig
  }>
  clusters: Array<{
    name: string
    centerX: number
    centerY: number
    color: string
  }>
}
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite, TypeScript, Node.js scripts |
| Framework | React 19, React Router |
| 3D | Three.js, @react-three/fiber, custom GLSL |
| Content | gray-matter, remark, rehype, rehype-highlight |
| Layout | d3-force (build-time only) |
| Search | MiniSearch |
| Deploy | GitHub Pages (static) |

## File Structure

```
/
├── content/articles/          # Markdown source files
├── scripts/content/           # Build-time data generation
├── public/data/               # Generated cosmos.json, search-index.json
├── src/
│   ├── main.tsx
│   ├── app/                   # App shell, router
│   ├── styles/                # Global CSS, tokens
│   ├── features/
│   │   ├── cosmos/
│   │   │   ├── scene/         # Three.js scene setup, render loop
│   │   │   ├── shaders/       # GLSL: atmosphere, stars, nebula, nodes
│   │   │   ├── camera/        # Camera state, auto-cruise, gestures
│   │   │   ├── nodes/         # LOD logic, palette, emphasis
│   │   │   └── components/    # CosmosViewport, SummaryCard, SearchPalette, etc.
│   │   └── articles/
│   │       ├── ArticleLayout.tsx
│   │       └── NearbyPlanets.tsx
│   ├── routes/                # CosmosPage, ArticlePage
│   └── lib/content/           # Shared types
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Parallel Development Strategy

Four independent module groups that can be developed simultaneously:

**Group 1 — Content Pipeline** (no runtime dependencies)
- Article parser, d3-force layout engine, cosmos.json generator, search index generator
- Produces: `public/data/cosmos.json`, `public/data/search-index.json`

**Group 2 — Cosmos Renderer** (uses mock cosmos.json)
- Three.js scene, all 5 shader layers, camera system with auto-cruise
- Can develop and test with hardcoded mock node data

**Group 3 — UI Components** (uses mock data, no Three.js dependency)
- Summary card, search palette, theme lens, galaxy compass
- Pure React + CSS, tested independently

**Group 4 — Article Page** (uses mock article data)
- Reading layout, cover transition, nearby planets component
- Independent route, no cosmos dependency

**Integration**: wire Groups 2–4 to consume Group 1 output. Final pass: polish transitions, tune LOD thresholds, adjust shader parameters.

## Performance Constraints

- Initial load: < 500KB JS (Three.js ~150KB + app ~150KB + React ~50KB)
- 60fps at default zoom with 200 nodes
- Shader-based effects only — no canvas 2D shadowBlur
- Cover cards rendered only for visible near-view nodes (max 6–8 DOM elements)
- Star field and nebulae are GPU-only, zero CPU overhead per frame
- Article pages lazy-loaded on navigation

## Success Criteria

1. First impression is "this is not a normal blog" — the universe breathes, glows, and invites exploration
2. Infinite canvas feel is dominant — no visible edges, no scroll bars, no page boundaries
3. Auto-cruise makes the site feel alive even without interaction
4. Zooming into a cluster reveals editorial-quality cover cards
5. Article reading experience is calm and typographically excellent
6. Returning from an article resumes exploration at the exact prior position
7. Works on modern mobile browsers with touch gestures
8. Deploys as static files to GitHub Pages with zero server dependencies
