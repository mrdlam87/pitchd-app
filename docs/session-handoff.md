# Pitchd — Session Handoff Note
> Paste this at the start of a new Claude conversation to resume where we left off.

---

## What is Pitchd?
Pitchd is an AI-powered camping travel and planning companion for Australian campers. It solves the problem of fragmented, time-consuming trip planning by letting users describe what they want in plain English — including weather preferences, activities, and amenities — and returning intelligent results on an interactive map.

**In one sentence:** What used to take hours now takes seconds.

---

## What we've done so far

### Phase 0 — Project Scoping ✅
- Defined the app concept, MVP scope, and full tech stack
- Chose Next.js, Tailwind CSS, PostgreSQL, Prisma, Supabase, Anthropic Claude API, Open-Meteo, and Vercel
- Decided to build for Australia first

### Phase 1 — Market Research ✅
- Mapped all major competitors (WikiCamp, The Dyrt, Hipcamp, Campendium, Recreation.gov, iOverlander)
- Identified WikiCamp's decline following its 2024 redesign and acquisition by G'Day Group as a major opportunity
- Key gap: **no camping app uses AI**, and **weather + campsite planning is completely unsolved**
- Adopted an AI-first strategy as the core differentiator — Pitchd is not competing as a map directory, it's a camping intelligence platform
- App named **Pitchd** (pitched tent, modern dropped-vowel branding)
- GitHub repo created: github.com/mrdlam87/pitchd-app

---

## MVP Features (locked in)
1. **Natural language search** — plain English queries interpreted by Claude API
2. **Weather-aware search** — live forecasts via Open-Meteo integrated into results
3. **Map-first UI** — interactive map displaying results
4. **Core filters** — dog-friendly, fishing, swimming, dump points, public toilets, water fill stations, laundromats, nearby hikes
5. **Open in Google Maps** — one-tap navigation link on every result

---

## The Origin Story (important for persona work)
The founder camps 1-2x per month around Sydney. A typical trip involves checking weather across multiple regions (Goulburn, Newcastle, Blue Mountains etc.) to find somewhere dry, then separately searching for campsites in those areas across multiple apps. This takes hours.

The killer query Pitchd needs to solve:
> *"Find me a campsite a few hours from Sydney this weekend where it's not raining"*

---

## Where we're up to
**Ready to begin Phase 2 — User Personas & Problem Statement**

This involves:
- Defining 1-2 user personas based on the research and origin story
- Writing a sharp problem statement
- Validating that the MVP features solve the right problems for the right people

---

## Full project context
The complete living project document is at:
`https://github.com/mrdlam87/pitchd-app/blob/main/docs/project-context.md`

---

## How to continue
Say something like:
> *"I've read the handoff note. Let's begin Phase 2 — user personas and problem statement for Pitchd."*