import { Annotation } from "@langchain/langgraph";

/**
 * Shared lead state — the single object every agent (Supervisor, Qualifier,
 * Objection-handler, Scheduler) reads from and writes to. This is what makes
 * this a real multi-agent system instead of three separate chatbots: a
 * handoff between agents never loses context, because there is no separate
 * context to lose.
 *
 * Mirrors the `lead_state` table in Supabase (see ./lead_state.sql) — this
 * file is the in-memory/in-graph shape, the SQL file is the persisted shape.
 */

// ---- Supporting types ----

export type TurnRole = "lead" | "agent";

export interface ConversationTurn {
  turn: number;
  role: TurnRole;
  message: string;
  /** which agent produced this turn: "supervisor" | "qualifier" | "objectionHandler" | "scheduler" */
  agent: string;
  timestamp: string; // ISO 8601
}

export interface ObjectionEntry {
  objection: string;
  response: string;
  agent: string;
  timestamp: string;
}

export interface RoutingTraceEntry {
  timestamp: string;
  fromAgent: string;
  toAgent: string;
  /** why the Supervisor routed here — this is what the trace UI renders */
  reason: string;
}

export type QualificationStatus =
  | "unqualified"
  | "partially_qualified"
  | "qualified"
  | "dead";

export type Resolution = "in_progress" | "booked" | "dead" | "escalated";

// ---- LangGraph state schema ----

export const LeadState = Annotation.Root({
  // Identity — links back to Project 1's leads table.
  leadId: Annotation<string>(),

  // Append-only logs. Reducers concat rather than overwrite: every node
  // adds to history, none of them replace it.
  conversationHistory: Annotation<ConversationTurn[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  objectionHistory: Annotation<ObjectionEntry[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  routingTrace: Annotation<RoutingTraceEntry[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),

  // Status fields — last-write-wins (the default reducer), since each
  // sub-agent sets these directly rather than appending to a history.
  qualificationStatus: Annotation<QualificationStatus>({
    reducer: (_prev, next) => next,
    default: () => "unqualified",
  }),
  resolution: Annotation<Resolution>({
    reducer: (_prev, next) => next,
    default: () => "in_progress",
  }),
  needsHumanReview: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),

  // Timing — drives the "N days since last contact" re-engagement trigger.
  lastContactAt: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => new Date().toISOString(),
  }),
  nextFollowUpAt: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  turnsCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),

  // --- Transient, per-invocation only. NOT persisted to Supabase — these
  // exist to carry the incoming event into the graph and let the
  // Supervisor's decision flow to the conditional edge. Reset to null
  // before/after each invoke(), never written to the lead_state table. ---
  pendingMessage: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  daysSinceContact: Annotation<number | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  nextAgentHint: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type LeadStateType = typeof LeadState.State;
