# Normalized combat state v1

**Proposed compact decision DTO.** Raw Bridge responses remain adapter-internal. StoryCore owns memory/personality/relationships; Foundry owns live state, and D&D5e/Midi own rules. This schema is input to [COMBAT_INTENT_SCHEMA.md](COMBAT_INTENT_SCHEMA.md), not a duplicate Actor database.

## Sensor sources and trust

| Data | Current source | Normalization / missing support |
|---|---|---|
| World/system identity | B get-world-info | Pin Foundry 12.343 and D&D5e 3.3.1; installed Midi/Bridge version needs proposed capability response. |
| Combat/current combatant | B get-combat-state with combatId | Preserve round, turn, combatant, Actor, token. Proposed scoped context verifies combat.scene. |
| Tokens/instance selection | B get-scene-tokens + get-token with sceneId | Match current combatant's token, never first Actor match. Preserve base Actor ID as identity. Proposed scope sensor adds actorLink/effective Actor UUID. |
| Self core/resources/items | B get-actor and get-actor-items | B system is getRollData(), item system is toObject(false). Whitelist prepared fields; full token Actor scope is a required extension for unlinked instances. |
| Conditions/effects | B get-actor-effects and statuses | Include active statuses and short effect summaries, disabled/suppressed flags if available. Missing complete applicable-effect list stays explicitly unknown. Never evaluate effect change scripts/formulas. |
| LOS/distance | B get-combat-turn-context | Label existing LOS as wall geometry, and distance as approximate grid distance. Proposed native scoped sensor provides verified perception/range facts; do not use GM visibility as NPC perception. |
| Movement/path | Proposed plan-token-path | Cost, goal, endpoint, budget, blocked/unsupported reason, expiry and plan ID. Path search remains inside Bridge; raw waypoints stay internal by default. |
| Action availability | Prepared item metadata, native availability constraints, observed lease ledger | Distinguish available, conditional, unavailable and unknown. No fabricated rules or action counts. |

READ is a consistency bracket: get combat/scope before → gather required independent reads → get combat/scope after; reject if identity/turn/revision changed. Proposed revision is an extension-local counter invalidated by relevant Foundry document hooks, with a session epoch. It is not a native atomic snapshot. Re-read before every write, including between movement and activation.

Unknown numeric data is null, not zero; unknown booleans are null, not true. Disposition is a Foundry token fact, not an Actor relationship or tactical command. Relationships arrive separately from StoryCore. For repeated base Actor instances, show separate token/combatant entries and require disambiguation.

## Normative shape

Notation below is a closed TypeScript-style schema specification; object keys not listed are forbidden. ID = non-empty string <=128 characters. ShortText = plain text <=240 characters. All numbers finite; counts nonnegative except documented Foundry disposition. Coordinate integers are grid cells, not pixels. Runtime implementation derives strict validators/provider schema from one contracts module.

