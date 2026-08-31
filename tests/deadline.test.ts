import test from "node:test";
import assert from "node:assert/strict";
import { PHASE1A_DECISION_LIFETIME_MS } from "../src/phase1a-config.js";
import { CombatSensor } from "../src/combat-sensor.js";
import { CombatNormalizer } from "../src/combat-normalizer.js";
import { DecisionRunner } from "../src/decision-runner.js";
import { OpenRouterDecisionProvider } from "../src/openrouter-provider.js";
import type { DecisionRequestV1 } from "../src/contracts.js";
import type { ModelReply } from "../src/llm-gateway.js";
import { READ_COMMANDS } from "../src/bridge-session.js";
import { fixture, mind, makeBridge } from "./fixtures.js";
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const now = Date.UTC(2026, 7, 31, 12);
function reply(r: DecisionRequestV1): ModelReply {
  return { text: JSON.stringify({ schemaVersion: "1.0", decisionId: r.decisionId, snapshotId: r.state.snapshotId,
    stepId: r.stepId, type: "FINAL_INTENT", intent: { schemaVersion: "1.0", decisionId: r.decisionId,
      snapshotId: r.state.snapshotId, kind: "end_turn", action: null, movement: null } }),
    metadata: { provider: "TEST_DOUBLE", model: "TEST_DOUBLE", returnedModel: null, temperature: .25, maxOutputTokens: 700,
      format: "json", latencyMs: 0, requestBytes: 0, approximateTokens: 0,
      decisionId: r.decisionId, stepId: r.stepId, snapshotId: r.state.snapshotId } };
}

test("supervised snapshot and decision use one 60-second lifetime; valid response after 30 seconds can pass", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
  assert.equal(PHASE1A_DECISION_LIFETIME_MS, 60_000);
  const mock = makeBridge(); const sensor = new CombatSensor(mock.bridge);
  const raw = await sensor.capture(fixture); const state = new CombatNormalizer().normalize(raw);
  assert.equal(Date.parse(state.expiresAt) - Date.parse(state.observedAt), PHASE1A_DECISION_LIFETIME_MS);
  const result = await new DecisionRunner(sensor, { async decide(r) {
    assert.equal(r.deadlineAt, r.state.expiresAt);
    assert.equal(Date.parse(r.deadlineAt) - Date.now(), 60_000);
    t.mock.timers.tick(45_000); return reply(r);
  } }, () => []).run(fixture, mind, new AbortController().signal);
  assert.equal(result.accepted, true); assert.equal(result.timing.timeoutMs, 60_000);
  assert.equal(result.timing.providerLatencyMs, 45_000); assert.equal(result.writesDispatched, 0);
  assert.ok(mock.calls.every(c => READ_COMMANDS.includes(c.type)));
});

test("OpenRouter completion is aborted at the shared deadline with safe timeout and latency diagnostics", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
  const mock = makeBridge(); const started = deferred<AbortSignal>(); let completions = 0;
  const secret = "offline-key-that-must-not-appear";
  const provider = new OpenRouterDecisionProvider(() => ({ provider: "openrouter", model: "qwen/test", temperature: .25,
    apiKey: secret, bridgeKey: "" }), (async (url, init) => {
    if (String(url).endsWith("/models")) return Response.json({ data: [{ id: "qwen/test", supported_parameters: [] }] });
    completions++; const signal = init!.signal as AbortSignal;
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true }); started.resolve(signal);
    });
  }) as typeof fetch);
  const pending = new DecisionRunner(new CombatSensor(mock.bridge), provider, () => [secret]).run(fixture, mind, new AbortController().signal);
  const signal = await started.promise;
  t.mock.timers.tick(59_999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); assert.equal(signal.aborted, true);
  const result = await pending;
  assert.equal(result.status, "DECISION_DEADLINE"); assert.equal(result.accepted, false); assert.equal(completions, 1);
  assert.deepEqual(result.timing, { timeoutMs: 60_000, elapsedMs: 60_000, providerLatencyMs: 60_000 });
  assert.ok(result.events.some(e => e.error === "DECISION_DEADLINE" && e.timeoutMs === 60_000 && e.latencyMs === 60_000));
  for (const forbidden of [secret, "Authorization", "Bearer"]) assert.ok(!JSON.stringify(result).includes(forbidden));
  assert.equal(result.writesDispatched, 0); assert.ok(mock.calls.every(c => READ_COMMANDS.includes(c.type)));
});

test("an uncooperative late provider cannot keep the decision open or be accepted after expiry", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
  const mock = makeBridge(); const started = deferred<DecisionRequestV1>();
  const late = deferred<ModelReply>(); let providerSignal: AbortSignal | undefined;
  const pending = new DecisionRunner(new CombatSensor(mock.bridge), { async decide(r, _repair, signal) {
    providerSignal = signal; started.resolve(r); return late.promise;
  } }, () => []).run(fixture, mind, new AbortController().signal);
  const request = await started.promise; t.mock.timers.tick(60_000);
  const result = await pending; assert.equal(providerSignal!.aborted, true);
  assert.equal(result.status, "DECISION_DEADLINE"); assert.equal(result.accepted, false);
  const readsAtExpiry = mock.calls.length; const saved = JSON.stringify(result);
  t.mock.timers.tick(1); late.resolve(reply(request)); await late.promise; await Promise.resolve();
  assert.equal(JSON.stringify(result), saved); assert.equal(mock.calls.length, readsAtExpiry);
  assert.equal(result.writesDispatched, 0);
});

test("expiry during post-provider readback still prevents final acceptance", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
  const mock = makeBridge(); const sensor = new CombatSensor(mock.bridge); const original = sensor.assertFresh.bind(sensor);
  sensor.assertFresh = async raw => { await original(raw); t.mock.timers.tick(60_000); };
  const result = await new DecisionRunner(sensor, { async decide(r) { return reply(r); } }, () => []).run(fixture, mind, new AbortController().signal);
  assert.equal(result.accepted, false); assert.equal(result.status, "DECISION_DEADLINE"); assert.equal(result.writesDispatched, 0);
});

test("already expired snapshot never starts a provider and cancellation remains distinct", async t => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now });
  const mock = makeBridge(); const sensor = new CombatSensor(mock.bridge); const raw = await sensor.capture(fixture);
  raw.observedAt = new Date(now - 60_000).toISOString(); let calls = 0;
  const result = await new DecisionRunner(sensor, { async decide(r) { calls++; return reply(r); } }, () => [])
    .run(fixture, mind, new AbortController().signal, async () => raw);
  assert.equal(calls, 0); assert.equal(result.status, "DECISION_DEADLINE"); assert.equal(result.writesDispatched, 0);
  const started = deferred<void>(); const cancel = new AbortController();
  const pending = new DecisionRunner(sensor, { async decide() { started.resolve(); return new Promise<ModelReply>(() => {}); } }, () => [])
    .run(fixture, mind, cancel.signal);
  await started.promise; cancel.abort();
  const cancelled = await pending; assert.equal(cancelled.status, "CANCELLED"); assert.equal(cancelled.writesDispatched, 0);
});
