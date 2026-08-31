import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { SettingsStore } from "../src/settings.js";
import { BridgeSession } from "../src/bridge-session.js";
import { DesktopService } from "../src/desktop-service.js";
import { createIpcHandlers, IPC_CHANNELS, UI_URL, type IpcSender } from "../desktop/ipc.js";
import { OpenRouterDecisionProvider } from "../src/openrouter-provider.js";
import type { DesktopApi } from "../desktop/api.js";
import { fixture, mind } from "./fixtures.js";
const key = "desktop-test-secret-not-live", bridgeKey = "desktop-bridge-secret-not-live";
const input = { provider: "openrouter", model: "test/model", temperature: .25, apiKey: key, bridgeKey };
const protector = { async protect(s: string) { return Buffer.from(s).toString("base64"); }, async unprotect(s: string) { return Buffer.from(s, "base64").toString(); } };
const sender: IpcSender = { sender: { id: 7 }, senderFrame: { url: UI_URL, parent: null } };
async function setup(t: { after(fn: () => unknown): void }) {
  const directory = await mkdtemp(join(tmpdir(), "storycore-desktop-tests-")); const store = new SettingsStore(directory, protector);
  await store.save(input); const bridge = new BridgeSession(); const logs: string[] = [];
  const service = new DesktopService(store, bridge, undefined, text => logs.push(text));
  t.after(async () => {
    await service.close(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + "\\") || resolve(directory).startsWith(resolve(tmpdir()) + "/"));
    await rm(directory, { recursive: true, force: true });
  });
  return { store, bridge, logs, service, directory, handlers: createIpcHandlers(service, e => e.sender.id === 7) };
}
test("desktop IPC status never contains stored keys or encrypted blobs", async t => {
  const { handlers } = await setup(t); const result = await handlers["storycore:status"](sender);
  const text = JSON.stringify(result);
  for (const secret of [key, bridgeKey, Buffer.from(key).toString("base64"), "encryptedApiKey", "encryptedBridgeKey"])
    assert.ok(!text.includes(secret));
  assert.ok(text.includes('"hasOpenRouterKey":true')); assert.ok(text.includes('"hasBridgeKey":true'));
});
test("blank IPC save preserves both secrets across disk reload; only explicit clear removes them", async t => {
  const { handlers, store, directory } = await setup(t);
  const saved = await handlers["storycore:save-settings"](sender, { ...input, apiKey: "", bridgeKey: "", model: "custom/model" });
  assert.equal(saved.ok, true); assert.ok(!JSON.stringify(saved).includes(key));
  let reloaded = new SettingsStore(directory, protector); await reloaded.load();
  assert.equal(reloaded.credentials().apiKey, key); assert.equal(reloaded.credentials().bridgeKey, bridgeKey);
  await handlers["storycore:clear-openrouter-key"](sender);
  reloaded = new SettingsStore(directory, protector); await reloaded.load();
  assert.equal(reloaded.credentials().apiKey, ""); assert.equal(reloaded.credentials().bridgeKey, bridgeKey);
  await handlers["storycore:clear-bridge-key"](sender);
  reloaded = new SettingsStore(directory, protector); await reloaded.load();
  assert.equal(reloaded.credentials().bridgeKey, ""); assert.equal(store.publicView().hasKey, false);
});
test("IPC requires the exact main window, local URL and main frame", async t => {
  const { handlers } = await setup(t);
  for (const event of [
    { ...sender, sender: { id: 99 } },
    { ...sender, senderFrame: { url: "https://openrouter.ai", parent: null } },
    { ...sender, senderFrame: { url: UI_URL, parent: {} } },
    { ...sender, senderFrame: null },
    { ...sender, senderFrame: { url: UI_URL + "?arbitrary", parent: null } },
  ]) assert.deepEqual(await handlers["storycore:status"](event), { ok: false, error: "IPC_SENDER_DENIED" });
});
test("desktop IPC has no generic Bridge dispatch or write channel; injected commands are rejected", async t => {
  const { handlers, bridge } = await setup(t);
  assert.deepEqual(Object.keys(handlers).sort(), [...IPC_CHANNELS].sort());
  for (const channel of ["move-token", "activate-item", "next-turn", "execute-macro", "storycore:bridge", "storycore:read-file", "storycore:invoke"])
    assert.equal(Object.hasOwn(handlers, channel), false);
  for (const command of ["move-token", "dnd5e/activate-item", "next-turn", "update-actor", "execute-macro"]) {
    const request = { requestId: crypto.randomUUID(), fixture, mind, command };
    assert.deepEqual(await handlers["storycore:run-decision"](sender, request), { ok: false, error: "REQUEST_INVALID" });
    assert.deepEqual(await handlers["storycore:status"](sender, { command }), { ok: false, error: "IPC_ARGUMENTS_INVALID" });
  }
  assert.equal(bridge.readsSent, 0);
});
test("preload exposes only named typed methods and sends each on its fixed channel", async () => {
  const source = await readFile("desktop/preload.cts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  let exposed: DesktopApi | null = null; const calls: unknown[][] = [];
  runInNewContext(compiled, { exports: {}, require(name: string) {
    assert.equal(name, "electron");
    return { contextBridge: { exposeInMainWorld(name: string, api: DesktopApi) { assert.equal(name, "storycore"); exposed = api; } },
      ipcRenderer: { invoke(...args: unknown[]) { calls.push(args); return Promise.resolve({ ok: true, data: {} }); } } };
  } });
  assert.ok(exposed); const api = exposed as DesktopApi;
  assert.deepEqual(Object.keys(api).sort(), ["cancelDecision", "clearBridgeKey", "clearOpenRouterKey", "detectTurn", "runDecision", "saveSettings", "status", "testOpenRouter"].sort());
  assert.equal(Object.hasOwn(api, "invoke"), false); assert.equal(Object.hasOwn(api, "credentials"), false);
  await api.status(); await api.saveSettings(input as Parameters<DesktopApi["saveSettings"]>[0]);
  await api.clearOpenRouterKey(); await api.clearBridgeKey(); await api.testOpenRouter(); await api.detectTurn();
  await api.runDecision({ requestId: crypto.randomUUID(), detectionId: crypto.randomUUID(), selectedCandidateIds: [], attested: true,
    mind: { personality: mind.personality, motivation: mind.motivation, relevantMemory: [] } }); await api.cancelDecision();
  assert.deepEqual(calls.map(call => call[0]), [...IPC_CHANNELS]);
});
test("Test OpenRouter IPC calls existing provider in trusted runtime; renderer gets only safe outcome", async t => {
  const { store, bridge } = await setup(t); let calls = 0;
  const provider = new OpenRouterDecisionProvider(() => store.credentials(), (async (url, init) => {
    calls++; assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer " + key);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: "OK" } }] });
  }) as typeof fetch);
  const service = new DesktopService(store, bridge, provider); const handlers = createIpcHandlers(service, () => true);
  const result = await handlers["storycore:test-openrouter"](sender);
  assert.equal(calls, 1); assert.equal(result.ok, true);
  assert.ok(JSON.stringify(result).includes('"success":true')); assert.ok(!JSON.stringify(result).includes(key));
  await service.close();
});
test("provider error text, newly submitted invalid keys and stored blobs never appear in IPC errors", async t => {
  const { store, bridge, handlers } = await setup(t);
  const provider = new OpenRouterDecisionProvider(() => store.credentials(),
    (async () => new Response(key + " " + bridgeKey + " " + Buffer.from(key).toString("base64"), { status: 401 })) as typeof fetch);
  const service = new DesktopService(store, bridge, provider);
  const result = await createIpcHandlers(service, () => true)["storycore:test-openrouter"](sender);
  assert.ok(JSON.stringify(result).includes("OPENROUTER_HTTP_401"));
  for (const value of [key, bridgeKey, Buffer.from(key).toString("base64")]) assert.ok(!JSON.stringify(result).includes(value));
  const invalid = await handlers["storycore:save-settings"](sender, { ...input, arbitrary: key });
  assert.deepEqual(invalid, { ok: false, error: "SETTINGS_INVALID" });
  await service.close();
});
test("dry-run IPC result, status and summary log do not serialize credentials", async t => {
  const { handlers, logs, bridge } = await setup(t);
  const result = await handlers["storycore:detect-turn"](sender);
  const all = JSON.stringify([result, await handlers["storycore:status"](sender), logs]);
  assert.ok(all.includes("BRIDGE_DISCONNECTED"));
  for (const value of [key, bridgeKey, "Authorization", "encryptedApiKey", Buffer.from(key).toString("base64")]) assert.ok(!all.includes(value));
  assert.equal(bridge.readsSent, 0);
});
test("renderer has no Node or network client, uses local module and masked unsaved fields", async () => {
  const renderer = await readFile("desktop/renderer.ts", "utf8"); const html = await readFile("desktop/ui/index.html", "utf8");
  for (const forbidden of ["fetch(", "XMLHttpRequest", "WebSocket(", 'from "node:', "ipcRenderer", "localStorage", "Authorization"])
    assert.ok(!renderer.includes(forbidden));
  assert.equal((html.match(/type="password"/g) ?? []).length, 2);
  assert.ok(html.includes("connect-src 'none'")); assert.ok(html.includes('src="renderer.js"'));
});
