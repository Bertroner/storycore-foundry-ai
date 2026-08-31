import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { BridgeReader, ReadCommand } from "./bridge-session.js";
import { idSchema } from "./contracts.js";
import { ensure, BRIDGE_DIAGNOSTIC_FIELDS } from "./safety.js";

export const fixtureSchema = z.object({
  sceneId: idSchema, combatId: idSchema, actorId: idSchema, tokenId: idSchema,
  linkedActorIds: z.array(idSchema).min(1).max(13),
  perceivedTokenIds: z.array(idSchema).max(12),
  attestSingleActiveCombat: z.literal(true), attestViewedCombatScene: z.literal(true),
  attestNormalWalkingNoTerrain: z.literal(true),
}).strict();
const probeSchema = fixtureSchema.omit({ attestSingleActiveCombat: true, attestViewedCombatScene: true, attestNormalWalkingNoTerrain: true });
export type ReadScope = z.infer<typeof probeSchema>;
export type ScopeFixture = z.infer<typeof fixtureSchema>;
const combatant = z.object({ id: idSchema, actorId: idSchema, tokenId: idSchema.nullable(), hidden: z.boolean(), defeated: z.boolean() }).passthrough();
export const combatSchema = z.object({ id: idSchema, round: z.number().int().nonnegative(), turn: z.number().int().nonnegative(),
  started: z.boolean(), current: combatant.nullable(), combatants: z.array(combatant) }).passthrough();
// Wire contracts audited against Bridge v8.11.2 tokenTypes.ts (f71ea11).
export const sceneTokenSummarySchema = z.object({
  id: idSchema, actorId: idSchema.nullable(), name: z.string(), x: z.number(), y: z.number(),
  width: z.number(), height: z.number(), elevation: z.number(), rotation: z.number(), hidden: z.boolean(),
  disposition: z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1)]),
  img: z.string(), conditions: z.array(z.string()),
  hp: z.object({ value: z.number(), max: z.number() }).optional(), ac: z.number().optional(),
  // Not emitted by v8.11.2. Retain only the existing defensive rejection if explicitly false.
  actorLink: z.boolean().optional(),
}).passthrough();
export const tokenDetailSchema = z.object({
  id: idSchema, sceneId: idSchema, name: z.string(), x: z.number(), y: z.number(),
  width: z.number(), height: z.number(), elevation: z.number(), rotation: z.number(), hidden: z.boolean(),
  disposition: z.enum(["secret", "hostile", "neutral", "friendly"]), actorId: idSchema.nullable(),
  textureSrc: z.string(), hp: z.object({ current: z.number(), max: z.number() }).nullable(), ac: z.number().nullable(),
}); // No actorLink: Bridge detail does not report it. Unknown properties are stripped.
export type SceneTokenSummary = z.infer<typeof sceneTokenSummarySchema>;
export type TokenDetail = z.infer<typeof tokenDetailSchema>;
export function summaryDisposition(value: SceneTokenSummary["disposition"]): TokenDetail["disposition"] {
  return ({ [-2]: "secret", [-1]: "hostile", 0: "neutral", 1: "friendly" } as const)[value];
}
const actorSchema = z.object({ id: idSchema, name: z.string(), type: z.string(), system: z.record(z.string(), z.unknown()),
  items: z.array(z.object({ id: idSchema, name: z.string(), type: z.string(), system: z.record(z.string(), z.unknown()) }).passthrough()) }).passthrough();
export const sceneSchema = z.object({ id: idSchema, name: z.string(), active: z.boolean(), width: z.number(), height: z.number(),
  grid: z.object({ type: z.number(), size: z.number().positive(), distance: z.number().positive(), units: z.string() }),
  walls: z.array(z.object({ door: z.number() }).passthrough()) }).passthrough();
const contextToken = z.object({ tokenId: idSchema, actorId: idSchema.nullable(), gridX: z.number(), gridY: z.number(),
  distanceFt: z.number().nonnegative(), lineOfSight: z.boolean() }).passthrough();
