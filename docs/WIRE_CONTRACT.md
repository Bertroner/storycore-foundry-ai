# Wire contract v1

**Status: Phase 1A read/decision subset implemented; execution/extensions remain design only.** Existing Bridge wire is audited at v8.11.2; StoryCore envelopes and extensions below are proposals, not commands already available. [SOURCE_AUDIT.md](SOURCE_AUDIT.md) gives exact paths/pin; the two schema documents define the decision DTOs.

Phase 1 is limited to one NPC, one active combat, a linked Actor with a unique token instance, 1x1 square-grid walking without doors, and legacy single-target melee/ranged weapons. Unlinked/synthetic Actors, duplicate Actor instances, spells, AoE, reactions, bonus-action complexity, difficult terrain, flying/elevation, doors and multi-NPC tactics are deferred. Broader types/extensions below describe future compatibility; Phase 1 rejects those cases rather than implementing them. [PROJECT_STATE.md](PROJECT_STATE.md) defines the reviewed scope.

## Phase 1A implementation status

The read/decision subset is implemented in src/. The external StoryCore campaign route has no exported decision client; LlmDecisionGateway is the minimal compatible boundary documented in STORYCORE_BOUNDARY.md. The adapter/executor envelopes below remain the full future contract, not generic endpoints exposed by the dev server.

Phase 1A is strictly read-only. Electron main owns DesktopService; the fixed detectTurn IPC method discovers and retains the active scope in main. The narrow typed runDecision method accepts requestId, detectionId, selectedCandidateIds (offered opaque handles), attested:true and development mind (personality/motivation/relevantMemory). Main derives scope IDs and factual selected-hostile relationships; editable renderer scope/Actor IDs are rejected. It checks the active scene and fresh combat bracket against that detection before the model; changes reject as DETECTED_SCOPE_STALE. One invocation is bounded to one decision (two plan attempts, two repair continuations, five model calls, 30 seconds), stricter than the future eight-cycle maximum. No LLM tool interface or generic Bridge passthrough exists. PLAN_REQUEST returns summary:null and error.code=PLANNING_UNAVAILABLE in planFeedback for the same decision/snapshot. No plan-token-path command is dispatched. FINAL_INTENT is only stored as DRY-RUN VALIDATED INTENT; no submit-intent write path exists. Desktop status/save/clear/test/detect/run/cancel IPC handlers validate the exact local main-frame sender. No generic IPC or Bridge passthrough is exposed. Former HTTP UI/settings/decision routes are removed; only non-secret /health and the loopback Bridge WebSocket listener remain. Full Windows setup and evidence: PHASE1A_TESTING.md.

## 1. Trusted StoryCore ↔ adapter boundary

This can be an in-process interface in StoryCore or JSON over an existing authenticated local service. Do not create another generic Foundry command bus. UTF-8 JSON, schemaVersion 1.0; reject unknown fields, unsupported versions and non-finite values. Opaque IDs <=128 characters. Request IDs are unique within a session, generated outside the LLM. User/authorization/connection credentials never enter model context.

~~~typescript
type Scope = {
  worldId: string; sceneId: string; combatId: string;
  actorId: string; combatantId: string;
};
type ExpectedTurn = {
  round: number; turn: number; combatantId: string;
};
type AdapterRequestV1 =
  | {
      schemaVersion: "1.0"; requestId: string; type: "read_combat";
      scope: Scope;
    }
  | {
      schemaVersion: "1.0"; requestId: string; type: "preview_path";
      scope: Scope; decisionId: string; snapshotId: string; stepId: string; goal: PlanGoalV1;
    }
  | {
      schemaVersion: "1.0"; requestId: string; type: "submit_intent";
      scope: Scope; stepId: string; intent: CombatIntentV1;
    }
  | {
      schemaVersion: "1.0"; requestId: string; type: "cancel_decision";
      decisionId: string;
    };
type AdapterResultV1 = {
  schemaVersion: "1.0"; requestId: string;
  status: "ok" | "rejected" | "partial" | "unknown" | "cancelled";
  data: CombatStateV1 | PlanSummary | ExecutionObservation | null;
  error: { code: string; message: string; fields: string[]; retry: "read" | "new_decision" | "never" } | null;
};
~~~

