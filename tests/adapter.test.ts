import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { BridgeSession, READ_COMMANDS, type ReadCommand } from "../src/bridge-session.js";
import { CombatSensor } from "../src/combat-sensor.js";
import { CombatNormalizer } from "../src/combat-normalizer.js";
import { decisionSchema, parseDecision, validateDecision, type DecisionRequestV1 } from "../src/contracts.js";
import { DecisionRunner } from "../src/decision-runner.js";
import { OpenRouterDecisionProvider } from "../src/openrouter-provider.js";
import { SettingsStore, WindowsDpapi, type Settings } from "../src/settings.js";
import { redact, strictJson } from "../src/safety.js";
import { createApp } from "../src/server.js";
import { fixture, mind, makeBridge } from "./fixtures.js";

async function sample() {
  const mock = makeBridge(); const sensor = new CombatSensor(mock.bridge);
  const raw = await sensor.capture(fixture); const state = new CombatNormalizer().normalize(raw);
  const request: DecisionRequestV1 = { schemaVersion: "1.0", decisionId: "decision", stepId: "step", deadlineAt: state.expiresAt,
    limits: { planRequestsRemaining: 2, repairResponsesRemaining: 2, modelResponsesRemaining: 5 }, planFeedback: [], state, narrative: mind };
  return { ...mock, sensor, raw, state, request };
}
function final(request: DecisionRequestV1, weapon: "sword" | "bow" | null = "sword") {
  return { schemaVersion: "1.0", decisionId: request.decisionId, snapshotId: request.state.snapshotId, stepId: request.stepId, type: "FINAL_INTENT",
    intent: { schemaVersion: "1.0", decisionId: request.decisionId, snapshotId: request.state.snapshotId, kind: weapon ? "activate_item" : "end_turn",
      action: weapon ? { actionId: "item:" + weapon, itemId: weapon, target: { actorId: "hero", combatantId: "hero-combatant" } } : null, movement: null } };
}
function plan(request: DecisionRequestV1) {
  return { schemaVersion: "1.0", decisionId: request.decisionId, snapshotId: request.state.snapshotId, stepId: request.stepId, type: "PLAN_REQUEST",
    goal: { kind: "approach", actionId: "item:sword", target: { actorId: "hero" } } };
}
function reply(text: string) { return { text, metadata: { provider: "TEST_DOUBLE", model: "TEST_DOUBLE", returnedModel: null,
  temperature: .25, maxOutputTokens: 700, format: "json", latencyMs: 1, requestBytes: 1, approximateTokens: 1,
  decisionId: "test", stepId: "test", snapshotId: "test" } }; }
