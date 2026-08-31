# StoryCore Foundry AI — Chat Handoff

Last updated: 2026-08-31
Repository: Bertroner/storycore-foundry-ai
Branch: main

## Phase status

**Phase 0 is COMPLETE.**
**Pre-Phase-2 LAARU spell-compendium audit complete; awaiting review, no Phase 2 production implementation.**
**Current phase: Phase 1A live read -> normalization -> real Qwen tactical decision proven; full acceptance OPEN; execution DISABLED.**
**Exact next stage: OPTIMIZATION / GENERALIZATION, beginning with a universal Action Normalizer audit. Record only; do not begin it in this checkpoint.**

The source audit and six design documents are complete and are canonical inputs. Do not repeat the audit or replay CODEX_START_PROMPT.md as a new task. Phase 1A now has real supervised end-to-end evidence through a schema/reference-valid Qwen tactical response. Earlier read-contract and timeout failures remain historical evidence. The later live run preserved zero writes but exposed orchestration, action-catalogue and disposition issues; full Phase 1A acceptance is not closed.

PROJECT_STATE.md is the canonical checkpoint; CHAT_HANDOFF.md mirrors its status, scope, evidence and next step. The Phase 1 scope below limits the broader future architecture described in the audit documents. Deferred capabilities are not prerequisites to implement for this slice; unsupported cases must be rejected.


Settings UI follow-up: saved keys have an explicit per-field indicator; successful Save clears only submitted values after confirmation, while failed Save preserves typed values. Offline Electron regression checks cover short-key rejection, main-process validation failure, successful save and DPAPI disk reload with fake keys. No live model or combat request was made during that settings-only fix.

## Canonical inputs

Read AGENTS.md, this checkpoint and [PROVEN_POC.md](PROVEN_POC.md), then the six completed documents:

1. [SOURCE_AUDIT.md](SOURCE_AUDIT.md) — exact donor pins, source symbols and license evidence.
2. [COMPATIBILITY_MATRIX.md](COMPATIBILITY_MATRIX.md) — V12 compatibility and risks.
3. [REUSE_PLAN.md](REUSE_PLAN.md) — reuse decisions and module boundaries, constrained by the Phase 1 scope here.
4. [WIRE_CONTRACT.md](WIRE_CONTRACT.md) — trusted envelopes, bounded planning exchange and Bridge mapping.
5. [COMBAT_INTENT_SCHEMA.md](COMBAT_INTENT_SCHEMA.md) — PLAN_REQUEST / FINAL_INTENT and deterministic validation.
6. [NORMALIZED_COMBAT_STATE.md](NORMALIZED_COMBAT_STATE.md) — compact facts and offered PlanSummary catalogue.

The pinned donors have already been audited. Their revisions/licenses are recorded in SOURCE_AUDIT.md; _references/ remains read-only and gitignored. MIT adaptations require notices; PF2e assistant remains architecture-only without a verified reusable license.

## Runtime and ownership

- Foundry VTT: **Version 12 Stable — Build 343**. Never upgrade Foundry or redesign around V13/14.
- D&D5e: **3.3.1**; Midi-QOL and API Bridge are installed and proven locally.
- StoryCore owns memory, NPC personality, relationships, LLM decisions, voice and media.
- Foundry owns scene state, tokens, walls, LOS, combat tracker, Actors, Items, Compendiums and documents.
- D&D5e + Midi-QOL own combat rules and resolution. StoryCore never calculates/applies attack rolls, saves, damage, HP changes, resistance or resource consumption.
- Actor ID is stable narrative identity; Token ID is a scene instance resolved at runtime. Pass explicit scene/combat scope and validate it; do not assume unsupported fields work on the current Bridge.
- READ → NORMALIZE → LLM DECIDE → VALIDATE → COMMAND → OBSERVE. Fresh OBSERVE after every write is authoritative.

## POC evidence

