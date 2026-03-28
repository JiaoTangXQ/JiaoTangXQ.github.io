# JiaoTang Planet Blog Design

## Goal

Build `焦糖星球` as an AI-first personal blog for GitHub Pages where the homepage is a panoramic infinite canvas. Articles are not listed in a feed. They exist as a spatial thought universe: proximity communicates relevance, clusters communicate themes, and exploration is the primary reading invitation.

## Product Intent

This site is not a traditional blog template with a luxury skin.

It should feel like:

- a personal thought universe
- a high-end digital editorial object
- an exploratory reading environment

It should not feel like:

- a Hexo/Hugo-style article index
- a knowledge graph tool
- a normal card grid with fancy animation

## Core Principles

1. **Infinite canvas is the product, not decoration**
   The homepage must feel like a boundless world governed by camera movement, depth, atmosphere, and clustering. It cannot behave like a normal scrolling page.

2. **Relevance is expressed by distance, not lines**
   Related posts live near each other. Unrelated posts are separated. Clusters emerge visually. There are no relationship lines by default because they add visual noise and make the site feel like a data tool.

3. **Far view and near view serve different purposes**
   Far view communicates scale, energy, and structure. Near view communicates article identity and editorial richness.

4. **The homepage invites exploration; the article page supports reading**
   The homepage seduces. The summary filters. The article page quiets down and becomes highly readable.

5. **AI powers structure, but the output must feel art directed**
   AI can generate summaries, semantic similarity, theme clusters, and cover directions. The final site must still feel deliberate and visually controlled.

## Audience Experience

### First Impression

On first load, the visitor sees a wide, living universe made of clusters of colored article-planets. The site breathes slowly through subtle camera drift and atmospheric motion. It feels large and explorable from the first second.

### Exploration Loop

The user:

1. enters the infinite canvas
2. drifts or zooms toward an interesting area
3. hovers a node and sees nearby related nodes wake up
4. clicks a node to open a premium summary card
5. decides whether to enter the full article page
6. returns to the exact same camera position and continues exploring

## Information Architecture

### Homepage

The homepage is a fixed viewport with a `world + camera` model rather than a long document.

It contains:

- the infinite canvas
- the article nodes
- subtle theme-field cues
- extremely light persistent controls

Persistent controls should be limited to:

- site name: `焦糖星球`
- search entry
- camera reset entry

There should be no traditional nav bar or sidebar.

### Discovery Layers

The homepage works in four depth layers:

1. **Far view**
   Shows density, cluster distribution, colored nodes, and ambient cosmic atmosphere.

2. **Mid view**
   Reveals a small amount of cluster labeling and stronger node hierarchy.

3. **Near view**
   Allows the currently focused area to release premium editorial cover states.

4. **Focus state**
   Clicking a node opens the summary card, with a path to the full article page.

## Spatial Model

### Clustering

Articles are positioned by AI-generated semantic similarity. The resulting layout should naturally form thematic star systems such as:

- 技术
- 个人思考
- future 骑行
- future 健身

### Relevance Expression

Relevance is conveyed through:

- distance between nodes
- cluster density
- node size hierarchy
- local wake-up behavior during hover/focus

Relevance is not conveyed through persistent lines.

### Density

The homepage should feel `medium density`:

- enough visible nodes to communicate abundance
- enough empty space to keep the universe elegant

The layout must avoid uniform spacing. Real tension comes from sparse regions and dense regions coexisting.

## Visual Direction

### Overall Mood

The visual language should be:

- vibrant
- premium
- clear
- design-forward

It should feel like a hybrid of:

- an infinite cosmos
- a high-end editorial system

It should not feel like:

- dark luxury for its own sake
- pure sci-fi game UI
- sports advertising imagery

### Color

The palette should move away from heavy wine luxury and toward energetic, lively color.

Key behavior:

- the universe can contain many vivid hues
- color variety helps the world feel alive
- brightness and saturation must still be controlled so the scene stays premium

### Node Language

Each article is represented by a `mini cover planet`.

At a distance, the node should mainly communicate:

- color
- scale
- energy
- cluster belonging

It should not attempt to show full article cover detail at far range.

### Cover System

The approved cover approach is a **two-layer system**:

