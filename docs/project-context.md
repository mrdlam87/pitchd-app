# Pitchd — Project Context Document
> This is a living document. Update it at the end of every working session.
> **Location:** `docs/project-context.md` in the GitHub repo

---

## 1. Project Overview

**App Name:** Pitchd
**Domain:** pitchd.app (to confirm)
**GitHub:** github.com/mrdlam87/pitchd-app
**Type:** Full-stack Web App
**Stage:** Pre-development — Design & Architecture phase
**Target Market:** Australia (primary), with potential to expand

### Vision
An AI-powered camping travel and planning companion for Australian campers. Pitchd understands what you're looking for — whether you type it or just describe your situation — and handles the research so you can spend less time planning and more time outside.

### The Problem
Planning a camping trip in Australia is surprisingly time-consuming and fragmented. A typical camper might spend hours across multiple apps and websites just to answer basic questions — where should I go this weekend? Will it be raining? Is there a dump point nearby? Can I bring my dog?

There is no single tool that brings this all together intelligently. The leading Australian app (WikiCamp) has declined significantly following a 2024 redesign and commercial acquisition, leaving a vocal and displaced user base actively looking for an alternative. And not one existing camping app uses AI.

### The Solution
Pitchd understands what you're looking for and does the research for you. Describe your trip in plain English — including weather preferences, activities, amenities, and distance — and Pitchd finds the best options and displays them on a map.

What used to take hours now takes seconds.

### Strategic Positioning
Pitchd is not competing with WikiCamp as a map directory — it's a fundamentally different product. WikiCamp is a database with a map. Pitchd is an AI-powered camping travel and planning companion. The AI layer is the differentiator that sidesteps the cold start problem and provides value that established players can't easily replicate.

### The Origin Story (real use case)
The founder camps 1-2 times per month around Sydney. A typical trip starts by checking weather across multiple regions (Goulburn, Newcastle, Blue Mountains etc.) to find somewhere dry, then manually searching for campsites in those areas across multiple apps. This process can take hours.

Pitchd is built to solve exactly this — in a single natural language query:
> *"Find me a campsite a few hours from Sydney this weekend where it's not raining"*

This is the problem. This is the user. This is the product.

---

## 2. Target Users

### Persona 1 — Matt, The Weekend Warrior (Primary MVP Persona)

**Age:** 34 | **Location:** Western Sydney | **Camping frequency:** 1–2x per month
**Setup:** Car camper or roof-top tent, often brings his dog

**Situation:** Matt works a demanding job and camping is his reset button. He plans trips on Thursday or Friday evening for the upcoming weekend — short planning window, limited patience for friction. He knows the areas he likes (Blue Mountains, Hunter Valley, South Coast) but weather makes or breaks the trip. A wet weekend with no shelter is a write-off.

**Current behaviour:** Checks BOM or Weatherzone across 3–4 regions to find somewhere dry, then cross-references WikiCamp, Google Maps, and Facebook groups to find a matching site. The whole process takes 1–2 hours and still feels uncertain.

**The killer query:** *"Find me a dog-friendly campsite a few hours from Sydney this weekend where it's not going to rain"*

**Frustrations:**
- Can't get weather and campsite info in one place
- WikiCamp has deteriorated since the G'Day Group acquisition
- Amenity info (dump points, dog rules) is often wrong or missing
- Ends up calling campgrounds to confirm what apps should tell him

**What he wants:** Type what he's looking for, get a trustworthy answer on a map, and go.

---

### Persona 2 — Sarah, The Road Tripper (Secondary Persona)

**Age:** 41 | **Location:** Melbourne | **Camping frequency:** 4–6 longer trips per year
**Setup:** Caravan with dump tank, travels with partner and two kids

**Situation:** Sarah plans further in advance but her trips are more complex — she needs dump points along the route, caravan-friendly sites, somewhere the kids can swim or fish, and proper toilets. She's less spontaneous than Matt but just as frustrated by fragmented tools, and will spend hours across multiple apps still feeling unsure.

**Current behaviour:** Uses WikiCamp for dump points and toilets, a separate weather app, and GeoScout or Hema Explorer for caravan-friendly routes. She's well aware of how broken the process is.

**The killer query:** *"Plan a 5-day caravan trip from Melbourne to Adelaide with dump points and kid-friendly swimming stops"*

**Frustrations:**
- Dump point and amenity data is unreliable — she's driven 20 minutes out of the way to a dump point that no longer exists
- No app handles route-based planning with amenities
- Weather planning across a multi-day route requires entirely manual checking

**What she wants:** One tool that handles the full planning sequence — route, weather, sites, amenities — so she can focus on the trip, not the research.

> **Note:** Sarah is well served by the MVP for individual site searches. Route-based trip planning and multi-day itineraries are post-MVP features.

---

### Problem Statement

**Australian campers waste hours every trip doing research that should take seconds.** Planning a camping trip today means checking weather across multiple regions, cross-referencing two or three apps for campsites, manually verifying amenity data that's often wrong, and still feeling uncertain when you leave. There is no single tool that understands what you're looking for and brings it all together.

Pitchd solves this with a single natural language query. Describe your trip — where you're starting, when you're going, what you need — and Pitchd handles the rest: finding campsites, checking live weather across regions, and surfacing results that actually match. What used to take hours now takes seconds.

---

### MVP Feature Validation

