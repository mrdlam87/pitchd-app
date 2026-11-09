# Architecture — Proposed

> Draft. See `decisions.md` for what's agreed and `open-questions.md` for what isn't.

## Shape

```
 ┌───────────────────────────┐        stream (SSE)        ┌──────────────────────────────┐
 │ Next.js (Vercel)          │ ◄────────────────────────► │ Python agent service         │
 │ - Auth (Google OAuth)     │   user msg / agent events  │ (FastAPI)                    │
 │ - Map + conversation UI   │                            │ - Agent loop (Anthropic SDK) │
 │ - Renders structured cards│                            │ - Tools (Python functions)   │
 └───────────┬───────────────┘                            │ - Prompts, evals             │
             │                                            └──────┬───────────┬───────────┘
             │ Prisma                                            │           │
             ▼                                                   ▼           ▼
 ┌───────────────────────────────────────────────┐        Open-Meteo    Routing / geocode
 │ Supabase Postgres                             │        (weather)     (Mapbox)
 │ campsites, amenities, users, trips,           │
 │ preferences, conversations, tool/agent logs   │
 └───────────────────────────────────────────────┘
```

- **Frontend** stays Next.js on Vercel. It owns auth and the UI, and calls the agent service with the user's identity.
- **Agent service** is a separate Python service, because agent turns can run for tens of seconds — a poor fit for serverless function limits. Candidate hosts: Fly.io, Railway, Render, Cloud Run.
- **Database** stays the existing Supabase Postgres. Python reads it with its own data layer (Prisma is TypeScript-only). Schema migrations stay owned by Prisma to keep one source of truth.

## Agent

- **Harness:** start with a hand-written tool loop on the Messages API (learning), then move to the SDK's Tool Runner. Evaluate Managed Agents later for background/scheduled work.
- **Tools (first cut):**
  | Tool | Purpose |
  |---|---|
  | `search_campsites` | Area/radius + filters (dogs, amenities, setup) → candidate sites from DB |
  | `get_forecast` | Multi-day forecast for a set of points (batched, cached) |
  | `find_amenities` | Dump points, water, toilets, fuel near a point or along a route |
  | `geocode` | Place name → coordinates |
  | `drive_time` | Origin → destinations travel time |
  | `get_user_profile` / `update_preferences` | Remembered setup, dog, favourite regions |
  | `save_trip` | Commit a plan |
- **Search is agent-only.** The frontend never calls search directly. The current `/api/search` pipeline (filters, distance, weather scoring) is ported into the deterministic `search_campsites` tool; the agent decides *what* to search, then compares and explains. Map pan/zoom and pin details remain plain data reads (viewing, not searching).
- **Fast path:** simple asks ("dump points near Mudgee") should resolve in one tool call at low effort, with the first pins streamed to the map as soon as the tool returns. A hidden router can be added later if logs justify it.
- **Degraded mode:** if the Claude API is unavailable, show saved trips and last results with a clear message.
- **Output contract:** the agent returns a short text summary plus structured results (site IDs, ranks, reasons) that the UI renders as cards and pins. Site IDs must come from tool results — validated server-side before rendering.
- **Models:** to be decided with evals. Likely a capable model for planning, a cheap model for sub-tasks.

## Data agent (background)

A second agent runs offline to enrich, verify and dedupe campsite data — see `data-agent.md`. It writes to a review queue (`CampsiteUpdateProposal`) and a provenance table (`CampsiteFact`), never straight to live records. The planner reads `CampsiteFact` so it can cite sources and freshness ("Dogs allowed — Parks NSW, checked 3 weeks ago"). It shares the Python codebase and tools with the planner but runs on a schedule / batch, not behind the user-facing API.

## Scaling considerations (design now, build later)

- **Stateless service** — conversation and trip state live in Postgres, so the service can scale horizontally.
- **Cost controls** — prompt caching on system prompt + tools, cap tool calls per turn, cheaper models for sub-tasks, per-user cost tracking from API usage.
- **Latency** — stream everything, run independent tool calls in parallel, cache forecasts (~1 h) and geocodes.
- **Safety & limits** — per-user rate limits, keep invite-only roles, timeouts on every external call, treat user text as data in prompts.
- **Observability** — log every model turn and tool call (inputs, outputs, latency, tokens) from day one; this also becomes eval data.

## Optional later

- Expose Pitchd tools as an **MCP server**, so the same tools work from Claude Code / Claude Desktop / other agents.
