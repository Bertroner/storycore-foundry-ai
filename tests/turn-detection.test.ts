import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { TurnDetector, type DetectedTurn, type DetectedRunInput } from "../src/turn-detector.js";
import { BridgeSession, READ_COMMANDS } from "../src/bridge-session.js";
import { DecisionRunner } from "../src/decision-runner.js";
import { CombatSensor } from "../src/combat-sensor.js";
import { DesktopService } from "../src/desktop-service.js";
import { SettingsStore } from "../src/settings.js";
import { createIpcHandlers, UI_URL } from "../desktop/ipc.js";
import { makeBridge } from "./fixtures.js";
import type { DecisionRequestV1 } from "../src/contracts.js";

const record = (value: unknown) => value as Record<string, any>;
const request = (turn: DetectedTurn, selected = turn.candidates.filter(c => c.eligible).map(c => c.candidateId)): DetectedRunInput => ({
  requestId: randomUUID(), detectionId: turn.detectionId, selectedCandidateIds: selected, attested: true,
  mind: { personality: "Cautious creature that values survival.", motivation: "Defend its position and survive.", relevantMemory: [] },
});
const endTurn = (input: DecisionRequestV1) => ({ text: JSON.stringify({ schemaVersion: "1.0", decisionId: input.decisionId,
  snapshotId: input.state.snapshotId, stepId: input.stepId, type: "FINAL_INTENT", intent: { schemaVersion: "1.0",
    decisionId: input.decisionId, snapshotId: input.state.snapshotId, kind: "end_turn", action: null, movement: null } }),
  metadata: { provider: "TEST_DOUBLE", model: "TEST_DOUBLE", returnedModel: null, temperature: .25, maxOutputTokens: 700,
    format: "json", latencyMs: 1, requestBytes: 1, approximateTokens: 1,
    decisionId: input.decisionId, stepId: input.stepId, snapshotId: input.state.snapshotId } });

test("Detect derives active combat, actor, token and scene IDs using audited no-sceneId read", async () => {
  const mock = makeBridge(); const detector = new TurnDetector(mock.bridge); const turn = await detector.detect();
  assert.deepEqual(mock.calls[0], { type: "get-combat-state", params: {} });
  assert.deepEqual(mock.calls[1], { type: "get-scene", params: { includeScreenshot: false } });
  assert.equal(turn.scene.id, "scene"); assert.equal(turn.scene.name, "Test Arena");
  assert.equal(turn.combat.id, "combat"); assert.equal(turn.combat.combatantId, "npc-combatant");
  assert.equal(turn.npc.actorId, "npc"); assert.equal(turn.token.id, "npc-token");
  assert.deepEqual(turn.npc.hp, { current: 7, max: 7 }); assert.equal(turn.actorLink, null);
  assert.equal(turn.perception, "OPERATOR_CONFIRMATION_REQUIRED"); assert.equal(turn.writesDispatched, 0);
  assert.ok(mock.calls.every(c => READ_COMMANDS.includes(c.type)));
  assert.ok(!JSON.stringify(turn).includes("RAW_"));
});

test("Bridge permits omitted get-scene ID only with screenshot disabled", async () => {
  const bridge = new BridgeSession();
  await assert.rejects(bridge.read("get-scene", { includeScreenshot: false }), /BRIDGE_DISCONNECTED/);
  for (const params of [{ includeScreenshot: true }, {}, { includeScreenshot: false, arbitrary: "value" }])
    await assert.rejects(bridge.read("get-scene", params), /READ_PARAMS_INVALID/);
});

test("Detect requires started NPC turn and token membership in the detected scene", async () => {
  for (const kind of ["not-started", "no-current", "no-token", "not-npc", "wrong-detail-scene", "absent-token", "wrong-actor", "wrong-context", "grid"]) {
    const mock = makeBridge(); const values = mock.values;
    if (kind === "not-started") record(values["get-combat-state"]).started = false;
    if (kind === "no-current") record(values["get-combat-state"]).current = null;
    if (kind === "no-token") record(values["get-combat-state"]).current.tokenId = null;
    if (kind === "not-npc") record(values["get-actor"]).type = "character";
    if (kind === "wrong-detail-scene") record(values["get-token"]).sceneId = "other";
    if (kind === "absent-token") record(values["get-scene-tokens"]).tokens.shift();
    if (kind === "wrong-actor") record(values["get-token"]).actorId = "other";
    if (kind === "wrong-context") record(values["get-combat-turn-context"]).turn = 7;
    if (kind === "grid") record(values["get-scene"]).grid.units = "m";
    await assert.rejects(new TurnDetector(mock.bridge).detect(), /NO_ACTIVE_NPC_TURN|UNSUPPORTED|SCENE_MISMATCH|STALE_SNAPSHOT|CONTEXT_MISMATCH/, kind);
  }
});

