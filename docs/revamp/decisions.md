# Decision Log

> Newest first. Each entry: decision, why, and what would make us revisit it.

## 2026-11-10 — User reports (Q22): camper notes now, facts change only after a check
- **Decision (option C):**
  1. **A report never changes a fact by itself.** Facts change only via an official-source re-check by the data agent or a human review.
  2. **It shows at once as a dated camper note** beside the official fact ("A camper reported the showers broken 3 days ago — not yet confirmed"); the planner mentions it when relevant.
  3. **It bumps the site to the front of the data agent's re-check list** and lands in the review queue.
  4. **Camper notes expire** after ~30 days unless reported again — they describe temporary conditions.
  5. **Counting:** signed-in users only; one report per person per site per fact; 2+ different campers within 30 days → top of the queue, marked "likely".
  6. **Cautious reports** ("closed", "no water", "road impassable") show as a warning on the site immediately — same asymmetry as Q19.
  7. **Later (stage 2):** per-user report rate limits; per-reporter trust scores only if logs show a need.
- **Rejected:** A — queue only (others see nothing, even "closed"); B — N reports auto-change a fact (gameable; a true "closed" waits for more people); D — trust scores (overkill for an invite-only beta).
- **Why:** campers get today's news immediately, the official record stays clean, and repeated reports can't rewrite facts.
- **Revisit if:** reports are frequent and accurate enough that waiting for a check is the bottleneck, or abuse appears.

## 2026-11-10 — Source access (Q21): open data first, then polite reads of approved official sites
- **Decision (option B, with C later):**
  1. **Open data first** (data.gov.au, data.nsw, OSM) wherever a feed exists; read web pages only for facts feeds don't carry (dogs, showers, booking).
  2. **Source allowlist in code.** The agent may fetch only listed domains — also stops a planted link steering it (data-agent rule 6).
  3. **Terms check before a source is added.** Each entry records licence, terms URL, robots.txt result and date checked. NSW National Parks is checked before the pilot (not verified from this session — the site was outside its network allowlist; search results suggest CC BY 4.0 with exclusions).
  4. **Polite fetching:** generic bot user agent with the Pitchd URL (no personal details), obey robots.txt, a few seconds between requests per host, off-peak runs, no repeat fetches within a run.
  5. **Store facts, not pages:** the fact, a short evidence quote and the source URL. The UI credits and links the source ("Source: NSW National Parks").
  6. **Recheck each source's terms before charging money (stage 2+)** — CC BY usually allows commercial use with attribution, but excluded material doesn't.
  7. **Later (C):** once the pilot has results, ask NPWS and Parks Victoria about an official feed or closure alerts. Not on the critical path.
