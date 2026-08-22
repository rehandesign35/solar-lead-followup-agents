import { ChatOpenAI } from "@langchain/openai";

// Requires OPENAI_API_KEY in your .env — used by every real (non-test)
// agent implementation. Model is overridable via OPENAI_MODEL if you want
// to swap it later without touching code.
export const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature: 0.3,
});
