# Architecture — Proposed

> Draft. See `decisions.md` for what's agreed and `open-questions.md` for what isn't.

## Shape

```
 ┌───────────────────────────┐  stream (SSE) + read API   ┌──────────────────────────────┐
 │ Next.js (Vercel, syd1)    │ ◄────────────────────────► │ Python agent service         │
 │ - Auth (Google OAuth, JWT)│  user msg / agent events;  │ (FastAPI, Cloud Run Sydney)  │
 │ - Map + conversation UI   │  pins, trips, memory reads │ - Agent loop (Anthropic SDK) │
 │ - Renders structured cards│                            │ - Tools (Python functions)   │
 │ - No database access      │                            │ - Prompts, evals             │
 └───────────────────────────┘                            │ - SQLAlchemy models, Alembic │
                                                          └──────┬──────────┬────────┬───┘
                                                    SQLAlchemy   │          │        │
                                                    (psycopg 3)  ▼          ▼        ▼
 ┌───────────────────────────────────────────────────────────────────┐  Open-Meteo  Routing /
 │ Supabase Postgres + PostGIS (v2's own project, Sydney)            │  (weather)   geocode
 │ campsites, amenities, facts, proposals, users, trips, stops,      │              (Mapbox)
 │ preferences, conversations, tool/agent logs                       │
 └───────────────────────────────────────────────────────────────────┘
```

- **Frontend** stays Next.js on Vercel. It owns sign-in and the UI. It has no database access: it calls the agent service with the user's identity for conversations *and* for plain reads (map pins, site details, saved trips, memory) — the same API a native app will use. TS types are generated from the service's OpenAPI spec.
- **Agent service** is a separate Python service, because agent turns can run for tens of seconds — a poor fit for serverless function limits. **Hosted on Cloud Run in Sydney** (`australia-southeast1`), next to the Sydney Supabase project; the data agent and weather watch run as Cloud Run Jobs on Cloud Scheduler from the same image. The browser streams from it directly with a short-lived token minted by Next.js (see the Q11 entry in `decisions.md`).
- **Database** is v2's own Supabase project (decision D) with PostGIS. The Python service owns the schema — SQLAlchemy 2.0 models + Alembic migrations in `agent/` — and is the only reader and writer. Plain SQL via SQLAlchemy Core where it earns it (geo queries). See the Q12 entry in `decisions.md` for auth flow and Supabase connection gotchas.

## Agent

- **Harness:** start with a hand-written tool loop on the Messages API (learning), then move to the SDK's Tool Runner. Evaluate Managed Agents later for background/scheduled work.
- **Tools (first cut):**
  | Tool | Purpose |
  |---|---|
  | `search_campsites` | Area/radius + filters (dogs, amenities, setup) → candidate sites from DB |
  | `get_forecast` | Multi-day forecast for a set of points (batched, cached) |
  | `find_amenities` | Dump points, water, toilets, fuel near a point or along a route |
  | `geocode` | Place name → coordinates — own data first (DB + Geoscience Australia gazetteer, fuzzy match), Mapbox fallback, not stored |
  | `drive_time` | Origin → destinations travel time — PostGIS estimate for ranking, Mapbox Matrix for the ~10 shown; provider behind an interface |
  | `get_user_profile` / `update_preferences` | Remembered setup, dog, favourite regions |
  | `save_trip` | Commit a plan — a trip is an ordered list of stops (a weekend trip is one stop) |
  | `plan_route` *(phase 5b)* | Route geometry between stops; split into days by drive limit |
- **Search is agent-only.** The frontend never calls search directly. The current `/api/search` pipeline (filters, distance, weather scoring) is ported into the deterministic `search_campsites` tool; the agent decides *what* to search, then compares and explains. Map pan/zoom and pin details remain plain data reads (viewing, not searching).
- **Fast path:** simple asks ("dump points near Mudgee") should resolve in one tool call at low effort, with the first pins streamed to the map as soon as the tool returns. A hidden router can be added later if logs justify it.
- **Degraded mode:** if the Claude API is unavailable, show saved trips and last results with a clear message.
- **Weak signal / offline:** agent streams are resumable (event IDs, so a dropped connection picks up where it stopped); the web app keeps shown results on screen and retries with timeouts; a PWA service worker caches saved trips (and later the trip pack) for offline viewing.
- **Output contract:** the agent returns a short text summary plus structured results (site IDs, ranks, reasons) that the UI renders as cards and pins. Site IDs must come from tool results — validated server-side before rendering.
- **Models:** to be decided with evals. Likely a capable model for planning, a cheap model for sub-tasks.

## Data agent (background)

A second agent runs offline to enrich, verify and dedupe campsite data — see `data-agent.md`. It writes to a review queue (`CampsiteUpdateProposal`) and a provenance table (`CampsiteFact`), never straight to live records. The planner reads `CampsiteFact` so it can cite sources and freshness ("Dogs allowed — Parks NSW, checked 3 weeks ago"). It shares the Python codebase and tools with the planner but runs on a schedule / batch, not behind the user-facing API.

## Scaling considerations (design now, build later)

- **Stateless service** — conversation and trip state live in Postgres, so the service can scale horizontally.
- **Cost controls** — target ≤ US$0.30 per planned trip; hard cap US$1.50 per conversation (graceful wrap-up); per-user caps from stage 2 (~US$1/day, ~US$10/month); prompt caching on system prompt + tools, cap tool calls per turn, cheaper models for sub-tasks, per-user cost tracking from API usage (see Q15/Q17 in `decisions.md`).
- **Latency** — stream everything, run independent tool calls in parallel, cache forecasts (~1 h); geocode from our own place data (Mapbox geocoding results aren't stored).
- **Safety & limits** — per-user rate limits, keep invite-only roles, timeouts on every external call, treat user text as data in prompts.
- **Observability** — log every model turn and tool call (inputs, outputs, latency, tokens) from day one; this also becomes eval data.

## Optional later

- Expose Pitchd tools as an **MCP server**, so the same tools work from Claude Code / Claude Desktop / other agents.
