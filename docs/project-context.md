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
A clean, fast, map-first camp trip companion for Australian campers. Find campsites, essential road amenities, and nearby activities (hikes, fishing spots, swimming holes) all in one place — the way Google Maps works, but built specifically for camping life.

---

## 2. Target User

- To be refined during market research
- Initial assumption: casual to semi-regular campers who camp with dogs, fish, or have other specific requirements that make generic campsite search tools inadequate

---

## 3. MVP Features

- Map-first UI — browse and search via an interactive map (like Google Maps)
- Campsite search by location (nearby or region)
- Filter by activity: dog-friendly, fishing, swimming
- Essential road amenities on the map: dump points, public toilets, water fill stations, laundromats
- Nearby activities: hikes, walking trails
- Clean, fast, reliable results

### Future Features (post-MVP)
- Save / favourite locations
- User accounts & login
- Trip planning / route builder
- Offline support
- User-submitted reviews and photo updates
- Additional amenity types (fuel, BBQ areas, playgrounds, mobile coverage etc.)
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
_To be populated in Phase 4_

### Data Models
-

### API Structure
-

### Key Technical Decisions
-

---

## 9. Session Log

| Date | Phase | What Was Covered |
|---|---|---|
| Feb 28, 2026 | Phase 0 | Project concept defined, MVP scoped, tech stack chosen and rationale documented |
| Feb 28, 2026 | Phase 1 | Market research completed — competitors mapped, key gaps and user pain points identified |

---

## 10. Current Status & Next Steps

**Current Phase:** 2 — Define User Personas & Problem Statement
**Next Action:** Synthesise research into a clear problem statement and 1-2 user personas

---

*Tip for Claude Code: Paste sections 1–5 and the relevant phase section to give Claude the context it needs to help you build.*