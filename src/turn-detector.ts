import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { BridgeReader } from "./bridge-session.js";
import { CombatSensor, combatSchema, sceneSchema, parseBridgeData, summaryDisposition, type RawSnapshot, type ScopeFixture } from "./combat-sensor.js";
import { mindSchema, type NpcMind } from "./contracts.js";
import { ensure, plain, safeError, SafeError } from "./safety.js";

export const detectedRunSchema = z.object({
  requestId: z.string().uuid(), detectionId: z.string().uuid(),
  selectedCandidateIds: z.array(z.string().uuid()).max(12), attested: z.literal(true),
  mind: mindSchema.pick({ personality: true, motivation: true, relevantMemory: true }),
}).strict();
export type DetectedRunInput = z.infer<typeof detectedRunSchema>;
export type DetectedCandidate = {
  candidateId: string; combatantId: string; actorId: string; tokenId: string | null; name: string;
  disposition: "secret" | "hostile" | "neutral" | "friendly" | "unknown";
  distanceFt: number | null; losReported: boolean | null; eligible: boolean; excludedReason: string | null;
};
export type DetectedTurn = {
  detectionId: string; detectedAt: string; epoch: string; status: "SUPPORTED_FOR_PHASE1A";
  scene: { id: string; name: string }; combat: { id: string; round: number; turn: number; combatantId: string };
  npc: { actorId: string; name: string; hp: { current: number; max: number } | null };
  token: { id: string; name: string }; candidates: DetectedCandidate[];
  actorLink: null; perception: "OPERATOR_CONFIRMATION_REQUIRED"; writesDispatched: 0;
};
type Detection = { view: DetectedTurn; raw: RawSnapshot };
const identity = (raw: RawSnapshot) => JSON.stringify({ epoch: raw.epoch, scene: raw.scene.id,
  combat: raw.combat.id, round: raw.combat.round, turn: raw.combat.turn,
  combatant: raw.combat.current?.id, actor: raw.actor.id, token: raw.token.id });
const staleCodes = new Set(["UNSUPPORTED_CURRENT_COMBAT", "SCENE_MISMATCH", "UNSUPPORTED_ACTOR", "UNKNOWN_FIXTURE_TOKEN",
  "UNSUPPORTED_OR_HIDDEN_TOKEN", "UNSUPPORTED_COMBATANT", "UNSUPPORTED_DUPLICATE_OR_MISSING_TOKEN",
  "CONTEXT_MISMATCH", "CONTEXT_SCENE_MISMATCH", "STALE_SNAPSHOT"]);

