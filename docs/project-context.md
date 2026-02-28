# Pitchd — Project Context Document
> This is a living document. Update it at the end of every working session.
> **Location:** `docs/project-context.md` in the GitHub repo

---

## 1. Project Overview

**App Name:** TBD (placeholder: CampFinder)  
**Type:** Full-stack Web App  
**Stage:** Pre-development — Market Research phase  
**Target Market:** Australia (primary), with potential to expand  

### Vision
"Google Maps for campers" — a map-first experience where Australian campers can find everything they need for a trip in one place. Campsites, dump points, public toilets, laundromats, water fill stations, nearby hikes, and other activities — all on a single intuitive map. No bloat, no paywalled basics.

### The Problem
Finding campsites and essential road amenities (dump points, public toilets, laundromats, water fill stations) is a fragmented and frustrating experience. The leading Australian app (WikiCamp) has alienated its loyal user base through a poorly received redesign and an acquisition that prioritised commercial interests. No app combines campsite discovery, amenity finding, and nearby activity search in a clean, reliable, map-first experience.

### The Solution
An AI-powered camp trip companion for Australian campers. Pitchd goes beyond a map directory by letting campers describe what they want in natural language, get intelligent trip recommendations, and receive AI-generated summaries of campsites — making it genuinely useful from day one without needing years of community-built reviews.

### Strategic Positioning
Pitchd is not competing with WikiCamp as a map directory — it's building a fundamentally different product. WikiCamp is a database with a map. Pitchd is a **camping intelligence platform** with AI at its core. The AI layer is the differentiator that sidesteps the cold start problem and provides value that established players can't easily replicate.

---

## 2. Target User

- To be refined during market research
- Initial assumption: casual to semi-regular campers who camp with dogs, fish, or have other specific requirements that make generic campsite search tools inadequate

---

## 3. MVP Features

- **Natural language search** — describe what you want in plain English (e.g. *"dog-friendly campsite near Melbourne with fishing access"*). This is the core AI feature and primary differentiator for launch.
- Map-first UI — browse and search via an interactive map
- Core filters: dog-friendly, fishing, swimming, dump points, public toilets, water fill stations, laundromats, nearby hikes
- Clean, fast, reliable results

### Post-MVP — Phase 2
- **AI campsite summaries** — intelligently synthesised descriptions drawn from open data sources
- **AI trip planner** — input your dates, starting point, setup and interests and get a full itinerary
- **Smart recommendations** — learns your camping style and surfaces spots you'd love
- **Conversational trip assistant** — ask questions about any campsite and get intelligent answers
- **AI photo tagging** — automatically categorise user-submitted photos
- Save / favourite locations
- User accounts & login
- User-submitted reviews and photos
- Offline support
- Expand beyond Australia

---

## 4. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js (React) | Most in-demand React framework, handles frontend + backend in one project |
| Styling | Tailwind CSS | Fast, consistent, industry standard for modern apps |
| Backend | Next.js API Routes | Keeps stack unified, no separate server needed for MVP |
| Database | PostgreSQL + Prisma | Battle-tested DB, Prisma makes it approachable with type safety |
| Hosted DB | Supabase | Managed Postgres, generous free tier, no vendor lock-in |
| Deployment | Vercel | Native Next.js integration, auto CI/CD from GitHub, preview deployments |
| Version Control | GitHub | Industry standard, builds good habits |
| Data Source | Recreation.gov API | Free, real US public lands campsite data with filterable attributes |

---

## 5. Project Phases

- [x] **Phase 0** — Project scoping & stack decisions ✅
- [ ] **Phase 1** — Market research (gaps, competitors, user needs)
- [ ] **Phase 2** — Define user personas & problem statement
- [ ] **Phase 3** — Prototyping & design (Figma wireframes)
- [ ] **Phase 4** — Technical planning (architecture, data models, milestones)
- [ ] **Phase 5** — Build & ship (iterative development)

---

## 6. Market Research Findings

### Competitors Reviewed