const contextSchema = z.object({ round: z.number(), turn: z.number(),
  currentCombatant: z.object({ id: idSchema, actorId: idSchema, tokenId: idSchema, gridX: z.number(), gridY: z.number() }).passthrough(),
  nearbyTokens: z.array(contextToken) }).passthrough();
const effectsSchema = z.object({ actorId: idSchema, activeStatuses: z.array(z.string()),
  effects: z.array(z.record(z.string(), z.unknown())) }).passthrough();
const worldSchema = z.object({ world: z.object({ id: idSchema, foundryVersion: z.string(), system: z.string(), systemVersion: z.string() }) }).passthrough();
export function parseBridgeData<T>(schema: z.ZodType<T>, value: unknown, boundary?: ReadCommand): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    // Only a fixed schema field label, never an input value, arbitrary record key or Zod message.
    const first = result.error.issues[0]?.path[0];
    const field = typeof first === "string" && BRIDGE_DIAGNOSTIC_FIELDS.has(first) ? first : "payload";
    ensure(false, boundary ? `BRIDGE_DATA_INVALID:${boundary}:${field}` : "BRIDGE_DATA_INVALID");
  }
  return result.data;
}
export type RawSnapshot = { world: z.infer<typeof worldSchema>["world"]; combat: z.infer<typeof combatSchema>;
  scene: z.infer<typeof sceneSchema>; tokens: SceneTokenSummary[]; actor: z.infer<typeof actorSchema>;
  effects: z.infer<typeof effectsSchema>; context: z.infer<typeof contextSchema>;
  token: TokenDetail; epoch: string; fingerprint: string; observedAt: string; snapshotId: string; fixture: ReadScope };
