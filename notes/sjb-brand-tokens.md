---
name: sjb-brand-tokens
description: "SJB Global's real brand palette, typeface and logo, sampled from sjb-global.com"
metadata: 
  node_type: memory
  type: reference
  originSessionId: cccb46eb-0864-4abb-b985-500d27469c0c
  modified: 2026-08-15T16:33:26.377Z
---

SJB Global's live brand (sampled from the rendered CSS at https://sjb-global.com, not from a brand guide):

- Charcoal / primary: `#1D2E38` (deep variant `#0F1A22`)
- Orange / accent: `#F47920`
- Blue / data: `#1D75BD` (tint `#EAF4FC`)
- Cream `#FCF9F4`, body grey `#666666`, muted `#AFB8BD`
- Typeface: **Manrope** (variable, 200–800). Latin woff2 subset is ~24KB — small enough to inline as a data URI, which is required inside Artifacts because the CSP blocks font CDNs.
- Logo: `SJB-Global_Digital_Logo_120px.webp` (120×81, ~1.2KB) — "SJ" blue, "B" grey, GLOBAL beneath. No reverse/white version is published, so knock it out with `filter:brightness(0) invert(1)` on dark surfaces.
- Tagline: "Your goals, our lived experience". Positioning is cross-border expat advice (UK/US expats), not UK-domestic.

The user asked for platform work to match this, so prefer these over any navy/gold palette that appears in older briefs. Used in [[sjb-wealth-platform-prototype]].