~~~typescript
type ID = string;
type ShortText = string;
type FactSource = "native" | "bridge-approximation" | "turn-lease" | "unknown";
type Counter = { value: number | null; max: number | null };
type TargetRef = { actorId: ID; combatantId?: ID };
type GridPoint = { x: number; y: number };
type Availability = "available" | "conditional" | "unavailable" | "unknown";
type Goal = {
  kind: "approach" | "position" | "retreat";
  target: TargetRef | null;
  destination: GridPoint | null;
  within: number | null;
  units: string;
};
type ActionCard = {
  actionId: ID;
  itemId: ID;
  name: ShortText;
  itemType: "weapon" | "spell" | "feat" | "consumable" | "other";
  hasActivities: boolean | null;
  activation: {
    type: string | null;
    cost: number | null;
    source: FactSource;
  };
  execution: "automatic" | "manual" | "unsupported";
  availability: Availability;
  blockers: ShortText[];
  equipped: boolean | null;
  quantity: number | null;
  uses: Counter | null;
  rechargeReady: boolean | null;
  range: { normal: number | null; long: number | null; units: string | null };
  target: { kind: string | null; count: number | null };
  damageTypes: string[];
  saveAbility: string | null;
  spell: { level: number | null; prepared: boolean | null } | null;
  resourceCosts: { resourceId: ID; amount: number | null; source: FactSource }[];
  summary: ShortText;
  eligibleTargets: TargetRef[];
};
type PlanSummary = {
  planId: ID | null;
  goal: Goal;
  endpoint: GridPoint | null;
  status: "ready" | "over_budget" | "blocked" | "unsupported" | "unknown";
  distance: number | null;
  cost: number | null;
  units: string;
  withinBudget: boolean | null;
  reachesGoal: boolean;
  expiresAt: string;
  blockers: ShortText[];
};
type CombatStateV1 = {
  schemaVersion: "1.0";
  snapshotId: ID;
  observedAt: string;
  expiresAt: string;
  scope: {
    worldId: ID; sceneId: ID; combatId: ID;
    sessionEpoch: ID; revision: ID;
  };
  runtime: {
    foundryVersion: string;
    systemId: "dnd5e";
    systemVersion: string;
    bridgeVersion: string | null;
    midiVersion: string | null;
    scopeVerified: boolean;
    pathPreview: boolean;
    workflowMatching: boolean;
    automaticExecution: boolean;
  };
  combat: {
    started: boolean; round: number; turn: number;
    current: { combatantId: ID; actorId: ID; tokenId: ID };
  };
  self: {
    actorId: ID; tokenId: ID; combatantId: ID;
    effectiveActorUuid: string | null;
    actorLink: boolean | null;
    name: ShortText; actorType: string;
    position: GridPoint; elevation: number | null;
    footprint: { width: number; height: number };
    hp: { current: number | null; max: number | null; temp: number | null };
    ac: number | null;
    abilities: {
      str: number | null; dex: number | null; con: number | null;
      int: number | null; wis: number | null; cha: number | null;
    };
    movement: { walk: number | null; units: string | null };
    resources: { resourceId: ID; label: ShortText; counter: Counter; source: FactSource }[];
    spellSlots: { key: ID; level: number | null; counter: Counter }[];
    conditions: ShortText[];
    effects: {
      id: ID; name: ShortText; disabled: boolean;
      suppressed: boolean | null; remaining: number | null; units: string | null;
    }[];
    effectsComplete: boolean;
  };
  budgets: {
    movementRemaining: number | null;
    units: string;
    actionAvailable: boolean | null;
    bonusActionAvailable: boolean | null;
    reactionAvailable: boolean | null;
    source: FactSource;
    leaseId: ID | null;
  };
  actions: ActionCard[];
  nearby: {
    actorId: ID; tokenId: ID; combatantId: ID | null;
    name: ShortText;
    disposition: "hostile" | "neutral" | "friendly" | "secret" | "unknown";
    position: GridPoint;
    distance: number | null; units: string; distanceSource: FactSource;
    wallLos: boolean | null;
    perceived: true;
    perceptionSource: "native" | "verified-fixture";
    conditions: ShortText[];
    health: "unharmed" | "injured" | "down" | "unknown";
  }[];
  movement: {
    profile: string;
    grid: { type: string; sizePixels: number; distance: number; units: string };
    plans: PlanSummary[];
  };
  quality: {
    unknowns: ShortText[];
    warnings: ShortText[];
    omittedActions: number;
    omittedNearby: number;
    completeForDecision: boolean;
  };
};
~~~

Additional invariants:

