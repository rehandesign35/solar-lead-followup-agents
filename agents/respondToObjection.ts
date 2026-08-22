import { model } from "./llm";
import type { ObjectionResponder } from "./objectionHandler";

/** Real implementation wired into the graph — objectionHandler.test.ts uses a fake version instead. */
export const respondToObjection: ObjectionResponder = async (objection, state) => {
  const prompt = `You are a solar sales assistant handling an objection from a lead over text.

Past objections and how they were handled: ${JSON.stringify(state.objectionHistory)}
New objection: "${objection}"

Respond briefly and directly, addressing the objection. If this objection (or something close to it) already came up, acknowledge that and take a different angle rather than repeating the same answer.`;

  const response = await model.invoke(prompt);
  return String(response.content).trim();
};
