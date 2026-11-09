# Decision Log

> Newest first. Each entry: decision, why, and what would make us revisit it.

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
