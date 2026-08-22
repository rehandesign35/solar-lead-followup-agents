import { test } from "node:test";
import assert from "node:assert/strict";
import { runObjectionHandler, type ObjectionResponder } from "./objectionHandler";
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
    turnsCount: 2,
    ...overrides,
  };
}

test("logs the objection and response, and appends to objectionHistory", async () => {
  const state = baseState();
  const respond: ObjectionResponder = async (objection) => `I hear you on "${objection}" — here's how the financing works...`;

  const result = await runObjectionHandler(state, "the price is too high", respond);

  assert.equal(result.stateUpdate.objectionHistory?.length, 1);
  assert.equal(result.stateUpdate.objectionHistory?.[0].objection, "the price is too high");
  assert.equal(result.stateUpdate.conversationHistory?.length, 2);
  assert.equal(result.stateUpdate.turnsCount, 4);
});

test("respond() receives prior objection history, so repeated objections can be handled differently", async () => {
  const priorObjection = {
    objection: "price is too high",
    response: "here's the financing breakdown",
    agent: "objectionHandler",
    timestamp: new Date().toISOString(),
  };
  const state = baseState({ objectionHistory: [priorObjection] });

  let sawPriorHistory = false;
  const respond: ObjectionResponder = async (_objection, s) => {
    sawPriorHistory = s.objectionHistory.length > 0;
    return sawPriorHistory
      ? "I know price already came up — let's look at it a different way this time."
      : "Let me walk you through the pricing.";
  };

  const result = await runObjectionHandler(state, "still think it's too expensive", respond);

  assert.equal(sawPriorHistory, true);
  assert.match(result.reply, /already came up/);
  assert.equal(result.stateUpdate.objectionHistory?.length, 1); // this turn's new entry, reducer appends to the existing one
});
