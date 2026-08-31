import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure, plain } from "../../src/safety.js";
import type { TestReader, TestReadCommand } from "./bridge.js";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const combatant = z.object({ id, actorId: id, tokenId: id.nullable(), name: z.string(), hidden: z.boolean(), defeated: z.boolean() });
const combatSchema = z.object({ id, started: z.boolean(), round: z.number().int().nonnegative(), turn: z.number().int().nullable(), current: combatant.nullable(), combatants: z.array(combatant).max(32) });
const sceneSchema = z.object({ id, name: z.string(), active: z.boolean() });
const tokenSchema = z.object({ id, actorId: id.nullable(), name: z.string(), x: z.number().finite(), y: z.number().finite(), hidden: z.boolean() });
const tokenListSchema = z.object({ sceneId: id, tokens: z.array(tokenSchema).max(1000) });
const actorSchema = z.object({ id, name: z.string(), type: z.string(), system: z.record(z.string(), z.unknown()),
  items: z.array(z.object({ id, name: z.string(), type: z.string(), system: z.record(z.string(), z.unknown()) })).max(500) });
const documentSchema = z.object({ uuid: z.string(), documentName: z.string(), id, parentUuid: z.string().nullable(), data: z.record(z.string(), z.unknown()) });
const filterSchema = z.object({ results: z.array(z.object({ id, name: z.string() })).max(200), total: z.number().int().nonnegative(), hasMore: z.boolean() });
const hpSchema = z.object({ value: z.number().finite(), max: z.number().finite().nonnegative(), temp: z.number().finite().nullable().optional() });
const slotsSchema = z.record(z.string(), z.object({ value: z.number().finite().nullable().optional(), max: z.number().finite().nullable().optional(), level: z.number().finite().optional() }));
const resourceSchema = z.record(z.string(), z.object({ value: z.number().finite().nullable().optional(), max: z.union([z.number().finite(), z.string().max(80), z.null()]).optional() }));
const spellSchema = z.object({ level: z.literal(0), actionType: z.enum(["rsak", "msak"]),
  activation: z.object({ type: z.literal("action"), cost: z.literal(1) }),
  target: z.object({ type: z.enum(["creature", "enemy"]), value: z.union([z.literal(1), z.literal("1")]) }),
  properties: z.array(z.string()).optional(), components: z.object({ concentration: z.boolean().optional() }).optional(),
  activities: z.record(z.string(), z.unknown()).optional(),
  uses: z.object({ value: z.number().nullable().optional(), max: z.union([z.string(),z.number()]).optional(), per: z.string().nullable().optional() }).optional(),
  consume: z.object({ type: z.string().optional(), target: z.string().nullable().optional() }).optional(),
});
export const choiceSchema = z.object({ detectionId: z.string().uuid(), casterRow: z.string().uuid().optional(), targetRow: z.string().uuid().optional() }).strict();
export type TestChoice = z.infer<typeof choiceSchema>;
type Actor = z.infer<typeof actorSchema>;
type Participant = { actor: Actor; token: z.infer<typeof tokenSchema>; playerOwned: boolean; linked: boolean; combatantId: string };
export type Snapshot = { epoch: string; worldId: string; scene: z.infer<typeof sceneSchema>; combat: z.infer<typeof combatSchema>; participants: Participant[]; scopeKey: string; identityKey: string };
type Caster = Participant & { item: Actor["items"][number] };
export type Selection = { snapshot: Snapshot; caster: Caster; target: Participant };
export type CasterDiagnostic = { name: string; reason: "PLAYER_CONTROLLED_TARGET" | "FIRE_BOLT_NOT_OWNED" |
  "MULTIPLE_OWNED_FIRE_BOLT_ITEMS" | "FIRE_BOLT_SHAPE_UNSUPPORTED" | "TOKEN_INSTANCE_NOT_UNIQUE" |
  "COMBAT_TOKEN_NOT_FOUND" | "HIDDEN_PARTICIPANT" | "DEFEATED_PARTICIPANT" | "COMBAT_IDENTITY_AMBIGUOUS" |
  "UNLINKED_ACTOR" | "ELIGIBLE" };
