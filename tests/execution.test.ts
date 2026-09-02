import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { BridgeSession, WRITE_COMMANDS, type BridgeCommander, type WriteCommand } from "../src/bridge-session.js";
import { CombatSensor, type ScopeFixture } from "../src/combat-sensor.js";
import { CombatNormalizer } from "../src/combat-normalizer.js";
import { buildPlan } from "../src/plan-builder.js";
import { IntentExecutor } from "../src/intent-executor.js";
import { applyTurnLedger, consumeTurnIntent, createTurnLedger } from "../src/turn-budget.js";
import type { CombatIntentV1 } from "../src/contracts.js";
import { fixture, makeBridge } from "./fixtures.js";

async function socketPair(t: { after(fn: () => unknown): void }) {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" }); await once(server, "listening");
  const accepted = once(server, "connection");
  const client = new WebSocket("ws://127.0.0.1:" + (server.address() as { port: number }).port);
  const [socket] = await accepted as [WebSocket]; await once(client, "open");
  const bridge = new BridgeSession(1000); bridge.attach(socket);
  t.after(async () => { bridge.disconnect(); client.terminate(); for (const c of server.clients) c.terminate();
    await new Promise<void>(resolve => server.close(() => resolve())); });
  return { bridge, client };
}

test("write boundary exposes only four strict commands and correlates their exact envelopes", async t => {
  assert.deepEqual([...WRITE_COMMANDS].sort(), ["clear-targets", "dnd5e/activate-item", "move-token", "next-turn"].sort());
  const disconnected = new BridgeSession();
  for (const command of ["execute-macro", "update-actor", "plan-token-path", "eval", "__proto__"])
    await assert.rejects(disconnected.write(command as WriteCommand, {}), /WRITE_COMMAND_DENIED/);
  await assert.rejects(disconnected.write("move-token", { sceneId: "s", tokenId: "t", x: 1, y: 2, canOpenDoors: true }), /WRITE_PARAMS_INVALID/);
  await assert.rejects(disconnected.write("dnd5e/activate-item", { actorId: "a", itemId: "i", spellLevel: 9 }), /WRITE_PARAMS_INVALID/);
  assert.equal(disconnected.writesSent, 0);

  const { bridge, client } = await socketPair(t);
  const requests: { id: string; type: string; params: Record<string, unknown> }[] = [];
  client.on("message", bytes => {
    const request = JSON.parse(bytes.toString()); requests.push(request);
    client.send(JSON.stringify({ id: request.id, success: true, data: { command: request.type } }));
  });
  const result = await bridge.write("move-token", { sceneId: "scene", tokenId: "token", x: 100, y: 200, animate: true, canOpenDoors: false });
  assert.deepEqual(result, { command: "move-token" }); assert.equal(bridge.writesSent, 1);
  assert.deepEqual(requests[0]!.params, { sceneId: "scene", tokenId: "token", x: 100, y: 200, animate: true, canOpenDoors: false });
});

function commander() {
  const mock = makeBridge();
  const writes: { type: WriteCommand; params: Record<string, unknown> }[] = [];
  const bridge: BridgeCommander = {
    connected: true, epoch: mock.bridge.epoch, get writesSent() { return writes.length; },
    read: mock.bridge.read.bind(mock.bridge),
    async write(type, params) {
      writes.push({ type, params });
      if (type === "move-token") {
        const summary = (mock.values["get-scene-tokens"] as { tokens: Record<string, unknown>[] }).tokens[0]!;
        const detail = mock.values["get-token"] as Record<string, unknown>;
        const context = mock.values["get-combat-turn-context"] as { currentCombatant: Record<string, unknown>; nearbyTokens: Record<string, unknown>[] };
        summary.x = params.x; summary.y = params.y; detail.x = params.x; detail.y = params.y;
        context.currentCombatant.gridX = Number(params.x) / 100; context.currentCombatant.gridY = Number(params.y) / 100;
        context.nearbyTokens[0]!.distanceFt = Math.max(Math.abs(Number(summary.x) / 100 - Number(context.nearbyTokens[0]!.gridX)), 0) * 5;
        return { id: "npc-token", x: 0, y: 0, pathCost: 6 };
      }
      if (type === "dnd5e/activate-item") return { itemId: params.itemId, itemName: "Scimitar", itemType: "weapon",
        activated: true, targetsSet: 1, workflow: { attackTotal: 17, damageTotal: 5, isCritical: false, isFumble: false,
          hitTargetIds: ["hero-token"], saveTargetIds: [], failedSaveTargetIds: [] } };
      if (type === "next-turn") {
        const combat = mock.values["get-combat-state"] as { turn: number; current: unknown; combatants: unknown[] };
        combat.turn = 1; combat.current = combat.combatants[1]; return { turn: 1 };
      }
      return { cleared: true };
    }
  };
  return { ...mock, bridge, writes };
}

