import { model } from "./llm";
import type { ReplyClassifier } from "./supervisor";

const LABELS = ["provides_missing_info", "raises_objection", "ready_to_book", "unparseable"] as const;

/**
 * Real implementation of the Supervisor's classifier (supervisor.ts takes
 * this as an injected function — see supervisor.test.ts for the fake
 * version used in tests). This is what actually gets wired into the graph.
 */
export const classifyReply: ReplyClassifier = async (message, state) => {
  const prompt = `You are classifying a solar lead's text reply into exactly one category.

Categories:
- provides_missing_info: gives qualification details (homeownership, roof, budget, timeline)
- raises_objection: pushes back, raises a concern or objection (price, timing, trust, etc.)
- ready_to_book: signals readiness to schedule / move forward
- unparseable: doesn't clearly fit any of the above (off-topic, ambiguous, garbled)

Examples:
- "In 1 month" -> provides_missing_info
- "Yes" (confirming a qualification question or readiness to move forward) -> ready_to_book
- "Not yet" (answering a qualification question) -> provides_missing_info
- "Maybe" (without any additional context) -> unparseable

Lead's qualification status so far: ${state.qualificationStatus}
Lead's message: "${message}"

Reply with only one of these exact words: provides_missing_info, raises_objection, ready_to_book, unparseable`;

  const response = await model.invoke(prompt);
  const text = String(response.content).trim().toLowerCase();
  const match = LABELS.find((label) => text.includes(label));
  return match ?? "unparseable";
};