- **Far layer:** vibrant planet-like nodes maintain spatial clarity
- **Near/interaction layer:** the current article expands into a high-end cover card

Each article cover can be highly customized. Covers should mix:

- typography-led compositions
- graphic-led compositions

But all covers must still belong to the same art-directed universe.

## Interaction Model

### Camera Behavior

The default state includes subtle autonomous motion:

- slow drift
- light breathing
- quiet depth motion

The user can interrupt at any time through:

- drag
- zoom
- hover

The system must immediately yield control to the user. When the user stops, the universe can gradually regain subtle life.

### Zoom Behavior

Zoom should occur around the cursor or touch focus, never rigidly around screen center. The experience should feel like moving deeper into a region rather than operating a diagram tool.

### Hover Behavior

Hovering an article node should:

- brighten the active node
- wake up nearby relevant nodes
- slightly reduce visual emphasis on distant nodes
- preserve visibility of the broader universe

### Search

Search is a mandatory fallback and should be implemented as a premium command-style overlay rather than a typical blog search box.

When a search result is selected, the camera should smoothly travel to that region and highlight the relevant node(s).

### Theme Filtering

Theme filtering should act like a subtle lens, not a page switch. Selecting a theme brightens the relevant region and gently pushes the rest of the universe into the background.

### Orientation

Instead of a traditional minimap, the site should use a light `galaxy compass` that hints which thematic region the visitor is currently closest to.

## Summary Card

The summary card is not a generic modal. It is a premium reading object extracted from the universe.

It should contain:

- the article cover
- title
- summary
- metadata
- primary CTA: `阅读全文`

When the card appears:

- the universe remains visible in the background
- the background can soften, dim, and slow down
- the visitor must still feel present in the same world

## Article Page

The full article page must belong to the same universe, but be quieter and more readable than the homepage.

### Transition

Entering an article should feel like moving inward from the cosmos into the article world. A short cover-led transition is preferred.

### Reading Surface

The article page should emphasize:

- typography
- reading rhythm
- calm layout

It should preserve:

- world continuity with the homepage
- a clear return path to the canvas

### Related Content

Related posts at the bottom should not appear as a generic list. They should be expressed as `nearby planets` or a spatially consistent equivalent.

## Content System

Each article should exist as a static content file with structured metadata:

- title
- slug
- date
- tags
- summary
- cover configuration

AI preprocessing should generate and store:

- semantic vectors
- cluster assignments
- summaries
- cover direction data

These should be computed at build time, not in the browser.

## Technical Architecture

The site must remain compatible with GitHub Pages static hosting. Therefore the architecture should be `heavy precomputation, light runtime`.

### Build-Time Responsibilities

- compute semantic similarity
- generate 2D positions
- assign node sizes and clusters
- generate summary data
- generate cover configuration data
- generate search index data

### Runtime Responsibilities

- render the infinite canvas
- manage camera state
- handle zoom/drag/hover/focus
- load near-view cover states
- display summary cards
- preserve return context

### URL and State

Camera position, zoom level, and optionally the active node should be encoded in URL state or equivalent local state so returning to the homepage restores context.

## Risks

1. The experience becomes a beautiful demo but a bad reading tool.
2. Excessive visual strength causes the homepage and article page to compete.
3. Performance degrades as article count grows.
4. AI clustering occasionally produces semantically valid but personally unhelpful groupings.

## Risk Controls

- always provide search
- keep far view simpler than near view
- precompute spatial data and summaries
- lazily release heavier UI only in near/focus states
- reserve manual override fields in the data model for future cluster corrections

## Delivery Priorities

### P1

- content model
- AI preprocessing
- spatial data generation
- base infinite canvas

### P2

- two-layer node system
- summary card
- article page transition

### P3

- search
- theme lens
- camera memory and return behavior

### P4

- high-end atmospheric motion
- cover system refinement
- microinteraction polish

## Success Criteria

The design succeeds if:

- the homepage immediately feels like a boundless thought universe
- the site remains understandable without lines or explicit graph UI
- article abundance is visible without collapsing into noise
- the summary card feels premium enough to justify the click
- returning from an article feels like resuming exploration, not reloading a blog homepage
- the system still works when new themes such as 骑行 and 健身 are added later