test("runtime schema is identical to canonical audit schema", async () => {
  const doc = await readFile("docs/COMBAT_INTENT_SCHEMA.md", "utf8");
  assert.deepEqual(decisionSchema, JSON.parse(doc.match(/~~~json\r?\n([\s\S]*?)\r?\n~~~/)![1]!));
});
test("PLAN_REQUEST and all FINAL_INTENT branches parse strictly", async () => {
  const { request } = await sample();
  for (const value of [plan(request), final(request), final(request, "bow"), final(request, null),
    { ...final(request, null), intent: { ...final(request, null).intent, kind: "move", movement: { planId: "offered", goalKind: "retreat" } } }])
    assert.equal(parseDecision(JSON.stringify(value)).type, value.type);
});
test("reject unknown fields at every envelope/action/target/goal boundary and combined branches", async () => {
  const { request } = await sample(); const f = final(request), p = plan(request);
  const invalid = [{ ...f, script: "code" }, { ...f, goal: p.goal }, { ...f, intent: { ...f.intent, command: "next-turn" } },
    { ...f, intent: { ...f.intent, action: { ...f.intent.action, unknown: true } } },
    { ...f, intent: { ...f.intent, action: { ...f.intent.action, target: { actorId: "hero", tokenId: "invented" } } } },
    { ...p, goal: { ...p.goal, waypoints: [] } }];
  for (const value of invalid) assert.throws(() => parseDecision(JSON.stringify(value)), /DECISION_SCHEMA_INVALID/);
});
test("reject prose, fences, duplicate keys, comments, trailing commas, arrays, huge/deep JSON", async () => {
  for (const text of ['hello', '```json\n{}\n```', '{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"x":1,}', '{/*x*/}', "[]"])
    assert.throws(() => parseDecision(text));
  assert.throws(() => strictJson(" ".repeat(8193)), /PAYLOAD_TOO_LARGE/);
  assert.throws(() => strictJson("[".repeat(40) + "0" + "]".repeat(40)), /JSON_TOO_DEEP/);
});
test("reject invented items/actions/targets, stale/mismatched IDs and unoffered movement", async () => {
  const { request } = await sample(); const f = final(request);
  for (const value of [
    { ...f, intent: { ...f.intent, action: { ...f.intent.action, itemId: "invented" } } },
    { ...f, intent: { ...f.intent, action: { ...f.intent.action, actionId: "invented" } } },
    { ...f, intent: { ...f.intent, action: { ...f.intent.action, target: { actorId: "hidden-actor" } } } },
    { ...f, snapshotId: "stale" }, { ...f, stepId: "replay" },
    { ...f, intent: { ...f.intent, decisionId: "different" } },
    { ...f, intent: { ...f.intent, movement: { planId: "invented", goalKind: "approach" } } },
  ]) assert.throws(() => validateDecision(parseDecision(JSON.stringify(value)), request));
  assert.throws(() => validateDecision(parseDecision(JSON.stringify(f)), request, Date.parse(request.state.expiresAt)), /STALE_SNAPSHOT/);
});
test("melee and ranged are both selectable; known range/LOS blockers reject without substituting tactics", async () => {
  const { request } = await sample();
  validateDecision(parseDecision(JSON.stringify(final(request))), request);
  validateDecision(parseDecision(JSON.stringify(final(request, "bow"))), request);
  request.state.nearby[0]!.distance = 20;
  assert.throws(() => validateDecision(parseDecision(JSON.stringify(final(request))), request), /KNOWN_OUT_OF_RANGE/);
  validateDecision(parseDecision(JSON.stringify(final(request, "bow"))), request);
  request.state.nearby[0]!.wallLos = false;
  assert.throws(() => validateDecision(parseDecision(JSON.stringify(final(request, "bow"))), request), /WALL_LOS_BLOCKED/);
});
test("normalization whitelists compact DTO, never raw Actor/hidden data/secret state", async () => {
  const { state } = await sample(); const text = JSON.stringify(state);
  for (const forbidden of ["RAW_", "HIDDEN_SENTINEL", "hidden-actor", "hidden-token", "biography", "flags", "description", "999"]) assert.ok(!text.includes(forbidden));
  assert.ok(Buffer.byteLength(text) < 24576);
  assert.equal(state.self.actorLink, null); assert.equal(state.budgets.movementRemaining, null);
  assert.equal(state.nearby[0]?.wallLos, null); assert.equal(state.runtime.automaticExecution, false);
  assert.equal(state.actions.length, 2);
});
test("unsupported items are omitted explicitly; never silently ranked/pruned as a tactic", async () => {
  const { raw } = await sample();
  raw.actor.items.push({ id: "spell", name: "Fireball", type: "spell", system: {} });
  raw.actor.items[0]!.system.activation = { type: "bonus", cost: 1 };
  const state = new CombatNormalizer().normalize(raw);
  assert.equal(state.actions.length, 1); assert.equal(state.quality.omittedActions, 2);
  assert.equal(state.quality.completeForDecision, false);
});
test("caps fail rather than selecting a tactical subset", async () => {
  const { raw } = await sample(); raw.actor.items = Array.from({ length: 25 }, (_, i) => ({ ...raw.actor.items[0]!, id: "w" + i }));
  assert.throws(() => new CombatNormalizer().normalize(raw), /DTO_CATALOGUE_TOO_LARGE/);
});
test("duplicate-token detection and hidden/unlinked/large/elevated/door/grid rejection", async () => {
  for (const kind of ["duplicate", "hidden", "unlinked", "large", "elevated", "door", "grid"]) {
    const mock = makeBridge();
    const tokens = mock.values["get-scene-tokens"] as { tokens: Record<string, unknown>[] };
    const hero = tokens.tokens[1]!;
    if (kind === "duplicate") tokens.tokens.push({ ...hero, id: "duplicate" });
    if (kind === "hidden") hero.hidden = true;
    if (kind === "unlinked") hero.actorLink = false;
    if (kind === "large") hero.width = 2;
    if (kind === "elevated") hero.elevation = 5;
    if (kind === "door") (mock.values["get-scene"] as { walls: unknown[] }).walls = [{ door: 1 }];
    if (kind === "grid") (mock.values["get-scene"] as { grid: { type: number } }).grid.type = 2;
    await assert.rejects(new CombatSensor(mock.bridge).capture(fixture), /UNSUPPORTED/);
  }
});
test("missing operator attestation is rejected, never auto-approved", async () => {
  const { bridge } = makeBridge(); await assert.rejects(new CombatSensor(bridge).capture({ ...fixture, attestSingleActiveCombat: false }), /BRIDGE_DATA_INVALID/);
});
test("consistency bracket and fresh pre-acceptance read reject turn/token changes", async () => {
  const { sensor, raw, values } = await sample();
  (values["get-scene-tokens"] as { tokens: { x: number }[] }).tokens[1]!.x = 200;
  await assert.rejects(sensor.assertFresh(raw), /CONTEXT_SCENE_MISMATCH|STALE_SNAPSHOT/);
  const mock = makeBridge(); let count = 0;
  const read = mock.bridge.read.bind(mock.bridge);
  mock.bridge.read = async (type, params) => {
    const value = await read(type, params);
    if (type === "get-combat-state" && ++count === 2) (value as { turn: number }).turn++;
    return value;
  };
  await assert.rejects(new CombatSensor(mock.bridge).capture(fixture), /STALE_SNAPSHOT/);
});
test("explicit read allowlist has only required audited reads; every other command is denied", async () => {
  assert.deepEqual([...READ_COMMANDS].sort(), ["get-world-info", "get-combat-state", "get-scene-tokens", "get-token", "get-actor",
    "get-actor-effects", "get-combat-turn-context", "get-scene"].sort());
  const bridge = new BridgeSession();
  for (const command of ["move-token", "dnd5e/activate-item", "next-turn", "plan-token-path", "execute-macro", "update-actor", "__proto__"])
    await assert.rejects(bridge.read(command as ReadCommand, {}), /READ_ONLY_COMMAND_DENIED/);
  await assert.rejects(bridge.read("get-scene", { sceneId: "x", includeScreenshot: true }), /READ_PARAMS_INVALID/);
  assert.equal(bridge.readsSent, 0);
});
async function socketPair(t: { after(fn: () => unknown): void }, timeout = 1000) {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" }); await once(server, "listening");
  const accepted = once(server, "connection");
  const client = new WebSocket("ws://127.0.0.1:" + (server.address() as { port: number }).port);
  const [socket] = await accepted as [WebSocket]; await once(client, "open");
  const bridge = new BridgeSession(timeout); bridge.attach(socket);
  t.after(() => { bridge.disconnect(); client.terminate(); for (const c of server.clients) c.terminate(); server.close(); });
  return { bridge, client };
}
test("WebSocket correlates out-of-order replies using existing wire envelope", async t => {
  const { bridge, client } = await socketPair(t); const requests: { id: string; type: string; params: unknown }[] = [];
  client.on("message", bytes => {
    requests.push(JSON.parse(bytes.toString()));
    if (requests.length === 2) for (const request of [...requests].reverse())
      client.send(JSON.stringify({ id: request.id, success: true, data: request.type }));
  });
  assert.deepEqual(await Promise.all([bridge.read("get-world-info", {}), bridge.read("get-combat-state", {})]), ["get-world-info", "get-combat-state"]);
  assert.deepEqual(Object.keys(requests[0]!).sort(), ["id", "params", "type"]);
});
test("read timeout does not replay; disconnect rejects pending and changes epoch", async t => {
  const { bridge, client } = await socketPair(t, 40); let sent = 0; client.on("message", () => sent++);
  await assert.rejects(bridge.read("get-world-info", {}), /BRIDGE_READ_TIMEOUT/);
  assert.equal(sent, 1);
  const pending = bridge.read("get-world-info", {}); const epoch = bridge.epoch; bridge.disconnect();
  await assert.rejects(pending, /BRIDGE_DISCONNECTED/); assert.notEqual(bridge.epoch, epoch);
});
test("bounded loop returns planning unavailable then accepts provider-chosen final; no Bridge writes", async () => {
  const mock = makeBridge(); let calls = 0; const seen: DecisionRequestV1[] = [];
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide(request) {
    seen.push(structuredClone(request)); return reply(JSON.stringify(calls++ === 0 ? plan(request) : final(request, "bow")));
  } }, () => []);
  const result = await runner.run(fixture, mind, new AbortController().signal);
  assert.equal(result.status, "DRY-RUN VALIDATED INTENT"); assert.equal(result.writesDispatched, 0);
  assert.equal(result.events[0]?.status, "PLANNING_UNAVAILABLE"); assert.equal(seen[1]?.planFeedback[0]?.summary, null);
  assert.equal(seen[0]?.decisionId, seen[1]?.decisionId); assert.equal(seen[1]?.limits.planRequestsRemaining, 1);
  assert.ok(mock.calls.every(c => READ_COMMANDS.includes(c.type)));
  assert.ok(!mock.calls.some(c => c.type === "plan-token-path" as ReadCommand));
});
test("malformed responses get at most two repair continuations, no fallback or auto-end-turn", async () => {
  const mock = makeBridge(); let calls = 0;
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide() { calls++; return reply("bad"); } }, () => []);
  const result = await runner.run(fixture, mind, new AbortController().signal);
  assert.equal(calls, 3); assert.equal(result.accepted, false); assert.equal(result.status, "VALIDATION_LIMIT");
});
test("repeated PLAN_REQUEST never exceeds two previews; no autonomous tool loop", async () => {
  const mock = makeBridge(); let calls = 0;
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide(req) { calls++; return reply(JSON.stringify(plan(req))); } }, () => []);
  const result = await runner.run(fixture, mind, new AbortController().signal);
  assert.equal(calls, 3); assert.equal(result.status, "PLAN_LIMIT"); assert.equal(result.accepted, false);
  assert.equal(result.events.filter(e => e.status === "PLANNING_UNAVAILABLE").length, 2);
});
test("stale state after real-provider boundary is rejected before accepting result", async () => {
  const mock = makeBridge();
  const runner = new DecisionRunner(new CombatSensor(mock.bridge), { async decide(req) {
    (mock.values["get-combat-state"] as { turn: number }).turn++; return reply(JSON.stringify(final(req)));
  } }, () => []);
  const result = await runner.run(fixture, mind, new AbortController().signal);
  assert.equal(result.accepted, false); assert.ok(result.events.some(e => e.validation === "REJECTED"));
});
test("secret redaction handles exact arbitrary keys, Bearer headers and provider key patterns", () => {
  for (const secret of ["private-fixture-secret", "sk-or-v1-abcdefghijk", "pk_abcdefghijk"])
    assert.ok(!redact("value=" + secret, [secret]).includes(secret));
  assert.equal(redact("Bearer abcdef"), "Bearer [REDACTED]");
});
const credentials: Settings = { provider: "openrouter", model: "qwen/test", temperature: .25, apiKey: "test-secret-not-live", bridgeKey: "test-bridge-secret-not-live" };
test("OpenRouter request uses real endpoint/auth boundary and structured schema, excludes credentials/raw state", async () => {
  const { request } = await sample(); let posted: Record<string, unknown> | null = null;
  const fetcher = (async (url, init) => {
    if (String(url).endsWith("/models")) return Response.json({ data: [{ id: credentials.model, supported_parameters: ["structured_outputs"] }] });
    assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer " + credentials.apiKey);
    posted = JSON.parse(String(init?.body));
    for (const forbidden of [credentials.apiKey, credentials.bridgeKey, "RAW_", "HIDDEN_SENTINEL"]) assert.ok(!String(init?.body).includes(forbidden));
    return Response.json({ model: credentials.model, choices: [{ finish_reason: "stop", message: { content: JSON.stringify(final(request)) } }] });
  }) as typeof fetch;
  const provider = new OpenRouterDecisionProvider(() => credentials, fetcher);
  const result = await provider.decide(request, null, new AbortController().signal);
  assert.equal(result.metadata.format, "json_schema");
  assert.deepEqual((posted as unknown as { response_format: { json_schema: { schema: unknown } } }).response_format.json_schema.schema, decisionSchema);
  assert.equal((posted as unknown as { max_tokens: number }).max_tokens, 700);
});
test("unsupported schema providers use strict JSON text, no regex/prose fallback", async () => {
  const { request } = await sample();
  const fetcher = (async (url) => String(url).endsWith("/models") ? Response.json({ data: [{ id: credentials.model, supported_parameters: [] }] })
    : Response.json({ choices: [{ finish_reason: "stop", message: { content: "Some prose" } }] })) as typeof fetch;
  const result = await new OpenRouterDecisionProvider(() => credentials, fetcher).decide(request, null, new AbortController().signal);
  assert.equal(result.metadata.format, "strict-json-text"); assert.throws(() => parseDecision(result.text));
});
test("provider failure bodies and echoed secrets never become exposed errors/results", async () => {
  const provider = new OpenRouterDecisionProvider(() => credentials, (async () => new Response(credentials.apiKey, { status: 401 })) as typeof fetch);
  await assert.rejects(provider.testConnection(new AbortController().signal), /^Error: OPENROUTER_HTTP_401$/);
  const echo = new OpenRouterDecisionProvider(() => credentials, (async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: credentials.apiKey } }] })) as typeof fetch);
  await assert.rejects(echo.testConnection(new AbortController().signal), /SECRET_IN_CONTEXT/);
});
async function temporary(t: { after(fn: () => unknown): void }) {
  const directory = await mkdtemp(join(tmpdir(), "storycore-tests-"));
  t.after(async () => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + "\\") || resolve(directory).startsWith(resolve(tmpdir()) + "/")); await rm(directory, { recursive: true, force: true }); });
  return directory;
}
const testProtector = { async protect(s: string) { return Buffer.from(s).toString("base64"); }, async unprotect(s: string) { return Buffer.from(s, "base64").toString(); } };
test("settings public API never returns stored keys; storage abstraction round-trips separately", async t => {
  const directory = await temporary(t); const store = new SettingsStore(directory, testProtector);
  await store.save(credentials); const publicText = JSON.stringify(store.publicView());
  assert.ok(!publicText.includes(credentials.apiKey)); assert.ok(!publicText.includes(credentials.bridgeKey));
  assert.equal(store.publicView().hasKey, true);
  const another = new SettingsStore(directory, testProtector); await another.load(); assert.equal(another.credentials().apiKey, credentials.apiKey);
  await another.save({ provider: "openrouter", model: "custom/model", temperature: .5, apiKey: "" });
  assert.equal(another.credentials().apiKey, credentials.apiKey);
});
test("Windows DPAPI encrypts with CurrentUser and decrypts without command-line secrets", { skip: process.platform !== "win32" }, async () => {
  const protector = new WindowsDpapi(); const encrypted = await protector.protect(credentials.apiKey);
  assert.ok(!encrypted.includes(credentials.apiKey)); assert.equal(await protector.unprotect(encrypted), credentials.apiKey);
});
test("HTTP UI is loopback-only, settings are masked, cross-origin writes/generic commands denied", async t => {
  const store = new SettingsStore(await temporary(t), testProtector); await store.save(credentials);
  const runtime = await createApp(store, 0); t.after(() => runtime.close());
  const address = runtime.app.address() as { address: string; port: number }; assert.equal(address.address, "127.0.0.1");
  const origin = "http://127.0.0.1:" + address.port;
  const status = await (await fetch(origin + "/api/status")).text(); assert.ok(!status.includes(credentials.apiKey));
  const html = await (await fetch(origin)).text(); assert.ok(html.includes('type="password"'));
  for (const path of ["/api/settings", "/api/decision", "/api/execute"]) {
    const response = await fetch(origin + path, { method: "POST", headers: { Origin: "https://evil.invalid", "Content-Type": "application/json", "X-StoryCore-Local": "1" }, body: "{}" });
    assert.equal(response.status, 400);
  }
  assert.equal(runtime.bridge.readsSent, 0);
});
