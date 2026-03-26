# Pitchd — UX Session 1
> Core search flow, map interactions, pin behaviour, drawer interactions, filters
> Date: 15 March 2026

---

## 1. Home Screen

- Primary purpose: AI search entry point and first-time / occasional user experience
- Onboarding and inspiration content to be explored in a later phase
- Swipe left = navigate to map (one-way gesture — no swipe back needed)
- Recent searches surface on home screen but become less critical once the map view search bar also surfaces them
- Long-term, returning users will likely swipe straight to the map every time — home screen serves new and occasional users most

---

## 2. Search → Results Transition

- On search submit, navigate to map immediately — the map becomes the loading experience
- Map renders with city centred and no pins yet
- Pins materialise as weather data returns (batch or one by one)
- Drawer peek shows loading state ("Checking weather across X areas…") rather than a spinner overlay
- This makes the AI feel fast — user is already oriented on the map while data loads

---

## 3. Browse Mode (swipe to map, no search)

- Map centres on device location on arrival
- All nearby campsites and amenities shown as pins — Google Maps style density
- No weather pre-loaded on pins in MVP
- Current day's weather fetched on demand when user taps a pin and card opens
- Longer term: explore area-level weather overlays at zoom-out and individual weather at zoom-in (deferred — but should inform data architecture decisions)
- "X campsites in view" counter pill persistent above drawer, updates as user pans and zooms (inspired by AllTrails)
- Drawer always present, ordered by distance
- No search results = distance ordering, no weather score

### Weather in browse mode (deferred)
- Fetching weather for all visible pins simultaneously is a performance and cost concern
- Likely solution: only fetch for pins in current viewport, re-fetch on pan
- Zoom level determines fetch granularity — zoomed out = area-level weather, zoomed in = individual pin weather
- Do not architect against this — keep it in mind during data and API design

---

## 4. Pin Behaviour

### Visual states
- Unselected: standard pin, current design
- Selected: subtler than current prototype — size increase scaled back, clear but not oversized
- Two pin designs: search results mode (numbered, ranked) vs browse mode (unnumbered) — should look distinctly different so user understands which mode they are in

### Tap behaviour
- Tap pin → card snaps to top of drawer list in current order, pin gets selected state on map, map pans to centre pin in the visible area above the drawer (AllTrails-style offset accounting for drawer height)
- Tap card in drawer → same result from opposite direction — pin selected on map, map pans to centre
- Pin and card are always in sync — selecting from either direction produces identical result
- In search results mode: tapping a pin also brings that card into focus in the ranked list (list order does not change, only scroll position)

### Dismiss
- Tap anywhere on map = deselects pin, drawer returns to previous state
- Swipe card down = same result
- Both gestures supported

### Clustering
- Dense areas (e.g. Blue Mountains, Sunshine Coast hinterland) will produce overlapping pins
- MVP solution: user zooms in to separate clustered pins
- Full clustering solution (merge at low zoom, expand at high zoom) deferred post-MVP
- Pin design should not make clustering harder to solve later

---

## 5. Drawer Interactions

### Snap positions
- Three positions: peek (lowest), half, full
- No free-floating mid-positions — always snaps

### Drawer states by mode

| Mode | Peek | Half / Full |
|---|---|---|
| Browse, nothing tapped | "X campsites in view" + nearest site previewed | Scrollable list ordered by distance |
| Browse, pin tapped | Rises to show full single card | Same list, card in focus |
| Search results, nothing tapped | Top result previewed | Scrollable list ordered by search intent |
| Search results, pin tapped | Rises to show full single card | Same list, card in focus |

### Movement rule
- Drawer only moves if it needs to reveal a card
- Already at half or full = no drawer movement on tap, just scrolls list to card
- At peek = rises enough to show full card on tap
- No unnecessary drawer movement — minimise distraction

### Map behaviour
- Map is locked when drawer is open
- Map pans when a card is tapped — centres selected pin in visible area above drawer
- Map does not respond to gestures while drawer is open

### List ordering
- Browse mode: distance (closest first)
- Search results: AI-determined by search intent — weather score, filter relevance, or weighted combination depending on query
- Ordering is never hardcoded to weather score — the AI should inform ranking based on what the user was looking for
- List order never changes based on selection — only scroll position changes

### Card content by mode
- Search results card: name, drive time, blurb, weather score badge, multi-day weather forecast, amenity tags, AI summary (full view)
- Browse mode card: name, drive time, blurb, amenity tags, current day weather (fetched on tap)
- Card appearance stays visually consistent between modes — content differs, design language does not

---

## 6. AI Search + Filters

### Core principle: AI and filters are always in sync
- AI search sets filter state based on interpreted intent
- Filter panel reflects what the AI understood — city, dates, drive time, activity tags
- User can see exactly what the AI interpreted and correct anything it got wrong
- Makes the AI transparent and trustworthy rather than a black box
- Filters can also be used independently without AI search — not every user wants AI

### Filter panel
- Dates are optional — no dates selected = weather based on current day
- Parameters: city, drive time, activity tags (dog-friendly, fishing, hiking, dump points, water fill etc.)
- Acts as a refinement layer over AI search, not a parallel entry point
- If AI misinterprets a query, the filter panel is where the user corrects it