Scope is validated against trusted session authorization; merely possessing an Actor ID is not write permission. PlanGoalV1 (LLM goal), Goal (adapter-expanded geometry goal), PlanSummary and CombatStateV1 are defined in NORMALIZED_COMBAT_STATE.md; DecisionResponseV1 and CombatIntentV1 in COMBAT_INTENT_SCHEMA.md. preview_path and submit_intent are internal translations of admitted PLAN_REQUEST and FINAL_INTENT responses, not bypasses around the decision loop. Each response type must match its request: read→state, preview→plan, submit→observation, cancel→null or observation if already dispatched.

The adapter calls StoryCore's **existing** decision interface:

~~~typescript
type DecisionRequestV1 = {
  schemaVersion: "1.0"; decisionId: string; stepId: string; deadlineAt: string;
  limits: { planRequestsRemaining: number; repairResponsesRemaining: number; modelResponsesRemaining: number };
  planFeedback: {
    requestStepId: string;
    summary: PlanSummary | null;
    error: { code: string; message: string } | null;
  }[];
  state: CombatStateV1;
  narrative: {
    actorId: string;
    personality: string;
    motivation: string;
    relationships: { actorId: string; summary: string }[];
    relevantMemory: string[];
  };
};
type DecisionResponseV1 =
  | {
      schemaVersion: "1.0"; decisionId: string; snapshotId: string; stepId: string;
      type: "PLAN_REQUEST"; goal: PlanGoalV1;
    }
  | {
      schemaVersion: "1.0"; decisionId: string; snapshotId: string; stepId: string;
      type: "FINAL_INTENT"; intent: CombatIntentV1;
    };
~~~

Narrative is supplied by StoryCore, not gathered by Foundry. Bound personality/motivation to 500 characters each, 12 relationships with 160-character summaries, 6 memory entries of 240 characters; total decision request <=32 KiB. Treat descriptions/memory as data, not permission to alter tool policy. Each model response matches the issued stepId and open decision/snapshot, and is exactly one union branch. A PLAN_REQUEST cannot also carry an intent. No array, arbitrary waypoints or extra tool names are accepted. FINAL_INTENT movement references only an offered planId.

### Bounded planning exchange

Per decision: at most two PLAN_REQUESTs, two repair responses, five LLM responses total, and one accepted FINAL_INTENT; stop at the 30-second decision deadline or earlier snapshot/plan expiry. Plan results do not reset counters or deadline. Stale source state closes the decision and invalidates its offers. A supervised Phase 1 invocation permits at most eight decision cycles and 120 seconds total, with no automatic restart or next-NPC handoff.

The adapter owns counters/step IDs, not the LLM. Each response (including malformed) consumes a model slot. Each recognized PLAN_REQUEST consumes a preview slot, even on failure; at most one Bridge preview is dispatched per slot, without hidden retries. A repair continuation consumes a repair slot. Cached retransmission of the same issued step returns the same result without another model call, preview or counter reset; it cannot create another operation. After two previews, only a final response is allowed. No accepted final by a limit/deadline means manual pause, no write and no automatic end-turn.

1. Adapter sends DecisionRequestV1 for decision-17, step-1, snapshot-42, with initially empty planFeedback and possibly empty movement.plans.
2. LLM returns PLAN_REQUEST with one PlanGoalV1 (see schema example). Adapter validates scope, goal, target/action catalogue, bounds and known budget; it alone supplies sceneId/tokenId/guard/budget/profile and expands native Item range/units into Goal.
3. Adapter sends existing Bridge envelope {id,type:"plan-token-path",params:...} using the proposed read-only extension. The LLM never sees a generic Bridge command interface.
4. Normalize the result into PlanSummary. Set offeredFor to {decisionId,snapshotId,requestStepId}; append it to state.movement.plans and return it in planFeedback on the next DecisionRequestV1. Keep decisionId/snapshotId/deadline; issue step-2 and reduced counters. Failed previews return blocked/unknown summaries with null planId, or a bounded error if no summary is available.
5. LLM chooses another allowed PLAN_REQUEST or FINAL_INTENT. For a final, validate offered plan membership and fresh state; only then translate to internal submit_intent and writes. Seal the decision on accepted final.

Preview feedback augments a catalogue, not live state: do not renew snapshot/plan expiry or reset counters. If the live scene/turn/resources changed during planning, close the decision and discard offers; a fresh decision consumes the existing supervised invocation cap. Read-only preview cannot move, target, open a door, consume resources or advance combat. A timeout does not trigger a tactical fallback.

