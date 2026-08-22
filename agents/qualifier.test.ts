import { test } from "node:test";
import assert from "node:assert/strict";
import { runQualifier, type QualifierExtractor } from "./qualifier";
import type { LeadStateType } from "../state/schema";

function baseState(overrides: Partial<LeadStateType> = {}): LeadStateType {
  return {
    leadId: "lead-1",
    conversationHistory: [],
    objectionHistory: [],
    routingTrace: [],
    qualificationStatus: "partially_qualified",
    resolution: "in_progress",
    needsHumanReview: false,
    lastContactAt: new Date().toISOString(),
    nextFollowUpAt: null,
    turnsCount: 4,
    ...overrides,
  };
}

test("time-triggered re-engagement (no message) logs only an agent turn", async () => {
  const state = baseState();
  const extract: QualifierExtractor = async () => ({
    status: "partially_qualified",
    reply: "Hey, still interested? What kind of roof do you have?",
  });

  const result = await runQualifier(state, null, extract);

  assert.equal(result.stateUpdate.conversationHistory?.length, 1);
  assert.equal(result.stateUpdate.conversationHistory?.[0].role, "agent");
  assert.equal(result.stateUpdate.turnsCount, 5);
});

test("a reply that completes qualification flips status to qualified", async () => {
  const state = baseState();
  const extract: QualifierExtractor = async () => ({
    status: "qualified",
    reply: "Great, that's everything I need — I'll get you booked in.",
  });

  const result = await runQualifier(state, "we own the house, south-facing roof, ready this month", extract);

  assert.equal(result.stateUpdate.qualificationStatus, "qualified");
  assert.equal(result.stateUpdate.conversationHistory?.length, 2);
  assert.equal(result.stateUpdate.conversationHistory?.[0].role, "lead");
  assert.equal(result.stateUpdate.conversationHistory?.[1].role, "agent");
  assert.equal(result.stateUpdate.turnsCount, 6);
});
