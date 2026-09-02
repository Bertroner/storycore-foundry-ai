import { PHASE1A_DECISION_LIFETIME_MS } from "./phase1a-config.js";
import type { ActionCard, CombatStateV1 } from "./combat-state.js";
import type { RawSnapshot } from "./combat-sensor.js";
import { ensure, numberOrNull as num, plain, sanitizeDescriptionHint } from "./safety.js";
function obj(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function strings(value: unknown, max = 16) { return Array.isArray(value) ? value.slice(0, max).map(v => plain(v)) : []; }
function bool(value: unknown) { return typeof value === "boolean" ? value : null; }
function counter(value: unknown) { const c = obj(value); return { value: num(c.value), max: num(c.max) }; }
function activities(value: unknown) { return Array.isArray(value) ? value.length : Object.keys(obj(value)).length; }
function damageTypes(system: Record<string, unknown>) {
  const parts = obj(system.damage).parts;
  return Array.isArray(parts) ? parts.slice(0, 8).map(p => Array.isArray(p) ? plain(p[1]) : "").filter(Boolean) : [];
}
const ITEM_TYPES = new Set(["weapon", "spell", "feat", "consumable"]);
const AREA_TARGETS = new Set(["cone", "cube", "cylinder", "line", "radius", "sphere", "square", "wall"]);
const TARGETED = new Set(["", "creature", "enemy", "ally", "object", "individual"]);

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
        name: plain(t.name), relationToSelf: "enemy", targetAuthorized: true,
        position: position(t), distance: c.distanceFt, units: scene.grid.units, distanceSource: "bridge-approximation",
        wallLos: c.lineOfSight === false ? false : null, perceived: true, perceptionSource: "verified-fixture",
        conditions: [], health: "unknown" };
    });

    const actions: ActionCard[] = []; let omittedActions = 0;
    for (const item of actor.items) {
      const s = item.system, activation = obj(s.activation), target = obj(s.target), range = obj(s.range);
      const targetType = typeof target.type === "string" ? target.type.toLowerCase() : "";
      const actionType = typeof s.actionType === "string" ? s.actionType.toLowerCase() : "";
      const level = num(s.level), preparation = obj(s.preparation), uses = obj(s.uses);
      const selfTarget = targetType === "self";
      const noTarget = targetType === "none";
      const combatantTarget = ["", "creature", "enemy", "individual"].includes(targetType);
      const targetCount = num(target.value);
      const activationType = typeof activation.type === "string" ? activation.type.toLowerCase() : "";
      const legacySingle = ITEM_TYPES.has(item.type) && activities(s.activities) === 0 &&
        ["action", "bonus"].includes(activationType) && activation.cost === 1 && !AREA_TARGETS.has(targetType) &&
        (selfTarget || noTarget || TARGETED.has(targetType)) && (targetCount === null || targetCount <= 1);
      const supportedResolution = item.type === "weapon" ? ["mwak", "rwak"].includes(actionType) :
        item.type === "spell" ? ["msak", "rsak", "save", "heal", "util", "other"].includes(actionType) :
        ["mwak", "rwak", "msak", "rsak", "save", "heal", "util", "other", ""].includes(actionType);
      // Legacy levelled spell configuration/upcasting is not safe through Bridge v8.11.2 yet.
      const executableSpell = item.type !== "spell" || level === 0 || preparation.mode === "atwill" || preparation.mode === "innate";
      if (!legacySingle || !supportedResolution || !executableSpell) { omittedActions++; continue; }

      const unsupportedTarget = !selfTarget && !noTarget && !combatantTarget;
      const unavailable = s.equipped === false || s.quantity === 0 ||
        (typeof uses.max === "number" && uses.max > 0 && uses.value === 0) ||
        (item.type === "spell" && preparation.prepared === false && preparation.mode === "prepared") ||
        unsupportedTarget;
      const blockers: string[] = [];
      if (unavailable && !unsupportedTarget) blockers.push("Known equipment, preparation, quantity or uses blocker");
      if (unsupportedTarget) blockers.push("No supported combatant target for native target kind " + (targetType || "unknown"));
      if (item.type === "spell" && level !== 0) blockers.push("Innate/at-will legacy spell; D&D5e owns resource consumption");
      const normalizedTarget = selfTarget ? "self" : noTarget ? "none" : targetType || null;
      const numericRange = num(range.value);
      const rangeUnits = typeof range.units === "string" && range.units ? plain(range.units) : null;
      const canPlanApproach = combatantTarget && numericRange !== null && rangeUnits === scene.grid.units;
      const descriptionValue = typeof s.description === "string" ? s.description : obj(s.description).value;
      const label = actionType || "utility";
      actions.push({
        actionId: "item:" + item.id, itemId: item.id, name: plain(item.name),
        itemType: ITEM_TYPES.has(item.type) ? item.type as ActionCard["itemType"] : "other",
        hasActivities: false, activation: { type: activationType, cost: 1, source: "native" },
        execution: "automatic", availability: unavailable ? "unavailable" : blockers.length ? "conditional" : "available",
        blockers, equipped: bool(s.equipped), quantity: num(s.quantity),
        uses: Object.keys(uses).length ? counter(uses) : null, rechargeReady: bool(obj(s.recharge).charged),
        range: { normal: numericRange, long: num(range.long), units: rangeUnits },
        target: { kind: normalizedTarget, count: targetCount }, damageTypes: damageTypes(s),
        saveAbility: typeof obj(s.save).ability === "string" && obj(s.save).ability ? plain(obj(s.save).ability) : null,
        spell: item.type === "spell" ? { level, prepared: bool(preparation.prepared) } : null,
        resourceCosts: [], summary: "Legacy " + item.type + " / " + label +
          (level !== null ? " / level " + level : "") + "; D&D5e/Midi resolves rules and resources.",
        descriptionHint: sanitizeDescriptionHint(descriptionValue), canPlanApproach,
        eligibleTargets: combatantTarget ? nearby.map(t => ({ actorId: t.actorId, combatantId: t.combatantId! })) : []
      });
    }

    const resources = Object.entries(obj(actor.system.resources)).map(([key, value]) => ({
      resourceId: plain(key, 128), label: plain(obj(value).label), counter: counter(value), source: "native" as const
    }));
    const spellSlots = Object.entries(obj(actor.system.spells)).filter(([key]) => /^spell[1-9]$/.test(key)).map(([key, value]) => ({
      key: plain(key, 128), level: Number(key.slice(5)), counter: counter(value)
    }));
    const effects = raw.effects.effects.map(e => ({ id: plain(e.id, 128), name: plain(e.name), disabled: e.disabled === true,
      suppressed: bool(e.suppressed), remaining: num(obj(e.duration).remaining), units: null }));
    ensure(actions.length <= 24 && nearby.length <= 12 && resources.length <= 16 && spellSlots.length <= 9 &&
      effects.length <= 16 && raw.effects.activeStatuses.length <= 16, "DTO_CATALOGUE_TOO_LARGE");
    const abilities = obj(actor.system.abilities);
    const state: CombatStateV1 = {
      schemaVersion: "1.0", snapshotId: raw.snapshotId, observedAt: raw.observedAt,
      expiresAt: new Date(Date.parse(raw.observedAt) + PHASE1A_DECISION_LIFETIME_MS).toISOString(),
      scope: { worldId: raw.world.id, sceneId: scene.id, combatId: combat.id, sessionEpoch: raw.epoch, revision: raw.fingerprint },
      runtime: { foundryVersion: raw.world.foundryVersion, systemId: "dnd5e", systemVersion: raw.world.systemVersion,
        bridgeVersion: null, midiVersion: null, scopeVerified: false, pathPreview: true,
        workflowMatching: false, automaticExecution: true },
      combat: { started: combat.started, round: combat.round, turn: combat.turn,
        current: { combatantId: current.id, actorId: actor.id, tokenId: token.id } },
      self: { actorId: actor.id, tokenId: token.id, combatantId: current.id, effectiveActorUuid: null, actorLink: null,
        name: plain(actor.name), actorType: actor.type, position: position(token), elevation: token.elevation,
        footprint: { width: token.width, height: token.height },
        hp: { current: num(hp.value), max: num(hp.max), temp: num(hp.temp) }, ac: num(obj(attributes.ac).value),
        abilities: { str: num(obj(abilities.str).value), dex: num(obj(abilities.dex).value), con: num(obj(abilities.con).value),
          int: num(obj(abilities.int).value), wis: num(obj(abilities.wis).value), cha: num(obj(abilities.cha).value) },
        movement: { walk: num(movement.walk), units: typeof movement.units === "string" ? plain(movement.units) : null },
        resources, spellSlots, conditions: strings(raw.effects.activeStatuses), effects, effectsComplete: false },
      budgets: { movementRemaining: null, units: scene.grid.units, actionAvailable: null, bonusActionAvailable: null,
        reactionAvailable: null, source: "unknown", leaseId: null },
      actions, nearby, movement: { profile: "square-flat-walk-v1", grid: { type: "square", sizePixels: scene.grid.size,
        distance: scene.grid.distance, units: scene.grid.units }, plans: [] },
      quality: { unknowns: ["Actor linking and NPC perception remain operator-attested",
        "Movement remaining is not exposed; one supervised move is capped by native walk speed",
        "Bridge Midi workflow matching is unscoped; execution stops on ambiguous results"],
        warnings: ["Supervised execution enabled for legacy single-target/self action and bonus-action Items",
          "Levelled prepared spells, AoE/templates, reactions and activity Items remain excluded",
          "Distance is Bridge approximation; fresh Foundry readback is authoritative"],
        omittedActions, omittedNearby: raw.context.nearbyTokens.length - nearby.length, completeForDecision: omittedActions === 0 }
    };
    ensure(Buffer.byteLength(JSON.stringify(state)) <= 32 * 1024, "DTO_TOO_LARGE");
    return state;
  }
}