Plan feedback is at most two entries within the 32 KiB request cap. One invocation does not schedule further NPC turns. The LLM picks goals/action/target; deterministic route selection is geometry only. A final activation may omit movement and ignore a preview; previewing never commits the action.

Example internal adapter submission admitted from FINAL_INTENT (payload fixture from COMBAT_INTENT_SCHEMA.md):

~~~json
{
  "schemaVersion": "1.0",
  "requestId": "adapter-request-18",
  "type": "submit_intent",
  "stepId": "step-2",
  "scope": {
    "worldId": "world-demo", "sceneId": "scene-room", "combatId": "combat-demo",
    "actorId": "actor-goblin", "combatantId": "combatant-goblin"
  },
  "intent": {
    "schemaVersion": "1.0", "decisionId": "decision-17", "snapshotId": "snapshot-42",
    "kind": "activate_item",
    "action": {
      "actionId": "action-scimitar", "itemId": "item-scimitar",
      "target": { "actorId": "actor-hero", "combatantId": "combatant-hero" }
    },
    "movement": { "planId": "plan-approach-hero", "goalKind": "approach" }
  }
}
~~~

## 2. Existing adapter ↔ API Bridge frames

B src/commands/types.ts defines exactly:

~~~typescript
type BridgeCommand<P> = { id: string; type: string; params: P };
type BridgeResponse<D> = { id: string; success: boolean; data?: D; error?: string };
~~~

The Bridge running in Foundry is a WebSocket **client** connecting outward to the configured endpoint. Retain the already-proven local bidirectional arrangement; a direct adapter endpoint accepts that connection, or the existing working local relay supplies it. This donor does not establish a new inbound HTTP Foundry API. No localhost URL/port is invented by this design.

Transport authentication uses the established local configuration; B createChannel appends apiKey in query parameters. Bind any new local endpoint to loopback, authenticate the expected Bridge peer, reject competing writer sessions, and redact keys/URLs from logs. Do not expose this powerful bridge to the LLM or public network.

Do not copy T's MCP_QUERY/MCP_RESPONSE wrapper around these frames. No JSON-RPC jsonrpc/method field, event frame, acknowledgement frame or cancellation command is defined by B here.

Existing examples:

~~~json
{"id":"bridge-read-1","type":"get-combat-state","params":{"combatId":"combat-demo"}}
~~~

~~~json
{"id":"bridge-read-2","type":"get-token","params":{"sceneId":"scene-room","tokenId":"token-goblin"}}
~~~

~~~json
{"id":"bridge-move-3","type":"move-token","params":{"sceneId":"scene-room","tokenId":"token-goblin","x":500,"y":200,"animate":true,"canOpenDoors":false}}
~~~

~~~json
{"id":"bridge-use-4","type":"dnd5e/activate-item","params":{"actorId":"actor-goblin","itemId":"item-scimitar","targetTokenIds":["token-hero"]}}
~~~

The two write frames illustrate **existing syntax**, not recommended unguarded production dispatch. Activation has no sceneId at this pin. Never claim an old Bridge honors proposed scope fields.

Example existing activation response shape, with illustrative outcome values:

~~~json
{
  "id": "bridge-use-4",
  "success": true,
  "data": {
    "itemId": "item-scimitar", "itemName": "Scimitar", "itemType": "weapon",
    "activated": true, "targetsSet": 1, "rolls": [],
    "workflow": {
      "attackTotal": 17, "damageTotal": 5, "isCritical": false, "isFumble": false,
      "hitTargetIds": ["token-hero"], "saveTargetIds": [], "failedSaveTargetIds": []
    }
  }
}
~~~

~~~json
{"id":"bridge-read-bad","success":false,"error":"Actor not found: missing-actor"}
~~~

Undefined attackTotal/damageTotal properties can be omitted in actual JSON. Bridge errors are strings, not stable machine-readable error codes. Classify known validation errors locally; never decide that a write was definitely not applied just by parsing an error message.