function fingerprint(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function assertUniqueTokens(tokens: { actorId: string | null }[], actorIds: string[]) {
  for (const actorId of actorIds) ensure(tokens.filter(t => t.actorId === actorId).length === 1, "UNSUPPORTED_DUPLICATE_OR_MISSING_TOKEN");
}
export class CombatSensor {
  constructor(private bridge: BridgeReader) {}
  async capture(input: unknown): Promise<RawSnapshot> {
    return this.readScope(parseBridgeData(fixtureSchema, input));
  }
  // Discovery validates read-only geometry/identity without asserting operator knowledge or invoking the LLM.
  async probe(input: ReadScope): Promise<RawSnapshot> { return this.readScope(parseBridgeData(probeSchema, input)); }
  private async readScope(fixture: ReadScope): Promise<RawSnapshot> {
    const epoch = this.bridge.epoch;
    const before = parseBridgeData(combatSchema, await this.bridge.read("get-combat-state", {}), "get-combat-state");
    ensure(before.started && before.id === fixture.combatId && before.current?.actorId === fixture.actorId &&
      before.current.tokenId === fixture.tokenId && !before.current.hidden && !before.current.defeated, "UNSUPPORTED_CURRENT_COMBAT");
    const [worldData, sceneData, tokensData, actorData, effectsData, contextData, tokenData] = await Promise.all([
      this.bridge.read("get-world-info", {}), this.bridge.read("get-scene", { sceneId: fixture.sceneId, includeScreenshot: false }),
      this.bridge.read("get-scene-tokens", { sceneId: fixture.sceneId }), this.bridge.read("get-actor", { actorId: fixture.actorId }),
      this.bridge.read("get-actor-effects", { actorId: fixture.actorId, includeDisabled: true }),
      this.bridge.read("get-combat-turn-context", { combatId: fixture.combatId }),
      this.bridge.read("get-token", { sceneId: fixture.sceneId, tokenId: fixture.tokenId }),
    ]);
    const after = parseBridgeData(combatSchema, await this.bridge.read("get-combat-state", {}), "get-combat-state");
    ensure(epoch === this.bridge.epoch && fingerprint(before) === fingerprint(after), "STALE_SNAPSHOT");
    const world = parseBridgeData(worldSchema, worldData, "get-world-info").world; const scene = parseBridgeData(sceneSchema, sceneData, "get-scene");
    const tokenList = parseBridgeData(z.object({ sceneId: idSchema, tokens: z.array(sceneTokenSummarySchema) }).passthrough(), tokensData, "get-scene-tokens");
    const actor = parseBridgeData(actorSchema, actorData, "get-actor"); const effects = parseBridgeData(effectsSchema, effectsData, "get-actor-effects");
    const context = parseBridgeData(contextSchema, contextData, "get-combat-turn-context");
    const token = parseBridgeData(tokenDetailSchema, tokenData, "get-token");
    ensure(world.foundryVersion === "12.343" && world.system === "dnd5e" && world.systemVersion === "3.3.1", "UNSUPPORTED_RUNTIME");
    ensure(scene.id === fixture.sceneId && scene.active && tokenList.sceneId === fixture.sceneId &&
      token.sceneId === fixture.sceneId, "SCENE_MISMATCH");
    ensure(actor.id === fixture.actorId && actor.type === "npc" && effects.actorId === actor.id &&
      token.id === fixture.tokenId && token.actorId === actor.id, "UNSUPPORTED_ACTOR");
    ensure(scene.grid.type === 1 && scene.grid.units === "ft" && scene.walls.every(w => w.door === 0), "UNSUPPORTED_GRID_OR_DOORS");
    ensure(context.round === before.round && context.turn === before.turn &&
      context.currentCombatant.id === before.current?.id && context.currentCombatant.actorId === actor.id &&
      context.currentCombatant.tokenId === token.id, "CONTEXT_MISMATCH");
    const tokens = tokenList.tokens;
    const self = tokens.find(t => t.id === token.id);
    ensure(self && self.x === token.x && self.y === token.y && self.actorId === actor.id &&
      self.hidden === token.hidden && summaryDisposition(self.disposition) === token.disposition, "STALE_SNAPSHOT");
    ensure(fixture.linkedActorIds.includes(actor.id), "LINKED_ACTOR_ATTESTATION_REQUIRED");
    const relevant = [self, ...fixture.perceivedTokenIds.map(id => tokens.find(t => t.id === id))];
    ensure(relevant.every(Boolean), "UNKNOWN_FIXTURE_TOKEN");
    const actorIds: string[] = [];
    for (const t of relevant) {
      ensure(t && t.actorId && !t.hidden && t.disposition !== -2 && t.actorLink !== false &&
        fixture.linkedActorIds.includes(t.actorId), "UNSUPPORTED_OR_HIDDEN_TOKEN");
      ensure(t.width === 1 && t.height === 1 && t.elevation === 0 &&
        t.x % scene.grid.size === 0 && t.y % scene.grid.size === 0, "UNSUPPORTED_TOKEN_GEOMETRY");
      ensure(before.combatants.filter(c => c.actorId === t.actorId && c.tokenId === t.id && !c.hidden).length === 1, "UNSUPPORTED_COMBATANT");
      const c = t.id === self.id ? context.currentCombatant : context.nearbyTokens.find(c => c.tokenId === t.id && c.actorId === t.actorId);
      ensure(c && c.gridX === t.x / scene.grid.size && c.gridY === t.y / scene.grid.size, "CONTEXT_SCENE_MISMATCH");
      actorIds.push(t.actorId);
    }
    ensure(!fixture.perceivedTokenIds.includes(token.id) && new Set(fixture.perceivedTokenIds).size === fixture.perceivedTokenIds.length, "FIXTURE_INVALID");
    assertUniqueTokens(tokens, actorIds);
    const data = { world, combat: before, scene, tokens, actor, effects, context, token, epoch, fixture };
    return { ...data, fingerprint: fingerprint(data), observedAt: new Date().toISOString(), snapshotId: randomUUID() };
  }
  async assertFresh(snapshot: RawSnapshot) {
    const fresh = await this.readScope(snapshot.fixture);
    ensure(fresh.fingerprint === snapshot.fingerprint && fresh.epoch === snapshot.epoch, "STALE_SNAPSHOT");
  }
}
