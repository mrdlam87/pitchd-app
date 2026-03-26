---
name: Open UX items in progress
description: UX decisions and features acknowledged but not yet resolved or implemented
type: project
---

Items confirmed as still open as of 2026-03-26. Do not treat these as decided — flag them and facilitate resolution when they come up.

## Still to implement
- **Recent searches in map search bar** — tapping the map search bar should surface recent queries before the user types (Google Maps / AllTrails pattern). Confirmed needed, not yet built.
- **Quick chip queries** — hardcoded placeholder query strings need to be replaced with dynamically constructed queries (inject actual weekend dates, detected region, etc.). Confirmed needs fixing.
- **Empty states** — no results, location permission denied, no internet. None designed yet. Matt will hit "no results" on narrow region searches. Must be resolved before beta.
- **Submit button label** — open since UX Session 1. Options: "Pitch it", "Search", "Go". Production currently uses a coral arrow icon with no label. Decision needed.

## Still to review / resolve
- **AI vs browse mode differentiation** — not intuitive to users which mode they're in. Numbered ranked pins (search) vs unnumbered pins (browse) is the right direction but needs a full design pass. A clear label in the drawer summary row ("Browsing nearby" vs "Results for X") is low-effort and high-value. Resolve before M5 when AI mode becomes much more prominent.
- **"X campsites in view" counter pill** — AllTrails-style persistent pill above drawer that updates on pan/zoom. Still to come. Note: separate from the clustered pins GH issue (which is about overlapping pins at low zoom, not the counter).
- **Clustered pins UI** — GH issue created. Separate concern from the counter pill.
- **Drawer summary row copy** — confirmed pattern is "X areas found · ranked by [intent] · [drive time] of [city]". Currently shows basic count + "nearby" label. The ranked-by and drive-time-from context is missing — these communicate what the AI did and build trust in the result ordering.
- **Loading state map tiles** — open question from UX Session 1: show faded real map tiles behind the loading overlay (vs current blank/cream canvas). Blank canvas makes it feel like the map hasn't loaded, undermining the "navigate to map immediately, feel fast" intent.
- **Card header images** — SVG procedural landscape is a warm placeholder but every card looks visually identical at the header level. Distinct palette seeding per campsite name is a short-term improvement; real location photography is the long-term fix.
- **Geolocation fallback is silent** — when denied or timed out, map silently flies to Sydney. User has no idea. Need a subtle indicator ("Using Sydney as your location") so non-Sydney users aren't confused.
- **Drive time accuracy** — currently uses haversine distance ÷ 80 km/h. Australian camping roads (Blue Mountains, Snowy Mountains, coastal hinterland) are frequently 60 km/h or slower, causing systematic underestimates. Consider 60–65 km/h or a road-type adjustment.

## Technical UX debt
- **Static spacer height in BottomDrawer** — 120px hardcoded to clear the search bar in full drawer state. Will cause content overlap if the chip row wraps or search bar grows. ResizeObserver fix is a TODO in the code.
- **Filter badge conflates activities + POI toggles** — the active filter count badge adds both together. When M4 separates campsite filters from amenity filters the badge will mislead. Design the split badge now even if M4 wires it up.
- **Pin animation on appearance** — all pins materialise simultaneously. A staggered fade-in (20–30ms delay per pin, capped at ~10) makes the map feel alive. Low effort, high perceived quality.
- **Loading messages not contextual** — generic cycling copy ("Finding the best spots…"). If parsed intent is available during loading, messages could reference it ("Checking weather across the Blue Mountains…").
