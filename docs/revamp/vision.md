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
4. **Remember me.** Dog, setup (car camper / caravan), favourite regions, how far I'll drive — asked once, used forever (and editable).
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
| **Describe** | Types or speaks a trip in plain English; quick-start chips for common asks | Asks at most one clarifying question if something essential is missing (e.g. dates); otherwise makes sensible assumptions and states them |
| **Agent works** | Sees progress *on the map*: regions being checked, weather overlays appearing, candidate pins dropping in | Streams tool activity as human steps: "Checking weather around Mudgee, Blue Mountains, Hunter…" |
| **Proposal** | A short ranked shortlist (≈3), a clear top pick, one-line reason each, trade-offs called out | Ranks on weather + drive time + fit to preferences; explains the trade-off between top options |
| **Refine** | "Closer", "drier", "somewhere with a shower" — by chat or refinement chips; tap a pin to ask "why this one?" | Keeps the conversation context; re-runs only what changed |
| **Commit** | Saves the trip (site, dates, who's coming, setup) | Writes to the trip store; offers a packing list matched to the forecast |
| **Watch** | Gets a nudge if the forecast turns: "Saturday now 70% rain at X — want alternatives?" | Background job re-checks saved trips; proposes options rather than just alerting |
| **On the trip** | Nearby dump points, water, fuel, toilets; works on patchy signal | Lightweight queries; cached data where possible |
| **Reflect** | Quick rating ("great site, too windy") | Updates preferences and adds signal for future ranking |

MVP of the revamp = **Describe → Agent works → Proposal → Refine → Commit**. Watch, On the trip, Reflect come later.

## 4. Interface principles

1. **The map is the shared canvas; the conversation drives it.** Not a chat app with a map bolted on, and not a map with a chatbot bolted on. The agent's work shows up spatially. Candidate layout: map full-screen, a conversation sheet that replaces today's results drawer (peek / half / full), keeping Session 1's drawer model.
2. **Tap and talk are equal.** Anything you can say, you can usually tap (chips, pins, cards), and anything you tap becomes context for the agent. Typing should never be mandatory for a refinement.
3. **Show the work, briefly.** Visible progress builds trust and hides latency, but keep it to short step lines — no walls of reasoning.
4. **Answers are structured, not just prose.** The agent returns cards (site, weather days, drive time, why) rendered by the UI, with a short natural-language summary on top. The existing card + weather-pin conventions carry over.
5. **Assumptions are visible and editable.** "Assuming this weekend (Sat–Sun), 3 hr from Sydney, with your dog" as tappable chips the user can change.
6. **Honest when it can't.** No dry sites within range → say so and offer the trade-off ("dry if you drive 4.5 h, or showers Sunday morning only at X").
7. **Search is agent-only; viewing is free.** There is no filter panel — every search goes through the agent, and quick chips are canned prompts. But the map is always explorable: pan, zoom, tap a pin for details, with "Ask Pitchd about this site" to bring the agent in. (See `decisions.md`.)

## 5. What the agent is (and isn't)

**Is:** a planner for camping trips in Australia, grounded in Pitchd's campsite, amenity and weather data.

**Isn't (for now):** a general travel chatbot, a booking engine, or a source of facts it can't back with data. Off-topic asks get a friendly redirect.

**Personality (draft):** friendly, concise, practical, a bit Aussie but not a caricature. Gives a straight answer, then the reasoning.

## 6. Personas, revisited

- **Matt (primary)** — the revamp's first user is effectively the founder, who is Matt. Optimise for the weekend-decision flow first.
- **Sarah (secondary)** — multi-day, route-based planning was post-MVP before. An agent makes it far more feasible (itinerary = a sequence of tool calls), so it's a strong candidate for revamp phase 2.

## 7. Success signals (draft)

- Time from opening the app to a committed trip (target: < 5 minutes, vs 1–2 hours today)
- Share of sessions ending in a saved trip
- How often the top pick is the one chosen
- "Would you have found this yourself?" — qualitative, from the founder's own trips first
- Cost per planned trip (keeps the scaling story honest)
