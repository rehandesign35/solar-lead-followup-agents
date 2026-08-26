import type { LeadStateType, RoutingTraceEntry } from "../state/schema";

/**
 * The Supervisor's only job: given the current lead state and an incoming
 * event, decide which sub-agent handles it next, and log why. It does not
 * do any qualifying, objection-handling, or scheduling itself.
 *
 * Deterministic fast paths run first (no LLM call, no cost, no latency).
 * Free-text lead replies are the one case that needs interpretation, so
 * that step is delegated to an injected `classify` function — which means
 * this whole module is testable with fake inputs and zero API calls.
 * See supervisor.test.ts.
 */

export type SupervisorEvent =
  | { type: "lead_reply"; message: string }
  | { type: "time_trigger"; daysSinceContact: number };

export type ReplyClassification =
  | "provides_missing_info"
  | "raises_objection"
  | "ready_to_book"
  | "unparseable";

export type ReplyClassifier = (
  message: string,
  state: LeadStateType
) => Promise<ReplyClassification>;

export type NextAgent =
  | "qualifier"
  | "objectionHandler"
  | "scheduler"
  | "escalate"
  | "end";

export interface RoutingDecision {
  nextAgent: NextAgent;
  reason: string;
}

export async function route(
  state: LeadStateType,
  event: SupervisorEvent,
  classify: ReplyClassifier
): Promise<RoutingDecision> {
  // Fast path: already resolved — nothing left to route.
  if (state.resolution === "booked" || state.resolution === "dead" || state.resolution === "escalated") {
    return {
      nextAgent: "end",
      reason: `Lead already resolved as "${state.resolution}" — no further routing.`,
    };
  }

  // Time-based trigger: no new message, just "N days since contact".
  if (event.type === "time_trigger") {
    if (state.qualificationStatus === "qualified") {
      return {
        nextAgent: "scheduler",
        reason: `${event.daysSinceContact} days since last contact and lead is already qualified — attempting to (re)book.`,
      };
    }
    return {
      nextAgent: "qualifier",
      reason: `${event.daysSinceContact} days since last contact and qualification is incomplete — re-engaging to gather missing info.`,
    };
  }

  // Lead sent a free-text reply — classify it, then route on the result.
  const classification = await classify(event.message, state);

  switch (classification) {
    case "raises_objection":
      return { nextAgent: "objectionHandler", reason: "Reply raises a new objection." };
    case "ready_to_book":
      return { nextAgent: "scheduler", reason: "Reply signals the lead is ready to book." };
    case "provides_missing_info":
      return {
        nextAgent: "qualifier",
        reason: "Reply provides qualification info — continuing the qualification flow.",
      };
    case "unparseable":
    default:
      return {
        nextAgent: "escalate",
        reason: "Reply doesn't match any expected pattern — escalating for human review instead of guessing.",
      };
  }
}

/** Converts a routing decision into the state update a graph node returns. */
export function toStateUpdate(
  decision: RoutingDecision,
  fromAgent: string = "supervisor"
): Partial<LeadStateType> {
  const trace: RoutingTraceEntry = {
    timestamp: new Date().toISOString(),
    fromAgent,
    toAgent: decision.nextAgent,
    reason: decision.reason,
  };
  const update: Partial<LeadStateType> = {
    routingTrace: [trace],
    needsHumanReview: decision.nextAgent === "escalate",
  };
  if (decision.nextAgent === "escalate") {
    update.resolution = "escalated";
  }
  return update;
}
