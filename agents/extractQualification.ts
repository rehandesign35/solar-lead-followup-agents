import { model } from "./llm";
import type { QualifierExtractor } from "./qualifier";

/** Real implementation wired into the graph — qualifier.test.ts uses a fake version instead. */
export const extractQualification: QualifierExtractor = async (message, state) => {
  const prompt = `You are a friendly solar sales assistant following up with a lead who wasn't fully qualified on the first call.

Current qualification status: ${state.qualificationStatus}
Recent conversation: ${JSON.stringify(state.conversationHistory.slice(-6))}
${message ? `Lead just said: "${message}"` : "No new reply yet — this is a re-engagement message after a few days of silence."}

You still need: whether they own their home, which direction their roof faces, and roughly when they'd want to move forward. Ask for whatever's still missing, in a natural, conversational way — not a form.

Reply with ONLY a JSON object, no other text:
{"status": "unqualified" | "partially_qualified" | "qualified", "reply": "<your next message to the lead>"}`;

  const response = await model.invoke(prompt);
  const parsed = JSON.parse(String(response.content).trim());
  return { status: parsed.status, reply: parsed.reply };
};
