# Pitchd — UX Session 2
> Mobile search & filter UX audit — current implementation vs design intent
> Date: 20 April 2026

---

## 1. Session Scope

Audit of the current production implementation (M1–M6 complete) focused on the search and filtering experience on mobile. Findings are split by severity and include specific remediation notes. Session 1 principles are treated as ground truth.

---

## 2. Critical Issues

### 2.1 Touch targets below 44pt minimum

Several interactive elements fall short of the Apple HIG / Material 48dp minimum:

| Element | Current size | Issue |
|---|---|---|
| Quick filter chips | `py-1.5 px-3` ≈ 28px tall | Too short; short-label chips (e.g. "Dog") also too narrow |
| FilterPanel toggle chips | `py-2` ≈ 32px tall | Borderline |
| Date grid cells | ~38px on a 375px screen (7-col, `gap-1.5`) | Below minimum on small phones |
| Drawer drag handle | `w-10 h-1` pill | Visual only — hit area is only as large as the surrounding div |

**Fix:** Add `min-h-[44px]` to chips. Ensure date grid cells have `min-h-[44px]`. Expand drag handle hit area via vertical padding on the containing row.

### 2.2 No inline error feedback on the search input

API failures surface as a page-level banner, which may be off-screen when the user is scrolled down. During loading, `disabled:opacity-60` on the textarea gives no indication of *why* input is unavailable.

**Fix:** Show error text directly below the textarea (`text-xs text-[#c0392b] mt-1`). Add `aria-describedby` pointing to the error element, and `aria-busy="true"` on the form during loading.

### 2.3 Loading state provides no progress signal

The "Pitching…" state disables the textarea and shows a button spinner, but gives no sense of progress. AI + weather parsing can take 2–4 seconds — users may assume it has frozen.

Session 1 established: *"drawer peek shows loading state rather than a spinner overlay — makes the AI feel fast."* The current implementation does not fully realise this on the home screen pre-navigation.

**Fix:** Map the existing 1.5s message cycle to actual pipeline stages: `"Finding campsites…" → "Checking weather…" → "Almost there…"`. Consider a thin progress bar at the top of the search card to reinforce activity.

---

## 3. High Priority Issues

### 3.1 Geolocation denial is invisible to the user

When the user denies location access, the app silently falls back to Sydney (−33.8688, 151.2093). A user in Brisbane or Melbourne receives results centred on Sydney with no explanation.

**Fix:** On geolocation denial, show a non-blocking note below the search input: *"Using approximate location — allow location access for better results."* (`text-xs text-[#8a9e8a]`). Do not block the search flow.

### 3.2 Date picker can't represent AI-inferred dates beyond the 7-day strip

When a user types *"late May"* or *"next weekend in two weeks"*, Claude correctly infers dates outside the 7-day FilterPanel grid. Those dates are used in the search but cannot be viewed or corrected in the UI. This directly violates Session 1's core principle: *"AI is transparent — filters always reflect what the AI understood, user can correct it."*

**Fix (short term):** After an AI search, display parsed dates as a compact chip in the floating search bar: *"20–21 Apr · edit"*. Tapping "edit" opens a date picker that is not constrained to 7 days (native `<input type="date">` pair, or a simple month grid).

**Fix (long term):** Replace the 7-day strip in FilterPanel entirely with a scrollable month-view date picker.

### 3.3 Active filters are invisible on the map screen

Once the user applies filters and returns to the map, there is no persistent indicator of which filters are active. The user cannot tell whether "Dog friendly" is still applied without reopening the panel.

**Fix:** In the MapView floating search bar chip row, render active filters as dismissible pills: `[🐕 Dog · ✕]`. Tapping ✕ removes that filter and re-fetches. This is the AllTrails pattern and aligns with Session 1's intent for chips as "shortcuts to search intents."

### 3.4 Empty state is missing on the map screen

When a search returns 0 campsites, the map shows no pins and the drawer is blank. No guidance on what to do next. Session 1's deferred items table explicitly flags this as outstanding.

**Fix:** When `campsites.length === 0`, render a dedicated drawer state:
- Icon: tent outline
- Heading: *"No campsites found"*
- Subtext: *"Try removing a filter or searching a different area"*
- Action: *"Clear filters"* (full-width coral button)

---

## 4. Medium Priority Issues

### 4.1 Quick chips have no active state on the map screen

On HomeScreen, tapping a chip highlights it before navigation. On MapView, chips always appear inactive regardless of which direct filter was applied. The visual feedback loop is broken.

**Fix:** When `activeFilters.activities` contains an item, render the matching chip as active (coral background/border) in the map's floating chip row.

### 4.2 FilterPanel uses a full-screen modal — mismatched pattern for map context

Opening a full-screen overlay from the map discards spatial context. The user's mental map of where they were is lost. Session 1 established the map as always the hero — interactions should keep it in view.

AllTrails and Google Maps both use bottom sheets for filters on mobile.

**Fix:** Convert FilterPanel to a Vaul bottom sheet (already a dependency). Snap points at `[0.6, 1]`: 60% for a single expanded section, 100% for full content. Consistent with the BottomDrawer pattern already in use for results.