### Recent searches in map view
- Tapping the search bar in map view surfaces recent searches before the user types
- Same pattern as Google Maps and AllTrails — familiar and expected
- Reduces reliance on home screen recent searches for returning users

---

## 7. Predefined Searches (formerly "filter chips")

- Renamed from "filter chips" — these are shortcuts to common search intents, not filters
- Positioned near the search bar, not inside the filter panel
- Current set: Pitchd pick, Good weather, Dog friendly, Fishing, Hiking, Dump points, Water fill

### Pitchd pick
- The hero predefined search — Pitchd's single best recommendation right now
- One tap, no input required
- Runs the most comprehensive search available: device location, upcoming weekend dates, weather across all areas, balanced default preferences
- Returns the single best result with a confident recommendation
- Directly solves Matt's core pain: save time, remove frustration, just tell me where to go
- MVP: signal-based (location + weather + defaults)
- Post-MVP: evolves toward personalisation using learned preferences and usage history
- Label/copy TBD — needs to communicate "best option right now" at a glance, not just a brand name

---

## 8. Design Observations (from Figma screens, March 2026)

### Home screen
- Illustrated landscape with tent silhouette used as hero image — warm and distinctive, avoids generic photography
- Predefined searches (Pitchd, Good weather, Dog friendly) visible directly below search box — correct placement confirmed in design
- Search submit button currently labelled "Pitch" — **copy decision needed**: "Pitch it", "Search", or "Go" to be confirmed
- Light cream/sand colour palette — significant departure from dark green prototype, feels more approachable and consumer-grade

### Map view
- Real map tiles (appears to be Mapbox or similar) — much more grounded than SVG mock
- Campsite pins: numbered green circles with location label pills below — clean and scannable
- Amenity pins: icon-based circles (caravan for dump points, water drop for water fill) — visually distinct from campsite pins, good differentiation
- Predefined search chips sit cleanly below the search bar pill
- "More/Less" text toggle sits alongside drag handle on drawer — good accessibility addition, keep this pattern

### Drawer — half state
- Summary row: "5 areas found · ranked by weather · 3hr of Sydney" — exactly the right language, confirmed in design
- Cards show: name, drive time, blurb, colour-coded weather bar, day-by-day forecast columns, amenity tags
- "Great" badge in green top right of each card — weather score badge confirmed in design

### Drawer — full state
- Illustrated landscape header image appears at top of each card — adds visual richness and warmth
- These will need real location photography or location-specific illustrations in production — placeholder illustrations used in Figma
- AI weather summary text appears below amenity tags in full view ("Clear skies and warm sunshine — perfect camping weather all weekend") — confirms the full drawer is the right place for AI-generated copy

### Weather signal (updated Mar 2026)
- Weather day columns (strip + day cells) are the card-level weather signal
- A separate "Great/Good/Poor" badge pill was built then removed as redundant with the day columns
- Planned for M7: colour-code map pins by weather score (great/good/poor) for spatial weather awareness at a glance — gives Matt instant signal without opening a card

### Filter panel
- Activities and Amenities are separated into two distinct sections — cleaner than prototype
- Active filter shown with terracotta/coral outline and checkmark — clearly communicates AI sync state
- "Good weather ✓" active state confirms the AI → filter sync pattern is visually resolved in design
- Date picker, nearest city dropdown, drive time slider all present and resolved

### Loading state
- Map screen is shown immediately on search submit — confirms the transition behaviour discussed
- Loading spinner centred on map canvas with "Finding the best spots… / Checking weather across the region…" copy
- Map canvas is blank/cream behind the overlay — **open question**: consider showing faded map tiles behind overlay to feel more grounded and reinforce that the map is loading, not absent
- Ghost drawer visible at bottom with "0 areas found" — good — reinforces that results are coming

---

## 9. Deferred — To Explore in Later Sessions

| Topic | Notes |
|---|---|
| Weather fetching in browse mode | ✅ Implemented — viewport-based fetch, re-fetches on pan (Mar 2026). |
| Area-level weather overlays | Google Maps "local vibe" style — zoomed out = region weather, zoomed in = site weather |
| Pin clustering solution | Merge at low zoom, expand at high zoom — post-MVP |
| Pitchd pick personalisation | Learned preferences, usage history — post-MVP |
| Home screen onboarding content | First-time user experience, inspiration content |
| UX copy and labelling pass | "Pitch" button label, Pitchd pick label, search bar placeholder copy, empty states |
| Empty states | No results, location permission denied, no internet |
| Edge cases | What happens if AI misparses completely, location unavailable etc. |
| Loading state map tiles | Consider showing faded real map tiles behind loading overlay rather than blank canvas |
| Card header images | Illustrated placeholders in Figma — need real location photography or location-specific illustrations in production |

---

## 10. Key Principles Established

1. **AI is transparent** — filters always reflect what the AI understood, user can correct it
2. **Map is always the hero** — interactions are designed to keep the map prominent and useful
3. **Minimum necessary movement** — drawer and map only move when they need to
4. **Two modes, consistent design language** — browse and search results use the same components with different data and ordering logic
5. **Pitchd pick is the product's north star interaction** — one tap, best answer, no friction
