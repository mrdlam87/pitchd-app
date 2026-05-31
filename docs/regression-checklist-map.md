# Map Screen Regression Checklist

Run this before merging any PR that touches Map.tsx, BottomDrawer.tsx, SearchInput.tsx, HomeScreen.tsx, or any `/api/search/*` route.

---

## 1. HomeScreen appearance

- [ ] Search card shows a **textarea** (multiline, 3 rows), not a single-line input
- [ ] `Try: "not raining this weekend"` hint is visible at the bottom-left of the card
- [ ] **Pitch** button at the bottom-right of the card; greyed out when textarea is empty, coral when text is present
- [ ] Placeholder text cycles through the four example prompts
- [ ] Suggested prompts list is visible below the search card
- [ ] Tapping a suggested prompt populates the textarea
- [ ] Quick-filter chips (Pitchd, Good weather, Dog friendly, etc.) are visible and tappable

---

## 2. HomeScreen → Map navigation

- [ ] Typing a query and tapping **Pitch** navigates to the map and the **map search bar** shows the exact same query
- [ ] Tapping the **Pitchd** chip on the HomeScreen navigates to the map; the map search bar shows the Pitchd chip's query and the Pitchd chip is highlighted
- [ ] Tapping the **Good weather** chip navigates to the map; the map loads with the Good weather filter active (no search bar query)

---

## 3. Map search bar — basic behaviour

- [ ] Search bar is visible at the top of the map in pill style (white, rounded-full)
- [ ] Typing in the bar and pressing Search runs a search; the query stays in the bar after results load
- [ ] The circular button shows a **search icon** when the bar is empty / loading; shows an **× button** when the bar has text (and is not loading)
- [ ] Tapping **×** clears the bar, clears results, and returns to browse mode

---

## 4. Chip searches populate the search bar

- [ ] Tapping **Pitchd** chip on the map populates the bar with the Pitchd query and runs the search
- [ ] Tapping **Dog friendly** chip on the map populates the bar with that chip's query
- [ ] After a chip search, the bar shows the chip's query (not empty)

---

## 5. Chip active / disabled state

- [ ] After a **bar** (NL) search, **no chip is highlighted**
- [ ] After a **Pitchd chip** search, only the Pitchd chip is highlighted
- [ ] While a chip search is loading, **only that chip** is visually disabled; other chips remain tappable
- [ ] Bar searches during load do **not** disable any chip

---

## 6. Context label

- [ ] In normal browse mode (no active search), there is **no** context label below the search bar
- [ ] After selecting a **location suggestion** (city/town), the drawer shows the city name as the search context (e.g. "near Melbourne") in the empty-state message — see §11a and §12 for full location search checks

---

## 7. Drawer states

- [ ] Drawer is visible in **peek** state (64 px strip) on page load
- [ ] Swiping up / tapping **▲ More** expands to **half** state
- [ ] Tapping **▲ More** again expands to **full** state
- [ ] Tapping **▼ Less** collapses from full directly back to **peek**
- [ ] Dragging the handle pill moves the drawer smoothly between states
- [ ] In **full** state the card list scrolls independently of the map (no accidental drawer drag while scrolling)

---

## 8. Search input focusability (Radix FocusScope fix)

- [ ] Tapping the search bar while drawer is in **peek** state — input becomes focused, keyboard appears
- [ ] Tapping the search bar while drawer is in **half** state — input becomes focused, keyboard appears
- [ ] Tapping the search bar while drawer is in **full** state — input becomes focused, keyboard appears
- [ ] Typing a character while drawer is full collapses drawer to **peek** automatically
- [ ] The circular action button does **not** steal focus when the drawer is opened

---

## 9. Soft keyboard — drawer stability (critical mobile regression)

- [ ] Tap search input → keyboard opens → **drawer remains visible** at peek strip
- [ ] Dismiss keyboard (tap Done / back / outside input) → **drawer is still visible** at the same snap position it was before
- [ ] After dismissing keyboard, tapping the drawer handle or map still responds normally
- [ ] Repeat the above with drawer in **half** state before tapping input

---

## 10. Recent searches

- [ ] After running a search, the query is saved to recents
- [ ] Tapping the search bar when it is empty / short shows the recents dropdown
- [ ] Selecting a recent populates the bar **and** runs the search
- [ ] Keyboard up/down navigates the recents list; Enter selects

---

## 11. Suggestion dropdown — campsite & region

- [ ] Typing ≥2 characters shows the suggestions dropdown
- [ ] **Campsite** suggestions show ⛺ icon with state below; clicking navigates to that pin on the map
- [ ] **Region** suggestions show 📍 icon with "Region · state · N campsites" below; clicking loads campsites in that region
- [ ] After clicking a suggestion the **dropdown closes and does not reopen** (no 300 ms flicker)
- [ ] Pressing Escape dismisses the dropdown without searching
- [ ] Clicking/tapping outside the search bar dismisses the dropdown

---

## 11a. Suggestion dropdown — city & town (location search)

- [ ] Typing a **city name** (e.g. "Sydney", "Melbourne", "Cairns") shows 📍 location suggestions at the **top** of the dropdown, above any region/campsite results
- [ ] Location suggestions show the subtitle **"Show campsites nearby"**
- [ ] Clicking a **location suggestion** flies the map to that city and loads campsites within 100 km, sorted by proximity
- [ ] The search bar shows the city name after selection (e.g. "Sydney")
- [ ] The context label below the bar shows the city name (e.g. "Sydney") with **✕ Browse area**
- [ ] Typing a **town name** (e.g. "Jindabyne", "Cooma", "Bright") also returns location suggestions
- [ ] Typing a **suburb name** (e.g. "Manly", "St Kilda") returns location suggestions
- [ ] If no city/town matches, no location suggestions appear — campsite/region results are unaffected
- [ ] Location suggestions do **not** appear for very short queries (< 2 chars)
- [ ] When Mapbox returns two places with the **same name** (e.g. two "Manly" suburbs), both rows appear without React key warnings — **0 console errors**

---

## 11b. Region search (via region suggestion)

- [ ] Typing a known region name (e.g. "Blue Mountains", "Snowy Mountains") shows a region suggestion when region data is populated in DB
- [ ] Clicking a region suggestion shows all campsites in that region sorted by proximity to the region centre
- [ ] The drawer count shows "X campsites found" for the region

---

## 12. Proximity search results (nearby)

- [ ] After selecting a city suggestion, the map **flies to the city centre** (not the user's GPS location)
- [ ] Campsites within 100 km are shown; campsites beyond 100 km are excluded
- [ ] Results are sorted **nearest-first** (closest campsite is at the top of the drawer list)
- [ ] The **Free** chip applies on top of a proximity search (re-fetches with `free=true`)
- [ ] Tapping **✕ Browse area** exits proximity search and returns to browse mode
- [ ] If no campsites exist within 100 km, the drawer shows the **empty state** (not a crash)

---

## 13. Browse mode (no search)

- [ ] On load without a search payload, map shows pins for the default area
- [ ] Drawer shows "X campsites found" (or fetching spinner)
- [ ] Tapping a pin highlights it and shows it in the peek strip

---

## Environment

Tested on:
- Desktop Chrome (Playwright / devtools mobile simulation)
- Real iOS Safari (manual)
- Real Android Chrome (manual)