| App | Strengths | Weaknesses |
|---|---|---|
| **WikiCamp (AU)** | 60,000+ AU sites, dump points, toilets, laundromats, community data | Acquired by G'Day Group (commercial bias), disastrous 2024 redesign alienated loyal users, slow, buggy, data going stale |
| **The Dyrt** | Largest US database (public + private), community reviews, good filters | Full functionality behind $35.99/yr paywall, no specific activity filters (fishing etc.), US-focused |
| **Hipcamp** | Unique private land listings, broad site types | Search notoriously inaccurate, amenity filters unreliable |
| **Campendium** | Cell coverage overlays, strong community reviews, free tier | Geared toward RVers/vanlifers, US-focused |
| **Recreation.gov** | Official federal land data, free, direct booking | Only covers federal land, clunky UI, no activity-based filtering |
| **iOverlander** | Free, crowdsourced, global | Outdated listings, no search bar (map-only), amenity data unreliable |
| **CampsiteTonight** | Cross-platform search, cancellation alerts | Focused on availability/booking, not discovery or amenity finding |

### Key Gaps Identified
- **Activity-based filtering is largely absent.** No major app lets you filter specifically by activities like fishing, hiking trails, swimming holes, or kayak launch access. Most filters stop at broad amenities (hookups, showers, toilets).
- **Pet filtering is shallow.** Most apps have a simple "pet-friendly" toggle but no detail — leash rules, breed restrictions, nearby dog-friendly trails, water access for dogs.
- **Search accuracy is a real problem.** Hipcamp in particular has vocal user complaints about search results returning campsites nowhere near the searched location.
- **Data freshness is a recurring frustration.** iOverlander and FreeCampsites.net are riddled with outdated or unverified listings. Users don't trust amenity data.
- **Too much friction between discovery and decision.** Users have to cross-reference 2-3 apps to get a complete picture — one for finding a site, another to check reviews, another to verify fishing or dog rules.
- **Most good features are paywalled.** The Dyrt, Campendium, and others lock their best filters behind subscriptions, leaving free users with a poor experience.

### User Pain Points (from real reviews & research)
- "I entered an amenity like swimming and only one of fifteen listings mentions it" — Hipcamp user
- "Outdated listings, missing filters for critical needs like pet-friendliness" — industry research
- "Some locations lack recent reviews — spots with no reviews in months or even years"
- "I end up using 3 different apps to plan one trip"
- Campers with dogs or fishing gear consistently report having to call campgrounds directly to verify what the apps can't tell them

---

## 7. Design & Prototype Notes
_To be populated in Phase 3_

### User Flows
-

### Wireframe Decisions
-

### Figma Link
-

---

## 8. Architecture & Technical Decisions

### AI Cost Management Strategy
- **Use Claude Haiku for MVP** — significantly cheaper than Sonnet/Opus, fully capable for natural language search interpretation
- **Cache AI responses** — identical or similar searches return cached results rather than making repeated API calls
- **Rate limit free users** — limit AI searches per day on the free tier to control costs
- **Hybrid search approach** — use traditional filters for simple queries, only invoke AI for genuinely conversational or complex natural language input
- **Pre-generate where possible** — for future AI summaries, run batch jobs to generate and store in the database rather than on-demand generation
- **Monitor usage from day one** — set up cost alerts in the Anthropic Console to avoid surprises

### AI Feature Rollout
- **MVP:** Natural language search only — keeps AI scope tight and costs predictable
- **Phase 2:** AI campsite summaries, trip planner, smart recommendations

### Data Models
- TBD in Phase 4

### API Structure
- TBD in Phase 4

### Key Technical Decisions
- TBD in Phase 4

---

## 9. Session Log

| Date | Phase | What Was Covered |
|---|---|---|
| Feb 28, 2026 | Phase 0 | Project concept defined, MVP scoped, tech stack chosen and rationale documented |
| Feb 28, 2026 | Phase 1 | Market research completed — competitors mapped, key gaps and user pain points identified. WikiCamp identified as declining incumbent. AI-first strategy adopted as core differentiator. App named Pitchd. |

---

## 10. Current Status & Next Steps

**Current Phase:** 2 — Define User Personas & Problem Statement
**Next Action:** Synthesise research into a clear problem statement and 1-2 user personas

---

*Tip for Claude Code: Paste sections 1–5 and the relevant phase section to give Claude the context it needs to help you build.*