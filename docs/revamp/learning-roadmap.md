# Learning Roadmap

> Each phase teaches one core agent-building concept **and** leaves something usable. Don't skip phase 5 (evals) — it's what turns guessing into engineering.

Two tracks: the **trip planner** (interactive, user-facing) and the **data agent** (background, data quality — see `data-agent.md`). The data pilot is a good *first* agent: no UI, no latency pressure, easy to check by hand, and it improves v1's data immediately.

### Data agent track

| # | Phase | You learn | Done when |
|---|---|---|---|
| D1 | **Single-region enrichment pilot** (CLI) | The tool loop, web search/fetch, structured extraction, provenance | 50–100 Blue Mountains sites have sourced facts in the proposal table |
| D2 | **Hand review = first eval** | Grading agent output, measuring accuracy and cost per site | ≥ 90% of high-confidence facts correct; cost per site known |
| D3 | **Verify + dedupe + schedule** | Batch processing, scheduled runs, conflict rules; self-hosted vs Managed Agents comparison; first MCP server; `/admin/review` page | Region-by-region refresh running on a schedule; Managed Agents vs our own Job scored on the D2 eval set and the winner kept |

### Trip planner track

| # | Phase | You learn | Done when |
|---|---|---|---|
| 1 | **Hand-written loop** (CLI) | How agents actually work: model requests a tool → your code runs it → result goes back → repeat | A Python script answers "dog-friendly site 3 h from Sydney, dry this weekend" using 2–3 real tools |
| 2 | **Tool Runner + polish** | SDK helpers, streaming, error handling, prompt caching | Same behaviour with less code; streaming output; cache hits visible in usage |
| 3 | **Service + UI** | FastAPI, streaming to a browser, structured outputs rendered as cards | The founder can plan a real trip in the Next.js app, on a phone |
| 4 | **Memory & state** | Conversation persistence, user preferences, saved trips | Pitchd remembers the dog and setup; a conversation can be resumed |
| 5 | **Evals** | Building a test set, grading agent output, comparing models/prompts with evidence | 20–50 real queries with a repeatable score; model choice made from data; Sarah's killer query + variants included from the start |
| 5b | **Multi-day trips** (Sarah) | Longer multi-step agent runs, planning a sequence, route-based tools, handling forecast horizons | "5-day caravan trip Melbourne → Adelaide with dump points and swimming stops" produces a day-by-day plan that passes its eval cases; ready before the stage 2 caravan tester |
| 6 | **Multi-agent & background** | Sub-agents, scheduled jobs (Cloud Run Jobs); deterministic checks that hand off to the agent | Nightly "weather watch" alerts on saved trips (the Managed Agents comparison moved to D3) |
| 7 | **MCP server** (optional) | Standard tool protocol | Pitchd tools usable from Claude Desktop / Claude Code |

## Notes
- Phases 1–2 can live in a new `agent/` folder in this repo (decide in `open-questions.md`).
- Log everything from phase 1 — those logs seed the phase 5 eval set.