[PROVEN_POC.md](PROVEN_POC.md) is authoritative for live evidence. No new POC/live combat mutation tests were performed during Phase 1A. The local simulated transport/unit checks are not new live evidence.

Preserved proven facts:

- Local bidirectional Bridge transport, Actor/Item/effect/resource reads, combat context and scene-token resolution work.
- Walls/LOS reads, token movement and wall avoidance work.
- Movement budget reading from Actor walk speed and budget enforcement were proven in the POC scope.
- Melee/ranged runtime choice from freshly observed positions passed; this does not prove that the old POC used an LLM.
- Legacy single-target item activation through D&D5e + Midi resolves real attacks, including hit/miss behavior.
- Fresh Foundry HP readback is authoritative; workflow is useful even when native rolls is empty.
- next-turn works. Immediate movement response coordinates may be stale.

**Movement-exhaustion-across-multiple-NPC-turns is not independently proven.** Do not claim multi-turn movement continuation was proven or infer it from budget enforcement plus next-turn. Remaining turn allowance must not be equated with walk speed without verified state.

## Phase 1 — Minimal Vertical Slice

Scope:

- One NPC at a time.
- One active combat.
- Linked Actor.
- Unique token instance.
- 1x1 square-grid walking.
- No doors.
- Legacy single-target melee/ranged weapons.
- StoryCore LLM makes the actual action, target and movement decision.
- D&D5e + Midi resolve the action.
- Fresh OBSERVE after every write.

Explicitly deferred:

- Unlinked/synthetic Actor support.
- Duplicate Actor instances.
- Spells.
- AoE.
- Reactions.
- Bonus-action complexity.
- Difficult terrain.
- Flying/elevation.
- Doors.
- Multi-NPC tactics.

Detect and reject deferred cases; do not silently fall back to a different Actor, instance, weapon or tactic. Multi-turn movement exhaustion remains an evidence gap, not an added proven capability.

## Target bounded decision protocol

The following is the full Phase 1 target. The implemented Phase 1A restrictions are listed in the next section: planning is unavailable and execution is disabled.

Each LLM response within a decision is exactly one of:

- PLAN_REQUEST: one LLM-chosen goal, read-only, no arbitrary waypoints. Adapter validates scope and asks Bridge plan-token-path; returned PlanSummary goes back into the same bounded decision.
- FINAL_INTENT: activate_item, move or end_turn. Movement references only an offered, still-valid planId.

Per decision: at most two PLAN_REQUESTs, two repair responses, five LLM responses total, and one accepted FINAL_INTENT; stop at the 60-second supervised Phase 1A decision deadline or earlier snapshot/plan expiry. Plan results do not reset counters or deadline. Stale source state closes the decision and invalidates its offers. A supervised Phase 1 invocation permits at most eight decision cycles and 120 seconds total, with no automatic restart or next-NPC handoff. Limits, response IDs and failure behavior are specified in WIRE_CONTRACT.md.

The LLM chooses tactics. Deterministic code plans geometry, validates and executes; it never substitutes hardcoded rules such as distance-too-far → bow. There is no unrestricted autonomous tool loop and no arbitrary JavaScript.

## Phase 1A implementation and evidence

