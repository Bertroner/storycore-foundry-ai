import type { BridgeReader, ReadCommand } from "../src/bridge-session.js";
export const fixture = { sceneId: "scene", combatId: "combat", actorId: "npc", tokenId: "npc-token",
  linkedActorIds: ["npc", "hero"], perceivedTokenIds: ["hero-token"], attestSingleActiveCombat: true,
  attestViewedCombatScene: true, attestNormalWalkingNoTerrain: true };
export const mind = { actorId: "npc", personality: "Cautious.", motivation: "Survive.", relationships: [{ actorId: "hero", summary: "Hostile." }], relevantMemory: [] };
export function makeBridge() {
  const current = { id: "npc-combatant", actorId: "npc", tokenId: "npc-token", hidden: false, defeated: false };
  const target = { id: "hero-combatant", actorId: "hero", tokenId: "hero-token", hidden: false, defeated: false };

  const token = { id: "npc-token", actorId: "npc", name: "Guard", x: 0, y: 0, width: 1, height: 1, elevation: 0, hidden: false, disposition: -1, rotation: 0, img: "icons/guard.webp", conditions: [], hp: { value: 7, max: 7 }, ac: 15 };
  const hero = { ...token, id: "hero-token", actorId: "hero", name: "Hero", x: 100, disposition: 1 };
  const hidden = { ...hero, id: "hidden-token", actorId: "hidden-actor", name: "HIDDEN_SENTINEL", hidden: true };
  const values: Record<ReadCommand, unknown> = {
    "get-world-info": { world: { id: "world", foundryVersion: "12.343", system: "dnd5e", systemVersion: "3.3.1" }, compendiumMeta: ["RAW_COMPENDIUM"] },
    "get-combat-state": { id: "combat", started: true, round: 1, turn: 0, current, combatants: [current, target] },
    "get-scene": { id: "scene", name: "Test Arena", active: true, width: 2000, height: 2000, grid: { type: 1, size: 100, distance: 5, units: "ft" }, walls: [], asciiMap: "RAW_ASCII", notes: ["RAW_NOTES"] },
    "get-scene-tokens": { sceneId: "scene", tokens: [token, hero, hidden] },
    // Separate detail fixture: no spread from the summary (different wire keys and HP shape).
    "get-token": { id: "npc-token", sceneId: "scene", name: "Guard", x: 0, y: 0, width: 1, height: 1,
      elevation: 0, rotation: 0, hidden: false, disposition: "hostile", actorId: "npc", textureSrc: "icons/guard.webp",
      hp: { current: 7, max: 7 }, ac: 15 },
    "get-actor": { id: "npc", name: "Guard", type: "npc", flags: { secret: "RAW_FLAGS" }, system: {
      attributes: { hp: { value: 7, max: 7 }, ac: { value: 15 }, movement: { walk: 30 } },
      details: { biography: { value: "RAW_BIOGRAPHY" } } }, items: [
        { id: "sword", name: "Scimitar", type: "weapon", system: { actionType: "mwak", activation: { type: "action", cost: 1 },
          activities: {}, equipped: true, quantity: 1, range: { value: 5, long: null, units: "ft" }, target: { type: "", value: null },
          description: { value: "<script>RAW_ITEM_SCRIPT</script>" }, damage: { parts: [["1d6", "slashing"]] } } },
        { id: "bow", name: "Shortbow", type: "weapon", system: { actionType: "rwak", activation: { type: "action", cost: 1 },
          range: { value: 80, long: 320, units: "ft" }, target: { type: "creature", value: 1 }, equipped: true } },
      ] },
    "get-actor-effects": { actorId: "npc", activeStatuses: [], effects: [{ id: "effect", name: "Bless", disabled: false, changes: ["RAW_EFFECT_CODE"] }] },
    "get-combat-turn-context": { round: 1, turn: 0, currentCombatant: { ...current, gridX: 0, gridY: 0 }, nearbyTokens: [
      { tokenId: "hero-token", actorId: "hero", gridX: 1, gridY: 0, distanceFt: 5, lineOfSight: true, hp: { value: 999, max: 999 } },
      { tokenId: "hidden-token", actorId: "hidden-actor", gridX: 4, gridY: 3, distanceFt: 20, lineOfSight: true, name: "HIDDEN_SENTINEL" },
    ], asciiMap: "RAW_CONTEXT" },
  };
  const calls: { type: ReadCommand; params: Record<string, unknown> }[] = [];
  const bridge: BridgeReader = { connected: true, epoch: "epoch",
    async read(type, params) { calls.push({ type, params }); return structuredClone(values[type]); } };
  return { bridge, values, calls };
}