export class TurnDetector {
  private latest: Detection | null = null;
  private sensor: CombatSensor;
  constructor(private bridge: BridgeReader) { this.sensor = new CombatSensor(bridge); }
  invalidate() { this.latest = null; }
  private async activeScene() {
    // v8.11.2 GetSceneParams.sceneId is optional; sceneTypes.getScene resolves game.scenes.active.
    return parseBridgeData(sceneSchema, await this.bridge.read("get-scene", { includeScreenshot: false }), "get-scene");
  }
  async detect(): Promise<DetectedTurn> {
    this.latest = null;
    const epoch = this.bridge.epoch;
    // First read is always the active combat; never supply a renderer-selected combat ID.
    const combat = parseBridgeData(combatSchema.extend({ turn: z.number().int().nullable() }),
      await this.bridge.read("get-combat-state", {}), "get-combat-state");
    ensure(combat.started && combat.current?.tokenId && !combat.current.hidden && !combat.current.defeated &&
      combat.turn !== null && combat.turn >= 0, "NO_ACTIVE_NPC_TURN");
    const current = combat.current;
    const scene = await this.activeScene();
    const raw = await this.sensor.probe({ sceneId: scene.id, combatId: combat.id, actorId: current.actorId,
      tokenId: current.tokenId!, linkedActorIds: [current.actorId], perceivedTokenIds: [] });
    ensure(epoch === raw.epoch && combat.id === raw.combat.id && combat.round === raw.combat.round &&
      combat.turn === raw.combat.turn && current.id === raw.combat.current?.id, "DETECTED_SCOPE_STALE");
    ensure((await this.activeScene()).id === scene.id && this.bridge.epoch === epoch, "DETECTED_SCOPE_STALE");
    const candidates = this.candidates(raw);
    ensure(candidates.filter(c => c.eligible).length <= 12, "UNSUPPORTED_TOO_MANY_TARGETS");
    const view: DetectedTurn = { detectionId: randomUUID(), detectedAt: raw.observedAt, epoch,
      status: "SUPPORTED_FOR_PHASE1A", scene: { id: scene.id, name: plain(scene.name) },
      combat: { id: combat.id, round: combat.round, turn: combat.turn, combatantId: current.id },
      npc: { actorId: raw.actor.id, name: plain(raw.actor.name), hp: raw.token.hp },
      token: { id: raw.token.id, name: plain(raw.token.name) }, candidates,
      actorLink: null, perception: "OPERATOR_CONFIRMATION_REQUIRED", writesDispatched: 0 };
    this.latest = { view, raw }; return structuredClone(view);
  }
  private candidates(raw: RawSnapshot): DetectedCandidate[] {
    ensure(raw.combat.combatants.length <= 128, "UNSUPPORTED_TOO_MANY_COMBATANTS");
    return raw.combat.combatants.filter(c => c.id !== raw.combat.current?.id).map(c => {
      const token = raw.tokens.find(t => t.id === c.tokenId && t.actorId === c.actorId);
      const context = raw.context.nearbyTokens.filter(t => t.tokenId === c.tokenId && t.actorId === c.actorId);
      const nearby = context.length === 1 ? context[0] : undefined;
      let reason: string | null = null;
      if (!token) reason = "Token absent from active scene";
      else if (c.hidden || token.hidden || token.disposition === -2) reason = "Hidden or secret";
      else if (c.defeated) reason = "Defeated";
      else if (raw.tokens.filter(t => t.actorId === c.actorId).length !== 1 ||
        raw.combat.combatants.filter(t => t.actorId === c.actorId || t.tokenId === c.tokenId).length !== 1) reason = "Duplicate Actor/token instance";
      else if (token.actorLink === false) reason = "Unlinked Actor";
      else if (token.width !== 1 || token.height !== 1 || token.elevation !== 0 ||
        token.x % raw.scene.grid.size !== 0 || token.y % raw.scene.grid.size !== 0) reason = "Unsupported token geometry";
      else if (!nearby) reason = "Missing or ambiguous current context";
      else if (nearby.gridX !== token.x / raw.scene.grid.size || nearby.gridY !== token.y / raw.scene.grid.size) reason = "Context position mismatch";
      else if (nearby.lineOfSight === false) reason = "LOS explicitly blocked";
      const excludedHidden = c.hidden || token?.hidden || token?.disposition === -2;
      return { candidateId: randomUUID(), combatantId: c.id, actorId: c.actorId, tokenId: c.tokenId,
        name: plain(token?.name ?? c.name) || "Unnamed combatant", disposition: token ? summaryDisposition(token.disposition) : "unknown",
        distanceFt: excludedHidden ? null : nearby?.distanceFt ?? null, losReported: excludedHidden ? null : nearby?.lineOfSight ?? null,
        eligible: reason === null, excludedReason: reason };
    });
  }
  prepare(input: DetectedRunInput): { fixture: ScopeFixture; mind: NpcMind; capture: () => Promise<RawSnapshot> } {
    const detection = this.latest;
    ensure(detection && detection.view.detectionId === input.detectionId && detection.raw.epoch === this.bridge.epoch, "DETECTED_SCOPE_STALE");
    ensure(input.attested, "ATTESTATION_REQUIRED");
    ensure(new Set(input.selectedCandidateIds).size === input.selectedCandidateIds.length, "DETECTED_SELECTION_INVALID");
    const selected = input.selectedCandidateIds.map(id => detection.view.candidates.find(c => c.candidateId === id));
    ensure(selected.every(c => c?.eligible), "DETECTED_SELECTION_INVALID");
    const targets = selected as DetectedCandidate[];
    const fixture: ScopeFixture = { sceneId: detection.raw.scene.id, combatId: detection.raw.combat.id,
      actorId: detection.raw.actor.id, tokenId: detection.raw.token.id,
      linkedActorIds: [detection.raw.actor.id, ...targets.map(c => c.actorId)], perceivedTokenIds: targets.map(c => c.tokenId!),
      attestSingleActiveCombat: true, attestViewedCombatScene: true, attestNormalWalkingNoTerrain: true };
    // Selection is explicit per-run attack authorization. Foundry disposition remains diagnostic only.
    const mind: NpcMind = { ...input.mind, actorId: fixture.actorId,
      relationships: targets.map(c => ({ actorId: c.actorId, summary: "Enemy selected for this supervised run" })) };
    return { fixture, mind, capture: async () => {
      try {
        ensure(this.latest === detection && this.bridge.epoch === detection.raw.epoch, "DETECTED_SCOPE_STALE");
        ensure((await this.activeScene()).id === fixture.sceneId, "DETECTED_SCOPE_STALE");
        // Run the existing full fresh-read bracket after the user's attestation, before any model call.
        const fresh = await this.sensor.capture(fixture);
        ensure(identity(fresh) === identity(detection.raw), "DETECTED_SCOPE_STALE");
        const available = this.candidates(fresh);
        for (const target of targets) {
          const found = available.find(c => c.combatantId === target.combatantId && c.actorId === target.actorId && c.tokenId === target.tokenId);
          ensure(found?.eligible && found.disposition === target.disposition, "DETECTED_SCOPE_STALE");
        }
        ensure((await this.activeScene()).id === fixture.sceneId && this.bridge.epoch === fresh.epoch, "DETECTED_SCOPE_STALE");
        return fresh;
      } catch (error) {
        if (staleCodes.has(safeError(error))) throw new SafeError("DETECTED_SCOPE_STALE");
        throw error;
      }
    } };
  }
}