test("movement uses only an offered plan, dispatches one wall-aware command and trusts fresh readback", async () => {
  const mock = commander();
  const tokens = (mock.values["get-scene-tokens"] as { tokens: Record<string, unknown>[] }).tokens;
  tokens[1]!.x = 800;
  const nearby = (mock.values["get-combat-turn-context"] as { nearbyTokens: Record<string, unknown>[] }).nearbyTokens[0]!;
  nearby.gridX = 8; nearby.distanceFt = 40;
  const sensor = new CombatSensor(mock.bridge); const raw = await sensor.capture(fixture);
  const state = new CombatNormalizer().normalize(raw);
  const plan = buildPlan(state, "decision", "step", { kind: "approach", target: { actorId: "hero" }, actionId: "item:sword" });
  assert.ok(plan.planId); assert.deepEqual(plan.endpoint, { x: 6, y: 0 }); state.movement.plans.push(plan);
  const intent: CombatIntentV1 = { kind: "move", movement: { planId: plan.planId!, goalKind: "approach" } };
  const logs: unknown[] = []; const outcome = await new IntentExecutor(mock.bridge, entry => logs.push(entry)).execute(state, intent, fixture as ScopeFixture);
  assert.equal(outcome.status, "MOVED"); assert.equal(outcome.writesDispatched, 1);
  assert.deepEqual(mock.writes, [{ type: "move-token", params: { sceneId: "scene", tokenId: "npc-token", x: 600, y: 0, animate: true, canOpenDoors: false } }]);
  assert.equal(outcome.observedState!.self.position.x, 6); assert.ok(logs.length >= 4);
});

test("Item execution clears stale targets, invokes one real owned Item, observes Midi, clears again and never retries", async () => {
  const mock = commander(); const sensor = new CombatSensor(mock.bridge);
  const state = new CombatNormalizer().normalize(await sensor.capture(fixture));
  const intent: CombatIntentV1 = { kind: "activate_item", action: { actionId: "item:sword", itemId: "sword",
      target: { actorId: "hero", combatantId: "hero-combatant" } } };
  const outcome = await new IntentExecutor(mock.bridge, () => {}).execute(state, intent, fixture as ScopeFixture);
  assert.equal(outcome.status, "ITEM_ACTIVATED"); assert.equal(outcome.writesDispatched, 3);
  assert.deepEqual(mock.writes.map(w => w.type), ["clear-targets", "dnd5e/activate-item", "clear-targets"]);
  assert.deepEqual(mock.writes[1]!.params, { actorId: "npc", itemId: "sword", targetTokenIds: ["hero-token"] });
  assert.equal((outcome.result.workflow as { damageTotal: number }).damageTotal, 5);
});

test("legacy spell capabilities are projected structurally without a per-spell name handler", async () => {
  const mock = makeBridge(); const actor = mock.values["get-actor"] as { items: Record<string, unknown>[] };
  actor.items.push({ id: "spell-a", name: "Homebrew Arc", type: "spell", system: { level: 0, actionType: "rsak",
    activation: { type: "action", cost: 1 }, activities: {}, preparation: { mode: "atwill", prepared: true },
    range: { value: 120, long: null, units: "ft" }, target: { type: "creature", value: 1 },
    description: { value: "<p>A ranged mote deals fire damage to one creature.</p><script>RAW_SPELL_SCRIPT</script>" },
    damage: { parts: [["1d10", "fire"]] } } });
  actor.items.push({ id: "spell-object", name: "Homebrew Utility", type: "spell", system: { level: 0, actionType: "util",
    activation: { type: "action", cost: 1 }, activities: {}, preparation: { mode: "atwill", prepared: true },
    range: { value: null, long: null, units: "touch" }, target: { type: "object", value: 1 },
    description: { value: "<p>Makes a touched object glow.</p>" } } });
  actor.items.push({ id: "spell-b", name: "Prepared Level Spell", type: "spell", system: { level: 1, actionType: "save",
    activation: { type: "action", cost: 1 }, preparation: { mode: "prepared", prepared: true }, target: { type: "creature", value: 1 } } });
  const state = new CombatNormalizer().normalize(await new CombatSensor(mock.bridge).capture(fixture));
  const projected = state.actions.find(action => action.itemId === "spell-a");
  assert.equal(projected?.itemType, "spell"); assert.equal(projected?.range.normal, 120);
  assert.deepEqual(projected?.damageTypes, ["fire"]); assert.equal(projected?.canPlanApproach, true);
  assert.equal(projected?.descriptionHint, "A ranged mote deals fire damage to one creature.");
  const objectSpell = state.actions.find(action => action.itemId === "spell-object");
  assert.equal(objectSpell?.availability, "unavailable"); assert.equal(objectSpell?.canPlanApproach, false);
  assert.deepEqual(objectSpell?.eligibleTargets, []); assert.equal(objectSpell?.descriptionHint, "Makes a touched object glow.");
  assert.equal(state.actions.some(action => action.itemId === "spell-b"), false);
  assert.ok(!JSON.stringify(state).includes("RAW_SPELL_SCRIPT"));
});

