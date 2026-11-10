# Decision Log

> Newest first. Each entry: decision, why, and what would make us revisit it.

## 2026-11-10 — Visual identity B1 · Palette: keep the family, give each colour one job
- **Decision (option B):** keep forest / sage / warm neutrals with coral, and tighten the roles. Sketch: https://claude.ai/artifact/Sd5Bg25avPg9ohMpCzxhDB
  | Colour | Token (v1 value) | Job |
  |---|---|---|
  | Warm neutrals | `SURFACE` #f7f5f0, white cards, `BORDER` #e0dbd0 | Most of the screen |
  | Forest | `FOREST_GREEN` #2d4a2d (`TEXT` #1a2e1a for body) | Headings, the agent's summary line, "Pitch" in the wordmark, user bubbles |
  | Sage | `SAGE` #5a7a5a | Secondary text, chip labels, step lines — **one** sage (the prototype's #7a9e7a and #4a6a4a are retired) |
  | **Coral = Pitchd** | `CORAL` #e8674a | Only: the wordmark "d", the send / primary action, the top-pick outline, and the agent's mark (B6). At most one or two coral things on screen |
  | Coral ink *(new)* | #b84a33 | Coral **text** ("Top pick", links) — 4.7:1 on the background; v1's coral text is 3.0:1 |
  | Weather | decided in B4 | Its own set — **never coral** |
