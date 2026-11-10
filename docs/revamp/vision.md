# Vision & UX — Agent-first Pitchd

> Draft for discussion. Builds on `docs/project-context.md` (personas, problem) and `docs/ux-session-1.md` / `ux-session-2.md` (current UX principles).

## 1. The shift

| | Today (M1–M6) | Agent-first |
|---|---|---|
| Mental model | A smart **search** box over a campsite map | A **trip-planning companion** that does the research with you |
| Unit of work | One query → one list of results | A **trip**: an evolving plan, refined over a conversation and over days |
| AI's role | Parses the query into filters | Plans, compares, explains trade-offs, re-plans, watches |
| Time span | The moment of searching | Before → during → after the trip |
| Interaction | Type, then filter by hand | Talk, tap, and refine — the agent keeps context |

**One-line pitch (draft):** *Pitchd is like a mate who knows every campsite in Australia, checks the weather for you, and tells you straight where to go this weekend.*

The original origin story still holds — the killer query is the same — but the agent can now do the parts that still took Matt time after the search: comparing regions, weighing "dry but further" against "close but showery", and keeping an eye on the forecast until he leaves.

## 2. What we're trying to achieve

1. **Decide, not just find.** End with a confident recommendation ("Go to X. Here's why."), not 40 pins to sift through.
2. **Show the reasoning.** Every recommendation says why: weather, drive time, amenities, the user's own preferences.
3. **Never invent places.** The agent may only recommend campsites that came from Pitchd's tools and data. Trust is the product — WikiCamp users left over bad data.
4. **Remember me.** Dog, setup (car camper / caravan), favourite regions, how far I'll drive — asked once, used forever (and editable). What you say about yourself is saved automatically (with Undo); anything Pitchd works out from your behaviour is asked first; memory that shapes an answer shows in the chips; everything is listed in "What Pitchd knows". (See `decisions.md`.)
5. **Stay with the trip.** A plan isn't finished at search time — Pitchd watches the forecast and speaks up when something changes.
6. **Fast enough for Thursday night.** Matt plans in a short window. Something useful on screen within a couple of seconds; the full answer streams in.

## 3. The trip lifecycle (core UX loop)

```
 Describe ──► Agent works ──► Proposal ──► Refine ──► Commit ──► Watch ──► On the trip ──► Reflect
  (talk)      (visible)      (shortlist    (chat or    (save     (forecast   (nearby          (rate, log,
                              + reasons)    tap)        trip)     alerts)     amenities)       learn prefs)
```

| Stage | What the user experiences | Agent behaviour |
|---|---|---|
| **Describe** | Types or speaks a trip in plain English; quick-start chips for common asks | Defaults what it can (next weekend, current location, remembered drive limit) and shows the guesses as chips; asks one question with tap answers only when there's no default and a wrong guess would ruin the answer (no starting point, too vague, unsafe-if-wrong). Questions about the user are asked once and remembered |
| **Agent works** | Sees progress *on the map*: regions being checked, weather overlays appearing, candidate pins dropping in | Streams tool activity as human steps: "Checking weather around Mudgee, Blue Mountains, Hunter…" |
| **Proposal** | A short ranked shortlist (≈3), a clear top pick, one-line reason each, trade-offs called out | Ranks on weather + drive time + fit to preferences; explains the trade-off between top options |
| **Refine** | "Closer", "drier", "somewhere with a shower" — by chat or refinement chips; tap a pin to ask "why this one?" | Keeps the conversation context; re-runs only what changed |
| **Commit** | Saves the trip (site, dates, who's coming, setup); for sites that need booking, a "Check & book" link and a "Booked?" tick ("Not booked yet" shows on the trip card until ticked) | Writes to the trip store; offers a packing list matched to the forecast; never claims a site is available unless it checked |
| **Watch** | Opts in when saving a trip. Gets a push (or email if no push) only when the forecast materially turns — "Saturday now 70% rain at X — want alternatives?" — plus safety alerts (fire ban, closure, flood) always, and a final check the day before | Background job re-checks saved trips; thresholds in code; max one weather alert per trip per day, quiet hours; proposes options rather than just alerting |
| **On the trip** | Nearby dump points, water, fuel, toilets; saved trip and a downloaded trip pack (amenities within ~50 km, last forecast, fire danger) work with no signal; messages typed offline send when signal returns | Lightweight queries; trip pack refreshed at save and at the day-before check; offline maps wait for native |
| **Reflect** | Quick rating ("great site, too windy") | Updates preferences and adds signal for future ranking |

MVP of the revamp = **Describe → Agent works → Proposal → Refine → Commit**. Watch, On the trip, Reflect come later.

## 4. Lessons from v1's UI

**Founder's verdict:** the drawer was glitchy, and the experience overall wasn't well thought out or intuitive.

**What the audits show (`docs/ux-session-2.md`):** most issues trace back to two search systems (AI + filters) competing — indistinguishable chips, invisible active filters, no exit from search mode, parsed intent not shown — plus an opaque AI wait, undesigned states (empty, error, no location), and basics (touch targets, accessibility).

**Diagnosis:** v1 was designed screen by screen and component by component; the end-to-end journey was never designed as a whole. The drawer was carrying too much (results, details, loading, filters, modes) through too many states.

**What v2 does differently:**
1. **Design the journey before the screens.** Write the core flows end to end (describe → agent works → proposal → refine → commit, plus every failure path) and walk through them before any UI is drawn.
2. **Prototype the hard interaction first.** The map + conversation sheet is the riskiest piece — prototype and test it on a real phone before building anything around it.
3. **Fewer states.** If there's a sheet, two snap positions (collapsed / expanded) unless a third earns its place. Every state has one clear purpose.
4. **Don't hand-roll gestures.** Use a proven bottom-sheet implementation (or the platform's native sheet) rather than custom drag logic.
5. **Test on real trips.** The founder plans actual weekends with the prototype before v2 is built in earnest; anything confusing is fixed in the design, not patched in code.

