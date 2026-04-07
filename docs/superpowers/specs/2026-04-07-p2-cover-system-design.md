# P2 Cover System Design

## Goal

Extend the article cover system from simple gradient/image toggle to a highly customizable per-article cover with configurable gradient direction, colors, title placement, and overlay control. Add a near-mode LOD transition that reveals mini cover previews on node label cards.

## CoverConfig Extension

```typescript
type CoverConfig = {
  style?: "gradient" | "image";
  accent?: string;
  imageUrl?: string;
  gradientAngle?: number;           // default 135
  gradientColors?: string[];        // 2-3 custom color stops, overrides cluster palette
  titleAlign?: "left" | "center" | "right";   // default "left"
  titlePosition?: "bottom" | "center" | "top"; // default "bottom"
  overlayOpacity?: number;          // 0-1, default 0.85
};
```

All new fields are optional. Omitting them preserves the current cluster-palette-based behavior. Fully backward compatible.

## ArticleLayout Cover Rendering

- Gradient direction controlled by `gradientAngle` (replaces hardcoded 135deg)
- Custom color stops from `gradientColors` array, falling back to `palette.core[0], palette.core[1]`
- Title vertical position via CSS `justify-content`: bottom (flex-end), center, top (flex-start)
- Title horizontal alignment via `text-align`
- Overlay opacity configurable via `overlayOpacity`

## SummaryCard Cover Sync

SummaryCard reads `gradientAngle` and `gradientColors` from the node's cover config so the popup card preview matches the article cover appearance.

## Near-Mode LOD Cover Card Transition

When zoom crosses from "mid" to "near", NodeLabels transitions from simple title text to a rich preview card. The card gains a mini cover strip:

- 40px tall gradient/image strip at the top of the near-mode card
- Uses the same cover config (gradientAngle, gradientColors, or imageUrl)
- Transition: CSS `max-height` + `opacity` animation, 300ms ease-out-expo
- No new components — extends existing NodeLabels card markup

## Implementation Boundaries

- No route structure changes
- No content schema format changes (only additive optional fields)
- No new build dependencies
- No cover editor UI
- No changes to search logic

## Validation

1. Existing articles with simple `{ style: "gradient", accent: "#xxx" }` render identically to before
2. An article with custom `gradientColors`, `gradientAngle`, `titleAlign: "center"`, `titlePosition: "center"` renders a visually distinct cover
3. SummaryCard popup shows matching cover appearance
4. Near-mode node labels show mini cover strips with smooth transition from mid-mode
