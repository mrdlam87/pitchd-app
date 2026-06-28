# Detail Sheet Interaction Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three bugs in the campsite detail sheet: the floating search bar overlapping detail content in full state, Vaul drawer drag/snap being blocked while the detail sheet is open, and the map pin not highlighting when a card is tapped from the half/full list.

**Architecture:** The root cause of bugs 1 and 2 is that `CampsiteDetailSheet` is `absolute inset-0` over the *entire* `Drawer.Content` — covering both the spacer and the Vaul handle strip. The fix is to restructure `Drawer.Content` so the spacer + handle strip are siblings *above* a new `relative flex-1 overflow-hidden` content wrapper, and the detail sheet is only `absolute inset-0` within that wrapper. Bug 3 is a separate wiring gap: `DrawerContentList` needs to call a lightweight `onHighlightPin(i)` alongside `onOpenDetail(campsite)` so `selectedIdx` updates without triggering a drawer snap change.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Vaul drawer, Mapbox

---

## File Map

| File | Change |
|------|--------|
| `app/components/BottomDrawer.tsx` | Restructure `Drawer.Content` children order; add content wrapper div; remove drag pill from `CampsiteDetailSheet`; add `onHighlightPin` to `DrawerContentList` |
| `app/components/Map.tsx` | Pass `onHighlightPin` callback to `BottomDrawer` → `DrawerContentList` |

---

## Task 1: Restructure `Drawer.Content` — lift spacer + handle above the detail sheet

**File:** `app/components/BottomDrawer.tsx`

The current order inside `Drawer.Content` is:
1. `<Drawer.Title>` (sr-only)
2. `<CampsiteDetailSheet>` ← absolute inset-0, covers everything below
3. spacer div (0 → 120 px)
4. handle strip div
5. card list / peek content

The new order:
1. `<Drawer.Title>` (sr-only)
2. spacer div ← moved up
3. handle strip div ← moved up
4. `<div className="relative flex-1 overflow-hidden">` ← new content wrapper
   - `<CampsiteDetailSheet>` ← still absolute inset-0, but now relative to wrapper
   - card list / peek content

- [ ] **Step 1: Open `app/components/BottomDrawer.tsx` and locate the return block inside `BottomDrawer` (~line 895). Replace the entire `<Drawer.Content>` children with the restructured order shown below.**

The section to replace starts after `<Drawer.Content ...>` and ends before `</Drawer.Content>`. Replace it with:

```tsx
          {/* Visually-hidden title for screen readers */}
          <Drawer.Title className="sr-only">Search results</Drawer.Title>

          {/* Spacer — pushes handle strip below the floating search bar + chips (z-[60])
              in full state. Animating height prevents the handle from jumping on
              state transitions. Now also clears the detail sheet since it lives below. */}
          <div
            style={{
              height: isFull ? FULL_STATE_SPACER_PX : 0,
              flexShrink: 0,
              overflow: "hidden",
              transition: `height ${DRAWER_TRANSITION_MS}ms cubic-bezier(0.32,0.72,0,1)`,
            }}
          />

          {/* Handle strip — drag pill + summary row + More/Less button.
              Positioned above the content wrapper so it remains reachable even
              when the detail sheet is open. */}
          <div
            className="flex-shrink-0 select-none cursor-grab"
            style={{ borderTop: isFull ? `1.5px solid ${BORDER}` : "none" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full" style={{ background: BORDER }} />
            </div>
            <div className="px-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-semibold${isFetching ? " animate-pulse" : ""}`}
                  style={{ color: FOREST_GREEN }}
                >
                  {resultLabel}
                </span>
                {isFetching && (
                  <div
                    className="w-4 h-4 rounded-full animate-spin flex-shrink-0"
                    style={{ border: `2px solid ${BORDER}`, borderTopColor: CORAL }}
                  />
                )}
              </div>
              {hasContent && (
                <button
                  type="button"
                  className="text-[11px] font-bold flex-shrink-0 ml-2"
                  style={{ color: CORAL }}
                  onClick={() =>
                    onDrawerStateChange(drawerState === "full" ? "peek" : cycleUp(drawerState))
                  }
                  aria-label={drawerState === "full" ? "Collapse drawer" : "Expand drawer"}
                >
                  {drawerState === "full" ? "▼ Less" : "▲ More"}
                </button>
              )}
            </div>
          </div>

          {/* Content wrapper — fills remaining space below the handle strip.
              relative + overflow-hidden so CampsiteDetailSheet (absolute inset-0)
              clips within this area only and doesn't cover the handle strip. */}
          <div className="relative flex-1 overflow-hidden">

            {/* Detail sheet — slides up within the content wrapper only */}
            <CampsiteDetailSheet
              campsite={detailCampsite}
              userLocation={userLocation}
              open={isDetailOpen}
              onDismiss={closeDetail}
            />

            {/* Scrollable card list (or empty state) — visible in half and full states */}
            {drawerState !== "peek" && (
              showEmptyState ? (
                <div className="overflow-y-auto flex-1 px-4 pt-2 pb-4">
                  <EmptySearchState
                    title={emptyTitle}
                    location={searchLocation}
                    onClearSearch={onClearSearch}
                    onBroadenSearch={onBroadenSearch}
                  />
                </div>
              ) : (
                <DrawerContentList
                  campsites={campsites}
                  amenityPois={amenityPois}
                  selectedPoi={selectedPoi}
                  poiMeta={poiMeta}
                  selectedIdx={selectedIdx}
                  userLocation={userLocation}
                  cardRefs={cardRefs}
                  compact={drawerState !== "full"}
                  drawerMode={drawerMode}
                  scrollRef={scrollContainerRef}
                  onSelectPoi={onSelectPoi}
                  onOpenDetail={openDetail}
                />
              )
            )}

            {/* Peek state — single card, no scroll */}
            {drawerState === "peek" && (
              <div className="px-4 pt-2 pb-4 overflow-hidden">
                {showEmptyState ? (
                  <EmptySearchState
                    title={emptyTitle}
                    location={searchLocation}
                    onClearSearch={onClearSearch}
                    onBroadenSearch={onBroadenSearch}
                  />
                ) : selectedPoi && peekPoiMeta ? (
                  <POICard poi={selectedPoi} meta={peekPoiMeta} />
                ) : peekCampsite ? (
                  <CampsiteCard
                    campsite={peekCampsite}
                    index={peekIdx}
                    isSelected={selectedIdx === peekIdx}
                    compact={true}
                    userLocation={userLocation}
                    cardRef={() => { /* peek card — ref not used for scrollIntoView */ }}
                    onSelect={() => onSelectPin(peekIdx)}
                  />
                ) : null}
              </div>
            )}

          </div>
```

- [ ] **Step 2: Remove the drag pill from `CampsiteDetailSheet`.**

The `CampsiteDetailSheet` currently has a visual pill at the top of its header section that duplicates the main handle strip pill. Now that the main pill is always visible above, remove only the pill div. Keep the header wrapper div (it still provides the swipe-to-dismiss gesture and the "Back" button).

Find this block inside `CampsiteDetailSheet` (~line 583):
```tsx
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: BORDER }} />
        </div>
