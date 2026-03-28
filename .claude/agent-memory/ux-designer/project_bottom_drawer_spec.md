---
name: bottom_drawer_spec
description: Full UX spec for the AllTrails-style bottom drawer — snap positions, animation, drag, card states, handle behaviour.
type: project
---

# Bottom Drawer UX Spec (AllTrails-aligned)

Authored after reading `app/components/BottomDrawer.tsx` (production) and `prototypes/pitchd-light-v2.jsx`.

## Current production state (as of UX session 2)

- Three snap positions implemented: peek (64px), half (52vh), full (100dvh).
- CSS `height` drives the transition (not `transform: translateY`). See gap note below.
- `DRAWER_TRANSITION_MS = 300`, easing `ease-in-out`.
- Drag handled on the handle strip only (correct). `DRAG_THRESHOLD_PX = 40` displacement only — no velocity check.
- `position: fixed` on full, `absolute` otherwise. Delayed flip via `isFixed` state prevents layout jump.
- `isDragging` suppresses the CSS transition and uses `transform: translateY(dragOffsetY)` during live drag.
- `isCompact` and `showContent` both trail drawerState on close to prevent reflow stutter.
- Handle click: peek→half (via `cycleDown` on click, which is incorrectly `full→half→peek` direction); "More"/"Less" button cycles separately in the correct direction.

## Gaps vs AllTrails target behaviour

1. **Velocity-based snapping not implemented.** Currently only displacement threshold (40px). AllTrails snaps based on flick velocity — a fast flick of even 10px should snap; a slow drag needs to cross 35–40% of the distance to the next snap.
2. **Handle tap cycles incorrectly.** Tapping the handle strip calls `cycleDown(drawerState)` — tapping at peek → half is correct but it then goes half→peek on the next tap instead of half→full. The "More" button is the only reliable cycle-up. AllTrails: tapping the handle always expands (peek→half→full), never collapses; swiping down collapses.
3. **No upward drag resistance.** Dragging above the current snap point is unconstrained. Production uses `Math.max(0, dy)` which stops upward drag entirely — should allow slight upward spring (resistance) for feel.
4. **Full state: `height` vs `transform` approach.** Using CSS `height` for all transitions is correct for peek↔half. For full state, AllTrails uses `transform: translateY` on a fixed-height container so GPU compositing handles the animation. Current approach works but may stutter on low-end devices.

## Target spec (what to build toward)

### Snap positions
| State | Height | Content visible |
|---|---|---|
| Peek | 64px | Handle pill + summary row ("X campsites found · nearby") + "More" text button |
| Half | 52vh | Handle + summary + scrollable compact card list (no scenic photo, 2-day weather) |
| Full | 100dvh | Handle + summary + scrollable full cards (scenic photo, 4-day weather, AI summary) + top spacer clears search bar |

### Animation
- Property: CSS `height` (current approach — acceptable for MVP). Future: consider `transform: translateY` on full-height container for GPU compositing.
- Duration: 300ms.
- Easing: `cubic-bezier(0.32, 0.72, 0, 1)` — matches iOS/AllTrails spring feel better than `ease-in-out`. Production uses `ease-in-out` which is acceptable but slightly flat.
- Border radius animates in sync with height: 16px at peek/half → 0 at full.
- During drag: transition is `none` (already implemented correctly).

### Drag / velocity snapping
- Drag surface: handle strip only (correct).
- Displacement threshold: 35% of distance to next snap position (not a fixed 40px — relative threshold).
- Velocity threshold: if `|velocity| > 0.3 px/ms` at touchEnd, snap in that direction regardless of displacement.
- Velocity calculation: `(endY - startY) / (endTime - startTime)` — track `touchStartTime` alongside `touchStartY`.
- Upward drag: allow with resistance — `dragOffsetY = Math.max(-20, dy)` (20px spring upward before blocking).
- After touchEnd: always animate to a snap position — never leave drawer mid-height.

### Handle strip behaviour
- Tap (not drag): always expand — peek→half→full. Never collapse on tap.
- To collapse: swipe down (drag gesture) OR tap "Less" button.
- "More" / "Less" text button: remains as-is (cycles up on "More", snaps to peek on "Less").
- Minimum tap target: 44px height (current strip at ~44px is borderline — padding-top: 12px + pill 4px + padding-bottom: 8px + summary row ~20px = 44px total, acceptable).

### Card content at each state
- Peek: no card list rendered (showContent=false after animation). Only summary row.
- Half: compact cards — no scenic photo, 2-day weather strip only, shorter blurb truncated to 1 line.
- Full: full cards — scenic photo header (120px), 4-day weather cells, full blurb, amenity tags, AI summary text, navigate button.
- Card switching (compact↔full): trails drawerState on close via `isCompact` + `compactTimerRef` — prevents reflow during shrink animation. Already implemented correctly.

### Selected card in peek state
- When a pin is selected, peek shows that card's name + drive time (not the first card). Already implemented via `peekIdx = selectedIdx ?? 0`.

### Scroll behaviour
- Card list scrollable in half and full states.
- Scrolling within the card list does NOT trigger drawer drag — drag is handle-strip only (correct).
- `scrollIntoView` on selected card fires after `DRAWER_TRANSITION_MS` delay to avoid racing the animation (implemented in Map.tsx, keep).

### Full state positioning
- `position: fixed`, `top: 0`, `bottom: 0` — covers full viewport including safe areas.
- `isFixed` delayed flip pattern (already implemented) prevents layout jump on close.
- Top spacer (`FULL_STATE_SPACER_PX = 120px`) clears the floating search bar + chips. Make dynamic via ResizeObserver if search bar height changes (current TODO comment in code).
- Border-top on handle strip in full state: `1.5px solid #e0dbd0` — consistent with card borders.

### Loading state
- Peek height maintained (64px).
- Summary row shows "Checking weather across X areas…" copy.
- No card list — ghost/skeleton not required for MVP.