export type DiscoveryView = { detectionId: string; status: "READY_FOR_REVIEW" | "SELECT_CASTER" | "SELECT_TARGET";
  scene: string; round: number; currentCombatant: string | null; spell: "Fire Bolt";
  casters: { row: string; name: string }[]; targets: { row: string; name: string }[];
  casterRow: string | null; targetRow: string | null; caster: string | null; target: string | null;
  execution: "DISABLED_REVIEW_REQUIRED"; writesDispatched: 0;
  advanced: { sceneId: string; combatId: string; currentCombatantId: string | null; epoch: string;
    participants: { name: string; actorId: string; tokenId: string; actorLink: boolean; hasPlayerOwner: boolean }[];
    itemId: string | null; actorId: string | null; tokenId: string | null; targetActorId: string | null; targetTokenId: string | null } };
const hash = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
function parse<T>(schema: z.ZodType<T>, data: unknown): T { const r = schema.safeParse(data); ensure(r.success, "TEST_READ_DATA_INVALID"); return r.data; }
export function actorResources(actor: Actor) {
  const data = parse(z.object({ attributes: z.object({ hp: hpSchema }), spells: slotsSchema.optional(), resources: resourceSchema.optional() }), actor.system);
  return { hp: data.attributes.hp, spells: data.spells ?? {}, resources: data.resources ?? {} };
}
function isFireBoltName(name: string) {
  // Exact slash-delimited display-name segment supports audited localized LAARU names without fuzzy matching.
  return name.split("/").some(label => label.trim().toLocaleLowerCase("en-US") === "fire bolt");
}
function fireBolts(p: Participant) {
  return p.actor.items.filter(item => item.type === "spell" && isFireBoltName(item.name) && item.system.level === 0);
}
function suitableItem(item: Actor["items"][number]) {
  const parsed = spellSchema.safeParse(item.system);
  if (!parsed.success) return false;
  const s = parsed.data;
  return (s.properties !== undefined || s.components?.concentration !== undefined) && !s.properties?.includes("concentration") && s.components?.concentration !== true &&
    Object.keys(s.activities ?? {}).length === 0 && !s.consume?.type && !s.consume?.target &&
    (!s.uses?.max || s.uses.max === "0") && !s.uses?.per;
}
export class FireBoltDiscovery {
  private latest: { snapshot: Snapshot; view: DiscoveryView; casters: Map<string,Caster>; targets: Map<string,Participant> } | null = null;
  private busy = false;
  private lastCasterDiagnostics: CasterDiagnostic[] = [];
  private captureExclusions: CasterDiagnostic[] = [];
  constructor(private reader: TestReader, private now = Date.now) {}
  view() { return this.latest ? structuredClone(this.latest.view) : null; }
  diagnostics() { return structuredClone(this.lastCasterDiagnostics); }
  invalidate() { this.latest = null; }
  async capture(): Promise<Snapshot> {
    this.captureExclusions=[];
    const epoch = this.reader.epoch; const deadline = this.now() + 60000;
    let reads = 0;
    const read = async (type: TestReadCommand, params: Record<string,unknown>) => {
      ensure(this.reader.connected, "BRIDGE_DISCONNECTED"); ensure(epoch === this.reader.epoch, "SCOPE_STALE");
      ensure(++reads <= 100 && this.now() < deadline, "TEST_READ_LIMIT");
      const result = await this.reader.read(type, params);
      ensure(epoch === this.reader.epoch, "SCOPE_STALE"); ensure(this.now() < deadline, "TEST_READ_LIMIT"); return result;
    };
    const combat = parse(combatSchema, await read("get-combat-state", {}));
    ensure(combat.started, "NO_ACTIVE_COMBAT");
    const scene = parse(sceneSchema, await read("get-scene", { includeScreenshot: false }));
    ensure(scene.active, "NO_ACTIVE_SCENE");
    const world = parse(z.object({ world: z.object({ id, foundryVersion: z.string(), system: z.string(), systemVersion: z.string() }) }), await read("get-world-info", {})).world;
    ensure(/^12\.343(?:\.0)?$/.test(world.foundryVersion) && world.system === "dnd5e" && world.systemVersion === "3.3.1", "UNSUPPORTED_RUNTIME");
    const scope = parse(documentSchema, await read("resolve-uuid", { uuid: `Combat.${combat.id}` }));
    ensure(scope.uuid === `Combat.${combat.id}` && scope.id === combat.id && scope.documentName === "Combat" &&
      scope.data.scene === scene.id && scope.data.active === true, "SCOPE_STALE");
    const tokens = parse(tokenListSchema, await read("get-scene-tokens", { sceneId: scene.id }));
    ensure(tokens.sceneId === scene.id && new Set(tokens.tokens.map(t => t.id)).size === tokens.tokens.length, "SCOPE_STALE");
    const owners = new Map<string,boolean>();
    for (const player of [true,false]) {
      let expectedTotal: number | null = null; const seen = new Set<string>();
      for (let page=0; page<8; page++) {
        const result = parse(filterSchema, await read("filter-actors", { hasPlayerOwner: player, limit: 200, offset: page*200 }));
        ensure(expectedTotal === null || expectedTotal === result.total, "SCOPE_STALE"); expectedTotal = result.total;
        for (const row of result.results) { ensure(!seen.has(row.id) && !owners.has(row.id), "OWNERSHIP_UNVERIFIED"); seen.add(row.id); owners.set(row.id,player); }
        if (!result.hasMore) { ensure(seen.size === result.total, "OWNERSHIP_UNVERIFIED"); break; }
        ensure(result.results.length === 200 && page<7, "OWNERSHIP_READ_LIMIT");
      }
    }
    const participants: Participant[] = [];
    for (const c of combat.combatants) {
      // Count all scene instances, including hidden tokens; never pick the first duplicate.
      const matches = tokens.tokens.filter(t => t.actorId === c.actorId);const displayName=plain(c.name)||"Unnamed participant";
      if (matches.length !== 1) { this.captureExclusions.push({name:displayName,reason:"TOKEN_INSTANCE_NOT_UNIQUE"}); continue; }
      if (matches[0]!.id !== c.tokenId) { this.captureExclusions.push({name:displayName,reason:"COMBAT_TOKEN_NOT_FOUND"}); continue; }
      if (c.hidden || matches[0]!.hidden) { this.captureExclusions.push({name:displayName,reason:"HIDDEN_PARTICIPANT"}); continue; }
      if (c.defeated) { this.captureExclusions.push({name:displayName,reason:"DEFEATED_PARTICIPANT"}); continue; }
      if (combat.combatants.filter(o => o.actorId === c.actorId || o.tokenId === c.tokenId).length !== 1) {
        this.captureExclusions.push({name:displayName,reason:"COMBAT_IDENTITY_AMBIGUOUS"}); continue;
      }
      ensure(owners.has(c.actorId), "OWNERSHIP_UNVERIFIED");
      const token = matches[0]!;
      const tokenDoc = parse(documentSchema, await read("resolve-uuid", { uuid: `Scene.${scene.id}.Token.${token.id}` }));
      const native = parse(z.object({ _id: id, actorId: id, actorLink: z.boolean(), x: z.number(), y: z.number(), hidden: z.boolean() }), tokenDoc.data);
      ensure(tokenDoc.uuid === `Scene.${scene.id}.Token.${token.id}` && tokenDoc.documentName === "Token" && tokenDoc.id === token.id &&
        tokenDoc.parentUuid === `Scene.${scene.id}` && native._id === token.id && native.actorId === c.actorId &&
        native.x === token.x && native.y === token.y && native.hidden === token.hidden, "SCOPE_STALE");
      // Synthetic Actor overlays remain outside this isolated seam, including for a target.
      if (!native.actorLink) { this.captureExclusions.push({name:displayName,reason:"UNLINKED_ACTOR"}); continue; }
      const actor = parse(actorSchema, await read("get-actor", { actorId: c.actorId }));
      ensure(actor.id === c.actorId && new Set(actor.items.map(i => i.id)).size === actor.items.length, "SCOPE_STALE");
      participants.push({ actor, token, linked: native.actorLink, playerOwned: owners.get(c.actorId)!, combatantId: c.id });
    }
    const afterCombat = parse(combatSchema, await read("get-combat-state", {}));
    const afterScene = parse(sceneSchema, await read("get-scene", { includeScreenshot: false }));
    ensure(hash(combat) === hash(afterCombat) && hash(scene) === hash(afterScene), "SCOPE_STALE");
    const scopeKey = hash({ epoch, world: world.id, scene, combat });
    const identityKey = hash(participants.map(p => ({ actor: p.actor.id, token: p.token, owner: p.playerOwned, linked: p.linked, combatant: p.combatantId,
      items: p.actor.items.map(i => ({ id: i.id, name: i.name, type: i.type, system: i.system })) })));
    return { epoch, worldId: world.id, scene, combat, participants, scopeKey, identityKey };
  }
  private buildCasterDiagnostics(snapshot: Snapshot): CasterDiagnostic[] {
    return snapshot.participants.map(p => {
      const name=plain(p.token.name || p.actor.name) || "Unnamed participant";
      if (p.playerOwned) return {name,reason:"PLAYER_CONTROLLED_TARGET"};
      const items=fireBolts(p);
      if (!items.length) return {name,reason:"FIRE_BOLT_NOT_OWNED"};
      if (items.length>1) return {name,reason:"MULTIPLE_OWNED_FIRE_BOLT_ITEMS"};
      return {name,reason:suitableItem(items[0]!)?"ELIGIBLE":"FIRE_BOLT_SHAPE_UNSUPPORTED"};
    });
  }
  private candidates(snapshot: Snapshot): Caster[] {
    return snapshot.participants.filter(p => !p.playerOwned && p.linked).flatMap(p => {
      const items = fireBolts(p);
      if (items.length !== 1 || !suitableItem(items[0]!)) return [];
      return [{ ...p, item: items[0]! }];
    });
  }
  async detect(): Promise<DiscoveryView> {
    ensure(!this.busy, "TEST_BUSY"); this.busy = true; this.latest = null; this.lastCasterDiagnostics=[];
    try {
      const snapshot = await this.capture(); this.lastCasterDiagnostics=[...this.captureExclusions,...this.buildCasterDiagnostics(snapshot)]; const candidates = this.candidates(snapshot);
      const current = candidates.find(p => p.combatantId === snapshot.combat.current?.id);
      const offered = current ? [current] : candidates;
      ensure(offered.length > 0, "CASTER_NOT_FOUND");
      const targets = snapshot.participants.filter(p => p.playerOwned);
      ensure(targets.length > 0, "TARGET_NOT_FOUND");
      const casterMap = new Map(offered.map(p => [randomUUID(),p])); const targetMap = new Map(targets.map(p => [randomUUID(),p]));
      const name = (p: Participant) => plain(p.token.name || p.actor.name) || "Unnamed participant";
      const view: DiscoveryView = { detectionId: randomUUID(), status: "SELECT_CASTER", scene: plain(snapshot.scene.name), round: snapshot.combat.round,
        currentCombatant: snapshot.combat.current ? plain(snapshot.combat.current.name) : null, spell: "Fire Bolt",
        casters: [...casterMap].map(([row,p]) => ({row,name:name(p)})), targets: [...targetMap].map(([row,p]) => ({row,name:name(p)})),
        casterRow: casterMap.size===1 ? [...casterMap.keys()][0]! : null, targetRow: targetMap.size===1 ? [...targetMap.keys()][0]! : null,
        caster:null,target:null,execution:"DISABLED_REVIEW_REQUIRED",writesDispatched:0,
        advanced:{sceneId:snapshot.scene.id,combatId:snapshot.combat.id,currentCombatantId:snapshot.combat.current?.id??null,epoch:snapshot.epoch,
          participants:snapshot.participants.map(p=>({name:name(p),actorId:p.actor.id,tokenId:p.token.id,actorLink:p.linked,hasPlayerOwner:p.playerOwned})),
          itemId:null,actorId:null,tokenId:null,targetActorId:null,targetTokenId:null} };
      this.latest={snapshot,view,casters:casterMap,targets:targetMap}; this.updateView(); return this.view()!;
    } finally { this.busy=false; }
  }
  choose(input: unknown): DiscoveryView {
    ensure(!this.busy, "TEST_BUSY");
    const choice = parse(choiceSchema,input); const latest = this.latest;
    ensure(latest && latest.view.detectionId===choice.detectionId && latest.snapshot.epoch===this.reader.epoch, "SCOPE_STALE");
    if (choice.casterRow!==undefined) { ensure(latest.casters.has(choice.casterRow),"SELECTION_INVALID"); latest.view.casterRow=choice.casterRow; }
    if (choice.targetRow!==undefined) { ensure(latest.targets.has(choice.targetRow),"SELECTION_INVALID"); latest.view.targetRow=choice.targetRow; }
    this.updateView(); return this.view()!;
  }
  private updateView() {
    const d=this.latest!; const caster=d.view.casterRow ? d.casters.get(d.view.casterRow) : undefined;
    const target=d.view.targetRow ? d.targets.get(d.view.targetRow) : undefined;
    d.view.caster=caster ? plain(caster.token.name || caster.actor.name) : null; d.view.target=target ? plain(target.token.name || target.actor.name) : null;
    d.view.status=!caster ? "SELECT_CASTER" : !target ? "SELECT_TARGET" : "READY_FOR_REVIEW";
    Object.assign(d.view.advanced,{actorId:caster?.actor.id??null,tokenId:caster?.token.id??null,itemId:caster?.item.id??null,
      targetActorId:target?.actor.id??null,targetTokenId:target?.token.id??null});
  }
  async prepare(input: unknown): Promise<Selection> {
    const selected = this.choose(input); const d=this.latest!;
    ensure(selected.status==="READY_FOR_REVIEW", "SELECTION_REQUIRED");
    this.busy = true;
    try {
    const caster=d.casters.get(selected.casterRow!)!; const target=d.targets.get(selected.targetRow!)!;
    const fresh=await this.capture();
    ensure(this.latest===d && fresh.scopeKey===d.snapshot.scopeKey && fresh.identityKey===d.snapshot.identityKey, "SCOPE_STALE");
    const freshCaster=this.candidates(fresh).find(p=>p.actor.id===caster.actor.id && p.item.id===caster.item.id);
    const freshTarget=fresh.participants.find(p=>p.actor.id===target.actor.id && p.playerOwned);
    ensure(freshCaster && freshTarget && freshCaster.actor.id!==freshTarget.actor.id,"SCOPE_STALE");
    const itemUuid=`Actor.${freshCaster.actor.id}.Item.${freshCaster.item.id}`;
    const doc=parse(documentSchema,await this.reader.read("resolve-uuid",{uuid:itemUuid}));
    const owned=parse(z.object({_id:id,type:z.literal("spell"),name:z.string(),system:z.record(z.string(),z.unknown())}),doc.data);
    ensure(doc.uuid===itemUuid && doc.documentName==="Item" && doc.parentUuid===`Actor.${freshCaster.actor.id}` && doc.id===freshCaster.item.id && owned._id===doc.id &&
      isFireBoltName(owned.name) && suitableItem({...freshCaster.item,system:owned.system}),"ITEM_NOT_OWNED_OR_UNSUPPORTED");
    actorResources(freshCaster.actor); actorResources(freshTarget.actor);
    const end=await this.capture();
    ensure(end.scopeKey===fresh.scopeKey && end.identityKey===fresh.identityKey,"SCOPE_STALE");
    ensure(this.latest===d, "SCOPE_STALE");
    return {snapshot:end,caster:freshCaster,target:freshTarget};
    } finally { this.busy = false; }
  }
}