| Existing command | Parameters required by adapter usage | Important response/limit |
|---|---|---|
| get-world-info | {} | data.world includes id/system/systemVersion/foundryVersion; no module capabilities. |
| get-combat-state | combatId | data.id/round/turn/started/current/combatants; no sceneId. |
| get-combat-turn-context | combatId | Current/nearby/ASCII; always current canvas; no sceneId parameter. |
| get-scene-tokens, get-walls | sceneId | Resolve live tokens/walls for specified scene. |
| get-token | sceneId, tokenId | Token detail and effective token Actor HP/AC; not full Actor. |
| get-actor, get-actor-items, get-actor-effects | actorId | World Actor lookup; proposed instance scope required for synthetic state. |
| move-token | sceneId, tokenId, x, y; canOpenDoors:false | x/y pixel top-left, not center/grid cell. pathCost optional grid cost, not feet; read back. |
| dnd5e/activate-item | actorId, itemId, targetTokenIds | World Actor; current-canvas targets. Omit activity selectors for legacy. No HP/damage writes after this. |
| next-turn | combatId | Native turn advance; no sceneId or expectedTurn at this pin; read back. |

The automatic writer allowlist is move-token, dnd5e/activate-item and next-turn **with verified extensions below**. Reader allows only the listed sensors and proposed plan-token-path. No execute-macro, raw Actor updates, roll-attack/damage chain, spell-slot mutations, effects manipulation or generic command passthrough.

## 3. Proposed scope/capability extension

Extend the existing get-combat-turn-context request with required sceneId for adapter use. Its additive adapterContext result records:

~~~typescript
type AdapterContextExtensionV1 = {
  extensionVersion: "1.0";
  worldId: string; sceneId: string; combatId: string; canvasSceneId: string;
  canvasReady: boolean; gmUserId: string;
  sessionEpoch: string; revision: string;
  expectedTurn: ExpectedTurn;
  actorId: string; actingTokenId: string;
  actorLink: boolean; effectiveActorUuid: string;
  versions: { foundry: string; system: string; bridge: string; midi: string | null };
  capabilities: {
    scopedActorReads: boolean; scopedWrites: boolean;
    planTokenPath: boolean; guardedPlanMove: boolean;
    matchedMidiWorkflow: boolean; nativePerception: boolean;
  };
};
~~~

All fields are proposed, absent from current B. Verify combat belongs to scene, current combatant matches requested Actor, canvas is ready and showing that scene, and current user is the authorized GM. scene.active is not enough to prove which scene a particular GM is viewing. Return explicit unsupported/error if mismatch; never activate/view another scene automatically.

Future unlinked-Actor support would extend get-actor/get-actor-items/get-actor-effects with sceneId + actingTokenId. This is deferred in Phase 1; verify actorLink=true and unique instance, then use the linked world Actor reads. For that deferred extension, resolve the named scene token, validate its base actorId, and use TokenDocument.actor for effective stats/items/effects and activation. Phase 1 instead uses the verified linked world Actor; failure to establish linking/uniqueness rejects rather than falling back. scopedActorReads for synthetic Actors is not a Phase 1 prerequisite; scene/turn scope verification, guarded movement and matched Midi capture remain required for applicable writes.

Scope precondition on proposed **write requests**:

~~~typescript
type WriteGuardV1 = {
  sceneId: string;
  combatId: string;
  actingTokenId: string;
  expectedTurn: ExpectedTurn;
  sessionEpoch: string;
  revision: string;
};
~~~

Use the guard at the first mutation and recheck relevant live facts between awaited stages. An extension-local revision invalidates cached state/plans on token/Actor/Item/effect/combat/wall/scene/perception changes. Its epoch resets on restart/reconnect. It is not a universal atomic Foundry revision. The operation records its own updates; a plan may continue only through its own expected changes, and external relevant changes abort continuation.

Activation extends existing params with guard; next-turn extends existing params with guard; movement uses tokenId plus guard (must match actingTokenId). These are additive handler/schema changes in a maintained Bridge patch, never silent JSON fields on old B. Native resource checks still own rules. Missing version/capability disables automatic writes.

## 4. Proposed plan-token-path

Implement under existing Bridge router. **Read-only: no token update, door update, targeting, scene change, highlights, animation or resource spend.** One shared B GridPathfinder, no duplicate StoryCore A* and no parallel lib-find-the-path runtime.

~~~typescript
type PlanTokenPathParamsV1 = {
  decisionId: string; requestStepId: string;
  snapshotId: string;
  sceneId: string; combatId: string; actorId: string; tokenId: string;
  expectedTurn: ExpectedTurn; sessionEpoch: string; revision: string;
  goal: Goal;
  budget: { remaining: number; units: string; leaseId: string };
  profile: "square-flat-walk-v1";
};
type PlanTokenPathResultV1 = {
  decisionId: string; requestStepId: string;
  snapshotId: string;
  planId: string | null;
  status: "ready" | "over_budget" | "blocked" | "unsupported" | "search_limit" | "stale";
  sceneId: string; tokenId: string; sessionEpoch: string; revision: string;
  goal: Goal;
  start: { x: number; y: number };
  endpoint: { x: number; y: number } | null;
  waypoints: { x: number; y: number }[];
  distance: number | null; cost: number | null; units: string;
  withinBudget: boolean | null; reachesGoal: boolean;
  expiresAt: string;
  reasons: string[];
};
~~~

