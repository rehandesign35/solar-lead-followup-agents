# Eval Results

## How to generate these numbers

Run `npm run metrics` locally (needs `.env` set up with your Supabase keys).
It queries every row in `lead_state` and prints:

- Routing accuracy (as a sample of routing decisions — accuracy itself is
  a human spot-check against these, not something a script can score alone)
- Handoff count per resolved lead
- Resolution rate (booked/dead vs. still in progress)
- Average turns-to-resolution

## Latest run

_(paste the output of `npm run metrics` here after each run)_

## Known limitation — routing accuracy

Found during live testing on the deployed widget: a reply that directly
answered the Qualifier's timeline question ("In 1 month") got classified as
`unparseable` and escalated to human review instead of routing back to the
Qualifier. Short, terse-but-valid answers are currently under-recognized by
the classifier prompt in `agents/classifyReply.ts` — worth tightening with
a few-shot example of a short timeline answer. Logged here rather than
silently ignored, since this is exactly the kind of miss the routing-accuracy
metric exists to catch.

## Documented failure + recovery case

A reply that doesn't match any expected pattern (e.g. "🤷 idk man ask my
cousin lol") gets escalated and flips `needsHumanReview: true` instead of
the conversation silently dying. Covered by an isolated test in
`agents/supervisor.test.ts`, and reproduced live on the deployed widget.
