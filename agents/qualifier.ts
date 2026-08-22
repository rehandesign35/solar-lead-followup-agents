import type { LeadStateType, QualificationStatus, ConversationTurn } from "../state/schema";
import type { AgentTurnResult } from "./types";

/**
 * Qualifier: re-engages leads who weren't fully qualified on the first
 * call, and gathers the missing info conversationally rather than via a
 * form. `message` is null when this runs off a time-trigger (no new reply
 * yet, just re-engaging after N days of silence).
 *
 * The judgment call — "is this enough info now, or still missing something"
 * — is delegated to an injected `extract` function, so this is testable
 * with fake inputs and no API calls. Same pattern as the Supervisor.
 */

export type QualifierExtractor = (
  message: string | null,
  state: LeadStateType
) => Promise<{ status: QualificationStatus; reply: string }>;

export async function runQualifier(
  state: LeadStateType,
  message: string | null,
  extract: QualifierExtractor
): Promise<AgentTurnResult> {
  const { status, reply } = await extract(message, state);
  const timestamp = new Date().toISOString();

  const turns: ConversationTurn[] = [];
  if (message) {
    turns.push({ turn: state.turnsCount + turns.length + 1, role: "lead", message, agent: "qualifier", timestamp });
  }
  turns.push({ turn: state.turnsCount + turns.length + 1, role: "agent", message: reply, agent: "qualifier", timestamp });

  return {
    reply,
    stateUpdate: {
      conversationHistory: turns,
      qualificationStatus: status,
      turnsCount: state.turnsCount + turns.length,
      lastContactAt: timestamp,
    },
  };
}