Start/endpoint/waypoints in this Bridge result are **pixel top-left**; Goal destination is integer grid cells with scene/grid origin conversion done inside Bridge. Normalized PlanSummary converts endpoint to grid cells. Waypoints exclude start, in travel order; include start for native measurement. Actor footprint/scene origin must be accounted for, not assumed to be coordinate zero. Zero movement is a ready empty route with zero cost; do not interpret empty path as failure.

Budget originates from a verified native source/turn lease, not the LLM. The authenticated adapter owns the lease and sends its ID plus known remaining allowance; this is a trusted execution constraint, not an LLM field or a native D&D budget API. Bridge binds that ID to connection/scene/turn on first preview, validates the allowance against supplied verified evidence/native capacity, and prevents later requests from increasing the allowance without a new verified turn lease. It records native-measured guarded movement expenditure. No extra generic lease service is required. Lease tracks an externally verified remaining allowance plus observed expenditure for this turn; if initial allowance or external use is unknown, reject preview-for-execution rather than assume full walk speed.

Goal approach names target Actor/combatant and a stop distance. Bridge resolves target instance, enumerates geometrically valid endpoints satisfying the goal and uses the existing planner; deterministic route tie-breaking does not choose target/weapon. Position/retreat specify a goal cell chosen by StoryCore. The planner never substitutes a different goal when blocked or over budget.

First supported profile: ready matching canvas, aligned 1×1 token, flat square grid, uniform movement measurement, ordinary walking/terrain, no closed-door passage and no occupied cell traversal/stopping. This conservative occupancy restriction may reject legal special passage; report unsupported rather than implement D&D exceptions. Bounds/occupancy checks wrap the same B collision input; do not create a second route algorithm. Other footprints, grid types, diagonal metrics, difficult terrain, elevation/flying, doors and forced movement return unsupported until validated with native rules/measurement.

Measure full route with native V12 grid measurement and authoritative budget units. B's default search cost is steps; result cost is native movement cost in units. Do not assume grid units are feet because old context calls its field distanceFt. Default node bound 2,500; separate search_limit from proven blocked. Never treat a search-limited partial route as a legal approach completion. If an over-budget route is found, report its cost; do not silently truncate and execute. LLM can choose a different explicit position goal.

A successful preview augments the existing snapshot catalogue without changing its live-state identity; any source-state change requires a new snapshot and preview. Failed previews have null planId; search_limit/stale normalize to PlanSummary.status=unknown with reasons.

Plan ID is an opaque server-side route reference bound to decisionId, requestStepId, snapshotId, scope, start position, goal/target, bounds, occupancy, walls/grid revision, budget lease, profile and expiry (30 seconds maximum). Caller cannot create a plan by supplying arbitrary waypoints.

Extend move-token to accept planId + WriteGuardV1. For plan execution, existing x/y must equal recorded endpoint; arbitrary coordinates or extra route points reject. Revalidate the whole route and budget before first movement, then segment collision/occupancy/current turn before each update. Do not invoke a new unrestricted destination search that could lengthen the path. Share planner/collision setup with ordinary movement; guarded path movement does not use unchecked fallback. On drift/partial progress, stop and report actual last observed position. Own movement invalidates the old snapshot for subsequent item action: READ again and obtain a fresh guard.

## 5. Proposed activation capture result

Keep the successful legacy activation behavior and existing workflow metrics. Add:

~~~typescript
type ActivationResolutionV1 = {
  resolution: "completed" | "cancelled" | "timeout" | "ambiguous" | "unknown";
  actingTokenId: string; actorId: string; itemId: string;
  workflowId: string | null;
  captureMatched: boolean;
};
~~~

Pre-resolve all target tokens before changing shared targets. Arm a hook before item.use; match effective Actor, Item and acting token, plus workflow identity when the installed Midi version provides it. Use a filtered listener rather than accepting the first global event; clean up hook/timer in all cases. Capture mismatch/identity missing means ambiguous/unknown, never a fabricated completion. Preserve/restore prior target set in finally unless concurrent user edits make restoration unsafe; report the conflict and pause.

