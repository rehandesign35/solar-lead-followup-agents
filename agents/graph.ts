import { StateGraph, START, END } from "@langchain/langgraph";
import { LeadState, type LeadStateType } from "../state/schema";
import { route, toStateUpdate, type SupervisorEvent } from "./supervisor";
import { runQualifier } from "./qualifier";
import { runObjectionHandler } from "./objectionHandler";
import { runScheduler } from "./scheduler";
import { classifyReply } from "./classifyReply";
import { extractQualification } from "./extractQualification";
import { respondToObjection } from "./respondToObjection";
import { checkAvailability } from "./checkAvailability";

/**
 * The real flow: START -> supervisor -> conditional edge -> one sub-agent -> END.
 *
 * One call to graph.invoke() = one turn. The incoming event (a lead's reply,
 * or a time-based re-engagement trigger) comes in via the transient
 * `pendingMessage` / `daysSinceContact` fields on state (see schema.ts) —
 * whichever one is set determines the event type. Everything else on state
 * is what you loaded from Supabase for this lead before calling invoke().
 */

function eventFromState(state: LeadStateType): SupervisorEvent {
  if (state.pendingMessage) {
    return { type: "lead_reply", message: state.pendingMessage };
  }
  return { type: "time_trigger", daysSinceContact: state.daysSinceContact ?? 0 };
}

async function supervisorNode(state: LeadStateType): Promise<Partial<LeadStateType>> {
  const event = eventFromState(state);
  const decision = await route(state, event, classifyReply);
  return {
    ...toStateUpdate(decision),
    nextAgentHint: decision.nextAgent,
  };
}

async function qualifierNode(state: LeadStateType): Promise<Partial<LeadStateType>> {
  const result = await runQualifier(state, state.pendingMessage, extractQualification);
  return result.stateUpdate;
}

async function objectionHandlerNode(state: LeadStateType): Promise<Partial<LeadStateType>> {
  // Supervisor only routes here off a lead_reply event, so this is always set.
  const result = await runObjectionHandler(state, state.pendingMessage as string, respondToObjection);
  return result.stateUpdate;
}

async function schedulerNode(state: LeadStateType): Promise<Partial<LeadStateType>> {
  const result = await runScheduler(state, checkAvailability);
  return result.stateUpdate;
}

/** Reads the Supervisor's decision back off state to pick the next node. */
function routeFromSupervisor(state: LeadStateType): "qualifier" | "objectionHandler" | "scheduler" | typeof END {
  switch (state.nextAgentHint) {
    case "qualifier":
      return "qualifier";
    case "objectionHandler":
      return "objectionHandler";
    case "scheduler":
      return "scheduler";
    default:
      // "end" (already resolved) or "escalate" (needsHumanReview already
      // set by toStateUpdate) — nothing more to run this turn either way.
      return END;
  }
}

export const graph = new StateGraph(LeadState)
  .addNode("supervisor", supervisorNode)
  .addNode("qualifier", qualifierNode)
  .addNode("objectionHandler", objectionHandlerNode)
  .addNode("scheduler", schedulerNode)
  .addEdge(START, "supervisor")
  .addConditionalEdges("supervisor", routeFromSupervisor)
  .addEdge("qualifier", END)
  .addEdge("objectionHandler", END)
  .addEdge("scheduler", END)
  .compile();