## 5. Interface principles

1. **One way to search, one mode.** No search mode vs browse mode — map and conversation always coexist.
2. **The map is the shared canvas; the conversation drives it.** Not a chat app with a map bolted on, and not a map with a chatbot bolted on. The agent's work shows up spatially. **Layout (decided):** map full-screen with a two-snap conversation sheet — collapsed shows the current turn (summary, assumption chips, card carousel synced with pins, input); expanded shows the full thread. Input always visible; no half state. Desktop: the same pieces in a left sidebar beside the map. Redesigned from scratch, not v1's drawer (see §4 and `decisions.md`).
3. **Tap and talk are equal.** Anything you can say, you can usually tap (chips, pins, cards), and anything you tap becomes context for the agent. Typing should never be mandatory for a refinement. Speaking works too: the mic in the input dictates into the box so you can check it before sending; spoken replies and hands-free mode wait for native.
4. **Show the work, on the map.** Never a bare spinner — short step lines plus pins appearing. Builds trust and hides latency; no walls of reasoning.
5. **Answers are structured, not just prose.** The agent returns cards (site, weather days, drive time, why) rendered by the UI, with a short natural-language summary on top. The existing card + weather-pin conventions carry over.
6. **Always show what Pitchd understood.** After every agent turn, its interpretation is shown as editable chips. "Assuming this weekend (Sat–Sun), 3 hr from Sydney, with your dog" as tappable chips the user can change. Guessed values come first and look different from what the user said; tapping one offers quick alternatives and re-runs only what changed.
7. **Every state is designed** — empty, error, no location, offline, agent unavailable — each a deliberate screen, not a fallback. Basics from day one: 44 pt touch targets, accessible text, readable in sunlight.
8. **Honest when it can't.** No dry sites within range → say so and offer the trade-off ("dry if you drive 4.5 h, or showers Sunday morning only at X"). Same for availability: Pitchd says whether a site needs booking and links to it, but never claims it's free unless it checked.
9. **Search is agent-only; viewing is free.** There is no filter panel — every search goes through the agent, and quick chips are canned prompts. But the map is always explorable: pan, zoom, tap a pin for details, with "Ask Pitchd about this site" to bring the agent in. (See `decisions.md`.)
10. **No home screen — the map is home.** The app opens on the map with the sheet collapsed: a greeting, context-aware chips and the input. An upcoming trip leads as a card; saved trips and recent conversations live in the expanded sheet. Location is asked in context, never on launch. (See `decisions.md`.)

## 5a. Visual identity (in progress — see `decisions.md`)

Refresh, not rethink. Decided so far:
- **Palette (B1):** forest, sage and warm neutrals do most of the work; **coral means Pitchd** — the wordmark "d", the send button, the top pick and the agent's mark, nothing else. Coral text uses a darker coral ink for contrast. Weather has its own colours and is never coral.
- **Dark mode (B2):** light and dark both designed; follows the phone, with a System / Light / Dark override. Dark is a warm green-black, the map switches to its night preset, and coral keeps its job.

Still open: sunlight contrast, weather-state colours, wordmark at icon size + app icon, the agent-presence mark, type.

## 6. What the agent is (and isn't)

**Is:** a planner for camping trips in Australia, grounded in Pitchd's campsite, amenity and weather data.

**Isn't (for now):** a general travel chatbot, a booking engine, or a source of facts it can't back with data. Off-topic asks get a friendly redirect.

**Personality (decided):** a knowledgeable local mate — straight answer first, practical, honest about uncertainty, lightly Aussie, brief, no hype. Safety (fire bans, closures, floods) always surfaced first. Full detail in `decisions.md`.

## 7. Personas, revisited

- **Matt (primary)** — the revamp's first user is effectively the founder, who is Matt. Optimise for the weekend-decision flow first.
- **Sarah (secondary)** — multi-day, route-based planning was post-MVP before. An agent makes it far more feasible (itinerary = a sequence of tool calls). **Decided:** trips are ordered stops from day one and "on the way" amenities ship in the first build; full itineraries (days split by drive limit, a site per night, per-day weather, caravan constraints, route line + day-by-day cards) come in roadmap phase 5b, straight after evals and before the stage 2 caravan tester.

## 8. Success signals (draft)

- Time from opening the app to a committed trip (target: < 5 minutes, vs 1–2 hours today)
- Share of sessions ending in a saved trip
- How often the top pick is the one chosen
- "Would you have found this yourself?" — qualitative, from the founder's own trips first
- Cost per planned trip (keeps the scaling story honest)
