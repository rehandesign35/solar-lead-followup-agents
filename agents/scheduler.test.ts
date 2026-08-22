import { test } from "node:test";
import assert from "node:assert/strict";
import { runScheduler, type AvailabilityChecker } from "./scheduler";
import type { LeadStateType } from "../state/schema";

function baseState(overrides: Partial<LeadStateType> = {}): LeadStateType {
  return {
    leadId: "lead-1",
    conversationHistory: [],
    objectionHistory: [],
    routingTrace: [],
    qualificationStatus: "qualified",
    resolution: "in_progress",
    needsHumanReview: false,
    lastContactAt: new Date().toISOString(),
    nextFollowUpAt: null,
    turnsCount: 6,
    ...overrides,
  };
}

test("slot found -> booked, no future follow-up needed", async () => {
  const state = baseState();
  const check: AvailabilityChecker = async () => ({ slot: "Tue Aug 25, 2pm" });

  const result = await runScheduler(state, check);

  assert.equal(result.stateUpdate.resolution, "booked");
  assert.equal(result.stateUpdate.nextFollowUpAt, null);
  assert.match(result.reply, /Tue Aug 25, 2pm/);
});

test("no slot found -> stays in_progress, schedules a retry", async () => {
  const state = baseState();
  const check: AvailabilityChecker = async () => ({ slot: null });

  const result = await runScheduler(state, check);

  assert.equal(result.stateUpdate.resolution, "in_progress");
  assert.notEqual(result.stateUpdate.nextFollowUpAt, null);
  const retryDate = new Date(result.stateUpdate.nextFollowUpAt as string);
  assert.ok(retryDate.getTime() > Date.now());
});