- self identity equals combat.current; scope is selected by trusted caller and verified in Foundry.
- Goal approach requires target and within, destination null; position/retreat requires destination and null target/within. within is native item-derived range or an explicit geometry request, never a model-authored rule override.
- Only ready, unexpired plans with a non-null planId may be selected. Search-limit/stale preview results normalize to unknown with reasons; no plan ID is executable for failed previews.
- IDs/actionId/planId are unique within snapshot; Item ID is scoped to acting effective Actor. Plan IDs bind snapshot/scene/token/goal in Bridge.
- Activation cost/range/uses/damageTypes are copied metadata for selection, not permission to calculate or apply damage. Do not parse arbitrary item prose into executable rules.
- eligibleTargets are provisional known candidates, not a prediction of hit/success; conditional melee can require the offered approach path. Revalidate after movement.
- budgets describe known remaining allowance; action Available is not inferred from initiative index. Speed is capacity only. If source is unknown, counters/availability are null and automatic execution is disabled.
- effectsComplete=false with potentially relevant unknown effects makes affected automatic actions unknown/manual; do not invent effect resolution.
- No raw system, flags, biography, HTML, script, macro, journal, wall array, image/base64 or Compendium content field is allowed.
- Only targets whose perception is positively established are included in nearby. Unknown/hidden actors stay internal; quality gives aggregate omissions without names/locations. Secret tokens are not exposed merely because the GM can see them.
- Exact enemy HP/AC/resources are not exposed by default. health is a permitted observation supplied by the sensor/StoryCore knowledge policy, not a rules-derived damage estimate. Self HP/resources may be exact.
- nearby may include perceived noncombat actors using token-scoped sensor extension; old context lists combatants only. Disambiguate repeated noncombat instances or make them untargetable in this initial intent version.

## Illustrative fixture

This example describes a **hypothetical extended Bridge after capability verification**, not evidence that proposed APIs exist. Runtime module-version strings below are test placeholders. IDs are examples. Native measurement/turn budget have been supplied by a verified fixture; a real normalizer must not invent them.

