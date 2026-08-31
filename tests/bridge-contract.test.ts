import test from "node:test";
import assert from "node:assert/strict";
import { CombatSensor, sceneTokenSummarySchema, tokenDetailSchema, summaryDisposition } from "../src/combat-sensor.js";
import { CombatNormalizer } from "../src/combat-normalizer.js";
import { READ_COMMANDS, type ReadCommand } from "../src/bridge-session.js";
import { DecisionRunner } from "../src/decision-runner.js";
import { SafeError, safeError } from "../src/safety.js";
import { fixture, mind, makeBridge } from "./fixtures.js";

test("Bridge v8.11.2 numeric summary and string detail parse and normalize without writes", async () => {
  const mock = makeBridge();
  const raw = await new CombatSensor(mock.bridge).capture(fixture);
  assert.equal(raw.tokens[0]!.disposition, -1);
  assert.equal(raw.token.disposition, "hostile");
  assert.deepEqual(raw.tokens[0]!.hp, { value: 7, max: 7 });
  assert.deepEqual(raw.token.hp, { current: 7, max: 7 });
  assert.equal(summaryDisposition(raw.tokens[0]!.disposition), raw.token.disposition);
  for (const [numeric, label] of [[-2, "secret"], [-1, "hostile"], [0, "neutral"], [1, "friendly"]] as const) {
    assert.equal(summaryDisposition(sceneTokenSummarySchema.parse({ ...raw.tokens[0], disposition: numeric }).disposition), label);
    assert.equal(tokenDetailSchema.parse({ ...raw.token, disposition: label }).disposition, label);
  }
  const state = new CombatNormalizer().normalize(raw);
  assert.equal(state.self.actorLink, null); assert.equal(state.runtime.scopeVerified, false);
  assert.equal(state.runtime.automaticExecution, false); assert.equal(state.nearby[0]!.disposition, "friendly");
  assert.ok(mock.calls.every(call => READ_COMMANDS.includes(call.type)));
  assert.deepEqual([...new Set(mock.calls.map(call => call.type))].sort(), [...READ_COMMANDS].sort());
});

test("token detail validates nullable fields and never invents actorLink", () => {
  const { values } = makeBridge();
  const detail = values["get-token"] as Record<string, unknown>;
  const parsed = tokenDetailSchema.parse({ ...detail, hp: null, ac: null, actorId: null, actorLink: true });
  assert.equal(parsed.hp, null); assert.equal(parsed.ac, null); assert.equal(parsed.actorId, null);
  assert.equal("actorLink" in parsed, false);
  for (const field of Object.keys(detail)) {
    const incomplete = { ...detail }; delete incomplete[field];
    assert.equal(tokenDetailSchema.safeParse(incomplete).success, false, field);
  }
  assert.equal(tokenDetailSchema.safeParse({ ...detail, hp: { value: 7, max: 7 } }).success, false);
});

test("invalid and swapped dispositions fail closed at their respective read boundaries", async () => {
  for (const value of ["hostile", 2, -3, null, {}, "RAW_SECRET_SENTINEL"]) {
    const mock = makeBridge();
    (mock.values["get-scene-tokens"] as { tokens: Record<string, unknown>[] }).tokens[0]!.disposition = value;
    await assert.rejects(new CombatSensor(mock.bridge).capture(fixture), error =>
      safeError(error) === "BRIDGE_DATA_INVALID:get-scene-tokens:tokens");
  }
  for (const value of [-1, "enemy", "RAW_SECRET_SENTINEL", null, {}]) {
    const mock = makeBridge(); (mock.values["get-token"] as Record<string, unknown>).disposition = value;
    await assert.rejects(new CombatSensor(mock.bridge).capture(fixture), error =>
      safeError(error) === "BRIDGE_DATA_INVALID:get-token:disposition");
  }
});

test("get-token scene identity and summary/detail disposition consistency reject mismatches", async () => {
  const mock = makeBridge(); (mock.values["get-token"] as Record<string, unknown>).sceneId = "another-scene";
  await assert.rejects(new CombatSensor(mock.bridge).capture(fixture), /SCENE_MISMATCH/);
  const changed = makeBridge(); (changed.values["get-token"] as Record<string, unknown>).disposition = "secret";
  await assert.rejects(new CombatSensor(changed.bridge).capture(fixture), /STALE_SNAPSHOT/);
});

test("secret disposition remains excluded for perceived targets even when not hidden", async () => {
  const mock = makeBridge();
  const target = (mock.values["get-scene-tokens"] as { tokens: Record<string, unknown>[] }).tokens[1]!;
  target.disposition = -2; target.hidden = false;
  await assert.rejects(new CombatSensor(mock.bridge).capture(fixture), /UNSUPPORTED_OR_HIDDEN_TOKEN/);
});

test("every READ schema has distinct safe diagnostics without raw fields or values", async () => {
  const fields: Record<ReadCommand, string> = {
    "get-combat-state": "round", "get-world-info": "world", "get-scene": "grid", "get-scene-tokens": "tokens",
    "get-actor": "system", "get-actor-effects": "effects", "get-combat-turn-context": "nearbyTokens", "get-token": "disposition",
  };
  for (const command of READ_COMMANDS as ReadCommand[]) {
    const mock = makeBridge();
    (mock.values[command] as Record<string, unknown>)[fields[command]] = "RAW_SECRET_SENTINEL";
    await assert.rejects(new CombatSensor(mock.bridge).capture(fixture), error => {
      assert.equal(safeError(error), `BRIDGE_DATA_INVALID:${command}:${fields[command]}`);
      assert.ok(!String(error).includes("RAW_SECRET_SENTINEL")); return true;
    });
  }
  for (const code of ["BRIDGE_DATA_INVALID:get-token:RAW_SECRET_SENTINEL", "BRIDGE_DATA_INVALID:move-token:disposition",
    "BRIDGE_DATA_INVALID:get-token:disposition:RAW_SECRET_SENTINEL"])
    assert.equal(safeError(new SafeError(code)), "INTERNAL_ERROR");
});

test("runner exposes only token boundary diagnostic and stops before normalization or LLM with zero writes", async () => {
  const mock = makeBridge(); (mock.values["get-token"] as Record<string, unknown>).disposition = "RAW_SECRET_SENTINEL";
  let providerCalls = 0;
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide() { providerCalls++; throw new Error("MUST_NOT_CALL"); } }, () => []);
  const result = await runner.run(fixture, mind, new AbortController().signal);
  assert.equal(result.status, "BRIDGE_DATA_INVALID:get-token:disposition");
  assert.equal(result.state, null); assert.equal(result.stateBytes, 0); assert.equal(providerCalls, 0);
  assert.equal(result.writesDispatched, 0); assert.equal(result.execution, "DISABLED");
  assert.ok(!JSON.stringify(result).includes("RAW_SECRET_SENTINEL"));
  assert.ok(!JSON.stringify(result).includes("RAW_BIOGRAPHY"));
});
