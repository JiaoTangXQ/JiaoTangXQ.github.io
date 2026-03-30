# JiaoTang Planet C1 Visual Polish Design

## Goal

Refine `焦糖星球` from a working alpha into a more art-directed visual object without changing the core information architecture. The homepage should feel fresher, calmer, and more premium; the title system should gain a recognizable identity through restrained use of `Long Cang`.

## Approved Decisions

- Atmosphere direction: `C1` (`鲜活高级`)
- Core palette behavior: teal / mint / warm amber, no purple-led cyber look
- Brand display font: `Long Cang`
- `Long Cang` usage scope: homepage masthead + article cover titles only
- `Long Cang` usage style: restrained (`A 收着用`), not poster-scale takeover
- UI / body typography: remain clean and neutral; do not spread the display font to summary cards, search UI, or prose

## Product Intent

The site should feel like a living thought universe with curated restraint.

It should feel like:

- a premium digital editorial object
- a calm but alive cosmos
- a personal archive with a memorable title signature

It should not feel like:

- a cyberpunk demo
- a brush-calligraphy poster pasted onto a space scene
- a luxury-black template with decorative neon

## Atmosphere System

### Deep Space

The background should move away from blue-purple coldness and toward a more breathable field:

- deep teal-black base
- soft mint light blooms
- warm amber counterpoints at low density
- darker edges so the viewport still reads as expansive and quiet

The effect target is not “more color everywhere.” The effect target is richer depth and better temperature contrast.

### Nebula and Glow

Nebula clouds should feel lighter, broader, and more atmospheric:

- cluster hue remains data-driven
- opacity stays low
- edge transitions become softer
- teal-led clusters get more luminous air, not more saturation

Node glows should look cleaner and less synthetic:

- less game-like bloom
- slightly stronger center definition
- less muddy overlap between nearby nodes

### Stars

The star field should support the atmosphere, not steal attention:

- keep density high enough for scale
- reduce “noise texture” feeling
- push variation through temperature and brightness, not random intensity spikes

## Title System

### Homepage Masthead

`焦糖星球` becomes a restrained display mark using `Long Cang`.

Rules:

- the title is a masthead, not a floating label attached to a planet
- it must sit in a clearly designed brand area
- it should feel deliberate and sparse
- it should never dominate more than the active visual field

The English eyebrow / microcopy stays neutral and sans-serif so the composition does not collapse into pure calligraphy.

### Article Cover Titles

Article cover titles use the same display font family to connect the reading surface back to the cosmos identity.

Rules:

- only the cover hero title uses `Long Cang`
- article metadata, body, headings, and navigation remain readable neutral fonts
- the cover title should feel cinematic, not chaotic

### Fonts That Are Explicitly Rejected

- graffiti-like custom handwriting styles such as `PF频凡胡涂体`
- decorative display faces applied across UI chrome
- western condensed display families used as fake Chinese title styling via fallback

The rejection reason is structural: they either fight the atmosphere direction or rely on glyph fallback that collapses all options into the same CJK rendering.

## Component-Level Changes

### Homepage Chrome

The current brand block should be redesigned:

- smaller eyebrow
- stronger negative space around the masthead
- `Long Cang` title with calmer placement
- action buttons remain subordinate and glassy

### Node Labels

Node labels should remain neutral and legible. They are content UI, not branding.

- keep them sans / clean
- reduce competition with the masthead
- near-mode cards can inherit the refreshed palette but not the display font

### Summary Card

Summary cards remain premium editorial UI, but neutral:

- no `Long Cang`
- cleaner spacing and glass contrast
- atmosphere colors can influence accents, not typography

### Article Cover

The cover hero should absorb the new identity:

- `Long Cang` for the article title
- more theatrical but still controlled title scale
- gradient and overlay tuned to preserve title legibility

## Implementation Boundaries

This visual polish round does not include:

- changing route structure
- changing content schema
- changing search logic
- changing article body typography system
- introducing new complex motion systems

It may include light motion tuning where needed to support the new visual direction.

## Validation

The work is successful when:

1. The homepage immediately feels more distinctive without getting louder.
2. The masthead reads as intentional brand identity rather than default blog text.
3. Article cover titles clearly belong to the same world as the homepage.
4. Summary cards, search, labels, and controls still feel disciplined and readable.
5. The universe remains premium and quiet even after adding the display font.