test("candidates come only from active combat, not arbitrary visible scene or context tokens", async () => {
  const mock = makeBridge();
  const outsider = record(mock.values["get-scene-tokens"]).tokens[2]; outsider.hidden = false;
  const turn = await new TurnDetector(mock.bridge).detect();
  assert.deepEqual(turn.candidates.map(c => c.actorId), ["hero"]);
  assert.equal(turn.candidates[0]!.eligible, true);
  assert.ok(!JSON.stringify(turn).includes("HIDDEN_SENTINEL"));
});

test("hidden, secret, missing-context, blocked-LOS and duplicate candidates cannot be selected", async () => {
  for (const kind of ["hidden", "combat-hidden", "secret", "context", "los", "duplicate"]) {
    const mock = makeBridge(); const target = record(mock.values["get-scene-tokens"]).tokens[1];
    if (kind === "hidden") target.hidden = true;
    if (kind === "combat-hidden") record(mock.values["get-combat-state"]).combatants[1].hidden = true;
    if (kind === "secret") target.disposition = -2;
    if (kind === "context") record(mock.values["get-combat-turn-context"]).nearbyTokens = [];
    if (kind === "los") record(mock.values["get-combat-turn-context"]).nearbyTokens[0].lineOfSight = false;
    if (kind === "duplicate") record(mock.values["get-scene-tokens"]).tokens.push({ ...target, id: "duplicate" });
    const detector = new TurnDetector(mock.bridge); const turn = await detector.detect();
    assert.equal(turn.candidates[0]!.eligible, false, kind); assert.ok(turn.candidates[0]!.excludedReason);
    assert.throws(() => detector.prepare(request(turn, [turn.candidates[0]!.candidateId])), /DETECTED_SELECTION_INVALID/);
  }
});

test("deselection builds only confirmed internal IDs and factual hostile relationships", async () => {
  const mock = makeBridge(); record(mock.values["get-scene-tokens"]).tokens[1].disposition = -1;
  const detector = new TurnDetector(mock.bridge); const turn = await detector.detect();
  const full = detector.prepare(request(turn));
  assert.deepEqual(full.fixture, { sceneId: "scene", combatId: "combat", actorId: "npc", tokenId: "npc-token",
    linkedActorIds: ["npc", "hero"], perceivedTokenIds: ["hero-token"], attestSingleActiveCombat: true,
    attestViewedCombatScene: true, attestNormalWalkingNoTerrain: true });
  assert.deepEqual(full.mind.relationships, [{ actorId: "hero", summary: "Hostile combatant" }]);
  const none = detector.prepare(request(turn, []));
  assert.deepEqual(none.fixture.linkedActorIds, ["npc"]); assert.deepEqual(none.fixture.perceivedTokenIds, []);
  assert.deepEqual(none.mind.relationships, []); assert.equal(none.mind.actorId, "npc");
  assert.throws(() => detector.prepare({ ...request(turn), attested: false } as unknown as DetectedRunInput), /ATTESTATION_REQUIRED/);
});

test("changed detected combat, turn, scene, current identity or selected target rejects before LLM", async () => {
  for (const kind of ["combat", "round", "turn", "actor", "token", "scene", "target", "membership", "context", "secret"]) {
    const mock = makeBridge(); const detector = new TurnDetector(mock.bridge); const turn = await detector.detect();
    const prepared = detector.prepare(request(turn)); const values = mock.values;
    if (kind === "combat") record(values["get-combat-state"]).id = "changed";
    if (kind === "round") { record(values["get-combat-state"]).round++; record(values["get-combat-turn-context"]).round++; }
    if (kind === "turn") { record(values["get-combat-state"]).turn++; record(values["get-combat-turn-context"]).turn++; }
    if (kind === "actor") record(values["get-combat-state"]).current.actorId = "hero";
    if (kind === "token") record(values["get-combat-state"]).current.tokenId = "hero-token";
    if (kind === "scene") record(values["get-scene"]).id = "changed";
    if (kind === "target") record(values["get-scene-tokens"]).tokens.splice(1, 1);
    if (kind === "membership") record(values["get-combat-state"]).combatants.pop();
    if (kind === "context") record(values["get-combat-turn-context"]).nearbyTokens = [];
    if (kind === "secret") record(values["get-scene-tokens"]).tokens[1].disposition = -2;
    let calls = 0;
    const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide(input) { calls++; return endTurn(input); } }, () => []);
    const result = await runner.run(prepared.fixture, prepared.mind, new AbortController().signal, prepared.capture);
    assert.equal(result.status, "DETECTED_SCOPE_STALE", kind); assert.equal(calls, 0, kind);
    assert.equal(result.stateBytes, 0); assert.equal(result.writesDispatched, 0);
  }
});

