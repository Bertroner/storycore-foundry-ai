import type { ActionCard, CombatStateV1 } from "./combat-state.js";
import { summaryDisposition, type RawSnapshot } from "./combat-sensor.js";
import { ensure, numberOrNull as num, plain } from "./safety.js";
function obj(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown, max = 16) { return Array.isArray(value) ? value.slice(0, max).map(v => plain(v)) : []; }
function bool(value: unknown) { return typeof value === "boolean" ? value : null; }
function counter(value: unknown) { const c = obj(value); return { value: num(c.value), max: num(c.max) }; }
export class CombatNormalizer {
  normalize(raw: RawSnapshot): CombatStateV1 {
    const { actor, token, scene, combat, fixture } = raw;
    ensure(new Set(actor.items.map(item => item.id)).size === actor.items.length, "DUPLICATE_ITEM_ID");
    const attributes = obj(actor.system.attributes);
    const hp = obj(attributes.hp), movement = obj(attributes.movement);
    const current = combat.current; ensure(current?.tokenId, "CURRENT_TOKEN_REQUIRED");
    const position = (t: { x: number; y: number }) => ({ x: t.x / scene.grid.size, y: t.y / scene.grid.size });
    const nearby: CombatStateV1["nearby"] = fixture.perceivedTokenIds.map(id => {
      const t = raw.tokens.find(t => t.id === id)!; const c = raw.context.nearbyTokens.find(c => c.tokenId === id)!;
      return { actorId: t.actorId!, tokenId: t.id, combatantId: combat.combatants.find(c => c.tokenId === id)!.id,
        name: plain(t.name), disposition: summaryDisposition(t.disposition),
        position: position(t), distance: c.distanceFt, units: scene.grid.units, distanceSource: "bridge-approximation",
        // Bridge's true can mean missing backend. False is a reported obstruction; true remains unknown.
        wallLos: c.lineOfSight === false ? false : null, perceived: true, perceptionSource: "verified-fixture",
        conditions: [], health: "unknown" };
    });
    const actions: ActionCard[] = []; let omittedActions = 0;
    for (const item of actor.items) {
      const s = item.system; const activation = obj(s.activation); const target = obj(s.target); const range = obj(s.range);
      const hasActivities = Array.isArray(s.activities) ? s.activities.length > 0 : Object.keys(obj(s.activities)).length > 0;
      const modality = s.actionType;
      // Only scope filtering; never pick a tactic, weapon or target.
      if (item.type !== "weapon" || hasActivities || !["mwak", "rwak"].includes(String(modality)) ||
          activation.type !== "action" || activation.cost !== 1 ||
          !["", "creature", "enemy", undefined, null].includes(target.type as string) ||
          (num(target.value) !== null && target.value !== 1) ||
          (obj(s.consume).type && obj(s.consume).type !== "") || (obj(s.save).ability && obj(s.save).ability !== "")) { omittedActions++; continue; }
      const uses = obj(s.uses); const blockers = ["Dry-run only; native legality/action budget/effects not verified"];
      const unavailable = s.equipped === false || s.quantity === 0 || (typeof uses.max === "number" && uses.max > 0 && uses.value === 0);
      if (unavailable) blockers.push("Known equipment, quantity or uses blocker");
      const label = modality === "mwak" ? "melee" : "ranged";
      actions.push({ actionId: "item:" + item.id, itemId: item.id, name: plain(item.name), itemType: "weapon",
        hasActivities: false, activation: { type: "action", cost: 1, source: "native" },
        execution: "manual", availability: unavailable ? "unavailable" : "unknown", blockers,
        equipped: bool(s.equipped), quantity: num(s.quantity), uses: Object.keys(uses).length ? counter(uses) : null,
        rechargeReady: bool(obj(s.recharge).charged),
        range: { normal: num(range.value), long: num(range.long), units: typeof range.units === "string" && range.units ? plain(range.units) : null },
        target: { kind: typeof target.type === "string" && target.type ? plain(target.type) : null, count: num(target.value) },
        damageTypes: Array.isArray(obj(s.damage).parts) ? (obj(s.damage).parts as unknown[]).slice(0, 8).map(p => Array.isArray(p) ? plain(p[1]) : "").filter(Boolean) : [],
        saveAbility: null, spell: null, resourceCosts: [], summary: "Legacy " + label + " weapon; D&D5e/Midi resolves use. No execution in Phase 1A.",
        eligibleTargets: nearby.map(t => ({ actorId: t.actorId, combatantId: t.combatantId! })) });
    }
    const resources = Object.entries(obj(actor.system.resources)).map(([key, value]) => ({
      resourceId: plain(key, 128), label: plain(obj(value).label), counter: counter(value), source: "native" as const }));
    const effects = raw.effects.effects.map(e => ({ id: plain(e.id, 128), name: plain(e.name), disabled: e.disabled === true,
      suppressed: bool(e.suppressed), remaining: num(obj(e.duration).remaining), units: null }));
    ensure(actions.length <= 24 && nearby.length <= 12 && resources.length <= 16 && effects.length <= 16 &&
      raw.effects.activeStatuses.length <= 16, "DTO_CATALOGUE_TOO_LARGE");
    const abilities = obj(actor.system.abilities);
    const state: CombatStateV1 = {
      schemaVersion: "1.0", snapshotId: raw.snapshotId, observedAt: raw.observedAt,
      expiresAt: new Date(Date.parse(raw.observedAt) + 30000).toISOString(),
      scope: { worldId: raw.world.id, sceneId: scene.id, combatId: combat.id, sessionEpoch: raw.epoch, revision: raw.fingerprint },
      runtime: { foundryVersion: raw.world.foundryVersion, systemId: "dnd5e", systemVersion: raw.world.systemVersion,
        bridgeVersion: null, midiVersion: null, scopeVerified: false, pathPreview: false, workflowMatching: false, automaticExecution: false },
      combat: { started: combat.started, round: combat.round, turn: combat.turn,
        current: { combatantId: current.id, actorId: actor.id, tokenId: token.id } },
      self: { actorId: actor.id, tokenId: token.id, combatantId: current.id, effectiveActorUuid: null, actorLink: null,
        name: plain(actor.name), actorType: actor.type, position: position(token), elevation: token.elevation,
        footprint: { width: token.width, height: token.height }, hp: { current: num(hp.value), max: num(hp.max), temp: num(hp.temp) },
        ac: num(obj(attributes.ac).value),
        abilities: { str: num(obj(abilities.str).value), dex: num(obj(abilities.dex).value), con: num(obj(abilities.con).value),
          int: num(obj(abilities.int).value), wis: num(obj(abilities.wis).value), cha: num(obj(abilities.cha).value) },
        movement: { walk: num(movement.walk), units: typeof movement.units === "string" ? plain(movement.units) : null },
        resources, spellSlots: [], conditions: strings(raw.effects.activeStatuses), effects, effectsComplete: false },
      budgets: { movementRemaining: null, units: scene.grid.units, actionAvailable: null, bonusActionAvailable: null,
        reactionAvailable: null, source: "unknown", leaseId: null },
      actions, nearby, movement: { profile: "square-flat-walk-v1", grid: { type: "square", sizePixels: scene.grid.size,
        distance: scene.grid.distance, units: scene.grid.units }, plans: [] },
      quality: { unknowns: ["Actor linking, viewed scene, single combat and walking/terrain require per-run operator attestation",
        "NPC perception is operator-supplied, not GM visibility", "Bridge true LOS may be fallback; represented as null",
        "Movement/action budgets, full effects, native legality, Bridge/Midi versions unknown"],
        warnings: ["Phase 1A dry-run subset only; scopeVerified=false; no execution",
          "Unsupported actions omitted; completeForDecision=false refers to full native completeness",
          "Distance is Bridge Chebyshev approximation; revision is local fingerprint, not native revision"],
        omittedActions, omittedNearby: raw.context.nearbyTokens.length - nearby.length, completeForDecision: false },
    };
    ensure(Buffer.byteLength(JSON.stringify(state)) <= 24 * 1024, "DTO_TOO_LARGE"); return state;
  }
}
