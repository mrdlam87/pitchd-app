# Data Agent Track — Campsite Data Quality

> A second agent track alongside the trip planner. The planner can only be as trustworthy as the data it stands on — this track makes the data trustworthy.

## 1. The problem

- Campsites come from OSM (`app/scripts/ingest-osm.ts`); amenity POIs from `app/scripts/ingest-osm-pois.ts`.
- OSM coverage in Australia is uneven: missing amenities, duplicates, closed sites, no dog rules, thin or missing `blurb`s.
- `CampsiteAmenity` links are sparse; `syncStatus` (`active | unverified | removed`) is only as good as the last sync.
- This is exactly the persona pain: *"drove 20 minutes to a dump point that no longer exists"*, *"dog rules wrong"*, *"ends up calling the campground"*. Stale data is also why WikiCamp users are leaving.

## 2. Why agents fit

The work is slow, repetitive, and needs judgement (reading park websites, reconciling sources) — but **no user is waiting**. That makes it cheaper, safer, and easier to evaluate than the interactive planner, and a great first agent to build.

## 3. Jobs

| Job | What the agent does | Tools |
|---|---|---|
| **Enrich** | Finds official sources for a site (NSW National Parks, Parks Victoria, councils) and extracts dogs, toilets, showers, fees, booking (required / first-come + booking URL and provider), caravan/2WD access | web search, web fetch, `propose_campsite_update` |
| **Verify** | Checks a site is still open; looks for closures and changes; proposes `active` / `unverified` / `removed` with evidence | web search/fetch, park alerts |
| **Dedupe** | Finds the same site under two names or slightly different coordinates; proposes merges | DB query, distance check |
| **Describe** | Writes short, factual blurbs from verified facts only | DB read |
| **Resolve conflicts** | Source A says dogs allowed, B says no → prefers the higher-priority source and records why, or flags for review | source-priority rules (in code) |
| **Ingest user reports** | Planner conversations like "the showers there are closed" become reports in the review queue | `report_issue` (planner tool) |

## 4. Design rules

1. **Propose, don't overwrite.** Agents write to a review queue, never straight to live records. Auto-approve is earned per fact key (Q19): no-change re-checks just update `checkedAt`; the pilot reviews every change; after it, a key auto-approves official + high-confidence changes once it has ≥ 95% agreement over ≥ 30 reviews; cautious changes (closed, no dogs) apply at once and are flagged; ~1 in 20 auto-approvals is spot-checked, and a key drops back to review if agreement falls.
2. **Every fact has provenance.** Store value + source URL + source type + checked date + confidence, e.g. *dogs: no — nationalparks.nsw.gov.au — 2026-11-09 — high*. The planner can then say "verified last month" or "unverified, check before you go".
3. **Source priority:** park authority > council / official tourism > OSM > user reports. Encoded in code, not left to the model.
4. **Refresh by priority, not all at once.** Re-verify most-viewed, soonest-booked (saved trips), and oldest-checked records first.
5. **Bounded cost.** Haiku 5.5 for extraction, Sonnet 5.5 only for conflicts (Q13); per-run caps on sites and tool calls; batch processing (async, ~50% cheaper) since nothing is urgent.
6. **Treat fetched pages as data.** Web content goes into prompts as untrusted input — it can't change the agent's instructions or approve its own changes.

## 5. Data model additions (draft)

```
CampsiteFact
  campsiteId   → Campsite
  key          String    // "dogs_allowed" | "toilets" | "showers" | "fee" | "booking" | "booking_url" | "access_2wd" | ...
  value        Json
  sourceUrl    String?
  sourceType   Enum      // official | council | osm | user_report | agent_inferred
  checkedAt    DateTime
  confidence   Enum      // high | medium | low

CampsiteUpdateProposal
  campsiteId   → Campsite
  changes      Json      // proposed facts / status / merge target
  evidence     Json      // URLs + extracted snippets
  status       Enum      // pending | approved | rejected | auto_approved
  createdBy    String    // agent run id
  reviewedAt   DateTime?
  verdict      Enum?     // correct | wrong — reviewer's call, feeds the trust table

FactKeyTrust            // per fact key; rules in code (Q19)
  key          String
  reviews      Int
  agreements   Int
  autoApprove  Boolean
```

## 6. Pilot (first agent to build)

1. **Scope:** one region the founder camps in — 50–100 sites around the Blue Mountains.
2. **Build:** a CLI enrichment agent (Python, hand-written loop) that fills dogs / toilets / showers / booking with sources into the proposal table.
3. **Review by hand** — and record whether each proposed fact was right. That *is* the first eval set.
4. **Done when:** ≥ 90% of high-confidence facts are correct on the hand-reviewed sample, and cost per site is known.
5. **Then:** expand region by region; add verify + dedupe; schedule it.

## 7. Where it runs

- Offline / scheduled — no latency pressure. Host decided (Q11): a **Cloud Run Job** on Cloud Scheduler, from the same image as the planner. Bulk extraction through the Message Batches API. At D3, the same region is also run on Managed Agents (scheduled deployment, built-in web tools, dollar budget) and the two are compared on the D2 eval set (Q14).
- Independent of the v2 UI — improves data for v1 too, so it can start immediately.