~~~json
{
  "schemaVersion": "1.0",
  "snapshotId": "snapshot-42",
  "observedAt": "2026-08-31T12:00:00Z",
  "expiresAt": "2026-08-31T12:00:30Z",
  "scope": {
    "worldId": "world-demo", "sceneId": "scene-room", "combatId": "combat-demo",
    "sessionEpoch": "epoch-3", "revision": "rev-104"
  },
  "runtime": {
    "foundryVersion": "12.343", "systemId": "dnd5e", "systemVersion": "3.3.1",
    "bridgeVersion": "fixture-extended-8.11.2", "midiVersion": "fixture-midi-version",
    "scopeVerified": true, "pathPreview": true, "workflowMatching": true,
    "automaticExecution": true
  },
  "combat": {
    "started": true, "round": 2, "turn": 1,
    "current": { "combatantId": "combatant-goblin", "actorId": "actor-goblin", "tokenId": "token-goblin" }
  },
  "self": {
    "actorId": "actor-goblin", "tokenId": "token-goblin", "combatantId": "combatant-goblin",
    "effectiveActorUuid": "Actor.actor-goblin", "actorLink": true,
    "name": "Gate guard", "actorType": "npc", "position": { "x": 2, "y": 2 },
    "elevation": 0, "footprint": { "width": 1, "height": 1 },
    "hp": { "current": 7, "max": 7, "temp": 0 }, "ac": 15,
    "abilities": { "str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8 },
    "movement": { "walk": 30, "units": "ft" },
    "resources": [], "spellSlots": [], "conditions": [], "effects": [], "effectsComplete": true
  },
  "budgets": {
    "movementRemaining": 30, "units": "ft", "actionAvailable": true,
    "bonusActionAvailable": null, "reactionAvailable": null,
    "source": "turn-lease", "leaseId": "lease-turn-2-1"
  },
  "actions": [
    {
      "actionId": "action-scimitar", "itemId": "item-scimitar", "name": "Scimitar",
      "itemType": "weapon", "hasActivities": false,
      "activation": { "type": "action", "cost": 1, "source": "native" },
      "execution": "automatic", "availability": "conditional", "blockers": ["Requires approach"],
      "equipped": true, "quantity": 1, "uses": null, "rechargeReady": null,
      "range": { "normal": 5, "long": null, "units": "ft" },
      "target": { "kind": "creature", "count": 1 }, "damageTypes": ["slashing"],
      "saveAbility": null, "spell": null, "resourceCosts": [],
      "summary": "Legacy single-target melee item; native pipeline resolves use.",
      "eligibleTargets": [{ "actorId": "actor-hero", "combatantId": "combatant-hero" }]
    }
  ],
  "nearby": [
    {
      "actorId": "actor-hero", "tokenId": "token-hero", "combatantId": "combatant-hero",
      "name": "Intruder", "disposition": "friendly", "position": { "x": 6, "y": 2 },
      "distance": 20, "units": "ft", "distanceSource": "native", "wallLos": true,
      "perceived": true, "perceptionSource": "verified-fixture", "conditions": [], "health": "unknown"
    }
  ],
  "movement": {
    "profile": "square-flat-walk-v1",
    "grid": { "type": "square", "sizePixels": 100, "distance": 5, "units": "ft" },
    "plans": [
      {
        "planId": "plan-approach-hero",
        "goal": {
          "kind": "approach", "target": { "actorId": "actor-hero", "combatantId": "combatant-hero" },
          "destination": null, "within": 5, "units": "ft"
        },
        "endpoint": { "x": 5, "y": 2 }, "status": "ready",
        "distance": 15, "cost": 15, "units": "ft", "withinBudget": true,
        "reachesGoal": true, "expiresAt": "2026-08-31T12:00:30Z", "blockers": []
      }
    ]
  },
  "quality": {
    "unknowns": ["Bonus actions and reactions are not enabled in this profile"],
    "warnings": [], "omittedActions": 0, "omittedNearby": 0, "completeForDecision": true
  }
}
~~~

Foundry disposition friendly in this example is a token setting relative to the table, not a promise that the goblin considers that Actor an ally. StoryCore relationship/context determines intent; target eligibility reflects supported legality, not tactical ranking.

## Compactness and refresh

- Hard maximum 24 KiB serialized UTF-8 for the state; target roughly 2–4k model tokens in typical encounters. Byte cap is authoritative, token count is model-dependent.
- At most 24 action cards, 12 nearby perceived actors, 8 plan summaries, 16 effects, 16 resources and 10 spell-slot entries. Summary/description <=240 characters, names <=80 in emitted data; at most 8 blockers/cost entries per action. Bound strings/arrays before calling LLM.
- Never silently discard a legal choice as a tactical optimization. If caps omit relevant actions/targets or required evidence, set completeForDecision=false and do a read-only page/focus refinement before decision. Refined catalogue gets a new snapshotId; model chooses focus rather than adapter selecting a weapon.
- Remove redundant descriptions first, not identity/current turn/budget/unknown flags. Unsupported cards may be short blocked summaries. Do not replace missing data with guesses to fit the budget.
- Default snapshot/plan expiry is 30 seconds, but expiry is only a maximum age; revalidate live facts even within that interval. A long LLM call requires refresh/new decision if stale.
- Turn, token, Item, Actor, effects, walls/doors, lighting/perception, grid or scene changes invalidate relevant plans/snapshots. Reconnect changes sessionEpoch. No event alone proves completion; use fresh reads.
- raw Bridge payloads may be larger than 24 KiB and require a separately bounded transport limit (default 2 MiB); they never pass through the LLM serializer.

## Authority for observations

After movement read token coordinates again; immediate write coordinates can be stale. After activation read effective Actor/target HP/resources/effects and current combat again. A matched Midi workflow supplies attack/hit/save/damage results; empty rolls is allowed. Observed HP differences are facts, not permission to apply workflow.damageTotal manually.

Resource and effect deltas are reported only for the same resolved instance with valid before/after observations. Concurrent external changes may make attribution unknown. Never infer an attack missed solely from unchanged HP or a missing workflow.

