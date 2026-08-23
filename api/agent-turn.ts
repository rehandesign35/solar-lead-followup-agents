import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { graph } from "../agents/graph";
import type { LeadStateType } from "../state/schema";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

/** Supabase row (snake_case) -> graph state (camelCase). */
function rowToState(row: any): LeadStateType {
  return {
    leadId: row.lead_id,
    conversationHistory: row.conversation_history ?? [],
    objectionHistory: row.objection_history ?? [],
    routingTrace: row.routing_trace ?? [],
    qualificationStatus: row.qualification_status,
    resolution: row.resolution,
    needsHumanReview: row.needs_human_review,
    lastContactAt: row.last_contact_at,
    nextFollowUpAt: row.next_follow_up_at,
    turnsCount: row.turns_count,
    pendingMessage: null,
    daysSinceContact: null,
    nextAgentHint: null,
  };
}

function freshState(leadId: string): LeadStateType {
  return {
    leadId,
    conversationHistory: [],
    objectionHistory: [],
    routingTrace: [],
    qualificationStatus: "partially_qualified",
    resolution: "in_progress",
    needsHumanReview: false,
    lastContactAt: new Date().toISOString(),
    nextFollowUpAt: null,
    turnsCount: 0,
    pendingMessage: null,
    daysSinceContact: null,
    nextAgentHint: null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { leadId, message } = req.body ?? {};
  if (!leadId || !message) {
    return res.status(400).json({ error: "leadId and message are required" });
  }

  const { data: existingRow, error: fetchError } = await supabase
    .from("lead_state")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (fetchError) {
    return res.status(500).json({ error: fetchError.message });
  }

  const baseState: LeadStateType = existingRow ? rowToState(existingRow) : freshState(leadId);
  const inputState: LeadStateType = { ...baseState, pendingMessage: message, daysSinceContact: null };

  let result: LeadStateType;
  try {
    result = (await graph.invoke(inputState)) as LeadStateType;
  } catch (err: any) {
    return res.status(500).json({ error: `Agent graph failed: ${err.message ?? String(err)}` });
  }

  const { error: upsertError } = await supabase.from("lead_state").upsert(
    {
      lead_id: result.leadId,
      conversation_history: result.conversationHistory,
      objection_history: result.objectionHistory,
      routing_trace: result.routingTrace,
      qualification_status: result.qualificationStatus,
      resolution: result.resolution,
      needs_human_review: result.needsHumanReview,
      last_contact_at: result.lastContactAt,
      next_follow_up_at: result.nextFollowUpAt,
      turns_count: result.turnsCount,
    },
    { onConflict: "lead_id" }
  );

  if (upsertError) {
    return res.status(500).json({ error: upsertError.message });
  }

  // Only this turn's *new* entries — result holds the full accumulated
  // history, baseState is what existed before this invoke().
  const newTurns = result.conversationHistory.slice(baseState.conversationHistory.length);
  const newAgentTurn = [...newTurns].reverse().find((t) => t.role === "agent");
  const newTrace = result.routingTrace.slice(baseState.routingTrace.length);
  const lastTrace = newTrace[newTrace.length - 1];

  return res.status(200).json({
    reply: newAgentTurn?.message ?? null,
    handledBy: lastTrace?.toAgent ?? null,
    reason: lastTrace?.reason ?? null,
    needsHumanReview: result.needsHumanReview,
    resolution: result.resolution,
  });
}