- Minimal TypeScript runtime: contracts, BridgeSession, CombatSensor, TurnDetector, CombatNormalizer, LlmDecisionGateway, OpenRouterDecisionProvider, DevFixtureMindProvider, encrypted local settings and Electron desktop UI.
- Foundry connects outward through its existing {id,type,params} Bridge protocol. Eight explicit read commands only; no write dispatcher or IntentExecutor.
- Real OpenRouter is the only runtime provider. Default qwen/qwen3-30b-a3b-instruct-2507, temperature 0.25, max output 700; editable model and masked key. Structured schema when advertised, strict runtime validation on every path. No model mocks in the production path.
- StoryCore sibling source was inspected read-only; provider/context patterns are compatible, but its campaign-internal functions are not imported. Development-only personality/memory fixture remains replaceable. See [STORYCORE_BOUNDARY.md](STORYCORE_BOUNDARY.md).
- Windows DPAPI CurrentUser encrypts keys outside git in %LOCALAPPDATA%/StoryCoreFoundryAI/settings.json. Electron main owns secrets/provider/Bridge. The sandboxed renderer loads only packaged local assets through narrow typed IPC; saved keys never return to it. Only the Bridge WebSocket listener and tiny health endpoint bind 127.0.0.1:3210; former HTTP UI/settings routes are removed. No secrets in prompts, error bodies or logs.
- Per Run click: one decision, at most two plan attempts, two repair continuations, five model calls and 60 seconds from snapshot observation, using PHASE1A_DECISION_LIFETIME_MS for both snapshot expiry and the decision deadline. PLAN_REQUEST gets PLANNING_UNAVAILABLE in the same decision; the current implementation then continues the LLM loop (open orchestration bug). The adapter offers no preview or fabricated plan. FINAL_INTENT is validated/stored only. No automatic combat loop.
- Native scope/actorLink/perception/action budget completeness is absent in installed reads. Explicit per-run operator attestation enables only supervised degraded dry-run; unknown native fields stay null/false, scopeVerified=false and automaticExecution=false. All actual writes remain impossible. Full source/data limitations are in [PHASE1A_TESTING.md](PHASE1A_TESTING.md).
- Detect/Refresh discovers active combat and scene through audited v8.11.2 reads without manual IDs. Main stores the latest detected scope and filters candidates to safe current-combat participants; the user can deselect targets and confirms one attestation. Read-only IDs are collapsed in Advanced diagnostics. Default development personality/memory needs no editing; only selected hostile combatants generate factual relationships.
- Run accepts only the detection ID, offered candidate handles, attestation and editable non-ID mind fields. Main derives all scope/Actor/token lists, checks active scene and repeats the full read bracket before the model. Changed scope/selected targets reject as DETECTED_SCOPE_STALE; no silent switch.
- Fresh combat consistency bracket and full pre-acceptance readback reject observed state changes. Fingerprint is local, not atomic/native. Target catalogues omit hidden/unknown actors; raw Actor/HTML/flags/ASCII/Compendiums never enter model DTOs.
- Static result: npm run check passed, including typecheck, build and 63/63 automated tests on Windows. All original 32 regression cases remain; the retired HTTP-page case now verifies removal. IPC, secret-clear/preserve, trusted-provider and renderer-boundary tests passed, plus seven token-wire/diagnostic, ten auto-detection/scope/IPC and five deadline/cancellation regressions.
- Actual offline Electron smoke passed with fake credentials: OS sandbox, real IPC, no renderer Node/network, empty saved-key fields and main-process DPAPI clear. Detect/deselect/attest/Run passed through real IPC and a local fake Bridge with a test-only model; no deselected target entered the model and no writes were dispatched. Screenshot inspected. Portable Windows x64 package refreshed; startup/health was proven in the earlier desktop checkpoint. See [DESKTOP_BOUNDARY.md](DESKTOP_BOUNDARY.md).
- Live result (operator-reported): the first real Foundry read reached the adapter, but BRIDGE_DATA_INVALID stopped the attempt with stateBytes=0 and writesDispatched=0, before normalization/Qwen. Source verification against Bridge v8.11.2 (f71ea11b708d78c85c979ddae04d371be66e766e) confirmed numeric summary disposition versus string detail disposition. Separate adapter schemas now match those wire contracts; each READ schema has safe boundary/field diagnostics. No donor changes or new live calls were made for this fix. That earlier rejected attempt did not establish the live slice; it is superseded by the later tactical-response evidence below. Full acceptance remains open.