### 4.3 Cycling placeholder text has accessibility issues

The textarea placeholder cycles every 3.2s. This content is not re-announced to screen readers on change. It can also feel distracting for users trying to compose a query while the placeholder shifts.

**Fix:** Set a static `aria-label` on the textarea (*"Describe your camping trip"*) so screen readers ignore the cycling content. If cycling is kept for visual interest, ensure the `aria-label` is stable.

### 4.4 Parsed AI intent is not surfaced after search

After an AI search, `parsedIntent` contains the system's interpretation: location, drive hours, activities, dates. This information is used for the search but never shown to the user. This conflicts with Session 1 principle: *"AI is transparent — filters always reflect what the AI understood."*

**Fix:** In the MapView floating search bar, show a compact summary line below the input: *"Near Canberra · 3hr drive · Dog friendly"* (`text-[11px]`, sage colour). This lets users spot misinterpretations immediately and reinforces the "AI sync" model.

---

## 5. Summary Table

| Issue | Priority | Effort | Aligns with Session 1 Principle |
|---|---|---|---|
| Touch targets below 44pt | Critical | Low | — |
| No inline error feedback on search | Critical | Low | — |
| Loading state has no progress signal | Critical | Low | Map is hero / fast-feeling AI |
| Silent geolocation fallback | High | Low | — |
| Date picker can't show AI-inferred dates | High | Medium | AI is transparent |
| No active filter indicator on map | High | Low | AI is transparent |
| Empty state missing | High | Low | (flagged in Session 1 deferred) |
| Chips have no active state on map | Medium | Low | AI is transparent |
| FilterPanel should be bottom sheet | Medium | Medium | Map is always the hero |
| Cycling placeholder accessibility | Medium | Low | — |
| Parsed intent not surfaced post-search | Medium | Low | AI is transparent |

---

## 6. Items to Carry to Session 1 Deferred Table

The following Session 1 deferred items are now addressed or superseded by the above:

| Session 1 Item | Status |
|---|---|
| Empty states | Addressed above (§3.4) — implementation spec included |
| UX copy and labelling pass | Still open — search bar placeholder, "Pitch" button label, chip labels |
| Edge cases — AI misparse, location unavailable | Partially addressed (§3.1 geolocation, §4.4 intent surfacing) — full misparse recovery UX still needed |
| Loading state map tiles | Still open — faded tiles vs blank canvas behind overlay |

---

## 7. Key Principles Reinforced

The issues above cluster around three of Session 1's established principles:

1. **AI is transparent** — the current implementation does not yet fully surface parsed intent, active filters, or AI-inferred dates to the user. Most of the medium/high priority fixes address this gap.
2. **Map is always the hero** — the full-screen FilterPanel modal breaks this. Converting to a bottom sheet resolves it.
3. **Minimum necessary movement** — the missing empty state and loading feedback create unnecessary uncertainty about whether the system is working.

---

## 8. Deep Review — Search Behaviour & Results Rendering (April 2026)

A deeper review of the specific interaction flows: how search feels to use end-to-end, and how results are rendered on both the map and the card list.

### 8.1 Home → Map Transition

- No visual continuity between HomeScreen's textarea and MapView's search input — different shape, size, and interaction model with no connecting animation or shared element.
- `router.push("/map")` is a hard navigation — no directional slide, no loading intermediate.
- **No way back to HomeScreen** from the map. No home button, no back affordance. The map is a one-way door; users who want to retype a longer query or access recent searches must use OS back navigation.

### 8.2 HomeScreen Search — Specific Issues

- **Suggested prompts don't auto-submit** — tapping a suggestion populates the textarea but requires a second tap on "Pitch". Every comparable product (Google Maps, AllTrails) submits on suggestion tap. Remove the extra step.
- **Triple redundancy of EXAMPLE_PROMPTS** — the same 4 strings appear as cycling placeholder, as the static `Try: "not raining this weekend"` hint, and as the Suggested list. The hardcoded hint adds no value.
- **No textarea clear button** — no `×` affordance to reset the input when text is present. Users wanting to switch to a chip must manually select-all and delete.

### 8.3 Chip Behaviour — Indistinguishable Types

On both HomeScreen and MapView, the chip row mixes three fundamentally different behaviours with no visual differentiation:

| Chip | Behaviour |
|---|---|
| Pitchd pick, Good weather | Fires AI search via Claude API |
| Dog friendly, Fishing, Hiking | Direct DB filter, no AI, browse mode |
| Dump points, Water fill | Toggles an amenity POI layer |

Users have no way to predict what a chip will do. Tapping "Dog friendly" while in AI search mode silently exits search mode and replaces results — no confirmation, no explanation.

**Fix:** Distinguish chip types visually. AI chips (Pitchd, weather) could use a ✦ or ✨ prefix. Direct filter chips should pulse/highlight when active. Amenity layer chips could use a different shape (rounded square vs pill).

### 8.4 MapView Search Bar — Specific Issues

