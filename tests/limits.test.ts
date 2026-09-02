import { PHASE1A_DECISION_LIFETIME_MS } from "../src/phase1a-config.js";
import test from "node:test";
import assert from "node:assert/strict";
import { DecisionRunner } from "../src/decision-runner.js";
import { CombatSensor } from "../src/combat-sensor.js";
import { CombatNormalizer } from "../src/combat-normalizer.js";
import { fixture, mind, makeBridge } from "./fixtures.js";
import type { DecisionRequestV1 } from "../src/contracts.js";
import { OpenRouterDecisionProvider } from "../src/openrouter-provider.js";
import { ProviderFailure } from "../src/llm-gateway.js";
const meta = { provider: "TEST_DOUBLE", model: "TEST_DOUBLE", returnedModel: null, temperature: .25, maxOutputTokens: 700, format: "json", latencyMs: 0, requestBytes: 0, approximateTokens: 0, decisionId: "test", stepId: "test", snapshotId: "test" };
const base = (r: DecisionRequestV1) => ({ schemaVersion: "1.0", decisionId: r.decisionId, snapshotId: r.state.snapshotId, stepId: r.stepId });
test("one repair and one plan remain inside one bounded decision before final intent", async () => {
  const mock = makeBridge(); const requests: DecisionRequestV1[] = []; let n = 0;
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide(r) {
    requests.push(structuredClone(r)); n++;
    const response: unknown = n === 1 ? { invalid: true } : n === 2 ?
      { ...base(r), type: "PLAN_REQUEST", goal: { kind: "retreat", destination: { x: 2, y: 2 } } } :
      { ...base(r), type: "FINAL_INTENT", intent: { kind: "end_turn" } };
    return { text: JSON.stringify(response), metadata: meta };
  } }, () => []);
  const result = await runner.run(fixture, mind, new AbortController().signal);
  assert.equal(n, 3); assert.equal(result.accepted, true); assert.equal(result.status, "VALIDATED_INTENT");
  assert.equal(new Set(requests.map(r => r.deadlineAt)).size, 1);
  assert.equal(new Set(requests.map(r => r.decisionId)).size, 1);
  assert.deepEqual(requests.map(r => r.limits.modelResponsesRemaining), [5, 4, 3]);
  assert.equal(requests[1]?.limits.planRequestsRemaining, 2); assert.equal(requests[1]?.limits.repairResponsesRemaining, 1);
  assert.equal(requests[2]?.limits.planRequestsRemaining, 1); assert.equal(requests[2]?.planFeedback.length, 1);
  assert.equal(result.writesDispatched, 0);
});test("secret accidentally placed in mind fixture prevents any provider call", async () => {
  let called = false; const mock = makeBridge();
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide() { called = true; return { text: "", metadata: meta }; } }, () => ["private-test-secret"]);
  const result = await runner.run(fixture, { ...mind, personality: "private-test-secret" }, new AbortController().signal);
  assert.equal(called, false); assert.equal(result.status, "SECRET_IN_CONTEXT");
});
test("a hidden relationship identity prevents provider context transmission", async () => {
  let called = false; const mock = makeBridge();
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide() { called = true; return { text: "", metadata: meta }; } }, () => []);
  const result = await runner.run(fixture, { ...mind, relationships: [{ actorId: "hidden-actor", summary: "hidden" }] }, new AbortController().signal);
  assert.equal(called, false); assert.equal(result.status, "MIND_UNKNOWN_ACTOR");
});
test("duplicate item identities cannot enter the LLM catalogue", async () => {
  const mock = makeBridge(); const raw = await new CombatSensor(mock.bridge).capture(fixture);
  raw.actor.items.push(raw.actor.items[0]!);
  assert.throws(() => new CombatNormalizer().normalize(raw), /DUPLICATE_ITEM_ID/);
});
test("already-cancelled invocation never calls the provider or writes", async () => {
  let called = false; const mock = makeBridge(); const abort = new AbortController(); abort.abort();
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide() { called = true; return { text: "", metadata: meta }; } }, () => []);
  const result = await runner.run(fixture, mind, abort.signal);
  assert.equal(called, false); assert.equal(result.status, "CANCELLED"); assert.equal(result.writesDispatched, 0);
});
test("provider failures preserve safe request metadata without returning response bodies", async () => {
  const mock = makeBridge(); const secret = "not-a-real-secret";
  const provider = new OpenRouterDecisionProvider(() => ({ provider: "openrouter", model: "custom/model", temperature: .25, apiKey: secret, bridgeKey: "" }),
    (async () => new Response(secret, { status: 503 })) as typeof fetch);
  const raw = await new CombatSensor(mock.bridge).capture(fixture);
  const request: DecisionRequestV1 = { ...base({ decisionId: "d", stepId: "s", state: { snapshotId: "x" } } as DecisionRequestV1),
    deadlineAt: new Date(Date.now() + PHASE1A_DECISION_LIFETIME_MS).toISOString(), limits: { planRequestsRemaining: 2, repairResponsesRemaining: 2, modelResponsesRemaining: 5 },
    planFeedback: [], state: new CombatNormalizer().normalize(raw), narrative: mind } as DecisionRequestV1;
  await assert.rejects(provider.decide(request, null, new AbortController().signal), error => {
    assert.ok(error instanceof ProviderFailure);
    assert.equal(error.metadata.model, "custom/model"); assert.ok(error.metadata.latencyMs >= 0);
    assert.ok(!JSON.stringify(error).includes(secret)); return true;
  });
});
