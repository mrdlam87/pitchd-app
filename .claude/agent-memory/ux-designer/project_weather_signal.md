---
name: Weather signal design decision
description: How weather quality is communicated to users — badge removed, colored pins chosen
type: project
---

Weather quality badge on campsite cards was intentionally removed. The card already has weather day columns (weather strip + day cells) so a badge was redundant.

The chosen approach: **colour-code map pins by weather score** (great/good/poor). This gives Matt instant spatial weather awareness without opening a card — the right decision for a map-first app.

**Why:** Combines spatial view with weather signal in a single glance. Directly solves Matt's core pain of finding somewhere dry.

**How to apply:** When designing or reviewing the pin component, assume pins will be weather-coloured. Three open considerations to resolve before implementing:

1. **Colorblindness** — green/red is the most common form. Pair colour with a secondary signal (pin shape, icon, or opacity) so it's accessible
2. **Browse mode gap** — weather isn't pre-loaded in browse mode, so pins can't be coloured until the viewport weather fetch completes. Need a neutral "no weather yet" pin state that doesn't read as "bad weather"
3. **Brand colour conflict** — current unselected pin uses forest green (`#2d4a2d`). Weather-coloured pins require rethinking the base pin style and selected state (currently coral outline) so they don't clash