- **Found so far:** no NSW open campground dataset with facility detail. Useful feeds: NPWS Estate (park boundaries, CC BY, quarterly), NPWS facilities geodatabase (may include campgrounds — check fields), TfNSW NSW Rest Areas, data.gov.au open space layer.
- **Rejected:** A — open data only (doesn't carry the facts that matter); D — fetch anything reachable (terms breaches, blocking, junk sources).
- **Why:** gets the key facts from the official source, within each site's rules, and keeps the agent on vetted sites.
- **Revisit if:** a source refuses or blocks automated access (drop it, or ask permission), or an authority offers a feed.

## 2026-11-10 — Review UI (Q20): terminal tool for the pilot, admin page at D3
- **Decision (option B, then A):**
  - **Pilot: a terminal review tool** (`pitchd review`) in the data agent's CLI. Shows one proposal at a time — site, current value, proposed value, source link and quoted evidence — with keys for approve / reject / skip and a right/wrong verdict.
  - **One review code path.** Approve/reject and verdicts go through shared review functions that also update the per-key trust table (Q19). Nothing edits `status` directly.
  - **Read-only CSV export** of past verdicts for accuracy reports — never imported back.
  - **Later (D3, when the data agent is scheduled): an `/admin/review` page** in the v2 web app, `admin` role only, served through the agent API and calling the same review functions — a new screen, not new logic. Built when the queue becomes a few items a week worth clearing from a phone.
- **Rejected:** A first — blocks the pilot on the v2 web app, auth and API; C spreadsheet round-trip — import errors and stale copies; D Supabase table editor — raw JSON, no evidence view, bypasses the trust table.
- **Why:** reviewing can start now with almost nothing to build, every verdict is recorded in one place, and the nicer screen comes when it's needed.
- **Revisit if:** the pilot review is slow enough in a terminal that a basic page would pay for itself sooner.

## 2026-11-10 — Auto-approve threshold (Q19): earn trust per kind of fact
- **Decision (option C):**
  1. **No-change re-checks apply straight away.** A re-check that finds the same value only updates `checkedAt` — not a change, no review. This is most of the volume after the first pass.
  2. **Pilot: every real change is human-reviewed.** That review is needed anyway to measure the ≥ 90% target, and each verdict is recorded (it is the first eval set).
  3. **After the pilot, auto-approve is switched on per fact key** (`toilets`, `dogs_allowed`, …) once the agent's proposals for that key have matched the reviewer ≥ 95% over ≥ 30 reviews — and even then only for `official` sources at `high` confidence.
  4. **Cautious changes apply at once and are flagged.** An official source saying "closed" or "no dogs" goes live immediately (shown to users) and still lands in the queue for a look. Wrongly cautious costs a different campsite; wrongly permissive sends someone to a closed site or a fine.
  5. **Spot checks:** ~1 in 20 auto-approved changes is sent to the queue at random. If a key's agreement drops below 95%, its auto-approve switches off automatically.
  - Rules live in code (a small per-key trust table: reviews, agreements, enabled), never in the prompt. The model never decides whether its own proposal is approved.
- **Rejected:** A — review everything (≈1,000 items for the pilot, doesn't scale); B — official + high confidence from day one (trusts extraction before it's measured); D — the model decides (it would approve its own work; breaks data-agent rule 6).
- **Why:** as safe as A during the pilot at no extra cost, as cheap as B once trust is earned, and trust is evidence-based per fact.
- **Revisit if:** the review queue is still too big after the pilot (lower the 30-review bar or widen to council sources), or spot checks keep catching errors on an enabled key.

## 2026-11-10 — Models (Q13): Sonnet planner + Haiku sub-tasks to start; phase 5 evals pick; cheap to switch
- **Decision (option B) — starting roles:**
  | Job | Model | Effort |
  |---|---|---|
  | Planner (user-facing) | Sonnet 5.5 | Medium; low for simple asks ("dump points near Mudgee") |
  | Small sub-tasks (stated-fact detection for memory, conversation titles, step-line wording) | Haiku 5.5 | Low; small prompts |
  | Data agent extraction | Haiku 5.5 via the Message Batches API | Sonnet 5.5 only for source conflicts |
  | Eval grader | Opus 5.5 | Offline, low volume — stronger than what it grades |
- **How phase 5 chooses:** run the 20–50 query eval set across Haiku 5.5 (medium / high), Sonnet 5.5 (low / medium / high) and Opus 5.5 (low / medium). Score answer quality, cost per trip, time to first pins (~2 s target), and ask-or-assume correctness. **Pick the cheapest setup that passes the quality bar within ≤ US$0.30 a trip (Q17).** Haiku is the one to beat (~20× cheaper). Try the same model at lower effort before building any router — simpler, and one prompt cache.
- **Switching rules (go into v2's `CLAUDE.md`) — so changing a model is a config change plus an eval run:**
  1. **Model + effort per job live in config,** never hard-coded; every turn logs the model and effort used.
  2. **Write to what all three models share:** never turn thinking off (depth is controlled by effort only); always set effort explicitly (defaults differ: medium on Opus/Haiku, high on Sonnet); never force a tool call (unsupported on Opus 5.5 / Sonnet 5.5) — use structured outputs and strict tool schemas for the card output contract.
  3. **One refusal handler** that works with or without the API's built-in fallback model (on for Sonnet/Opus; Haiku has none, so plain retry + error path); always check `stop_reason` before reading content.
  4. **Cap context size per job** (compaction / context editing) — Haiku's price jumps 5× above 100k-token prompts.
  5. **Pass conversation history back unchanged,** including thinking blocks, so a model switch mid-conversation just works (the API drops reasoning the new model can't read). Expect one prompt-cache restart.
  6. **Model upgrades:** read the migration notes → change config → run the evals → fix regressions. Usually half a day to two days, mostly prompt tuning.
- **Cost of switching (with the rules):** config change in minutes; one eval run ~an hour and ~US$10–25 per setup at Sonnet prices (full sweep ~US$50–100); prompt re-tuning sometimes a day or two, guided by the evals.
- **Rejected:** A, Haiku everywhere (v1's rule — in phases 1–4 you couldn't tell a tool bug from a model that isn't capable enough); C, Opus planner (2–3× the budget, slower first answers); D, a Haiku/Sonnet router now (premature — router only if logs justify it, per the search decision; two models means two prompt caches).
- **Why:** a planner strong enough that early failures point at tools and prompts; close to budget after tuning; the switching rules keep the phase 5 choice — and every later model release — cheap.
- **Supersedes:** v1's "Claude Haiku for all MVP AI features" convention, for v2.
- **Revisit:** at phase 5 (the evals make the real choice), and at each new model release.

## 2026-11-10 — Managed Agents (Q14): self-host now; trial it for the data agent at D3
- **Decision (option C):**
  - **Weather watch — no Managed Agents.** A Cloud Run Job on Cloud Scheduler (Q11) re-fetches each saved trip's forecast and applies the thresholds in code (as decided). Only when a trip crosses a threshold does it call our own planner to prepare 2–3 alternatives. Tested with backtests.
  - **Data agent D1–D2 — our own hand-written loop,** as already decided; the hand-reviewed results become the eval set.
  - **D3 — a fair comparison:** run the same region both ways. **Managed Agents:** a scheduled deployment with built-in web search/fetch, a dollar session budget, and an outcome checklist per site. **Ours:** a Cloud Run Job, with extraction through the Message Batches API (50% off). Score both against the D2 eval set on accuracy, cost per site and upkeep time; keep the winner.
  - **MCP server as a side effect:** for Managed Agents to write to our database, the spike exposes `propose_campsite_update` (and the read tools it needs) as an MCP server, with credentials in a Managed Agents vault. It can only write to the proposal queue — "propose, don't overwrite" still holds. This starts roadmap phase 7.
- **Cost notes (from the docs):** Managed Agents bills model tokens at list price + $0.08 per session hour + $10 per 1,000 web searches; no batch discount. Tools that touch our database are ours either way (custom tools or our MCP server).
- **Rejected:** A, Managed Agents for all scheduled work now (skips the hand-written-loop learning decision; the weather watch is mostly a cron job and would need our tools over MCP; no batch discount); B, self-host permanently without trying it (we'd rebuild web fetching, run tracking and spend caps ourselves and never test whether Managed Agents does it better); D, the planner on Managed Agents too (every planner tool is ours anyway; extra hop on user-facing latency; reverses the harness decision).
- **Why:** each job gets the tool that fits — plain code for a threshold check, an agent platform for open-ended web reading; the learning path stays intact; the choice for the data agent is made from evidence.
- **Revisit if:** the D3 comparison is a clear win for Managed Agents → move scheduled data-agent runs there; or the weather watch's alternatives need open-ended research → reconsider for that step only.

## 2026-11-10 — Budget per planned trip (Q17): target ≤ US$0.30, with hard caps
- **Decision (option B):**
  - **Target:** median **≤ US$0.30 per planned trip**, all-in (model + routing). The model is almost the whole bill — weather is free, Cloud Run roughly free at this scale.
  - **Hard cap per conversation: US$1.50.** The agent loop tracks spend from each response's `usage`; near the cap it stops calling tools and answers with what it has ("Here's my best pick so far…") — never a cut-off answer. Also catches runaway loops.
  - **Per-user caps from stage 2:** ~US$1/day and ~US$10/month, adjustable by role. Founder: no cap, alerts only.
  - **Visible spend:** cost per trip, turn and tool logged from day one; Q13 evals report quality *and* cost per trip, so the model choice weighs both.
  - **Billing alerts:** Anthropic and Google Cloud at A$20/month in stage 1.
- **Starting estimate** (US$, ~16 model calls per trip — ~4 turns × ~4 calls; per call ~10k cached input, ~5k new, ~1.5k output incl. thinking; replace with real logs):
  | Model (in / out / cache read per MTok) | Per trip | Light trip (8 calls) |
  |---|---|---|
  | Opus 5.5 ($4 / $20 / $0.20) | ~$0.90 | ~$0.45 |
  | Sonnet 5.5 ($2 / $10 / $0.10) | ~$0.45 | ~$0.23 |
  | Haiku 5.5 ($0.10 / $0.50) | ~$0.02 | ~$0.01 |
- **Where the target comes from:** if Pitchd ever charged ~A$5/month, model cost should stay under ~a third of that; at ~4 trips/month plus small asks that's ~US$0.30 a trip. Reachable with a Sonnet-class planner + Haiku sub-tasks after caching and effort tuning; Opus only where evals show it's needed and it fits.
- **Rejected:** A, no target (nothing to tune against; costs creep unnoticed); C, ≤ US$0.05 (forces Haiku everywhere and decides Q13 before the evals).
- **Why:** gives the Q13 evals a real bar; caps protect against runaway loops and abuse before the beta; graceful wrap-up keeps the "never a broken answer" rule.
- **Revisit if:** evals show quality needs a model that can't meet the target after tuning → decide then whether to raise it, knowing the cost; or real logs show trips cost far less than estimated → tighten it.

## 2026-11-10 — Routing & drive times (Q15): estimate first, Mapbox for the top few
- **Decision (option B):**
  - **Estimate in PostGIS first:** filter and rank candidates by straight-line distance × a road factor (tuned per region type — coast, mountains, inland). Call the **Mapbox Matrix API only for the ~10 sites the agent will actually show** (~30 origin–destination pairs per trip vs ~100). Free for roughly 3,000 trips/month; ~US$0.06 a trip beyond that.
  - **"On the way" amenities:** one Mapbox Directions request per trip for the route line — negligible.
  - **`drive_time` is a thin interface over a provider,** so switching to a self-hosted router changes one module. **Trigger:** Mapbox routing passes ~US$50/month, or the terms block a cache we need → self-host OSRM or Valhalla on Australian OSM data (option C).
  - **Geocode against our own data first:** towns, parks and campsite names from our DB plus the free Geoscience Australia gazetteer, with fuzzy matching (also handles misheard names like "Gan Guddy" → Ganguddy). Mapbox geocoding is the fallback, and its results aren't stored.
  - **Before the build:** confirm Mapbox prices and product terms on mapbox.com — especially whether drive times may be cached briefly within a conversation, and the rule that routing results are shown on a Mapbox map (we use Mapbox maps, so it should be fine). Prices above are from third-party summaries: ~100k Matrix pairs and ~100k Directions requests free a month, then ~US$2 per 1,000; default terms appear to prohibit storing results; stored ("permanent") geocoding ~US$5 per 1,000.
- **Rejected:** A, Mapbox Matrix for every candidate (~US$0.20 a trip at scale — nearly the whole Sonnet bill — for sites mostly dropped); C now, our own router (another service to run before volume justifies it); D, Google Routes (dearer, a second map vendor) or OpenRouteService (free-tier daily caps too tight).
- **Why:** cuts routing to about a third, keeps it free through the beta, real drive times where the user sees them, and a clean exit to self-hosting.
- **Revisit if:** estimated drive times rank sites badly (the road factor misleads) → widen the Matrix shortlist; or Mapbox spend hits the trigger → self-host.

## 2026-11-10 — Agent hosting (Q11): Cloud Run in Sydney, Supabase in Sydney
- **Decision:** the Python agent service runs on Google Cloud Run in `australia-southeast1` (Sydney). v2's Supabase project is created in `ap-southeast-2` (Sydney); Vercel functions are pinned to `syd1`.
  - **Planner:** a Cloud Run service (FastAPI). Request timeout raised well above the 5-min default (60 min max) to cover phase 5b's longer runs.
  - **Background work:** the data agent and weather watch run as **Cloud Run Jobs** triggered by **Cloud Scheduler** — same container image, different entry points. If Q14 moves scheduled work to Managed Agents, the Jobs just aren't used.
  - **No work after the response:** CPU is only allocated during requests by default, so anything slow or deferred goes to a Job, never a background task in the service.
  - **Resumable streams:** agent events are written to Postgres with IDs (already planned), so a reconnect that lands on a different instance resumes correctly.
  - **Cold starts vs the ~2 s first-pins target:** stage 1 scales to zero and the web app sends a warm-up ping on open (the service is awake by the time you've typed); from stage 2, one minimum instance + startup CPU boost.
  - **Auth between web and service** (left open in Q12): the browser streams **directly** from the agent service, not through Vercel (proxying would burn serverless time on long streams). A Next.js route turns the Auth.js session into a short-lived signed token (~10 min, refreshed) carrying user ID + role; the service verifies it with a public key, so only Next.js holds the private key. Needs a custom API domain and CORS limited to the web app's origin.
  - **Ops:** secrets in Secret Manager; deploys from GitHub Actions with Workload Identity Federation (no stored keys); a billing budget alert from day one; confirm Sydney pricing for a minimum instance on the live calculator before stage 2.
  - **Portability:** a plain `Dockerfile` with config in environment variables — it runs on Fly.io unchanged if Google Cloud gets in the way.
- **Rejected:** Fly.io (close second — simpler setup and no cold starts, but a patchier reliability record, more to manage yourself, and basic scheduling); Railway and Render (no Australian region — every database query in a turn would cross to Singapore and back).
- **Why:** same city as the database, which matters because one turn makes many queries; one platform fits both the interactive planner and the batch/scheduled agents; long timeouts suit agent turns; costs close to nothing at one user and scales without code changes; no lock-in.
- **Revisit if:** cold starts still hurt with the warm-up ping, or Google Cloud setup and permissions eat more time than the learning is worth → move the same container to Fly.io `syd`.

## 2026-11-10 — Python data layer (Q12): Python owns the schema; the web app reads through the agent API
- **Decision (option B):** the Python service owns v2's schema and migrations, and is the only thing that talks to the database.
  - **Schema + migrations:** SQLAlchemy 2.0 models and Alembic migrations in `agent/`. Alembic autogenerates from model changes; every migration is reviewed and committed with the code that needs it.
  - **Python access:** SQLAlchemy async ORM on psycopg 3; plain SQL via SQLAlchemy Core where it earns it (PostGIS, heavy queries). PostGIS is enabled in the new Supabase project (GeoAlchemy2) for radius and along-route queries (`find_amenities`, phase 5b `plan_route`).
  - **Web access:** none directly — no Prisma or other ORM in `web/`. Map viewport pins, site details, saved trips and "What Pitchd knows" are plain read endpoints on the Python service, the same API the future native app uses. TS types are generated from FastAPI's OpenAPI spec (`openapi-typescript`).
  - **Auth:** Auth.js keeps Google OAuth with JWT sessions (no database adapter). Its sign-in callback asks the Python service to upsert the user and return their role (`admin | beta | user`). How the web app proves the user's identity on each call (a signed token the service verifies) is settled with Q11.
  - **v1 data:** the one-off campsite + amenity copy is a Python script into v2's schema; v2 tables don't have to match v1's.
  - **Supabase gotchas (into v2's `CLAUDE.md`):** turn off the auto-generated Data API, or enable RLS with no policies on every table, so the anon key can't read anything; the app connects through the Supavisor pooler in transaction mode with psycopg prepared statements disabled (`prepare_threshold=None`); Alembic uses the direct connection.
- **Rejected:** A, Prisma owns it (the main writer would depend on a TS schema and a Node migration step; two model definitions drift; weak PostGIS support); C, psycopg + hand-written SQL migrations (every mapping by hand, no autogenerate while the schema is still moving — plain SQL stays available through Core); D, shared SQL migrations with both apps reading directly (data rules in two places, a third client for native, breaks the thin-client decision); E, the agent calling Next.js API routes as tools (backwards dependency, serverless cold starts on every tool call, logic in the thin layer). Also SQLModel (lags SQLAlchemy, awkward with Alembic) and supabase-py / PostgREST (HTTP hop, weak for transactions and geo queries).
- **Why:** the owner of the schema should be its main writer; one API keeps logic in Python as the platform decision requires, so native is a new frontend; generated types keep the web app typed without an ORM; PostGIS becomes first-class; SQLAlchemy + Alembic is the standard Python stack with the most learning material.
- **Supersedes:** `architecture.md`'s "schema migrations stay owned by Prisma" (written before D gave v2 its own database), and v1's "Prisma for all DB interactions — no raw SQL" convention for v2.
- **Revisit if:** map viewport reads through the service are noticeably slow on a phone → serve pins as cached vector tiles or a CDN-cached endpoint before giving the web app its own database access.

## 2026-11-10 — Visual identity B7 · Type: Lora for the wordmark and a few headings, DM Sans for everything else
- **Decision (option B):** two faces. Nunito (v1's default body font) is dropped. Sketch (all five body options at real sizes): https://claude.ai/artifact/Le1D31kxmCFKJHBRkoyfC3
- **Lora** — Bold for the wordmark and the app icon "d" (exported as outlined SVG, so they never wait for the font — B5); SemiBold 17–19 px for the collapsed-sheet greeting; headings in the expanded sheet (trip titles, "Trips", "What Pitchd knows") and site detail titles. Never for reading text or anything under 15 px.
- **DM Sans** — everything the agent says and all UI text:
  | Role | Size / line | Weight |
  |---|---|---|
  | Agent summary, input | 15 / 21 | 400; lead sentence 700 |
  | Card title | 15 / 20 | 700 |
  | Chips, card facts, day columns, step lines | 13 / 18 | 500–600 (B3: 500+ under 15 px) |
  | Numbers (drive times, temperatures, rain %, times) | any | tabular figures |
- **Rules:** 13 px is the smallest text anywhere (B3); sizes in rem so the phone's text-size setting scales them; load only the weights used (Lora 600/700; DM Sans 400–700 with optical sizes); fonts cached by the PWA service worker after first load.
- **Rejected:** A, Nunito (rounded ends blur first in glare; wide letters fit less in the sheet; looks young next to Lora); C, Inter (adds no character; a bit cold next to Lora); D, system font (looks different on every phone, no brand character — kept as the fallback if load size ever matters more); E, Atkinson Hyperlegible (quirky next to Lora; fewer weights; no tabular figures).
- **Why:** already the prototype's look; optical sizes keep small text legible in sun; tabular figures for the numbers cards are full of; pairs warmly with Lora; two faces instead of v1's three.
- **Revisit if:** the midday sunlight test (B3) shows DM Sans at 13 px struggling → raise the floor or weight first; only then try the system font.

## 2026-11-10 — Visual identity B6 · Agent mark: the app icon's "d" tile, small
- **Decision (option C):** the agent's presence is shown by the B5 "d" tile at 20 px beside what Pitchd says — the icon you tapped is the one talking to you. State is shown by a coral ring around the tile, never by a new shape. Sketch (options, states, sheet moments, "d" vs "Pd"): https://claude.ai/artifact/AoL2DqbEW4r8ac82JX2AyF
  | State | Mark |
  |---|---|
  | Ready | Still tile beside the greeting and each answer |
  | Working | Coral arc circles the tile while tools run, with the step line ("Checking weather around Mudgee…") and the map showing the area being checked |
  | Writing | Arc stops once the answer streams |
  | Listening | Pulsing ring while dictation is on |
  | Offline / unavailable | Grey tile, with the offline banner |
- **Where:**
  | Place | Mark |
  |---|---|
  | Agent's summary line, greeting | 20 px tile, left of the text |
  | Expanded thread | First line of each agent turn only — not on step lines, cards or chips |
  | Input | No tile; the send button becomes a stop button with the same coral arc while working (no two coral marks side by side) |
  | Map — "Ask Pitchd about this site" | 16 px tile on the button |
  | Push notifications, browser tab | The app icon (B5) |
- **Rules:** every state also has words — the mark is never the only signal; with reduced motion the arc and ring are drawn dotted and still; coral on screen stays limited to the tile, the top pick and send (B1).
- **"Pd" considered** (as the mark, and as the icon): reads more like initials, but wouldn't match the "d" app icon, shrinks the coral to ~9 px at 20 px and runs together at 16 px. Kept "d" for both; "Pd" stays B5's fallback, and would replace both together if ever used.
- **Rejected:** A, no mark (nothing shows Pitchd is working; agent text looks like app text); B, mascot (cartoon cuteness clashes with "no hype" and safety messages; a character to maintain); D, ember dot (reads as "unread"; not tied to the name — kept as the fallback); E, sparkle ✦ (every product uses it; points at the technology, not the mate).
- **Why:** nothing new to learn; ties B1 (coral = Pitchd) and B5 together; carries the "never a bare spinner" principle.
- **Revisit if:** the arc reads as a loading spinner rather than "Pitchd is working" in testing → lean more on the step lines and map, keep the tile still.

## 2026-11-10 — Visual identity B5 · App icon: the coral "d" on forest; wordmark minimum 15 px
- **Decision (option D):** the app icon is the wordmark's coral "d" (Lora bold, #e8674a) alone on a forest square (#2d4a2d). Sketch (all options at real sizes): https://claude.ai/artifact/9g4dXtEegZv822wQUKHavZ
- **Why:** it's the one part of the wordmark only Pitchd has ("Pitch" + "d" = pitched); one bold glyph stays legible down to 16 px; coral means Pitchd (B1), so the icon, the send button and the agent mark (B6) all point the same way. Coral on forest is 3.0:1 — enough for a large glyph.
- **Wordmark size rule:**
  | Size | Use |
  |---|---|
  | 32 px+ | Sign-in, first-run sheet, splash — wordmark beside the icon here teaches the link |
  | 20 px | Desktop sidebar header |
  | **15 px minimum** | Expanded sheet header, emails |
  | below 15 px | Use the "d" icon instead (browser tab, push notifications, "Ask Pitchd" chips) — the coral "d" becomes a speck |
- **Build note:** PWA icon set — 180 px apple-touch-icon, 192 and 512 px, a maskable version (glyph inside the safe zone), and a favicon (16/32 px and SVG). Export the "d" as an outlined path so it doesn't depend on the font loading. v1 has no app icon or web manifest.
- **Rejected:** A, shrunk wordmark (unreadable below ~60 px); B, "P" monogram (drops the coral; looks like many other apps); C, "Pd" pair (cramped at 16 px; kept as the fallback); E, tent pictogram (almost every camping app uses one; says nothing about the name).
- **Revisit if:** stage 2 testers don't connect the "d" with Pitchd → switch to the "Pd" pair (C).

## 2026-11-10 — Visual identity B4 · Weather colours: one "sun to rain" scale for pins and day columns
- **Decision (option B):** gold → blue → navy, used for both map pins and card day columns. Sketch (with colour-blind and glare views): https://claude.ai/artifact/UFQap2zw6D1grvZM6A8W8H
  | State | Light pin | Light day tint (dark text) | Dark pin | Dark day tint / text | Meaning |
  |---|---|---|---|---|---|
  | **Dry** | #f0b72f | #fbe7b0 | #f5c542 | #3d3417 / #f5e3a8 | Under ~20% rain chance, no hazards |
  | **Mixed** | #5f93bf | #dbe8f1 | #7ab0e0 | #22313c / #cfe1ee | Showers, or a wet part of the day |
  | **Wet** | #24486e | #a9c3de | #3f72b8 | #1c3550 / #cfe0f5 | Rain most of the day |
  | **Typical** | hollow dashed pin | hatched neutral | same | same | Past the forecast range — "typical for May" (phase 5b) |
  | **Hazard** | dark "!" badge on any state | dark outline + reason in words | light "!" badge | light outline | Storm, strong wind, extreme heat, fire ban |
- **Rules:** day-column text 8–12:1 on every tint; an icon and label on every day (B3); pins set off from the map by B3's white ring + hairline (light ring in dark mode); coral never used for weather (B1) — it stays the top-pick ring.
- **Simpler than v1:** three colours replace v1's six strip colours (`condColorForCode`) and the separate Great/Good/Poor badge (`getWeatherBadge`). The 0–100 score still ranks sites in code; it just isn't shown as extra colours. Thresholds between states live in code with tests, like the alert thresholds.
- **To check later:** v1's water-fill amenity pin is blue (#2a8ab0) — amenity pins carry icons, but review the clash when amenity pins are designed.
- **Rejected:** A, v1 traffic light (wet = coral clashes with the brand; green/amber merge for red-green colour blindness; green pins vanish on a green map; white on amber 2.5:1); C, colour-blind-safe traffic light (vermilion still near coral; green still blends into the map; red for rain reads as danger, which belongs to safety); D, blues only (dry — the answer people want — is the faintest thing on the map).
- **Why:** a scale campers already read; yellow vs blue survives red-green colour blindness (~1 in 12 Australian men); light-to-dark steps survive glare and greyscale; no green or red, so no clash with the map, the brand or safety alerts.
- **Revisit if:** testers misread the scale without "green = good" → strengthen the icons and labels before changing colours.

## 2026-11-10 — Visual identity B3 · Sunlight contrast: the default light theme is built for outdoors
- **Decision (option B):** no separate outdoor mode — the normal light theme is sunlight-ready, and is checked on a real phone outside at midday before it's signed off. Sketch (with a rough glare slider): https://claude.ai/artifact/3uMTxiURbJA4Ym9rJi2XPg
- **Rules:**
  | Element | v1 | Contrast | v2 | Contrast |
  |---|---|---|---|---|
  | Key facts (summary line, card names) | #2d4a2d | 9.1:1 | #1a2e1a (`TEXT`) — aim 7:1+ | 13.3:1 |
  | Secondary text | #8a9e8a muted / #5a7a5a sage | 2.6 / 4.4:1 | #4f6b4f (sage, one shade darker); muted grey retired for text (disabled and decoration only) | 5.4:1 |
  | Coral text | #e8674a | 3.0:1 | #b84a33 coral ink (B1) | 4.7:1 |
  | Text on weather colours | white on amber / green | 2.5 / 3.3:1 | ≥ 4.5:1 (colours in B4) | — |
  | Input and chip borders | #e0dbd0 | 1.4:1 | #928a7a (3:1 for controls, on both the background and white cards); card borders stay soft but gain a shadow | 3.1:1 on background, 3.4:1 on white |
  | Pins | flat colour, thin white ring | — | darker fill, 3 px white ring, dark hairline; top pick 28 px | — |
  | Text size | — | — | 13 px floor; weight 500+ below 15 px | — |
- **Weather never by colour alone:** every day column has a label and an icon (ties to B4).
- **Contrast measured** against the background (#f7f5f0) and white cards. Dark mode (B2) already clears these bars.
- **Rejected:** A, WCAG AA as the bar (set for indoor screens; 4.5:1 text washes out in direct sun); C, automatic outdoor mode (the web can't read the light sensor on iPhone; a third theme); D, a manual high-contrast toggle (nobody finds it while squinting at a campsite; a third theme).
- **Why:** Pitchd is used outdoors, so the default must work there; no setting to find; also helps older eyes and cheap screens.
- **Revisit if:** the midday phone test still fails on something → darken that value; if the theme feels heavy indoors, soften decoration (borders, shadows), never text.

## 2026-11-10 — Visual identity B2 · Dark mode: follow the phone, with an override
- **Decision (option B):** light and dark are both designed. The app follows the phone's setting; "Appearance: System / Light / Dark" lives in the expanded sheet (beside "What Pitchd knows"). Sketch: https://claude.ai/artifact/9nMEPK1XHYhNkNnGNC5L2a
- **Dark values (starting point):**
  | Role | Light (B1) | Dark | Contrast on dark card |
  |---|---|---|---|
  | Background | #f7f5f0 | #141a14 (green-black, not blue-black) | — |
  | Card / sheet | #ffffff | #1d241d | — |
  | Border | #e0dbd0 | #344034 | — |
  | Text / headings | #2d4a2d | #e6ede1 | 13.3:1 |
  | Secondary (sage) | #4f6b4f (B3; v1 was #5a7a5a) | #a3baa0 | 7.6:1 |
  | Coral (fills) | #e8674a | #f07a5e | 5.8:1 |
  | Coral ink (text) | #b84a33 | #f4917a | 6.9:1 |
  | Text on coral | white | #1d241d (white on the brighter coral is only 2.7:1) | 5.8:1 |
  | Weather | B4 | dark versions chosen with B4 | — |
  | Map | Mapbox Standard, day preset | Mapbox Standard, night preset (no second custom style) | — |
- **Build note:** semantic colour tokens (CSS variables, light + dark) from the first build — components never use raw hex — so dark mode is a token set, not a retrofit. Every designed state (empty, error, offline) is checked in both themes.
- **Rejected:** A, light only (glaring at night at camp, when people check tomorrow's weather or the nearest toilet; white flash for dark-mode phones); C, manual toggle only (rarely found, ignores the phone); D, an extra red night-vision mode (weather colours stop working, a third theme to maintain — a gimmick before there are users).
- **Why:** much of the real use is after dark at camp; following the phone is right with no effort; warm green-black keeps it feeling like Pitchd; B1's roles carry over unchanged.
- **Revisit if:** testers at camp ask for something dimmer than dark mode → reconsider a night mode then.

## 2026-11-10 — Visual identity B1 · Palette: keep the family, give each colour one job
- **Decision (option B):** keep forest / sage / warm neutrals with coral, and tighten the roles. Sketch: https://claude.ai/artifact/Sd5Bg25avPg9ohMpCzxhDB
  | Colour | Token (v1 value) | Job |
  |---|---|---|
  | Warm neutrals | `SURFACE` #f7f5f0, white cards, `BORDER` #e0dbd0 | Most of the screen |
  | Forest | `FOREST_GREEN` #2d4a2d (`TEXT` #1a2e1a for body) | Headings, the agent's summary line, "Pitch" in the wordmark, user bubbles |
  | Sage | `SAGE` #5a7a5a → **#4f6b4f** (darkened in B3 to reach 4.5:1 on the background) | Secondary text, chip labels, step lines — **one** sage (the prototype's #7a9e7a and #4a6a4a are retired) |
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
- **Visual identity refresh — decided (B1–B7, 2026-11-10):** palette, dark mode, sunlight contrast, weather colours, app icon, agent mark and type — see their entries above. Original recommendation, now confirmed: keep the core palette (forest / sage / warm neutrals, coral used sparingly) but refresh — add dark mode, check sunlight contrast, give weather states distinct colours, test the wordmark at icon size, and design a small mark for the agent's presence. Define the agent's voice as part of the brand (ties to open question E).

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
