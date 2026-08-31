# Reuse plan — minimal production boundary

**Documentation complete; production implementation remains a separate pass.** Target remains Foundry 12.343 + D&D5e 3.3.1 + Midi-QOL. Source keys/pins/licenses are in [SOURCE_AUDIT.md](SOURCE_AUDIT.md); limits are in [COMPATIBILITY_MATRIX.md](COMPATIBILITY_MATRIX.md).

## Harvest decisions

| Disposition | Component/source | Concrete use |
|---|---|---|
| REUSE | B CommandRouter, WebSocketClient, command types, native read handlers | Keep the installed command bus and existing local transport direction. Reuse protocol definitions, not a new generic Foundry server. |
| REUSE | B Dnd5eItemActivationService and legacy Gateway item.use path | Preserve target → capture → use → observe order and native rules resolution. |
| ADAPT | B GridPathfinder + MoveTokenHandler | One shared PathPlanningService inside Bridge, read-only plan-token-path, guarded execution of its validated route. No StoryCore A*. |
| ADAPT | B Actor/context/activation scope and Midi gateway | Token-scoped effective Actor, scene/turn guards, scoped targeting cleanup, matched workflow capture and explicit resolution status. |
| ADAPT | T pendingQueries, buildToolRouter, schema/type separation | Small BridgeSession and strict protocol boundary. No T transport/runtime installation. |
| ADAPT | T Actor/Item projections, F function-call/result loop | Fixed compact DTOs, provider-neutral result association, bounded sequential decisions through StoryCore's existing LLM. |
| USE NATIVE FOUNDRY/API BRIDGE | Actor/Item/effect/Compendium documents, combat tracker, collision and distance, D&D5e/Midi item use | Foundry owns state, D&D5e/Midi own resolution. Read prepared values; do not recreate rules or a document database. |
| ARCHITECTURE ONLY | M sense/act/abort/busy lifecycle | Runner phases and invalidation, not tactical target choice or action-count logic. |
| ARCHITECTURE ONLY | P Path/PathManager/FTPUtility | Preview/traversal separation and edge-case checklist. Its alternate A* is not a dependency. |
| ARCHITECTURE ONLY | T TransactionManager/EventTracker | Operation journal and bounded invalidation history; no combat compensation engine. |
| ARCHITECTURE ONLY | A gatherGameState, craftSingleActionPrompt, requestNextAISuggestion | One-action feedback concept only. No code or prompt copying; license absent. |
| DO NOT COPY | M Behaviors/MookModel5e tactical/rules branches; A PF2e rules/parser | LLM chooses tactics; native system validates/resolves rules. |
| DO NOT COPY | F/T broad macros, HP/resource mutation, effects engine, Compendium index, provider/media runtime | Redundant or violates project boundaries. Also exclude T licensed bundle assets. |
| DO NOT COPY | Temporary PowerShell/BAT pathfinder; old Combat Mappers implementation | No permanent POC pathfinder; Combat Mappers stays frozen, no Phase 5 or merge. |

Reuse in this table describes production intent, not code already harvested. Preserve full MIT notices and provenance when actual copying/adaptation occurs. Work in a separate maintained Bridge patch/fork at implementation time; never edit _references/.

## Exact minimal adapter modules

Proposed TypeScript layout; these files/classes **do not exist yet**. No new package/provider/database is needed merely because a module is listed.

| Module | Public class/functions | Responsibility |
|---|---|---|
| src/contracts.ts | CombatStateV1, CombatIntentV1, DecisionRequestV1, AdapterResultV1, parseIntent | One strict schema source for runtime validation/types/provider schema. Wire and size limits only. |
| src/bridge-session.ts | BridgeSession.request, connect, close, reconcile | Existing local channel integration, allowlisted Bridge requests, ID correlation, deadlines, connection generation, durable write-stage records; no generic command registry. |
| src/combat-sensor.ts | CombatSensor.read, resolveActingInstance | READ/OBSERVE: scoped combat/token/Actor/items/effects reads, consistency bracket, authoritative snapshots, token disambiguation and version/capability gating. |
| src/combat-normalizer.ts | CombatNormalizer.normalize | Prepared values → bounded LLM DTO; action catalogue, provenance/unknowns, visible actor summaries and plan summaries. No tactics, raw descriptions or rules computation. |
| src/intent-validator.ts | IntentValidator.validate, revalidate | Strict schema, authorization/IDs/current turn/freshness, supported action metadata, known budgets, targets/perception and plan binding. Returns verified intent or structured rejection, never a replacement tactic. |
| src/intent-executor.ts | IntentExecutor.execute, observe | Serial guarded movement, readback, action revalidation, native activation, readback; explicit end-turn only. Partial/unknown outcomes and no replay. |
| src/turn-runner.ts | TurnRunner.run, cancel | READ → NORMALIZE → existing StoryCore decision callback → VALIDATE → COMMAND → OBSERVE. Owns one session write lease, bounded repair/redecision, operation journal lifecycle and StoryCore memory event delivery after observation. |

