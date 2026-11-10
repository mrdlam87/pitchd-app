# Decision Log

> Newest first. Each entry: decision, why, and what would make us revisit it.

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
- **Memory:** trip-relevant facts (dog, setup, home base, favourite regions, drive tolerance) remembered automatically, always visible and editable; nothing else without asking.
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
- **Still open (recommendation, not yet decided):** keep the core palette (forest / sage / warm neutrals, coral used sparingly) but refresh — add dark mode, check sunlight contrast, give weather states distinct colours, test the wordmark at icon size, and design a small mark for the agent's presence. Define the agent's voice as part of the brand (ties to open question E).

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