test("refresh replaces old detection, failed refresh invalidates it, and altered detection IDs are rejected", async () => {
  const mock = makeBridge(); const detector = new TurnDetector(mock.bridge); const first = await detector.detect();
  const second = await detector.detect();
  assert.throws(() => detector.prepare(request(first)), /DETECTED_SCOPE_STALE/);
  assert.throws(() => detector.prepare({ ...request(second), detectionId: randomUUID() }), /DETECTED_SCOPE_STALE/);
  record(mock.values["get-scene"]).grid.units = "m";
  await assert.rejects(detector.detect()); assert.throws(() => detector.prepare(request(second)), /DETECTED_SCOPE_STALE/);
});

test("normal renderer needs no editable Foundry IDs and regenerates scope in main", async () => {
  const html = await readFile("desktop/ui/index.html", "utf8"); const renderer = await readFile("desktop/renderer.ts", "utf8");
  for (const id of ["sceneId", "combatId", "actorId", "tokenId", "linkedActorIds", "perceivedTokenIds"]) {
    assert.ok(!html.includes('id="' + id + '"')); assert.ok(!renderer.includes('input("' + id + '")'));
  }
  assert.ok(html.includes("Detect current Foundry turn")); assert.ok(html.includes("Advanced diagnostics"));
  assert.ok(html.includes('<pre id="turnDiagnostics">')); assert.ok(!html.includes('textarea id="relationships"'));
});

test("trusted Detect and Run IPC use confirmed scope, sanitized DTO and no writes", async t => {
  const directory = await mkdtemp(join(tmpdir(), "storycore-detect-test-"));
  const store = new SettingsStore(directory, { async protect(s) { return s; }, async unprotect(s) { return s; } });
  await store.save({ provider: "openrouter", model: "TEST_DOUBLE", temperature: .25, apiKey: "test-only-secret" });
  const mock = makeBridge(); const bridge = new BridgeSession(); bridge.read = mock.bridge.read;
  const seen: DecisionRequestV1[] = []; const logs: string[] = [];
  const service = new DesktopService(store, bridge, { async testConnection() { throw new Error("unused"); },
    async decide(input) { seen.push(input); return endTurn(input); } }, text => logs.push(text));
  t.after(async () => { await service.close(); await rm(directory, { recursive: true, force: true }); });
  const handlers = createIpcHandlers(service, () => true); const sender = { sender: { id: 1 }, senderFrame: { url: UI_URL, parent: null } };
  const detected = await handlers["storycore:detect-turn"](sender); assert.equal(detected.ok, true);
  const turn = (detected as { data: DetectedTurn }).data;
  assert.equal(seen.length, 0);
  const invalid = await handlers["storycore:run-decision"](sender, { ...request(turn), fixture: { actorId: "forged" } });
  assert.deepEqual(invalid, { ok: false, error: "REQUEST_INVALID" });
  const result = await handlers["storycore:run-decision"](sender, request(turn, []));
  assert.equal(result.ok, true); assert.equal(seen.length, 1);
  assert.deepEqual(seen[0]!.state.nearby, []); assert.deepEqual(seen[0]!.narrative.relationships, []);
  assert.equal(seen[0]!.state.self.actorId, "npc");
  assert.ok(JSON.stringify(result).includes('"writesDispatched":0'));
  const all = JSON.stringify([result, service.status(), logs]);
  for (const forbidden of ["RAW_", "test-only-secret", "HIDDEN_SENTINEL"]) assert.ok(!all.includes(forbidden));
  assert.ok(mock.calls.every(c => READ_COMMANDS.includes(c.type)));
});
