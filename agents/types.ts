import type { LeadStateType } from "../state/schema";

/** What every sub-agent hands back: the message to send the lead, and the state update. */
export interface AgentTurnResult {
  reply: string;
  stateUpdate: Partial<LeadStateType>;
}
