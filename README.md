# Lead Follow-Up Agents

Multi-agent lead qualification & follow-up system — Project 2 in the portfolio,
built on **LangGraph.js**.

## The problem

Project 1 (AI voice agent) recovers the immediate opportunity — it calls, qualifies,
and books solar leads live. But not every lead is ready the moment they're
contacted: some say "call me back," "still exploring," or "need to check with
my spouse," and right now those just sit in a table. This project is what
happens next — a system of coordinating agents that follows up over days,
re-qualifies, handles new objections, and either books the lead or correctly
marks it dead, without a human tracking any of it by hand.

*Project 1 recovers the immediate opportunity. Project 2 makes sure nothing
that wasn't ready the first time gets lost.*

## Architecture

- **Supervisor** — receives events (a lead reply, or a time-based trigger),
  decides which sub-agent handles it, and routes with a logged reason.
- **Qualifier** — re-engages leads who weren't fully qualified on the first call.
- **Objection-handler** — responds to new objections raised in follow-up replies.
- **Scheduler** — checks availability and (re)books once a lead is ready.
- **Shared lead state** — one record per lead, read and written by every agent,
  so a handoff never loses context. See `state/schema.ts`.

## Stack

- **LangGraph.js** (`@langchain/langgraph`) — explicit graph-based orchestration
- **Supabase** — shared lead state, same project as Project 1
- **Vercel** — serverless functions running the graph
- Demo frontend: web chat widget + live agent-trace timeline (not real SMS —
  documented as the production integration path instead)

## Status

- [x] **Step 1 — Shared lead-state schema** (`state/schema.ts`, `state/lead_state.sql`)
- [x] **Step 2 — Supervisor routing logic** (`agents/supervisor.ts`, tested in isolation — `npm test`)
- [x] **Step 3 — Sub-agents** (`agents/qualifier.ts`, `objectionHandler.ts`, `scheduler.ts`, each tested alone — 14/14 tests passing)
- [x] **Step 4 — Wired into a real LangGraph graph** (`agents/graph.ts` — Supervisor -> conditional edge -> sub-agent -> END)
- [x] **Step 5 — Trace visualization** (`frontend/trace-timeline.html` — colored spine shows agent handoffs, includes the escalation case)
- [ ] Step 6 — Demo chat widget frontend
- [ ] Step 7 — Log outcomes to Supabase
- [ ] Step 8 — Docs, README polish, walkthrough video

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase + Anthropic keys
npm run typecheck
```

Run `state/lead_state.sql` against the same Supabase project used in Project 1.
