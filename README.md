# Lead Follow-Up Agents

Multi-agent lead qualification & follow-up system — Project 2 in the portfolio, built on **LangGraph.js**.

**Live demo:** [solar-lead-followup-agents-nine.vercel.app](https://solar-lead-followup-agents-nine.vercel.app)

## The problem

Project 1 (AI voice agent) recovers the immediate opportunity — it calls, qualifies, and books solar leads live. But not every lead is ready the moment they're contacted: some say "call me back," "still exploring," or "need to check with my spouse," and right now those just sit in a table. This project is what happens next — a system of coordinating agents that follows up over days, re-qualifies, handles new objections, and either books the lead or correctly marks it dead, without a human tracking any of it by hand.

*Project 1 recovers the immediate opportunity. Project 2 makes sure nothing that wasn't ready the first time gets lost.*

## Architecture

```
                    ┌──────────────┐
   lead reply  ───▶ │  SUPERVISOR  │ ── logs routing decision + reason
   or time-trigger  └──────┬───────┘    to routingTrace (the visible trace)
                            │
              ┌─────────────┼─────────────┬──────────────┐
              ▼             ▼             ▼              ▼
        ┌──────────┐ ┌─────────────┐ ┌──────────┐  ┌───────────┐
        │QUALIFIER │ │  OBJECTION  │ │SCHEDULER │  │ ESCALATE  │
        │          │ │   HANDLER   │ │          │  │(human     │
        │          │ │             │ │          │  │ review)   │
        └────┬─────┘ └──────┬──────┘ └────┬─────┘  └─────┬─────┘
             │              │             │              │
             └──────────────┴──────┬──────┴──────────────┘
                                    ▼
                          shared lead_state (Supabase)
                    conversationHistory · objectionHistory
                    routingTrace · qualificationStatus · resolution
```

- **Supervisor** — receives events (a lead reply, or a time-based trigger), decides which sub-agent handles it, and routes with a logged reason. Deterministic fast paths for known cases (already booked, already escalated); an LLM classification step only for interpreting free-text replies.
- **Qualifier** — re-engages leads who weren't fully qualified on the first call, gathers missing info conversationally.
- **Objection-handler** — responds to new objections raised in follow-up replies, and sees prior objection history so it doesn't repeat itself.
- **Scheduler** — checks availability and (re)books once a lead is ready; if nothing's open, sets a future follow-up instead of dead-ending the lead.
- **Shared lead state** — one record per lead, read and written by every agent, so a handoff never loses context. See `state/schema.ts`.

## Agent trace example

Real output from `routingTrace`, captured live off the deployed widget — this is what the trace panel on the right side of the demo renders directly, not mock UI copy:

```
[lead-4821] supervisor → qualifier:  "Reply provides qualification info — continuing the qualification flow."
[lead-4821] supervisor → escalate:   "Reply doesn't match any expected pattern — escalating for human review instead of guessing."
```

The second line is the documented failure-and-recovery case from the spec: an unparseable reply doesn't get dropped or silently mis-routed — it escalates, `needsHumanReview` flips to `true`, and `resolution` becomes `"escalated"` so the Supervisor stops auto-routing further messages from that lead until a human clears it.

## Metrics

Generated with `npm run metrics`, which queries every row in `lead_state` directly — no hand-picked numbers. These are early numbers from manual + live testing, not production volume yet; re-run the script periodically as real traffic comes through and update this section.

| Metric | Value |
|---|---|
| Total leads | 1 (early testing) |
| Resolution rate | tracked automatically — booked/dead/escalated vs. still in progress |
| Escalated to human | tracked automatically |
| Avg handoffs per lead | 4.00 |
| Avg turns to resolution | n/a yet — needs more resolved leads |

**Known limitation, found via live testing (not hidden):** a reply that directly answered the Qualifier's timeline question ("In 1 month") was misclassified as `unparseable` and escalated, instead of routing back to the Qualifier. Short-but-valid answers are currently under-recognized by the classifier prompt in `agents/classifyReply.ts` — worth tightening with a few-shot example. Full writeup in `docs/eval-results.md`.

## Tech stack & key decisions

- **LangGraph.js**, not a no-code flow builder — chosen over Relevance AI (which was seriously considered, and is faster to ship) because the code is inspectable directly in this repo, and because the skill transfers to the rest of the portfolio roadmap rather than being a one-off.
- **OpenAI**, not Anthropic, for the sub-agent LLM calls — a practical constraint (existing API key), not an architecture requirement; swapping providers only touches `agents/llm.ts`.
- **No real SMS/Twilio for the public demo** — a web chat widget instead, framed as "you're the lead, continue the conversation." Real delivery is documented as the production integration path, not faked for the demo.
- **`lead_id` is plain text, not a foreign-key-enforced `calls.id`** — found during build that demo visitors aren't real leads and can't satisfy a real FK, so referential integrity is enforced at the app level instead of the database level for this table.
- **Escalated leads stop auto-routing** — found via live testing that an escalation wasn't actually changing `resolution`, so the Supervisor kept trying to re-classify messages from leads already flagged for a human. Fixed so `resolution: "escalated"` is itself a terminal state, same as booked/dead.

## Status

- [x] Step 1 — shared lead-state schema
- [x] Step 2 — Supervisor routing logic, tested in isolation
- [x] Step 3 — three sub-agents, each tested alone
- [x] Step 4 — wired into a real LangGraph graph
- [x] Step 5 — agent trace timeline visualization
- [x] Step 6 — live demo chat widget + Vercel API endpoint
- [x] Step 7 — real metrics via `npm run metrics`
- [x] Step 8 — docs polish (this README)

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase + OpenAI keys
npm test                # 15/15 should pass
npm run metrics         # real numbers from your own Supabase data
```

Run `state/lead_state.sql` against the same Supabase project used in Project 1. Deployed on Vercel — see `vercel.json` for the static/API split, and Project Settings → Environment Variables for the 3 required secrets.