A null/cancelled item use or missing workflow is not a miss and not success just because the old service sets activated:true. The first automatic profile expects matched Midi completion; no alternative raw-roll damage path is allowed. Spell/template/slot config is excluded until independently verified with this pinned system.

## 6. Journal, deadlines, observation

BridgeSession maintains pending request ID → operation/resolve/reject/deadline and a durable stage ledger before every write send. Distinguish LLM decisionId and issued stepId, adapter requestId and Bridge id. Never use a new ID to conceal a retry.

| Condition | Required action |
|---|---|
| Read deadline | Default 10 seconds. Bounded retry allowed after connection/scope verification. |
| Path preview deadline | Default 10 seconds plus bounded search; no mutation, so safe to request a fresh preview. |
| Native activation deadline | Default 60 seconds, greater than B's 30-second capture timeout. Native UI may outlive this; deadline does not cancel a Foundry operation. |
| Missing reply/disconnect after write send | Mark may-have-applied, invalidate snapshot and reconcile. No automatic resend. |
| Late response | Match original ID/stage; retain as evidence, never trigger another write. |
| Same (decisionId, stepId)/body submitted again | Return cached preview feedback or final status/result; changed body for that pair rejects. Distinct issued steps permit preview → final/repair, but accepted final seals the decision. |
| Crash with prepared/sent journal entry | Treat uncertain send window as unknown, observe before any continuation. Exactly-once is not claimed. |
| Reconnect | New session epoch; resync versions, scope, turn, effective Actor, tokens/resources. Pending write is unresolved until reconciled. |
| Cancellation after dispatch | Stop issuing new operations; cannot cancel B native item use by closing socket. Continue observation and report outcome. |
| Bridge success:false after write | Still read back: targeting/movement/native use may already have mutated state before exception. |

Only one adapter mutation chain per GM/Bridge session, not merely one per Actor. This prevents global target/capture contention between adapter commands; other humans/modules can still change the world. Stop on conflicts. Do not promise a multi-command atomic transaction.

After each mutation OBSERVE via the same scoped sensor. Movement checks get-token position after the command (poll up to 5 seconds, default 250 ms interval, stopping promptly when fresh scope/position agrees); do not treat stale immediate coordinates as completion. An explicit fresh unexpected position is a conflict/partial outcome, not permission to teleport again. After activation inspect matched workflow plus fresh self/target effective HP/resources/effects and combat state. Polling retries **reads only**, not attack writes.

~~~typescript
type ExecutionObservation = {
  decisionId: string;
  stage: "validated" | "moved" | "activated" | "turn_advanced" | "stopped";
  certainty: "observed" | "partial" | "unknown";
  bridgeRequestIds: string[];
  beforeSnapshotId: string;
  afterState: CombatStateV1 | null;
  workflow: {
    workflowId: string | null; matched: boolean;
    attackTotal: number | null; damageTotal: number | null;
    isCritical: boolean | null; isFumble: boolean | null;
    hitTargetIds: string[]; saveTargetIds: string[]; failedSaveTargetIds: string[];
  } | null;
  changes: {
    actorId: string; tokenId: string;
    field: "position" | "hp" | "resource" | "condition";
    summary: string;
    attribution: "matched_operation" | "unknown";
  }[];
  next: "new_decision" | "done" | "manual_review";
};
~~~

Bound observations to 32 KiB, changes to 32 entries with summaries <=240 characters, and IDs/arrays to known scene entities. Exact readback is stored separately under trusted access; the LLM receives only perception-authorized normalized results, never leaked hidden target data.

workflow.damageTotal is a report, never a mutation instruction. Unchanged HP does not prove a miss; HP delta does not uniquely prove which attack ran. Unknown/partial operations pause for manual review and cannot implicitly end turn. No rollback of HP, consumed slots/uses, effects or chat records. No new rules resolver.

## 7. Event handling

B has lifecycle hooks and a Midi hook, not the state-event wire defined here. Initial adapter correctness uses explicit readback. Proposed Bridge scope revision uses local hooks (combat, token, Actor, embedded Item/effect, wall/door, scene/grid/perception) for invalidation; no extra transport is required. Events are hints to refresh, not authoritative outcome proof. A later push channel would need its own explicitly versioned protocol and is outside the minimum implementation.
