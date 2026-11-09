# Learning Roadmap

> Each phase teaches one core agent-building concept **and** leaves something usable. Don't skip phase 5 (evals) — it's what turns guessing into engineering.

| # | Phase | You learn | Done when |
|---|---|---|---|
| 1 | **Hand-written loop** (CLI) | How agents actually work: model requests a tool → your code runs it → result goes back → repeat | A Python script answers "dog-friendly site 3 h from Sydney, dry this weekend" using 2–3 real tools |
| 2 | **Tool Runner + polish** | SDK helpers, streaming, error handling, prompt caching | Same behaviour with less code; streaming output; cache hits visible in usage |
| 3 | **Service + UI** | FastAPI, streaming to a browser, structured outputs rendered as cards | The founder can plan a real trip in the Next.js app, on a phone |
| 4 | **Memory & state** | Conversation persistence, user preferences, saved trips | Pitchd remembers the dog and setup; a conversation can be resumed |
| 5 | **Evals** | Building a test set, grading agent output, comparing models/prompts with evidence | 20–50 real queries with a repeatable score; model choice made from data |
| 6 | **Multi-agent & background** | Sub-agents, scheduled jobs; compare self-hosted vs Managed Agents | Nightly "weather watch" alerts on saved trips |
| 7 | **MCP server** (optional) | Standard tool protocol | Pitchd tools usable from Claude Desktop / Claude Code |

## Notes
- Phases 1–2 can live in a new `agent/` folder in this repo (decide in `open-questions.md`).
- Log everything from phase 1 — those logs seed the phase 5 eval set.