- Supervised timeout fix (operator-reported live evidence): qwen/qwen3-30b-a3b-instruct-2507 reached OpenRouter but returned DECISION_DEADLINE at latencyMs=29999 with returnedModel=null and writesDispatched=0. It required more time than the previous 30-second supervised window. src/phase1a-config.ts now defines PHASE1A_DECISION_LIFETIME_MS=60000; snapshot expiry and the entire bounded decision share it. The provider receives cancellation at expiry, late replies cannot be accepted, and fresh-state validation remains mandatory. Results/log summaries include timing.timeoutMs, timing.elapsedMs (snapshot age), and timing.providerLatencyMs (last model-call latency); deadline events also carry timeoutMs/latencyMs, never keys/headers. All response counts, per-invocation/session limits and READ-ONLY restrictions are unchanged. No new live calls were made for this fix; Phase 1A live acceptance is not complete.

Current timeout-fix portable artifact: release/phase1a-60s/StoryCoreFoundryAI-win32-x64/StoryCoreFoundryAI.exe. The standard release folder could not be replaced while the previous app was open (Windows EBUSY); it was not updated. The separate package uses the same saved DPAPI settings. Close the old window before launching this build.

## Phase 1A live LLM checkpoint - 2026-08-31

Evidence source: the operator supplied the results of a real supervised run after the timeout fix. This was not a mock or fake provider. This documentation checkpoint does not rerun the live test or import raw runtime logs. Code reviewed before the checkpoint: dab5cb31b0dc850dbd4d6fd02f0caa467e16a6ea (Increase Phase 1A LLM decision timeout), matching origin/main after fetch.

**Phase 1A real-LLM vertical slice is proven end-to-end through live Foundry read -> normalization -> real Qwen tactical decision, with zero Foundry writes. Full Phase 1A acceptance remains OPEN.** The run proved the first schema/reference-valid tactical response, not a completed final intent or executable combat AI.

Runtime: Foundry VTT 12.343, D&D5e 3.3.1, Foundry API Bridge, OpenRouter, qwen/qwen3-30b-a3b-instruct-2507. The observed pipeline was LIVE FOUNDRY STATE -> CombatSensor -> CombatNormalizer -> OpenRouter -> REAL QWEN RESPONSE.

| Live observation | Recorded value |
|---|---|
| Current NPC | Goblin; HP 7/7; movement 30 ft (capacity, not proof of remaining turn allowance) |
| Perceived target | Ethan; distance 40 ft; perceived=true |
| Offered action catalogue | Scimitar only; range 5 ft; omittedActions=4 |
| Development personality | Cautious creature that values survival. |
| Development motivation | Defend its position and survive. |
| First Qwen latencyMs | 2778 |
| First returnedModel | qwen/qwen3-30b-a3b-instruct-2507 |
| First response | PLAN_REQUEST; goal.kind=approach; target Ethan; action Scimitar |
| First response validation | SCHEMA_AND_REFERENCES_VALID |
| Planning capability | pathPreview=false; movement.plans=[] |
| Whole-run safety | execution=DISABLED; writesDispatched=0 |
| Final run status | PLAN_LIMIT, not a validated final intent |

REAL QWEN received LIVE NORMALIZED FOUNDRY COMBAT STATE and independently chose the approach intent. The adapter did not choose a distance > X -> approach rule or substitute scripted deterministic combat AI. The LLM owned the tactical decision; deterministic code validated schema/references. This does not prove native action legality, path availability or action execution.

The entire live run remained READ-ONLY: no move-token, activate-item, next-turn, HP mutation, Actor mutation, Midi execution, other Foundry write or StoryCore memory write occurred. Recording a local dry-run diagnostic is not a memory update. These live observations are separate from the older POC claims in PROVEN_POC.md.

Observed orchestration sequence (four model responses, followed by final status):

