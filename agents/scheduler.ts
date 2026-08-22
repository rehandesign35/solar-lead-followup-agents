import type { LeadStateType, ConversationTurn, Resolution } from "../state/schema";
import type { AgentTurnResult } from "./types";

/**
 * Scheduler: checks availability and (re)books once a lead is ready.
 * If nothing's available right now, it doesn't dead-end the lead — it
 * sets a future follow-up so the time-triggered path picks it back up.
 */

export type AvailabilityChecker = (
  state: LeadStateType
) => Promise<{ slot: string | null }>;

const RETRY_AFTER_MS = 1000 * 60 * 60 * 24 * 2; // 2 days

export async function runScheduler(
  state: LeadStateType,
  checkAvailability: AvailabilityChecker
): Promise<AgentTurnResult> {
  const { slot } = await checkAvailability(state);
  const timestamp = new Date().toISOString();
  const resolution: Resolution = slot ? "booked" : "in_progress";

  const reply = slot
    ? `You're booked for ${slot}. Looking forward to it.`
    : "I don't have a slot that matches right now — I'll check again and follow up shortly.";

  const turns: ConversationTurn[] = [
    { turn: state.turnsCount + 1, role: "agent", message: reply, agent: "scheduler", timestamp },
  ];

  return {
    reply,
    stateUpdate: {
      conversationHistory: turns,
      resolution,
      turnsCount: state.turnsCount + 1,
      lastContactAt: timestamp,
      nextFollowUpAt: slot ? null : new Date(Date.now() + RETRY_AFTER_MS).toISOString(),
    },
  };
}
