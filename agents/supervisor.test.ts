import { test } from "node:test";
import assert from "node:assert/strict";
import { route, toStateUpdate, type ReplyClassifier } from "./supervisor";
import type { LeadStateType } from "../state/schema";

function baseState(overrides: Partial<LeadStateType> = {}): LeadStateType {
  return {
    leadId: "lead-123",
    conversationHistory: [],
    objectionHistory: [],
    routingTrace: [],
    qualificationStatus: "unqualified",
    resolution: "in_progress",
    needsHumanReview: false,
    lastContactAt: new Date().toISOString(),
    nextFollowUpAt: null,
    turnsCount: 0,
    ...overrides,
  };
}

// Fake classifier — no network call, just returns whatever the test wants.
function fakeClassifier(result: "provides_missing_info" | "raises_objection" | "ready_to_book" | "unparseable"): ReplyClassifier {
  return async () => result;
}

test("already-resolved leads route to end regardless of event", async () => {
  const state = baseState({ resolution: "booked" });
  const decision = await route(state, { type: "time_trigger", daysSinceContact: 5 }, fakeClassifier("ready_to_book"));
  assert.equal(decision.nextAgent, "end");
});

test("time trigger + qualified lead routes to scheduler", async () => {
  const state = baseState({ qualificationStatus: "qualified" });
  const decision = await route(state, { type: "time_trigger", daysSinceContact: 3 }, fakeClassifier("ready_to_book"));
  assert.equal(decision.nextAgent, "scheduler");
  assert.match(decision.reason, /3 days/);
});

test("time trigger + unqualified lead routes to qualifier", async () => {
  const state = baseState({ qualificationStatus: "partially_qualified" });
  const decision = await route(state, { type: "time_trigger", daysSinceContact: 3 }, fakeClassifier("ready_to_book"));
  assert.equal(decision.nextAgent, "qualifier");
});

test("reply classified as objection routes to objectionHandler", async () => {
  const state = baseState();
  const decision = await route(state, { type: "lead_reply", message: "your price is way too high" }, fakeClassifier("raises_objection"));
  assert.equal(decision.nextAgent, "objectionHandler");
});

test("reply classified as ready_to_book routes to scheduler", async () => {
  const state = baseState();
  const decision = await route(state, { type: "lead_reply", message: "ok let's do it" }, fakeClassifier("ready_to_book"));
  assert.equal(decision.nextAgent, "scheduler");
});

test("reply classified as provides_missing_info routes to qualifier", async () => {
  const state = baseState();
  const decision = await route(state, { type: "lead_reply", message: "we're in a townhouse, own it, roof is south-facing" }, fakeClassifier("provides_missing_info"));
  assert.equal(decision.nextAgent, "qualifier");
});

// The documented failure + recovery case from the project spec: an
// unparseable reply must not be dropped or silently mis-routed — it has
// to escalate, and needsHumanReview must flip true on the resulting state
// update so a human actually sees it.
test("unparseable reply escalates and flags needsHumanReview", async () => {
  const state = baseState();
  const decision = await route(state, { type: "lead_reply", message: "🤷 idk man ask my cousin lol" }, fakeClassifier("unparseable"));
  assert.equal(decision.nextAgent, "escalate");

  const update = toStateUpdate(decision);
  assert.equal(update.needsHumanReview, true);
  assert.equal(update.routingTrace?.length, 1);
  assert.equal(update.routingTrace?.[0].toAgent, "escalate");
});

test("toStateUpdate does not flag review for normal routes", async () => {
  const decision = { nextAgent: "scheduler" as const, reason: "test" };
  const update = toStateUpdate(decision);
  assert.equal(update.needsHumanReview, false);
});