- **What changes from v1:** coral stops meaning "poor weather" (`weatherScore.ts` uses #e8674a for the Poor badge and severe strip) and stops being used for text; duplicate prototype tokens are merged.
- **Rejected:** A, keep v1 exactly (coral does four jobs, so a wet day looks like a highlight; coral text fails AA); C, ochre accent (sits next to the showers amber, blurs top pick and showery days; changes the wordmark); D, new "night sky + campfire" identity (loses the outdoorsy warmth; closer to generic tech apps; same accent-vs-weather clash).
- **Why:** the palette isn't the problem — overloading one colour is. Coral meaning only "Pitchd" lets it carry into the agent's mark, and frees the weather colours for B4. Keeps v1's recognition.
- **Still to tune:** exact values for dark mode (B2) and sunlight (B3) — roles stay as above.
- **Revisit if:** sunlight testing (B3) shows the forest/sage contrast isn't enough outdoors → darken values, not change hues.

## 2026-11-10 — Offline & patchy signal: cope with weak signal now, trip pack later, offline maps with native
- **Decision (option C, in two steps):**
  1. **First build** (needed for any real phone use):
     - **Designed offline / weak-signal states** — a clear banner ("No signal — showing your saved trip from 2:10 pm"), never a broken spinner.
     - **Answers survive dropouts** — the stream resumes where it stopped, cards already shown stay put, automatic retries with timeouts.
     - **Saved trips viewable offline** (PWA service worker + local cache) — trip card and details, facts, last forecast with its timestamp, booking and directions links, the trip's conversation. "Open in Google Maps" still works with Google's own offline maps.
  2. **With the "On the trip" stage (later):**
     - **Trip pack** — downloaded on save and again at the day-before check (Q5): dump points, water, toilets and fuel within ~50 km of each stop, plus the latest forecast and fire danger rating. Shown as a list with distances, no map: "Saved for offline: forecast, fire danger and 12 amenities near Lake Burrendong."
     - **Queued messages** — typed offline, sent and answered when signal returns, with a note saying so.
- **Native later:** offline maps and offline amenity search for a downloaded region (map tile licensing — Mapbox's offline support is aimed at its mobile SDKs; check terms before any web tile caching).
- **Rejected:** online only (fails exactly when Sarah needs a dump point); saved trip only (weak signal, which is far more common than none, would still break answers mid-stream); full offline now (native-level work plus tile licensing).
- **Why:** weak signal hits every user, so handling it is core, not an extra; a saved trip that opens offline is cheap and matters most at camp; the trip pack makes the last thing Pitchd tells you before losing signal — weather, fire danger, nearest dump point — available offline; full offline maps are already a listed trigger for going native.
- **Revisit if:** real trips show the trip-pack list isn't enough without a map → that's the go-native signal.

## 2026-11-10 — Sarah's multi-day route planning: model for it now, build it straight after evals
- **Decision (option B):**
  1. **First build:** a trip is an ordered list of stops from day one (a weekend trip is one stop) — no migration later. "On the way" amenities ("dump point or fuel on the way to X") are in, using the already-planned `find_amenities` along a route.
  2. **New roadmap phase 5b — Multi-day trips, straight after evals:** route geometry; split the route into days by daily drive limit with one site per night; per-day weather — forecast within ~a week, beyond that typical conditions for the time of year (clearly labelled) and re-checked as the date nears; caravan constraints (access, length, dump points) from the data agent's facts. UI: route line on the map and day-by-day cards in the sheet's carousel; tapping a day centres the map on that leg — no new layout.
  3. **Gate:** ready before the stage 2 caravan tester is invited.
  4. **Evals:** Sarah's killer query plus 2–3 variants go into the phase 5 eval set from the start, so the gap is measured before the feature exists.
- **Rejected:** in the first build (doubles the riskiest phase, delays the founder's real weekends); after weather watch (the stage 2 caravan tester would get an app that can't do her main trip; retrofitting multi-stop costs more); only if testers ask (Sarah's pain is already known).
- **Why:** the weekend flow is the founder's own use and the riskiest part, so it goes first; modelling stops now is nearly free and changing it later isn't; building right after evals means the more complex agent is measured, not guessed; lands in time for the tester it's for.
- **Revisit if:** phase 5 evals show the single-stop agent isn't reliable yet → fix that before starting 5b; or the founder starts planning multi-day trips themselves → bring 5b forward.

## 2026-11-10 — Campsite availability: know, link, warn — no availability claims
- **Decision (option B):** Pitchd knows whether a site needs booking, gives a one-tap "Check & book" link, warns in busy periods and offers a backup. It never claims a site is available unless it actually checked.
  - **Data:** the data agent adds sourced booking facts like any other `CampsiteFact`: `booking` (required / first_come / unknown), `booking_url` + provider (NSW Parks, Parks Vic, Hipcamp, park's own site), and `fee`.
  - **Cards:** one line — "Book ahead · NSW Parks ↗" / "First come, first served" / "Booking unknown — check before you go". The link opens the official booking page (dates pre-filled where the site allows). Pitchd never handles bookings or payments (keeps E's scope).
  - **Agent wording:** "Bookable, but I can't see availability — tap to check before you lock it in."
  - **Busy periods:** public holidays, school holidays (by state) and long weekends, from a small calendar table in code. In a busy period the agent says so ("It's the long weekend — book now") and automatically includes one first-come backup.
  - **Commit:** saving a trip on a booking-required site adds a "Booked?" tick; until ticked, the home-sheet trip card shows "Not booked yet".
- **Later:** live availability checks (option C) as a spike — NSW parks first, only after a terms-of-use check; only for the top 2–3 picks, only when asked ("is it free?") or on save; always timestamped ("Free Sat–Sun, checked 8:40 pm"); on failure fall back to B, never guess. Partner APIs (D) only at scale.
- **Rejected:** website link only (you find out it's booked out after deciding); live checks now (fragile pages, unchecked terms, slower answers, too big too early); partner APIs now (need commercial agreements).
- **Why:** solves most of the real problem — know whether to book, book in one tap, have a backup when it's busy — at almost no cost; keeps "honest about uncertainty"; fits the data agent's provenance model; leaves a clear path to real checks.
- **Revisit if:** the founder's trips keep hitting booked-out picks despite the link and warnings → bring the live-check spike forward.

## 2026-11-10 — Voice: dictation into the input box now; full voice mode with native
- **Decision (option B):** a mic button in the input uses the browser's speech recognition; the words appear in the input box, the user checks and taps send. Auto-send after a pause can be tested later.
  - **Fallback:** where the browser has no speech recognition (patchy on iPhone, especially as a Home Screen app), hide the mic and rely on the keyboard's dictation key.
  - **Misheard place names** are the agent's job, not the speech layer's: `geocode` matches loosely ("Gan Guddy" → Ganguddy) and asks "Did you mean…?" only when it's unclear (per the ask-or-assume rules). Misheard names become eval cases.
  - **No spoken replies yet** — the answer is cards and the map.
- **Rejected for now:** no voice (hides a real use case); push-to-talk with our own transcription (per-use cost, another service, more latency and privacy questions — the next step only if B fails); full voice mode (big build, loses cards and map, unsafe for a driver looking at the screen — belongs with native / CarPlay / Android Auto).
- **Why:** covers the real cases (passenger in the car, hands busy at camp) for almost no cost; seeing the transcript before sending protects accuracy; keeps the learning focus on the agent; full voice raises driving-safety questions a web app can't answer well.
- **Revisit if:** dictation often mishears place names on the founder's phone → move to our own transcription; voice gets used a lot on trips → plan a voice mode for the native app.

## 2026-11-10 — Proactive alerts: in-app card + web push, email fallback, strict triggers
- **Channels:** the home-sheet trip card (Q2) always shows changes on open; **web push** is the main out-of-app channel; **email** is the fallback for anyone without push (notably iPhone users who haven't added Pitchd to their Home Screen — iOS web push only works for installed PWAs). No SMS.
- **Opt-in per trip:** on saving a trip, Pitchd asks "Want me to watch the forecast for this trip?" — and asks for push permission then, when the value is obvious. Never on first open.
- **Triggers:**
  | Trigger | Alert? |
  |---|---|
  | Material forecast change — a day goes dry → rain, strong wind, extreme heat | Yes, with 2–3 alternatives |
  | Small wobble (e.g. 20% → 30% rain) | No — trip card updates only |
  | **Safety** — total fire ban, park/road closure, flood warning for the site | **Always**, for any saved trip even without weather opt-in; push + email |
  | Day before departure | One final check: "Still dry — have a good one", or a warning |
- **Limits:** max one weather alert per trip per day; quiet hours 9 pm–7 am local (the trip's or user's time zone), except safety alerts within 48 h of the trip. Every alert opens the trip's conversation with alternatives ready — never a bare "it might rain".
- **Rejected:** in-app only (you'd hear about Thursday's change too late); email only (slow to notice, heavy for a weather nudge); SMS (per-message cost, phone numbers, too much for weather).
- **Why:** the value of watching is hearing in time to act; push fits the "mate keeping an eye out" role and email leaves nobody out; strict triggers keep alerts rare enough not to be ignored; safety-always matches E's "safety first".
- **Build note:** roadmap phase 6 (background weather watch). "Material change" thresholds live in code and get eval/backtest cases, not left to the model. Log every alert sent and whether it was opened.
- **Revisit if:** web push proves unreliable or Add-to-Home-Screen friction blocks most iPhone users → the trigger to go native (see the platform decision); or alerts get ignored → raise thresholds.

## 2026-11-10 — Memory: what's remembered, and how it's seen and edited
- **What's remembered:**
  | Kind | Examples | Rule |
  |---|---|---|
  | **Stated about yourself** | Dog (name, "on a lead is fine"), setup (car camping / tent / 17 ft van, 2WD / 4WD), home base, drive tolerance, who usually comes, must-haves (toilets, showers) | **Saved automatically** when said clearly, with a visible "Remembered · Undo" note |
  | **Inferred from behaviour** | Prefers showers (last 4 picks), favourite regions, shorter drives in winter | **Ask first** ("Want me to remember you prefer showers?") — never saved silently |
  | **Trip history** | Saved trips, ratings, places been | **Kept automatically** — it's the user's own record; powers "same as last time" / "somewhere new" |
  | **Conversations** | Past threads | Kept and resumable; only become memory through the two rules above |
  | **Never kept** | Location history (only a stated home base), anything not about camping | Not stored |
- **How it's seen and edited (option D — all three):**
  1. **Inline when saved:** "Remembered: 17 ft van · Undo" under the agent's message.
  2. **Visible when used:** memory that shapes an answer shows in the assumption chips ("With Bindi 🐕", "Van-friendly").
  3. **"What Pitchd knows" list** in the expanded sheet (behind the avatar): each fact shows its source ("you said, 3 Nov"), can be edited or deleted; "Forget everything" at the bottom.
  4. **By conversation:** "I've got a 4WD now" updates the fact and shows the same note.
- **Rejected:** settings page only (memory hidden at the moment it matters); inline only (no overview); conversation only (can't see what it knows).
- **Why:** no setup form — "asked once, used forever"; asking before saving inferences keeps memory accurate and avoids "why does it think that?"; showing memory when used builds trust with an audience that left WikiCamp over trust; the overview and "Forget everything" make it ready for more users, not just the founder.
- **Build note:** each fact stores value + source (stated / inferred-confirmed) + date, mirroring `CampsiteFact` provenance. Lands in roadmap phase 4 (Memory & state).
- **Revisit if:** the "want me to remember?" prompts feel naggy in real use → batch them (at most one per conversation) or raise the evidence bar.

## 2026-11-10 — Ask or assume: assume and show; ask only when it really matters
- **Decision:** Pitchd fills gaps with sensible defaults and shows them as editable chips. It asks **one** question (with tap answers) only when there's no sensible default **and** a wrong guess would ruin the answer.
- **Defaults (no question):**
  | Missing | Default |
  |---|---|
  | Dates | Next weekend (Fri pm–Sun); from Sunday evening, the following weekend |
  | Starting point | Current location → home base |
  | Drive time | Remembered limit → ~3 h |
  | Dog, setup, amenities | Remembered values → nothing assumed |
- **Ask only when:**
  1. **No starting point at all** (no location, no home base) — "Where are you heading from?"
  2. **Too vague to search** ("somewhere nice", nothing else) — "Coast, mountains or inland?"
  3. **A wrong guess could be unsafe or a dead end** and Pitchd doesn't know yet — e.g. setup when the best options are on dirt roads: "Towing a van, or car camping?"
- **Ask once, remember forever:** questions about *you* (dog, setup, drive tolerance) are asked once and saved to memory; questions about *the trip* (dates, region) are asked fresh when they can't be defaulted.
- **Assumption chips:** 3–4 per turn, guessed values first and styled differently from what the user actually said. Tapping one offers quick alternatives; picking one re-runs only what changed.
- **Rejected:** ask first (slow, form-like, fails the Thursday-night test); always assume (some gaps have no default; wrong guesses can be unsafe); ask and answer at once (two things to read; the answer shown may be the wrong one).
- **Why:** one turn to an answer for most requests; never wastes a search on a guess that couldn't work; questions get rarer with use; the rules are concrete enough to become eval cases ("should it have asked here?").
- **Revisit if:** evals or the founder's trips show frequent wrong defaults (adjust the defaults) or users re-editing the same chip every time (it should be remembered).

## 2026-11-10 — Home screen: none — open on the map, the collapsed sheet is home (+ trip card)
- **Decision:** no separate home screen. The app opens on the map (centred on the user, their home base, or an upcoming trip) with the sheet collapsed. Sketch: https://claude.ai/artifact/APTJwNAEX32ahex7iyqNZp (wireframe only).
  - **Normal day:** a short greeting ("Evening Matt — where to this weekend?"), 3–4 quick chips and the input. Chips adapt to context: day of week ("Dry this weekend" on Thu/Fri), location ("Dump point near me" away from home), remembered preferences ("Dog-friendly within 2 h").
  - **Upcoming trip:** its card leads the sheet ("Lake Burrendong · in 3 days · still dry", with weather days); tapping it reopens that trip's conversation; chips switch to trip tasks (packing list, plan something else). Until the background weather watch exists (phase 6), the card refreshes the forecast on open.
  - **Forecast turned (later, with weather watch):** the card flags the change and Pitchd offers alternatives, not just a warning.
  - **First run:** same screen with a one-line intro. Location is asked in context (a "Use my location" chip or a "near me" ask), never on launch; without it the map shows the whole state and the agent asks where you're starting from.
  - **History:** saved trips and recent conversations live in the expanded sheet — no separate screen or menu.
- **Rejected:** a v1-style separate home screen (two screens and a jump between them, the mode split we removed; an extra step every visit); opening with the sheet expanded (hides the map, which is the canvas).
- **Why:** one screen, one mode from the first second; Thursday-night Matt can type within a second of opening; the map is the most useful first view; the trip card brings the "Watch" stage forward without needing push notifications.
- **Revisit if:** new users in stage 2 don't understand what to do on first open → add a richer first-run sheet, not a separate screen.

## 2026-11-10 — Layout: map-first with a two-snap conversation sheet (option A)
- **Decision:** a full-screen map with a bottom conversation sheet that has exactly two snap points. Sketch: https://claude.ai/artifact/PoaxgiCsEUwqkMZC4gfgFh (wireframe only, not the visual design).
  - **Collapsed (~35–40%):** the current turn only: the agent's summary line, assumption chips, a sideways card carousel synced with the pins (swipe a card → map pans to it), and the input box.
  - **Expanded (~90%):** the full thread: earlier turns, the agent's step lines, cards, chips, input.
  - **Rules:** no half state; the input box is visible in both states; tapping a pin or card while expanded drops the sheet to collapsed and centres the map on it.
  - **Desktop:** the same pieces in a fixed left sidebar (~400 px) next to the map. No sheet, so no gestures.
- **Rejected:** B (conversation-first, map as a strip) — the agent's work no longer plays out on the map; C (Map ⇄ Chat tabs) — brings back two modes, v1's core problem; D (floating input + carousel, no thread) — kept as the fallback shape.
- **Why:** the only option where the map stays the canvas *and* the conversation drives it; two snap points directly address v1's glitchy, over-loaded drawer; borrows D's carousel, the best part of D.
- **Next:** prototype the sheet on a real phone (with `vaul` or similar) before building around it; the visual design is a separate, later pass.
- **Revisit if:** the collapsed sheet feels cramped on a real phone → first move the chips to the expanded view; only then fall back to D's shape.

## 2026-11-10 — Staged rollout: founder → trusted campers → closed beta
- **Stage 1 — founder only.** Move on when: ~3 real trips planned in v2; data pilot ≥ 90% accurate on high-confidence facts; cost per planned trip known; per-user rate limits and cost caps in place.
- **Stage 2 — 3–5 trusted campers.** Deliberately varied: a caravan / long-trip camper (Sarah), a dog owner, a non-technical user, ideally someone outside Sydney. Invite-only via roles; short post-trip check-ins. Move on when they plan real trips unaided and the main confusions are fixed.
- **Stage 3 — closed beta, 20–50 users.** Displaced WikiCamp users from AU camping Facebook groups, Reddit, Whirlpool. Waitlist, invites in batches, in-app feedback ("Was this a good pick?"). Move on (wider launch, native) when people return unprompted and cost per user is sustainable.
- **Why:** the founder's phrasing is a narrow test set; every agent turn costs money; this audience's trust is fragile; varied testers cover both personas; each stage feeds the eval set.

## 2026-11-10 — v1 is frozen; retired once v2 handles real trips
- **Context:** the founder is v1's only user.
- **Now:** freeze v1 — no new features, M7 polish stops. Only fix what blocks the founder (login, outages). Close or label open M7 issues/PRs "v1 frozen"; carry anything worth keeping into v2's backlog.
- **Meanwhile:** v1 stays live at `pitchd-app.vercel.app` as the founder's fallback for real trips and a reference for behaviour and data.
- **Retirement bar:** ~3 real trips planned end to end in v2 without needing v1 (founder's judgement — can be sooner).
- **On retirement:** point the URL/domain at v2, archive the `pitchd-app` repo read-only, take a final DB backup, then pause/delete v1's Supabase project.
- **Why:** focus for a solo builder learning a new stack; no gap without a working app; makes the separate-database decision safe; a concrete exit stops v1 lingering. No user comms needed.

## 2026-11-10 — Agent personality, scope and safety
- **Personality:** a knowledgeable local mate — straight answer first, practical, honest about uncertainty and data freshness, warm and lightly Aussie (natural AU English, no forced slang), brief (2–4 sentences + cards), no hype.
- **Scope:** clearly about camping trips — sites, weather, drive times, amenities, dog rules, multi-stop trips, packing, what to know before you go. Trip-adjacent asks (coffee/servo on the way) are fine when tools cover them; general chat, bookings/payments, and anything it can't back with data get a friendly redirect.
- **Safety first:** fire bans, closures and flood warnings are surfaced prominently, even unprompted. Emergencies → 000 and official sources; never improvised safety advice; never claims certainty about road access, water or safety.
- **Locale:** Australian English spelling, metric units, local time zones (multi-state trips cross zones).
- **Memory:** trip-relevant facts (dog, setup, home base, favourite regions, drive tolerance) remembered automatically, always visible and editable; nothing else without asking. *Detailed in the Memory entry above.*
- **Why:** a frequent-use companion needs a voice that wears well; trust is the product; mobile, time-pressed use; focused scope makes a better, cheaper, more testable agent; outdoor safety is a real-world harm and a differentiator.
- **Revisit if:** the founder's own use finds the voice too flat or too chatty.

## 2026-11-09 — New `pitchd-v2` repo + separate Supabase project
- **Repo:** new `pitchd-v2` repo containing `web/` (Next.js thin client), `agent/` (Python planner + data agent, tools, prompts, evals), `docs/` (moved from `docs/revamp/`), and a fresh `CLAUDE.md`.
- **Database:** a new Supabase project for v2. Campsite + amenity data copied across once; v2 owns its schema; the data agent can't affect live v1.
- **Why:** v1 stays live and untouched; v1 conventions don't leak into v2; web + agent change together so they share one repo; useful v1 code (OSM ingestion, weather scoring) is ported, not depended on.
- **Trade-off accepted:** data improvements in v2 don't flow back to v1 (ties to question F).
- **Next step:** founder creates an empty `pitchd-v2` repo on GitHub and starts a session with it; harness workflow is set up before any code.

## 2026-11-09 — Platform: mobile-first web app first, native later
- **Decision:** v2 starts as a mobile-first web app (Next.js PWA). A native app (likely React Native / Expo) comes later.
- **Why:** Keeps learning focus on agents rather than a new frontend framework; fastest way to iterate on the risky part (the agent experience); reuses known stack and Vercel; desktop planning comes free.
- **Built for native from day one:** all logic lives in the Python agent service behind a clean streaming API; the web app is a thin client, so native is a new frontend, not a rewrite.
- **Sheet risk:** use a proven web bottom-sheet library (e.g. `vaul`) and prototype on a real phone first. If it still feels glitchy, that's an early signal to go native sooner.
- **Go native when:** weather-watch push alerts, offline use at camp, or sheet/map smoothness become the bottleneck — most likely around roadmap phase 6.

## 2026-11-09 — Keep the name "Pitchd" for v2
- **Why:** Short, memorable, the camping pun still fits an agent companion, and it's already live.
- **Visual identity refresh — in progress (B1–B7).** B1 palette decided (see the B1 entry above). Original recommendation: keep the core palette (forest / sage / warm neutrals, coral used sparingly) but refresh — add dark mode, check sunlight contrast, give weather states distinct colours, test the wordmark at icon size, and design a small mark for the agent's presence. Define the agent's voice as part of the brand (ties to open question E).

## 2026-11-09 — All search is agent-driven; map browsing kept
- **Decision:** Remove direct search from the UI — no filter panel, no filter state, no direct search API calls from the frontend. Every search goes through the agent (typed, spoken, or via prompt chips).
- **Kept:** Viewing, not searching — pan/zoom the map, tap a pin for details ("Ask Pitchd about this site"), saved trips.
- **How:** Quick chips become canned prompts sent to the agent. The agent's assumptions show as editable chips; tapping one sends the change to the agent. The existing `/api/search` pipeline becomes the agent's deterministic `search_campsites` tool — scoring stays in code.
- **Why:** One mental model ("talk to Pitchd"), a sharper identity than "a map directory with AI", a simpler UI, and every search becomes eval data.
- **Trade-offs accepted:** Higher per-search cost and latency; dependency on the Claude API. Mitigations: low effort + one tool call for simple asks, stream first pins fast (target ≤ ~2 s), caching, a degraded mode on API outage (saved trips + last results).
- **Revisit if:** Logs show users fighting the agent for simple lookups → add a hidden router first, not a filter panel.

## 2026-11-09 — Add a data agent track for campsite data quality
- **Why:** Bad/stale amenity data is a core persona pain and the main reason users are leaving WikiCamp. The planner is only as trustworthy as its data. Background enrichment is cheap, low-risk, easy to evaluate, and helps v1 immediately.
- **Rules:** agents propose changes to a review queue (never overwrite live data); every fact carries source + checked date; official sources outrank OSM.
- **First step:** single-region pilot (Blue Mountains, 50–100 sites) — likely the first agent built.
- **Revisit if:** accuracy on the hand-reviewed sample stays below ~90%, or cost per site is too high.

## 2026-11-09 — The agent is the focal point of Pitchd
- **Why:** The real value is deciding where to go and keeping the plan right, not just searching. An agent can compare, explain trade-offs, and follow the trip over time.
- **Revisit if:** Founder's own trips show the map-first search is faster for most cases.

## 2026-11-09 — Python agent service, Next.js frontend kept
- **Why:** Python has the largest body of agent examples, courses and eval tooling — good for the learning goal — and the skills transfer to other AI work. Next.js/Vercel already handles auth, map and UI well.
- **Trade-off accepted:** Two languages and two deployments.
- **Revisit if:** The two-service overhead outweighs the learning value; a TypeScript agent inside Next.js is a viable alternative.

## 2026-11-09 — Build the agent loop by hand first, then adopt SDK helpers
- **Why:** Learning goal — understand the loop before abstracting it.

## 2026-11-09 — Start with one user, design for scale
- **Why:** The founder is the first real user (persona: Matt). Keep state out of the service process, log costs and tool calls, and add rate limits so scaling is a config change, not a rewrite.

## 2026-11-09 — Keep the current app live during the revamp
- **Why:** M1–M6 works and is deployed; the revamp is exploratory.
