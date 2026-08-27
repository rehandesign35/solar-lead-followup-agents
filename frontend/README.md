# Frontend

Two static entry points for the lead follow-up demo:

- `index.html` is the live chat workspace. It posts lead replies to
  `/api/agent-turn` and renders the returned agent handoff.
- `trace-timeline.html` is the standalone persisted-state trace view.

Both pages are intentionally dependency-free and deploy from the `frontend/`
output directory configured in `vercel.json`.
