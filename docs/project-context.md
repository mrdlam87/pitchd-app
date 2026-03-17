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
- **Pitchd pick** — one-tap best recommendation based on location, upcoming weekend weather and balanced defaults. No input required.
- **Browse mode** — swipe to map without searching, explore nearby campsites and amenities based on current device location

### Post-MVP — Phase 2
- **AI campsite summaries** — intelligently synthesised descriptions drawn from open data sources
- **AI trip planner** — input your dates, starting point, setup and interests and get a full itinerary
- **Smart recommendations** — learns your camping style and surfaces spots you'd love
- **Conversational trip assistant** — ask questions about any campsite and get intelligent answers
- **AI photo tagging** — automatically categorise user-submitted photos
- **Pitchd pick personalisation** — evolves from signal-based to learned preferences and usage history
- **Area-level weather overlays** — Google Maps "local vibe" style weather at zoom-out, individual site weather at zoom-in
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
| Map | Mapbox (tentative) | Polished tiles, customisable styles, good AU coverage — to confirm at start of Phase 5 |
| Deployment | Vercel | Native Next.js integration, auto CI/CD from GitHub, preview deployments |
| Auth | Auth.js (NextAuth) + Google OAuth | No password storage, one-click sign in, easy Next.js integration |
| Version Control | GitHub | Industry standard, builds good habits |
| Data Sources | OpenStreetMap, data.gov.au, state park APIs | Free, open Australian camping and amenity data |

---

## 5. Project Phases

- [x] **Phase 0** — Project scoping & stack decisions ✅
- [x] **Phase 1** — Market research ✅
- [x] **Phase 2** — Define user personas & problem statement ✅
- [x] **Phase 3** — Prototyping & design ✅
- [x] **Phase 4** — Technical planning (architecture, data models, milestones) ✅
- [ ] **Phase 5** — Build & ship (iterative development) — M1 complete ✅, M2 in progress

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

### Figma
- Prototype: https://www.figma.com/design/pHfkpN27vM0zYhNbU0bK0r/Pitchd-%E2%80%94-Prototype?node-id=30-2
- UI design complete as of March 2026
- Generated via Claude Code MCP from interactive prototype

### Visual Direction (settled)
- **Fonts:** Nunito + Lora pairing
- **Palette:** Light cream/sand base with forest green accents, terracotta/coral highlights (#c4714a) — warm and consumer-grade, departed from earlier dark green prototype
- **Photography / illustration:** Illustrated landscape scenes with tent silhouette used as hero on home screen and card headers; to be replaced with real location photography in production
- **Cards:** Clean white/cream cards with subtle shadows — frosted glass dropped in favour of lighter palette
- **Weather badge:** "Great / Good / Poor" pill top-right of each card, colour-coded green/yellow/red
- **Active filter state:** Terracotta outline + checkmark — communicates AI sync state clearly

### Screen Architecture
Three core screens:

1. **Home screen** — Illustrated hero, AI search textarea, predefined searches below input, suggested searches list. Swipe left to map.
2. **Filter panel** — Full-screen overlay accessible from Filters button in search bar. Activities and Amenities in separate sections. Date picker, city dropdown, drive time slider. "Search with these filters" CTA.
3. **Map results view** — Real map tiles, persistent pill search bar + predefined searches pinned at top, numbered campsite pins + icon amenity pins, AllTrails-style bottom drawer with peek / half / full states.

### Confirmed Design Patterns (from Figma review)
- Predefined searches sit below search input on home screen and below search bar on map — consistent placement confirmed
- "More / Less" text toggle on drawer alongside drag handle — accessibility addition, keep
- Summary row in drawer: "X areas found · ranked by [intent] · [drive time] of [city]" — language confirmed
- Active predefined search chip: terracotta outline + checkmark = AI sync state visible at a glance
- Full drawer card structure: illustrated header image → name + badge → drive time + blurb → weather bar → day columns → amenity tags → AI summary text
- Loading state: map screen shown immediately, spinner centred, ghost drawer at bottom with "0 areas found"

### UX Decisions
See `docs/ux-session-1.md` for full UX decisions. Key principles:
- AI and filters are always in sync — filter panel reflects AI interpretation, user can correct
- Map is always the hero — interactions keep the map prominent
- Minimum necessary movement — drawer and map only move when they need to
- Two modes (browse + search results) share consistent design language, differ in data and ordering
- Pitchd pick is the north star interaction — one tap, best answer, no friction

### User Flows
See `docs/ux-session-1.md` for detailed flow decisions covering:
- Home → search → map transition
- Browse mode (swipe to map)
- Pin tap behaviour
- Drawer states and interactions
- Filter + AI sync

---

## 8. Architecture & Technical Decisions

Full technical detail lives in `docs/technical/technical-design.md`.

**Key decisions summary:**
- Next.js App Router + Tailwind, deployed to Vercel
- Auth.js with Google OAuth — no passwords, closed beta at launch
- Mapbox for maps (tentative — confirm at Phase 5 start)
- PostgreSQL via Prisma on Supabase
- OSM as campsite data base layer, enriched from state park sources
- Claude Haiku for all MVP AI features, responses cached in DB
- Navigate button uses Google Maps URL scheme — no SDK or API key required

---

## 9. Session Log

| Date | Phase | What Was Covered |
|---|---|---|
| Feb 28, 2026 | Phase 0 | Project concept defined, MVP scoped, tech stack chosen and rationale documented. App named Pitchd. |
| Feb 28, 2026 | Phase 1 | Market research completed — competitors mapped, key gaps and user pain points identified. WikiCamp identified as declining incumbent. AI-first strategy adopted as core differentiator. Weather-aware search added to MVP. Origin story captured. |
| Mar 1, 2026 | Phase 2 | User personas defined (Matt — Weekend Warrior, Sarah — Road Tripper). Problem statement written. MVP features validated against both personas. Phase 2 complete. |
| Mar 15, 2026 | Phase 3 | UI design complete (Figma via Claude Code). UX Session 1 completed — core search flow, map interactions, pin behaviour, drawer interactions, filters, predefined searches and Pitchd pick defined. Full decisions in ux-session-1.md. |
| Mar 16, 2026 | Phase 5 — M1 | M1 complete. Scaffolded Next.js app (#13), configured Prisma + Supabase (#14), set up Auth.js + Google OAuth (#15), implemented protected routes with beta/admin access control (#16), deployed to Vercel with all env vars configured (#17). App live at pitchd-app.vercel.app. |
| Mar 18, 2026 | Phase 5 — M2 | M2 started. Wrote Prisma schema for all data models (#18). Seeded AmenityType lookup table with 8 records — 4 activities (dog_friendly, fishing, hiking, swimming) and 4 POIs (dump_point, water_fill, laundromat, toilets) (#19). Fixed CI claude-code-review workflow — now posts as claude[bot] in the PR Reviews section using the Claude GitHub App. Added .gitattributes for consistent line endings. |

---

## 10. Current Status & Next Steps

**Current Phase:** Phase 5 — Build & ship (M2 in progress)

**Completed:**
- M1 fully complete — app boots, Google sign-in works, protected routes active, deployed to Vercel
- M2 started — Prisma schema written (#18), AmenityType lookup table seeded (#19)
- CI: claude-code-review workflow working — posts as `claude[bot]` reviewer via Claude GitHub App

**Next Actions:**
- M2 — Build OSM ingestion script (Overpass API → Postgres) to seed campsite data

---

*Tip for Claude Code: Paste sections 1–5, section 7, and the relevant phase section to give Claude the context it needs to help you build.*