BridgeSession journal may use StoryCore's existing durable store. Its owner is session transport; TurnRunner coordinates it, not a second database. Sensor and observer share one read implementation. Normalizer emits facts; StoryCore supplies personality, relationships and tactical judgment via decide(request).

## Small Bridge patch, three seams

1. **PathPlanningService + PlanTokenPathHandler** under existing token handlers. Extract shared collision/search setup from MoveTokenHandler; keep GridPathfinder as the sole route search. Return a plan without moving/highlighting/opening doors. Extend existing move-token with a validated plan reference/preconditions and per-segment checks so execution cannot silently choose a longer unbudgeted route. See wire contract.
2. **Scoped reads and guard helper**, not a second sensor protocol: extend get-combat-turn-context with scene binding/capabilities/perception completeness; extend Actor/items/effects read paths with sceneId + actingTokenId to resolve TokenDocument.actor; include actorLink/effective Actor identity and combat.scene. Reuse this scope resolver for activation/next-turn. Capabilities can be returned with context; no generic discovery service required.
3. **Scoped activation/capture**: declared sceneId, actingTokenId, expected-turn fields; pre-resolve all targets, preserve/restore user's target set safely, use effective Actor's Item, arm a matching Midi hook before use, report completion/cancel/timeout/ambiguity separately and include workflow identity where available. Keep legacy item.use. Extend next-turn with the same guard. No spell/rules reimplementation.

Only these requested additive fields are sent after a verified extension capability. Old Bridge stays available for read-only/supervised diagnosis; do not claim new safety guarantees on an unmodified pin.

## Execution boundary

~~~mermaid
flowchart LR
  S["StoryCore memory, personality, LLM"] -->|one structured intent| V["Validator"]
  R["Scoped READ"] --> N["Compact NORMALIZE"]
  N --> S
  V -->|verified| E["Serial executor"]
  E --> B["Existing API Bridge"]
  B --> F["Foundry V12 / D&D5e / Midi"]
  F --> O["Fresh OBSERVE"]
  O --> R
  O -->|observed outcome| S
~~~

Runner states: idle → reading → deciding → validating → executing-move → observing-move → revalidating-action → executing-item → observing-item → complete. Omit irrelevant stages for move-only, item-only and explicit end-turn. Rejections can return to deciding with a fresh snapshot; transport ambiguity/partial effects enters paused, not automatic retry. Cancellation before a write stops safely; cancellation after dispatch still requires observation.

One intent is at most one plan movement plus one native item use, or one move, or end-turn. No attack-loop count from LLM. The LLM may choose a bow, approach, retreat, hold position or end its turn among supported options; deterministic code must never substitute a bow when an approach is too far.

Movement/action bookkeeping is an execution safety ledger, not D&D resolution: compare verified native cost/availability and observed expenditure. Never assume walk speed equals remaining budget, reconstruct extra attacks, or assign action economy from turn order.

## Shortest implementation sequence

1. Add contracts and BridgeSession around the already working local channel. Fixture the actual B envelopes, version response and legacy Actor/item payload. Reads only; verify installed Bridge/Midi versions without re-litigating POCs.
2. Add CombatSensor/Normalizer with explicit IDs, compactness, unknowns, and StoryCore decision request. Inspect intent output in dry-run mode. Deny writes until required capabilities/budgets are known.
3. Patch shared Bridge scope/capability and token-Actor reads; add the single-engine path preview. Verify preview does not mutate token, doors, targets or highlights. Add guarded plan execution using the same planner.
4. Add validator/executor and matched Midi capture/scoped activation. Exercise targeted risks: duplicate Actor instances, stale turn, wrong canvas, unrelated workflow, null/cancelled use, lost response and partially completed movement. Reuse existing Scimitar success as baseline.
5. Connect TurnRunner to StoryCore's existing LLM callback. One supported NPC decision at a time, with observation before next intent. No autonomous next-turn unless explicitly chosen; no full combat automation expansion in this pass.

## Acceptance evidence required during implementation

- Legacy hasActivities:false survives normalization and routes through activate-item, never direct damage/HP writes.
- Source Actor/token ambiguity and unlinked resource differences cannot hit the wrong instance.
- Same-scene, same-turn preconditions hold before each write; context changes invalidate pending decisions/plans.
- Preview and movement share route/collision/cost; unsupported grid/terrain/occupancy/budget fail closed; preview is pure.
- Unrelated Midi completion cannot satisfy another activation. Empty rolls with a matched workflow is valid; absent workflow after timeout is unresolved, not a miss.
- Duplicate intent/write IDs, reconnect, timeout and crash never auto-repeat item use or next-turn. Partial movement is reported with actual position; no compensation of combat resources.
- LLM payload stays bounded, excludes hidden/unknown-perception actors, raw Actor system objects, secrets and arbitrary command/code fields.

Stop here: source audit and contracts only. No installation, production code, commit/push, live combat changes or Foundry upgrade is part of this deliverable.