test("turn lease exposes and consumes movement, action and bonus action independently", async () => {
  const mock = makeBridge();
  const actor = mock.values["get-actor"] as { items: Record<string, any>[] };
  actor.items.push({ id: "bonus", name: "Nimble Option", type: "feat", system: { actionType: "util",
    activation: { type: "bonus", cost: 1 }, activities: {}, target: { type: "self", value: 1 } } });
  const state = new CombatNormalizer().normalize(await new CombatSensor(mock.bridge).capture(fixture));
  const bonus = state.actions.find(card => card.itemId === "bonus");
  assert.equal(bonus?.activation.type, "bonus");
  const ledger = createTurnLedger(state);
  applyTurnLedger(state, ledger);
  assert.deepEqual(state.budgets, { movementRemaining: 30, units: "ft", actionAvailable: true,
    bonusActionAvailable: true, reactionAvailable: null, source: "turn-lease", leaseId: ledger.leaseId });
  consumeTurnIntent(ledger, state, { kind: "activate_item", action: { actionId: "item:sword",
    itemId: "sword", target: { actorId: "hero", combatantId: "hero-combatant" } } });
  const afterAction = new CombatNormalizer().normalize(await new CombatSensor(mock.bridge).capture(fixture));
  applyTurnLedger(afterAction, ledger);
  assert.equal(afterAction.budgets.actionAvailable, false);
  assert.equal(afterAction.budgets.bonusActionAvailable, true);
  assert.equal(afterAction.actions.find(card => card.itemId === "sword")?.availability, "unavailable");
  assert.equal(afterAction.actions.find(card => card.itemId === "bonus")?.availability, "available");
  consumeTurnIntent(ledger, afterAction, { kind: "activate_item", action: { actionId: "item:bonus",
    itemId: "bonus", target: null } });
  const afterBonus = new CombatNormalizer().normalize(await new CombatSensor(mock.bridge).capture(fixture));
  applyTurnLedger(afterBonus, ledger);
  assert.equal(afterBonus.budgets.bonusActionAvailable, false);
});

test("turn lease decrements observed path cost and closes movement after two bounded writes", async () => {
  const mock = makeBridge();
  const state = new CombatNormalizer().normalize(await new CombatSensor(mock.bridge).capture(fixture));
  state.nearby[0]!.position.x = 5; state.nearby[0]!.distance = 25;
  const ledger = createTurnLedger(state); applyTurnLedger(state, ledger);
  const plan = buildPlan(state, "decision", "step", { kind: "approach",
    target: { actorId: "hero" }, actionId: "item:sword" });
  assert.ok(plan.planId); state.movement.plans.push(plan);
  const move: CombatIntentV1 = { kind: "move", movement: { planId: plan.planId!, goalKind: "approach" } };
  consumeTurnIntent(ledger, state, move, 2);
  assert.equal(ledger.movementRemaining, 20); assert.equal(ledger.movementWrites, 1);
  consumeTurnIntent(ledger, state, move, 1);
  assert.equal(ledger.movementRemaining, 0); assert.equal(ledger.movementWrites, 2);
  assert.throws(() => consumeTurnIntent(ledger, state, move, 1), /MOVEMENT_WRITE_LIMIT/);
});

test("a failed initial target reset still attempts cleanup and fresh observation, with no Item retry", async () => {
  const mock = commander(); const sensor = new CombatSensor(mock.bridge);
  const state = new CombatNormalizer().normalize(await sensor.capture(fixture));
  const readsBefore = mock.calls.length; let first = true;
  const normalWrite = mock.bridge.write.bind(mock.bridge);
  mock.bridge.write = async (type, params) => {
    if (type === "clear-targets" && first) {
      first = false; mock.writes.push({ type, params }); throw new Error("simulated uncertain clear");
    }
    return normalWrite(type, params);
  };
  const intent: CombatIntentV1 = { kind: "activate_item", action: { actionId: "item:sword", itemId: "sword",
      target: { actorId: "hero", combatantId: "hero-combatant" } } };
  await assert.rejects(new IntentExecutor(mock.bridge, () => {}).execute(state, intent, fixture as ScopeFixture));
  assert.deepEqual(mock.writes.map(w => w.type), ["clear-targets", "clear-targets"]);
  assert.ok(mock.calls.length > readsBefore); assert.equal(mock.writes.some(w => w.type === "dnd5e/activate-item"), false);
});