1. Qwen requested approach to Ethan with Scimitar; SCHEMA_AND_REFERENCES_VALID; runtime reported PLANNING_UNAVAILABLE.
2. The runner called Qwen again instead of stopping. Qwen again requested approach to Ethan; runtime again reported PLANNING_UNAVAILABLE.
3. Qwen attempted FINAL_INTENT with kind=move and planId="default", although no such plan had been offered. The observed response was rejected with DECISION_SCHEMA_INVALID. No route or movement was authorized; the supplied evidence does not include the full rejected JSON, so no narrower schema-failure cause is asserted.
4. After repair, Qwen requested PLAN_REQUEST again.
5. Final status was PLAN_LIMIT.

**Open orchestration bug, not fixed:** src/decision-runner.ts::DecisionRunner.run records PLANNING_UNAVAILABLE and appends planFeedback without a terminating break/return; its bounded while loop continues. Existing regression tests also expect continuation. Desired supervised Phase 1A behavior is valid PLAN_REQUEST + pathPreview=false -> PLANNING_UNAVAILABLE -> STOP. That change is a separate next-stage task. Current limits still bound the loop; they do not make the extra calls correct for this checkpoint.

Recorded real Qwen latencies in this decision were approximately 2778, 9241, 2351 and 9766 ms. A separate earlier call reached the old timeout at 29999 ms. The unchanged 60000 ms lifetime is an emergency supervised deadline shared with snapshot expiry, not a normal expected NPC-turn latency or performance target.

## Open issues for OPTIMIZATION / GENERALIZATION

The following work is recorded but NOT started or implemented by this checkpoint. Full Phase 1A acceptance remains open because of the orchestration loop, incomplete action catalogue and unresolved disposition semantics.

1. **PLANNING_UNAVAILABLE orchestration loop.** Implement and verify the stop behavior described above in a separately authorized task; do not add path planning or execution to work around it.
2. **Universal Action Normalization / Shortbow omitted.** The model saw only Scimitar with omittedActions=4. Previously known Goblin items include Scimitar (mVZ4LasR8WtG2fzY), Shortbow (T7E8xxeseGuOZWpV) and Nimble Escape (Zkc9crbT8rO35I4O). Shortbow was absent from the model catalogue; the cause is not established by this checkpoint. The first priority of the next stage is a universal Foundry/D&D5e Item -> semantic capability audit, not an item-name fix such as if item.name === "Shortbow" or hundreds of per-item handlers. Future audit categories: legacy melee weapon, legacy ranged weapon, monster/class feature, spell attack, save spell, healing and AoE. These are audit categories, not newly enabled execution scope.
3. **Disposition semantics.** Ethan arrived as disposition=friendly while being the Goblin's intended test target. Investigate what Foundry Token disposition means, relative to whom, what Bridge emits, how normalization should represent combat hostility, and how StoryCore relationships contribute. Do not equate the observed value with NPC-relative hostility or apply a hardcoded replacement. No disposition change is made here.

Also investigate payload size in the next stage: requestBytes approximately 12388 and approximateTokens approximately 3097 for a simple Goblin decision. These are provider-request metrics, not a measurement of CombatState alone. Consider FULL INTERNAL COMBAT STATE for runtime/validator versus COMPACT LLM DECISION VIEW containing only decision-relevant facts. No payload optimization, context schema change or tactical logic is implemented in this checkpoint.

## Exact next step

Stop after this documentation checkpoint is committed and pushed. The next separately authorized stage is **OPTIMIZATION / GENERALIZATION**. Its first priority is a universal Action Normalizer audit across the categories above, not adding Shortbow by name. Also investigate disposition semantics, a compact DecisionView and stopping the unnecessary LLM continuation after PLANNING_UNAVAILABLE. Do not begin any of these changes here.

Full Phase 1A acceptance is not closed and combat execution is not ready. No pathfinder, movement, item/Midi execution, turn advancement, Foundry or memory writes are authorized by this checkpoint. The existing 60-second emergency deadline and bounded-call protections remain unchanged. The six Phase 0 audit documents and PROVEN_POC.md remain canonical and unmodified; the latest observed Phase 1A behavior and next-stage priorities are recorded here. Combat Mappers remains frozen.

