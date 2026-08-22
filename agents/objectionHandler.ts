import type { LeadStateType, ObjectionEntry, ConversationTurn } from "../state/schema";
import type { AgentTurnResult } from "./types";

/**
 * Objection-handler: responds to new objections raised in follow-up
 * replies. Text-based and slower-paced than a live call — and it has to
 * remember what was already said, so `respond` always receives the full
 * state, including prior objectionHistory, not just the new message.
 */

export type ObjectionResponder = (
  objection: string,
  state: LeadStateType
) => Promise<string>;

export async function runObjectionHandler(
  state: LeadStateType,
  objection: string,
  respond: ObjectionResponder
): Promise<AgentTurnResult> {
  const reply = await respond(objection, state);
  const timestamp = new Date().toISOString();

  const objectionEntry: ObjectionEntry = {
    objection,
    response: reply,
    agent: "objectionHandler",
    timestamp,
  };

  const turns: ConversationTurn[] = [
    { turn: state.turnsCount + 1, role: "lead", message: objection, agent: "objectionHandler", timestamp },
    { turn: state.turnsCount + 2, role: "agent", message: reply, agent: "objectionHandler", timestamp },
  ];

  return {
    reply,
    stateUpdate: {
      conversationHistory: turns,
      objectionHistory: [objectionEntry],
      turnsCount: state.turnsCount + 2,
      lastContactAt: timestamp,
    },
  };
}