| Feature | Solves for Matt? | Solves for Sarah? |
|---|---|---|
| Natural language search | ✅ Core need | ✅ Core need |
| Weather-aware search | ✅ Primary pain point | ✅ Multi-day route planning |
| Map-first UI | ✅ Spatial decision making | ✅ Route visualisation |
| Core filters (dog, dump points, fishing, etc.) | ✅ Dog-friendly is critical | ✅ Dump points are critical |
| Open in Google Maps | ✅ Confirms and navigates | ✅ Turn-by-turn to site |

---

## 3. MVP Features

- **Natural language search** — describe what you want in plain English (e.g. *"dog-friendly campsite within 3 hours of Sydney where it's not raining this weekend"*)
- **Weather-aware search** — integrates live weather forecasts into search results so campers can find somewhere dry without manually checking multiple locations
- **Map-first UI** — browse and search results via an interactive map
- **Core filters** — dog-friendly, fishing, swimming, dump points, public toilets, water fill stations, laundromats, nearby hikes
- **Open in Google Maps** — every campsite and amenity has a one-tap link to open directly in Google Maps for navigation

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
| Frontend | Next.js (React) + Tailwind CSS | Most in-demand React framework, handles frontend + backend in one project |
| Backend | Next.js API Routes | Keeps stack unified, no separate server needed for MVP |
| AI | Anthropic Claude API (Haiku for MVP) | Powers natural language search interpretation, cost-effective at small scale |
| Weather | Open-Meteo | Free, no API key needed, great Australian coverage |
| Database | PostgreSQL + Prisma ORM | Battle-tested DB, Prisma makes it approachable with type safety |
| Hosted DB | Supabase | Managed Postgres, generous free tier, no vendor lock-in |
| Map | TBD (Mapbox or Google Maps) | To be decided in architecture phase |
| Deployment | Vercel | Native Next.js integration, auto CI/CD from GitHub, preview deployments |
| Version Control | GitHub | Industry standard, builds good habits |
| Data Sources | OpenStreetMap, data.gov.au, state park APIs | Free, open Australian camping and amenity data |

---

## 5. Project Phases

- [x] **Phase 0** — Project scoping & stack decisions ✅
- [x] **Phase 1** — Market research ✅
- [x] **Phase 2** — Define user personas & problem statement ✅
- [ ] **Phase 3** — Prototyping & design (Figma wireframes)
- [ ] **Phase 4** — Technical planning (architecture, data models, milestones)
- [ ] **Phase 5** — Build & ship (iterative development)

---

## 6. Market Research Findings

### Competitors Reviewed

| App | Strengths | Weaknesses |
|---|---|---|
| **WikiCamp (AU)** | 60,000+ AU sites, dump points, toilets, laundromats, community data | Acquired by G'Day Group (commercial bias), disastrous 2024 redesign alienated loyal users, slow, buggy, data going stale |
| **The Dyrt** | Largest US database (public + private), community reviews, good filters | Full functionality behind $35.99/yr paywall, no activity filters, US-focused |
| **Hipcamp** | Unique private land listings, broad site types | Search notoriously inaccurate, amenity filters unreliable |
| **Campendium** | Cell coverage overlays, strong community reviews, free tier | Geared toward RVers/vanlifers, US-focused |
| **Recreation.gov** | Official federal land data, free, direct booking | Only covers federal land, clunky UI, no activity-based filtering |
| **iOverlander** | Free, crowdsourced, global | Outdated listings, no search bar (map-only), amenity data unreliable |
| **CampsiteTonight** | Cross-platform search, cancellation alerts | Focused on availability/booking, not discovery or amenity finding |

### Key Gaps Identified
- **No camping app uses AI** — every competitor is essentially a database with filters
- **WikiCamp's decline is a major opportunity** — acquired by G'Day Group, disastrous 2024 redesign, loyal user base actively looking for an alternative
- **Weather + campsite planning is completely unsolved** — campers manually check forecasts across multiple regions then separately search for sites. No app combines these
- **Amenity finding and campsite finding are treated as separate problems** — no app elegantly combines search with dump points, laundromats, toilets etc.
- **Activity-based filtering is largely absent** — fishing, dog-friendly trails, swimming holes not filterable on most apps
- **Data freshness is a recurring frustration** — users don't trust amenity data on most platforms
- **Too much friction** — users cross-reference 2-3 apps to plan one trip

### User Pain Points (from real reviews & research)
- "Since the site's sale to G'Day Group it has gone to the dogs" — WikiCamp user
- "Useless! Why make something that was working so well almost impossible to use" — WikiCamp user after redesign
- "I entered an amenity like swimming and only one of fifteen listings mentions it" — Hipcamp user
- "I end up using 3 different apps to plan one trip"
- Campers with dogs or fishing gear consistently report having to call campgrounds directly to verify what apps can't tell them
- Founder spends hours every trip checking weather across regions then searching for sites separately

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
- **MVP:** Natural language search + weather-aware results
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
| Feb 28, 2026 | Phase 0 | Project concept defined, MVP scoped, tech stack chosen and rationale documented. App named Pitchd. |
| Feb 28, 2026 | Phase 1 | Market research completed — competitors mapped, key gaps and user pain points identified. WikiCamp identified as declining incumbent. AI-first strategy adopted as core differentiator. Weather-aware search added to MVP. Origin story captured. |
| Mar 1, 2026 | Phase 2 | User personas defined (Matt — Weekend Warrior, Sarah — Road Tripper). Problem statement written. MVP features validated against both personas. Phase 2 complete. |

---

## 10. Current Status & Next Steps

**Current Phase:** 3 — Prototyping & Design
**Next Action:** Begin Figma wireframes — start with the core search flow (home screen → natural language input → map results)

---

*Tip for Claude Code: Paste sections 1–5 and the relevant phase section to give Claude the context it needs to help you build.*