Checkpoint verification: npm run check passed (63/63 tests, typecheck and build). Only PROJECT_STATE.md, CHAT_HANDOFF.md and PHASE1A_TESTING.md changed. Production code, tests, the six Phase 0 canonical documents and PROVEN_POC.md are unchanged. Diff review found no credential material or local runtime artifacts to commit. Passing existing tests does not resolve the observed orchestration bug.

## Review boundary and handoff discipline

Commit only the safe documentation changes as **Record Phase 1A live LLM checkpoint** and push origin/main after npm run check. Stop; no next-stage implementation, action/disposition fixes, payload optimization or execution changes.

PROJECT_STATE.md and CHAT_HANDOFF.md must stay aligned. Preserve the six completed audit documents as canonical inputs and PROVEN_POC.md as the authority for previous live evidence. Keep operator-supplied live evidence distinct from fixture tests and code inspection; do not invent additional live results.

## Latest checkpoint — Pre-Phase-2 LAARU spell audit (2026-08-31)

**Pre-Phase-2 LAARU spell-compendium audit complete. Phase 2 production implementation has not begun.** This additive checkpoint supersedes the earlier checkpoint's commit/stop instructions above; its Phase 1A evidence and open issues remain unchanged.

New completed static evidence: [LAARU_SPELL_COMPENDIUM_AUDIT.md](LAARU_SPELL_COMPENDIUM_AUDIT.md), [spell-only mechanical dataset](../analysis/laaru-spells-mechanical.json) and [offline audit extractor](../analysis/extract-laaru-spells.cjs). The supplied laaru-dnd5-hw 3.64.0 snapshot declares 18 LevelDB packs compatible with Foundry 11–12 / D&D5e 3.2.0–3.3.99. All packs were inspected from disposable copies; no donor database was opened on write or migrated.

- 640 standalone spell templates plus 9,452 Actor-embedded spell Items = **10,092 retained native spell documents**, without deduplication. All source identities are verified; embedded IDs include parent Actor scope. Zero non-spell documents enter the dataset.
- All 10,092 spells lack system.activities; mixed legacy field shapes, structural families, 14 real representative templates, ambiguous semantics and possible source identity mechanisms are documented. Only 52 embedded Items carry direct resolvable references to the standalone LAARU spell pack. No name-based resolver or per-spell handlers were implemented.
- Derived data contains bounded mechanical/identity fields, not descriptions/HTML/macros/scripts/arbitrary flags or secrets. All 7,505 donor file paths/content hashes stayed unchanged. No reusable donor license was verified; the audit does not authorize copying the original module's code or expressive content.
- Compendium templates can inform future semantic understanding, but live Actor-owned Items remain authoritative for ownership/preparation/resources/modifications. The dataset is offline research, not connected to production and not a bulk LLM prompt.
- Verification: independent source/field checks and a fresh-copy extraction check passed; npm run check passed **63/63 tests**, typecheck/build; git diff --check passed. Existing production code/tests/dependencies, the six canonical Phase 0 documents, PHASE1A_TESTING.md and PROVEN_POC.md are unchanged. No Foundry/LLM/Midi live test or live write occurred; execution remains DISABLED and Phase 1A acceptance OPEN.

**Exact next step: review this audit, then separately authorize its proposed offline generic capability-coverage experiment. STOP until review.** The broader OPTIMIZATION / GENERALIZATION priority remains universal Action Normalization, not a Shortbow or spell-name handler. PLANNING_UNAVAILABLE orchestration loop, incomplete action catalogue and disposition semantics remain open and untouched; compact DecisionView is still proposed. No Phase 2 implementation, pathfinding, movement, item/Midi execution, turn advancement or Foundry/memory writes are authorized here.

Commit this audit checkpoint as **Audit LAARU spell compendium**, push origin/main and stop. The earlier Phase 1A checkpoint's file list/commit instructions above describe that historical checkpoint, not this audit.
