# agents/

Supervisor + sub-agent prompt/logic goes here. Build order (per project spec):

- [ ] `supervisor.ts` — routing logic, tested in isolation with fake inputs first (Step 2)
- [ ] `qualifier.ts` (Step 3)
- [ ] `objectionHandler.ts` (Step 3)
- [ ] `scheduler.ts` (Step 3)
- [ ] `graph.ts` — wires all of the above together via LangGraph (Step 4)

Not started yet — this is the next build step after the state schema.