```
Delete those 3 lines. The "Results" back button section below remains unchanged.

- [ ] **Step 3: Add `inert` to the detail sheet root div when closed.**

`aria-hidden={!open}` already hides it from screen readers, but keyboard-focusable elements inside (the directions link, back button) remain reachable via Tab when the sheet is closed. Add `inert` to fully lock it out when not open.

Find the `CampsiteDetailSheet` root div (~line 546):
```tsx
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      aria-hidden={!open}
      style={{
```
Change to:
```tsx
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      aria-hidden={!open}
      inert={!open || undefined}
      style={{
```

- [ ] **Step 4: Build and verify no TypeScript errors.**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors. Fix any if they appear before continuing.

- [ ] **Step 5: Commit.**

```bash
git add app/components/BottomDrawer.tsx
git commit -m "fix(drawer): lift handle strip above detail sheet, clear search bar overlap"
```

---

## Task 2: Add `onHighlightPin` to wire map pin highlight on card tap

**Files:** `app/components/BottomDrawer.tsx`, `app/components/Map.tsx`

Currently `DrawerContentList.onSelect` calls only `onOpenDetail(campsite)`. `selectedIdx` is never set, so the map pin has no coral ring when the detail sheet opens. We don't want to call `onSelectPin(i)` because that also calls `setDrawerState("half")`, collapsing the drawer from full. Instead, a lightweight `onHighlightPin(i)` callback sets only `selectedIdx` and the ID ref.

- [ ] **Step 1: Add `onHighlightPin` to `DrawerContentList`'s prop type and call it in `onSelect`.**

In `app/components/BottomDrawer.tsx`, find the `DrawerContentList` function signature (~line 458). Add `onHighlightPin` to the destructuring and type:

```tsx
function DrawerContentList({
  campsites,
  amenityPois,
  selectedPoi,
  poiMeta,
  selectedIdx,
  userLocation,
  cardRefs,
  compact,
  drawerMode,
  scrollRef,
  onSelectPoi,
  onHighlightPin,
  onOpenDetail,
}: {
  campsites: Campsite[];
  amenityPois: AmenityPOI[];
  selectedPoi: AmenityPOI | null;
  poiMeta: Record<string, POIMeta>;
  selectedIdx: number | null;
  userLocation: { lat: number; lng: number } | null;
  cardRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  compact: boolean;
  drawerMode: DrawerMode;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelectPoi?: (poi: AmenityPOI) => void;
  onHighlightPin?: (i: number) => void;
  onOpenDetail: (campsite: Campsite) => void;
}) {
```

Then find the `CampsiteCard.onSelect` handler inside `DrawerContentList` (~line 516):
```tsx
          onSelect={() => {
            onOpenDetail(campsite);
          }}
```
Change to:
```tsx
          onSelect={() => {
            onHighlightPin?.(i);
            onOpenDetail(campsite);
          }}
```

Also add `onHighlightPin={onHighlightPin}` to the `DrawerContentList` JSX inside the content wrapper (added in Task 1). Find the `<DrawerContentList` usage in `BottomDrawer`'s return block and add the prop:
```tsx
                  onSelectPoi={onSelectPoi}
                  onHighlightPin={onHighlightPin}
                  onOpenDetail={openDetail}
```

- [ ] **Step 2: Add `onHighlightPin` to `BottomDrawer`'s `Props` type and accept it in the function signature.**

In `app/components/BottomDrawer.tsx`, find the `Props` type (~line 686) and add:
```tsx
  onHighlightPin?: (i: number) => void;
```

Then find the `BottomDrawer` function destructuring (~line 706) and add `onHighlightPin` to the parameter list. Pass it through to `DrawerContentList` — you added this in Task 1 already (the `onHighlightPin={onHighlightPin}` prop on `DrawerContentList`).

- [ ] **Step 3: Wire `onHighlightPin` in `Map.tsx`.**

In `app/components/Map.tsx`, find the `<BottomDrawer>` JSX (~line 1501). Add the prop after `onSelectPin`:

```tsx
          onHighlightPin={(i) => {
            setSelectedIdx(i);
            selectedIdRef.current = displayedCampsitesRef.current[i]?.id ?? null;
          }}
```

- [ ] **Step 4: Build and verify no TypeScript errors.**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit.**

```bash
git add app/components/BottomDrawer.tsx app/components/Map.tsx
git commit -m "fix(drawer): highlight map pin when opening campsite detail from card list"
```

---

## Task 3: Verify all three fixes in the browser

- [ ] **Step 1: Start the dev server if not already running.**

```bash
cd app && npm run dev
```

Navigate to `http://localhost:3000/map` in the Playwright session.

- [ ] **Step 2: Verify — search bar no longer overlaps detail in full state.**

1. Expand drawer to full (▲ More twice, or once if already at half)
2. Tap any campsite card → detail sheet slides up
3. Confirm: the "← Results" back button is fully visible below the search bar and chips
4. Confirm: no content is clipped behind the floating search bar

- [ ] **Step 3: Verify — drawer drag/snap works while detail sheet is open.**

1. Open the detail sheet from full state
2. Drag downward on the handle strip (pill + "8 campsites nearby" row) → drawer should snap to half
3. Confirm: the detail sheet collapses with the drawer (it occupies the content wrapper which shrinks)
4. Drag handle upward → should expand back to full
5. Click "▼ Less" / "▲ More" button → should work without dismissing the detail sheet

- [ ] **Step 4: Verify — tapping "← Results" closes the detail sheet.**

1. With detail open, tap "← Results"
2. Confirm: detail sheet slides out, card list is restored with the previously tapped card highlighted (coral border)
3. Confirm: the map pin for that campsite has the coral ring

- [ ] **Step 5: Verify — pin highlights on card tap from half state.**

1. Expand drawer to half state
2. Tap a campsite card
3. Confirm: detail sheet opens AND the corresponding map pin shows the coral ring (may need to dismiss the detail to verify on the map)

- [ ] **Step 6: Verify — dismiss gesture still works on detail header.**

1. Open detail sheet
2. Touch/drag down on the "← Results" area (the detail header)
3. Confirm: after ~60px downward drag, the detail sheet dismisses

- [ ] **Step 7: Run the test suite.**

```bash
cd app && npm test
```

Expected: all existing tests pass. The restructuring is purely layout — no API or logic changes.

- [ ] **Step 8: Commit verification note and push.**

If everything looks correct, push:
```bash
git push
```