- **"Filters" has no button affordance** — rendered as `text-xs font-bold text-[#e8674a]` with no border or background. It controls the entire filtering surface and must look like a button.
- **Search icon button is `h-7 w-7` = 28px** — below the 44pt minimum on the most-used screen.
- **NavigateButton in cards is `w-7 h-7` = 28px** — same violation on every card.
- **No query persistence** — `mapQuery` resets to `""` after a successful search; the user can't edit the previous query without retyping.
- **No cancel affordance** — in-progress search shows a spinner but provides no way to abort on slow connections.
- **`searchContextQuery` is `text-[10px]`** — the AI intent summary beneath the input is 10px, barely legible on any mobile screen, and gets `truncate`d.

### 8.5 Active Search Mode — No Clear Exit

`searchModeRef.current = true` locks the map — panning does not load new results. The only exits are:
1. Tap the active chip again (completely undocumented)
2. Apply filters in FilterPanel (exits search mode as a side effect, not an intent)
3. Submit a new search

There is no "Clear results" button, no "Browse area" affordance, no `✕` on the search context display. Users who pan to a new area and see no results won't understand why.

### 8.6 Map Pin Rendering

- **Pin labels use CSS text-shadow** — `textShadow: "0 0 3px rgba(255,255,255,0.95)..."`. This breaks on dark terrain tiles (forest, water) which dominate the `outdoors-v12` Mapbox style in Australian national parks. A white background pill is the standard pattern.
- **Labels always positioned right of pin** — clips at viewport right edge; no fallback positioning.
- **Pin numbers not shown on cards** — `showIndex={false}` is hardcoded in `DrawerContentList`. Pin #3 on the map can't be cross-referenced with the list. Violates Session 1's "pin and card are always in sync" principle.
- **Cluster → individual anchor jump** — clusters use `anchor="center"`, pins use `anchor="bottom"`. The pin jumps during zoom-to-uncluster animation.
- **No weather colour on pins** — planned for M7 (Session 1, §8). No spatial weather signal at a glance.

### 8.7 Drawer Summary Row

The summary always reads `"X campsites found · nearby"` regardless of mode. `"· nearby"` is incorrect when displaying AI search results 3+ hours away ranked by weather score.

Session 1 designed: *"5 areas found · ranked by weather · 3hr of Sydney"*. The `parsedIntent` and `searchContextQuery` data are available in MapView but not used for the summary label. This is a straightforward copy fix with meaningful impact on user trust.

### 8.8 Weather Data in Cards

- **`text-[7px]` day name labels** — "MON", "TUE" at 7px are near-invisible. Minimum legible size is 10–11px.
- **Inconsistent precipitation metric** — same cell shows either `X%` (probability) or `Xmm` (sum) with no label indicating which. These are different quantities; mixing them silently is misleading.
- **`WeatherStrip` is 5px tall and inaccessible** — a 5px color bar with no `aria-label` and no text. Purely decorative at that height. Remove or make legible (12px minimum, with tooltip on tap).
- **Compact mode shows 2 weather days** — `weather.slice(0, 2)`. Minimum meaningful camping window is Fri/Sat/Sun (3 days). Increase to 3 in compact mode.

### 8.9 Drawer Interaction Issues

- **Map drag collapses drawer from half unconditionally** — `onDragStart={() => setDrawerState("peek")}`. Any accidental map touch while browsing the card list at half state collapses the drawer. Should use a velocity threshold or not auto-collapse on drag at all.
- **"Less" button collapses full → peek, skipping half** — surprising for users who expect "Less" to go one step down.
- **No browse vs AI search distinction in drawer** — the drawer looks identical in both modes. No mode label, no sort indicator, no explanation of ranking logic.

### 8.10 Summary Table (Deep Review)

| Area | Issue | Severity |
|---|---|---|
| Transition | No way back to HomeScreen from map | High |
| HomeScreen | Suggestions don't auto-submit | High |
| HomeScreen | Triple redundancy of example prompts | Low |
| HomeScreen | No textarea clear button | Medium |
| Chips | AI / filter / layer chips indistinguishable | High |
| Chips | Direct filter chip exits AI mode silently | High |
| Map search bar | "Filters" has no button affordance | High |
| Map search bar | Search button and NavigateButton are 28px (below 44pt) | Critical |
| Map search bar | No query persistence after search | Medium |
| Map search bar | No cancel affordance for in-progress search | Medium |
| Map search bar | searchContextQuery is 10px | High |
| Search mode | No explicit exit from locked search mode | High |
| Map pins | Labels break on dark terrain tiles | High |
| Map pins | Labels always right-aligned, clip at edge | Medium |
| Map pins | No number shown on cards to match pins | High |
| Drawer | Summary always says "· nearby" | High |
| Drawer | No browse vs AI search mode distinction | High |
| Drawer | Map drag collapses half state aggressively | Medium |
| Cards | 7px day name labels illegible | Critical |
| Cards | Precipitation metric unlabelled and inconsistent | Medium |
| Cards | WeatherStrip is 5px and inaccessible | Low |
| Cards | Compact mode shows only 2 weather days | Medium |
