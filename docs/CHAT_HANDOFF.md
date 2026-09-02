# StoryCore Foundry AI — Chat Handoff

Last updated: 2026-09-02
Repository: Bertroner/storycore-foundry-ai
Branch: main

## Phase status

**Phase 0 is COMPLETE.**
**Pre-Phase-2 LAARU spell-compendium and V12 spell execution donor audits COMPLETE; awaiting review, no Phase 2 production implementation.**
**Current phase: Phase 2A supervised movement / Item execution vertical slice implemented; live execution acceptance OPEN.**
**Exact next step: run one supervised turn from the packaged desktop app in the dedicated Foundry test world and review the Process log; do not retry uncertain writes.**

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
- Per Run click: one decision, at most two plan attempts, two repair continuations, five model calls and 60 seconds from snapshot observation, using PHASE1A_DECISION_LIFETIME_MS for both snapshot expiry and the decision deadline. PLAN_REQUEST gets PLANNING_UNAVAILABLE in the same decision and now stops immediately; no later model response can invent or reference a planId when path preview is unavailable. The adapter offers no preview or fabricated plan. FINAL_INTENT is validated/stored only. No automatic combat loop.
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

**Historical orchestration defect (resolved in the latest checkpoint below):** the live run at this checkpoint showed DecisionRunner continuing after PLANNING_UNAVAILABLE. The later fix adds an immediate terminating return path and regression tests now require valid PLAN_REQUEST + pathPreview=false -> PLANNING_UNAVAILABLE -> STOP.

Recorded real Qwen latencies in this decision were approximately 2778, 9241, 2351 and 9766 ms. A separate earlier call reached the old timeout at 29999 ms. The unchanged 60000 ms lifetime is an emergency supervised deadline shared with snapshot expiry, not a normal expected NPC-turn latency or performance target.

## Open issues for OPTIMIZATION / GENERALIZATION

The following work is recorded but NOT started or implemented by this checkpoint. Full Phase 1A acceptance remains open because of the orchestration loop, incomplete action catalogue and unresolved disposition semantics.

1. **PLANNING_UNAVAILABLE orchestration loop (resolved later).** The latest checkpoint below implements and verifies immediate stop behavior without adding path planning or execution.
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

## Prior checkpoint — Pre-Phase-2 LAARU spell audit (2026-08-31)

**Pre-Phase-2 LAARU spell-compendium audit complete. Phase 2 production implementation has not begun.** This additive checkpoint supersedes the earlier checkpoint's commit/stop instructions above; its Phase 1A evidence and open issues remain unchanged.

New completed static evidence: [LAARU_SPELL_COMPENDIUM_AUDIT.md](LAARU_SPELL_COMPENDIUM_AUDIT.md), [spell-only mechanical dataset](../analysis/laaru-spells-mechanical.json) and [offline audit extractor](../analysis/extract-laaru-spells.cjs). The supplied laaru-dnd5-hw 3.64.0 snapshot declares 18 LevelDB packs compatible with Foundry 11–12 / D&D5e 3.2.0–3.3.99. All packs were inspected from disposable copies; no donor database was opened on write or migrated.

- 640 standalone spell templates plus 9,452 Actor-embedded spell Items = **10,092 retained native spell documents**, without deduplication. All source identities are verified; embedded IDs include parent Actor scope. Zero non-spell documents enter the dataset.
- All 10,092 spells lack system.activities; mixed legacy field shapes, structural families, 14 real representative templates, ambiguous semantics and possible source identity mechanisms are documented. Only 52 embedded Items carry direct resolvable references to the standalone LAARU spell pack. No name-based resolver or per-spell handlers were implemented.
- Derived data contains bounded mechanical/identity fields, not descriptions/HTML/macros/scripts/arbitrary flags or secrets. All 7,505 donor file paths/content hashes stayed unchanged. No reusable donor license was verified; the audit does not authorize copying the original module's code or expressive content.
- Compendium templates can inform future semantic understanding, but live Actor-owned Items remain authoritative for ownership/preparation/resources/modifications. The dataset is offline research, not connected to production and not a bulk LLM prompt.
- Verification: independent source/field checks and a fresh-copy extraction check passed; npm run check passed **63/63 tests**, typecheck/build; git diff --check passed. Existing production code/tests/dependencies, the six canonical Phase 0 documents, PHASE1A_TESTING.md and PROVEN_POC.md are unchanged. No Foundry/LLM/Midi live test or live write occurred; execution remains DISABLED and Phase 1A acceptance OPEN.

**Exact next step: review this audit, then separately authorize its proposed offline generic capability-coverage experiment. STOP until review.** The broader OPTIMIZATION / GENERALIZATION priority remains universal Action Normalization, not a Shortbow or spell-name handler. PLANNING_UNAVAILABLE orchestration loop, incomplete action catalogue and disposition semantics remain open and untouched; compact DecisionView is still proposed. No Phase 2 implementation, pathfinding, movement, item/Midi execution, turn advancement or Foundry/memory writes are authorized here.

Commit this audit checkpoint as **Audit LAARU spell compendium**, push origin/main and stop. The earlier Phase 1A checkpoint's file list/commit instructions above describe that historical checkpoint, not this audit.

## Prior checkpoint — V12 spell execution donor audit (2026-08-31)

**V12 spell execution donor audit completed. No production spell execution implemented; no live spell cast performed. Phase 2 production implementation has not begun.** This checkpoint supersedes earlier commit/next-step instructions above. Phase 0 remains COMPLETE; Phase 1A live read -> normalization -> real Qwen tactical decision remains proven, full acceptance OPEN, execution DISABLED.

New completed static evidence: [V12_SPELL_EXECUTION_DONOR_AUDIT.md](V12_SPELL_EXECUTION_DONOR_AUDIT.md), including the capability-confidence table, exact donor pins/licenses/source map, legacy API comparison, four spell-family analyses and future experiment. Starting project HEAD was `eaea65b4397533394477c73ca1044eeefaa543d9`, clean main. Existing LAARU audit/dataset and all six canonical Phase 0 documents remain unchanged inputs.

- Inspected exact ThreeHats `a31e4cfb10eebc204b8cb8fa6139e5880728cb00`, dnd-ai-dm `7659a53e776471877a8671aedad41dab08de6b09`, AI-GM `34f681e4720bce836520c86aa75347af2a57f82a`, and canonical API Bridge v8.11.2 `f71ea11b708d78c85c979ddae04d371be66e766e`. New donors are ignored local references, unchanged after acquisition; the two AI donors have no verified reusable project license and remain architecture-only.
- Inspected installed static D&D5e **3.3.1**, Midi-QOL **11.5.5** and DAE **11.3.64** source, with source hashes recorded. No live world/settings or module code was executed. Foundry remains **12.343**, never upgraded. Disk versions do not prove active automation settings.
- Legacy spells already share Bridge's generic Actor-owned Item.use seam with the proven Scimitar. No new spell command or replacement transport is justified. Native D&D5e owns use configuration/resources/upcasting/concentration/template creation; Midi orchestrates configured attacks/saves/damage and Midi/DAE configured effects. INVOKABLE does not mean FULLY AUTOMATED; no live spell success is claimed.
- Exact gaps: Bridge spellLevel uses activity-style spell.slot instead of legacy slotLevel; no-template config is also activity-style; scene/acting-token scope and target restoration are absent; empty targets retain old state; template preview patch can leak on cancellation; RollComplete capture is unscoped and may accept an unrelated workflow. Midi ordinary workflow ID is Item UUID, not unique per invocation. None was fixed here.
- LAARU Fire Bolt is the smallest attack-family candidate. Hold Person has no embedded effect proving paralysis; Shield has a +5 AC effect but trigger/expiry automation is unproven; Fireball native template placement exists but current Bridge placement is not proven safe/unattended. Save-success multipliers and actual Actor-owned automation must be verified, not inferred from spell names.
- Future design recommendation: generic live mechanical facts plus a bounded sanitized Actor-owned description, optionally cached semantic summaries; no handcrafted per-spell rules catalogue. LLM chooses tactics; validator resolves fresh references; native D&D5e/Midi resolve. No semantic-card/description pipeline or resolver was built.

**Exact next step: review this audit, then separately authorize one isolated supervised Fire Bolt execution-seam test per section 22. STOP until review/authorization.** Use one linked mage/unique token, one actual owned legacy spell Item and one validated target; read scope/resources/HP, invoke the existing Bridge once, correlate the correct Midi workflow, fresh OBSERVE, and restore targets safely. No activity/upcast/template parameter, no manual roll/HP/slot update, no automatic retry. If existing supervised tooling cannot safely isolate/correlate the cast, stop for separately authorized test instrumentation. This is a proposal only; no Foundry test, LLM call or write occurred here.

Broader OPTIMIZATION / GENERALIZATION work remains pending: universal Action Normalization (not a Shortbow-name fix), disposition semantics, compact DecisionView and the PLANNING_UNAVAILABLE orchestration loop. Those three acceptance issues remain open. The 60-second supervised decision/snapshot lifetime, bounded-call protections and current linked-Actor attestation limitations are unchanged. No production normalizer/runner/intent schema, Bridge fork, pathfinding, movement, Midi execution or turn advancement was added. PROVEN_POC.md and historical live evidence are untouched.

Verification: npm run check passed (63/63 tests, typecheck and build); git diff --check passed. Audit has all 22 requested sections, checkpoint/handoff bodies match, and targeted credential/diff review found no secrets. All 7,505 LAARU donor file paths/hashes and seven recorded installed-source hashes are unchanged; four pinned Git donor worktrees are clean. This checkpoint changes only V12_SPELL_EXECUTION_DONOR_AUDIT.md, PROJECT_STATE.md and CHAT_HANDOFF.md; no production code, donor code, runtime settings or logs are included. Passing existing tests is not a live spell test or closure of Phase 1A acceptance.

Commit this documentation checkpoint as **Audit V12 spell execution architecture**, push origin/main and STOP. Do not begin implementation or live testing until reviewed.

## Latest checkpoint — Fire Bolt automatic test discovery (2026-09-01)

**Isolated Fire Bolt discovery harness implemented and tested; spell execution remains NOT_PERFORMED. No production spell support or Phase 2 implementation.** This checkpoint supersedes the earlier manual preflight/next-step instructions. See [FIRE_BOLT_EXECUTION_SEAM_TEST.md](FIRE_BOLT_EXECUTION_SEAM_TEST.md).

The earlier request for operator-supplied scene/caster/target IDs and workflow-isolation certification was an unnecessary harness precondition, not a Foundry limitation. The separate desktop harness now reads active scope, native Actor.hasPlayerOwner through Bridge filter-actors, linked/unique Token instances and actual owned Item identity through resolve-uuid. Player ownership controls caster eligibility only, never hostility. Current eligible combatant is preferred; unique fallback/target candidates resolve automatically; ambiguity uses human-readable rows. No editable technical IDs or tactical ranking is used. The discovery UI now shows Bridge connection state separately and permits secure DPAPI storage of the matching Bridge key; saving a key does not enable writes or invoke Foundry. Caster failure output is bounded to participant display names and eligibility reason codes; localized LAARU `… / Fire bolt` labels are matched by an exact slash-delimited segment. Fresh live diagnostics identified `Маг: UNLINKED_ACTOR` and `Итан: PLAYER_CONTROLLED_TARGET`; no token was changed and execution remains NOT_PERFORMED.

Live read-only discovery reached **CASTER_NOT_FOUND**, with execution=DISABLED_REVIEW_REQUIRED and writesDispatched=0. The eligible caster set was empty; no complete live caster/target setup, owned spell execution, workflow or HP/resource result is claimed. The earlier NOT_PERFORMED result is not converted to PASS. No spell import, automatic substitute Actor or Foundry write occurred; PROVEN_POC.md is unchanged.

Verification: npm run check passed **85/85 tests**, typecheck/build; separate offline sandboxed Electron UI/backend test passed; git diff --check passed. Fixture tests prove automatic IDs, name-row selection, native ownership boundaries, stale rejection, and the one-shot dispatch/observe policy. They do not prove live Midi correlation. Production retains its original eight READ commands; only small transport/server reuse seams changed. Normalizer, runner, intent schemas, donors and installed Foundry/world files were not modified.

**Exact next step: review the harness and CASTER_NOT_FOUND result. STOP before any cast.** A suitable existing combat participant must satisfy discovery before a setup can be reviewed; no manual IDs are required. Run is deliberately disabled in this discovery build, with no activation IPC/live dispatcher. The one-shot guard is tested with fake ports; a later separately authorized live binding must supply scoped observation and safe target-state handling or stop uncertain. This checkpoint does not authorize implementing Phase 2 or production execution. Commit/push: **Automate Fire Bolt test discovery**.

Phase 0 remains COMPLETE. Phase 1A live Foundry -> normalization -> real Qwen decision remains proven; full acceptance OPEN, production execution DISABLED. Universal Action Normalization, disposition semantics, compact DecisionView and the PLANNING_UNAVAILABLE loop remain pending and untouched. Foundry stays 12.343 / D&D5e 3.3.1; no LLM calls, spell casts or live writes were made by this harness task.


## Latest checkpoint — Working token-control architecture (2026-09-01)

The pinned donor modules and existing project audits have been synthesized into [WORKING_TOKEN_CONTROL_ARCHITECTURE.md](WORKING_TOKEN_CONTROL_ARCHITECTURE.md). This is the target architecture for a usable token-controlling version; it supersedes the earlier narrow Fire Bolt harness as the production design. No production execution, Foundry write, LLM call, live combat test, donor edit or Foundry upgrade was performed in this checkpoint.

The key decision is to keep Foundry API Bridge as the sole command bus and D&D5e/Midi as the rules authority. StoryCore provides narrative context and the real LLM selects an offered structured intent. Deterministic code only reads, projects capabilities, validates fresh scope, compiles a small command allowlist and observes the result.

The production identity boundary is `sceneId + tokenId -> TokenDocument.actor`, not a linked world Actor requirement. This token-scoped effective Actor read supports linked and unlinked/synthetic tokens, distinguishes duplicate instances and resolves the actual Actor-owned Item. Native `hasPlayerOwner` controls AI eligibility; Foundry disposition and StoryCore relationship remain separate.

Weapons, spells, features and consumables use one structural `ActionCapability` model with item-family projectors selected by native type/fields, never Item names. Skills/abilities use separate context-gated check capabilities. Full internal state remains with the validator; the LLM receives a compact `DecisionView`. Unsupported or truncated capabilities fail visibly rather than being silently omitted or replaced by deterministic tactics.

The bounded episode is OBSERVE -> LLM DECIDE -> VALIDATE -> COMMAND -> OBSERVE. It permits movement, Item activation and end-turn across fresh snapshots while preserving hard model/plan/repair/time/write limits. `PLANNING_UNAVAILABLE` must stop immediately. Ambiguous writes are observed and stopped without retry.

The smallest Bridge work is: token-scoped Actor context read, read-only path planning using Bridge's existing `findGridPath`, plan-authorized movement, token-scoped legacy `dnd5e/activate-item` with exact target lifecycle and correlated Midi observation, and guarded next-turn. These changes belong in a maintained Bridge fork/extension, never in `_references/`.

**Exact next implementation stage: Phase 2A — Token-scoped capability foundation.** First add the read-only `get-token-actor-context` seam and strict linked/unlinked/player-ownership fixtures. Then add generic legacy weapon/spell/feature/consumable projection plus compact DecisionView coverage. Do not start live writes until that read-only foundation is reviewed. Existing POCs are not to be repeated; new verification targets only new seams.


## Latest checkpoint — Stop after unavailable planning (2026-09-01)

Operator-supplied live evidence from the packaged read-only build confirmed the known orchestration defect. The first real Qwen response was a schema/reference-valid PLAN_REQUEST to approach the selected target using the offered ranged dagger. That response completed in 33,872 ms and correctly produced PLANNING_UNAVAILABLE because pathPreview=false and no plans were offered. The old runner then made additional model calls: an invented move planId was rejected, another PLAN_REQUEST again produced PLANNING_UNAVAILABLE, and a fourth call reached the shared 60-second deadline. Final elapsed time was 60,002 ms. Execution remained DISABLED and writesDispatched remained 0.

`DecisionRunner.run` now terminates the current decision immediately after that first valid unavailable PLAN_REQUEST. The returned status is PLANNING_UNAVAILABLE, accepted=false and writesDispatched=0. No second model call occurs, no fabricated plan is offered, and all existing deadline, repair, response, cancellation, stale-state and read-only protections remain active.

Regression coverage proves both a first valid PLAN_REQUEST and a repair followed by a valid PLAN_REQUEST stop without later provider calls. This fix adds no pathfinding, movement, Item activation, Midi execution, turn advancement or other Foundry write. It does not make Phase 1A live acceptance complete; a new live run is still required to confirm the packaged behavior.

## Latest checkpoint — Supervised token control implementation (2026-09-02)

**Phase 2A supervised vertical slice is implemented locally; live execution acceptance is OPEN.** No live Foundry write, spell cast, attack or movement was performed while building this checkpoint. Foundry remains 12.343, D&D5e 3.3.1, and the existing API Bridge remains the sole command bus.

The desktop Run action now performs one bounded supervised NPC turn: fresh OBSERVE -> real LLM decision -> strict validation -> an allowlisted Bridge command -> fresh OBSERVE. A PLAN_REQUEST receives one deterministic grid endpoint selected from the LLM goal and native walk/range facts; the same bounded decision may reference only that offered planId. Movement uses Bridge `move-token` with explicit sceneId, `canOpenDoors:false`, and fresh coordinate readback. After one successful move the adapter makes one new decision from the fresh position. A second movement in the same Run or a later Run on the same combat turn is blocked.

Generic structural capability projection now covers legacy `weapon`, `spell`, `feat`, and `consumable` Items without name handlers. The LLM sees every supported offered action with real itemId, activation, range, target, damage type, uses and spell level/preparation facts, so it can compare weapons and supported spells tactically. Deterministic code never chooses which attack is better. For this slice, executable spells are limited to legacy cantrips and innate/at-will single-target/self Items. Prepared levelled spells, activities, AoE/templates, reactions, bonus-action complexity, difficult terrain, elevation/flying, doors and multi-NPC tactics remain rejected.

The strict write allowlist contains only `move-token`, `dnd5e/activate-item`, `clear-targets`, and `next-turn`, with command-specific parameter schemas. Item execution clears stale targets, activates exactly one current Actor-owned Item with zero or one validated Token target, clears targets after settlement, and performs a fresh state read. D&D5e/Midi own attack, save, damage, healing, effects and resource mutation. The adapter never rolls or changes HP/slots itself. No automatic retry occurs after a timeout, failed command or ambiguous workflow. A process-level fuse blocks repeated movement or Item activation on the same observed combat turn.

The former Result panel is now a live **Process log**. It records OBSERVE, DECIDE, VALIDATE, PLAN, COMMAND, MIDI, RESULT and STOP entries, provider latency, command count and safe result summaries; Advanced result data retains the bounded diagnostic object. API keys, Bridge keys, Authorization headers and raw Actor payloads are excluded.

Known supervised limitations remain explicit: actor linking/perception and normal walking require the per-run operator attestation; movement remaining is not exposed natively; Bridge validates wall routing during the write rather than providing a true read-only path preview; Midi RollComplete matching in Bridge v8.11.2 is not invocation-scoped; target state is cleared rather than restored; linked world-Actor activation is the tested scope. Ambiguous workflow output stops with `WORKFLOW_CORRELATION_UNCERTAIN`. These limits prevent claiming broad production combat support.

Static verification: `npm run check` passes with **94/94 tests**, including strict write envelopes, bounded planning, structural legacy spell projection, authoritative movement readback and one-shot Item/Midi observation. This is offline evidence only.

Offline Electron smoke also passes with the sandboxed renderer, real IPC, a fixture Bridge, one supervised next-turn command and fresh combat readback. Test ZIP: `release/StoryCoreFoundryAI-supervised-2026-09-02-win32-x64.zip` (163,349,781 bytes; SHA-256 `C52DCFC489C82DC5AEE42DB4FFDBE85F29EEBAC7CEF9AA19093CF4DAA8AFD0FF`).

**Exact next step:** launch the new supervised ZIP against the dedicated test world, Detect the current NPC turn, inspect the offered targets, tick the one-run authorization, and press **Run one supervised AI turn** once. Observe the Process log and Foundry state. Do not retry an uncertain or partially mutated result. The first live acceptance should use one linked 1x1 NPC, one unique player target, no doors/terrain/elevation, and a legacy weapon or Fire Bolt cantrip. Record the returned status/log before any broader test.
## Live follow-up — repeated PLAN_REQUEST after PLAN_READY (2026-09-02)

Operator-reported supervised run reached live Foundry reads and real Qwen planning but intentionally dispatched no write. The observed sequence was MODEL_REQUEST -> PLAN_READY (7,128 ms) -> a second PLAN_READY (33,107 ms) -> DECISION_DEADLINE at the shared 60-second snapshot lifetime. Final status was `DECISION_DEADLINE`, `writesDispatched=0`; therefore no Foundry movement or Item use was expected or claimed.

Root cause: after the first ready PlanSummary, the provider request still exposed the full PLAN_REQUEST-or-FINAL_INTENT JSON schema. Qwen legally requested another plan instead of confirming the offered planId, leaving insufficient deadline for another response. The runtime now narrows every continuation with a ready plan to a strict `FinalDecisionResponseV1` schema, explicitly forbids another PLAN_REQUEST, and caps that small confirmation response at 350 output tokens. The deterministic validator independently rejects PLAN_REQUEST after any ready plan with `PLAN_ALREADY_READY`; it never converts a planning request into movement automatically. The LLM must still issue the explicit FINAL_INTENT.

Decision events are now streamed into Process log when each response is validated, so PLAN_READY, rejected responses and deadline events retain actual publication times instead of appearing together after DecisionRunner returns. All snapshot expiry, stale-state checks, planId binding, write allowlists and no-retry rules remain active. Static verification remains 94/94 tests. No live retry or Foundry write was performed while applying this fix; movement/attack/spell execution still requires a new supervised run.
## Recorded design decision for the next correction (2026-09-02)

The compact LLM DecisionView should add a bounded, sanitized description hint for each Actor-owned action alongside native structured mechanics. The hint is for tactical understanding only; it is not rules authority and must never replace current Item fields or D&D5e/Midi execution. Build it deterministically from structured fields plus a short sanitized fragment of the owned Item description, with HTML, macros, controls and scripts removed and a strict length cap. Do not make an extra per-turn LLM call and do not add Item-name or per-spell handlers. A later optional cache may hold precomputed semantic summaries for complex/homebrew Items.

Target authorization, NPC-relative relationship and Foundry Token disposition are separate facts. The operator-selected target set must become the closed allowlist that the validator and every ActionCapability use; the LLM may choose only among that set. For the supervised fixture, selecting a row as an attack target is explicit per-run attestation that the NPC may treat that participant as an enemy. Preserve the original Foundry disposition as diagnostic world data, but do not translate friendly into an NPC ally or require hostile before creating the attested hostile relationship. Future StoryCore relationships may supply ally/enemy/neutral attitude instead of the temporary operator attestation. Player ownership continues to determine control ownership only.

This correction is now implemented locally. The UI labels checked rows as allowed attack targets; each selected row creates an explicit per-run enemy relationship regardless of Foundry disposition. Only selected identities enter nearby and ActionCapability eligibleTargets, and validation still fails closed on changed scope or references. The normalized LLM state omits Foundry disposition to avoid contradicting relationToSelf=enemy; Detect continues to display the untouched value as diagnostics.

Actor-owned actions now include a deterministic canPlanApproach flag and an optional descriptionHint capped at 240 characters. The sanitizer removes HTML, scripts/styles/forms/controls, Foundry enrichers, inline rolls, URLs and control characters. Native structured mechanics remain authoritative for validation, while D&D5e/Midi remain authoritative for execution. Object/ally target kinds are not offered an enemy combatant target in this supervised slice, and approach planning requires a numeric range in scene units. No Item-name or per-spell handler and no extra LLM summarization call was added.

## Live follow-up — compact FINAL_INTENT correction (2026-09-02)

Operator-supplied live evidence confirms the selected-enemy and description changes reached the real model. Ethan appeared as relationToSelf=enemy and targetAuthorized=true; Foundry disposition was absent from the normalized LLM state. Actor-owned descriptions were present as bounded descriptionHint fields. Qwen selected the real Actor-owned Fire Bolt against Ethan, so the tactical-selection seam improved as intended. Execution still ended with VALIDATION_LIMIT and writesDispatched=0; no Foundry movement, Item activation, Midi workflow or HP/resource mutation occurred.

The first Qwen response requested approach with Fire Bolt even though the target was 35 ft away and the action range was 120 ft. The previous planner returned a zero-distance ready plan. Subsequent Qwen responses expressed safe intended operations but omitted redundant nested schemaVersion/decisionId/snapshotId and unused null fields. The outer response IDs were correct, but the old nested contract rejected every response as DECISION_SCHEMA_INVALID.

The strict response contract is now smaller: correlation and freshness IDs remain once on the outer response; activate_item requires its action, move requires its offered movement plan, and end_turn requires only kind. Optional unused action/movement may only be null. Unknown keys, invented IDs, non-offered planIds and stale snapshots still reject. PLAN_REQUEST approach now rejects with PLAN_NOT_NEEDED when the selected target is already within known normal range, prompting the LLM to choose a direct final action instead of producing a no-op movement write.

Regression coverage includes the exact compact move and activate_item shapes observed live, redundant-field removal, outer ID correlation, plan binding, zero-distance planning rejection and the existing no-write safety limits. npm run check passes 94/94 tests. This is offline verification after the reported run; another supervised live run is required.

## Live follow-up — reject invented movement before a plan exists (2026-09-02)

Operator-supplied live result edb14193-7301-463c-a218-90cf27b0bb2b reached current Foundry state and real Qwen but dispatched no writes. The first model response returned FINAL_INTENT move with invented planId plan-approach-1 before any PlanSummary existed; deterministic validation correctly rejected it as PLAN_NOT_OFFERED. The second response selected the real Actor-owned Fire Bolt and Ethan but requested approach at 35 ft while the structured normal range was 120 ft; validation correctly rejected it as PLAN_NOT_NEEDED. Those calls consumed 25,565 ms and 32,742 ms, leaving about 1.7 seconds before the shared 60-second snapshot deadline. Final status was DECISION_DEADLINE and writesDispatched=0. No Foundry movement, Item activation, Midi workflow or mutation occurred.

The provider contract now excludes the move branch from the initial structured-output schema. Movement can appear only after runtime has offered a real PlanSummary. A PLAN_NOT_OFFERED or PLAN_NOT_NEEDED repair is narrowed to a compact non-movement FINAL_INTENT schema that permits only activate_item or end_turn, uses a 350-token response cap, and explains the exact correction. Deterministic validation remains unchanged as defense in depth: invented planIds, unnecessary approach requests, stale snapshots and invalid references still reject.

The normal Process log now displays the safe rejection code, such as PLAN_NOT_OFFERED or PLAN_NOT_NEEDED, alongside latency. It does not display raw payloads, Actor dumps, secrets or Authorization data. The LLM still chooses the action and target; deterministic code only constrains the protocol and validates geometry/range facts.

Offline verification: npm run check passed 95/95 tests, typecheck and build. Electron smoke passed. No live retry was performed during this correction. The refreshed ZIP is release/StoryCoreFoundryAI-supervised-2026-09-02-win32-x64.zip, 163,350,195 bytes, SHA-256 BAF391954C3191080B36C815164AA8075285D860281F5CD9358F3F85AD0D3E07. Exact next step: run one new supervised live turn with the refreshed ZIP and report the Process log. Do not automatically retry an uncertain or partially mutated command.

## Bounded full-turn lease implementation (2026-09-02)

The operator-confirmed Fire Bolt run proved real Qwen selection, Actor-owned Item activation and Midi workflow observation. It also showed that the previous DesktopService stopped after ITEM_ACTIVATED and therefore never offered the LLM the remaining movement/bonus-action/end-turn choice.

The supervised runtime now creates a process-local turn lease after the operator confirms that the NPC has not manually spent turn resources. The DecisionView exposes numeric movementRemaining plus actionAvailable and bonusActionAvailable booleans with source=turn-lease and an opaque leaseId. Initial availability comes from the current structurally supported Actor-owned catalogue: native one-cost action and bonus activations are supported generically; reaction Items remain excluded. This is not inferred native Foundry history and cannot detect actions performed outside this process before authorization.

After every successful move or Item activation, runtime performs fresh Foundry observation, applies the updated lease and asks the LLM for the next tactical intent. A normal action consumes only the action slot; a bonus-action Item consumes only the bonus slot. Observed Bridge pathCost reduces movement. The supervised cap is two movement writes, one action Item, one bonus-action Item, one next-turn write and five fresh decision cycles. The LLM must explicitly choose end_turn; deterministic code never selects a tactic or silently advances combat.

Spent-slot Items are marked unavailable in later DecisionViews. Validation rejects ACTION_BUDGET_SPENT, BONUS_ACTION_BUDGET_SPENT, MOVEMENT_EXHAUSTED, non-offered plans and stale turn leases. A write that becomes uncertain conservatively consumes its attempted slot and stops without retry. D&D5e/Midi remain authoritative for Item legality, attack/save/damage/effects and resource mutation.

Offline verification proves action -> fresh OBSERVE -> bonus action -> fresh OBSERVE -> LLM end_turn -> confirmed different combatant, with budgets [true,true] -> [false,true] -> [false,false]. Split movement path cost is accounted and closes after two writes. npm run check passes 97/97 tests. No live Foundry command or OpenRouter request was made while implementing this change. A new supervised live test is required.

Packaged full-turn test artifact: release/StoryCoreFoundryAI-supervised-full-turn-2026-09-02-win32-x64.zip, 163,351,478 bytes, SHA-256 3C8C2BC7D468900678317E7E95E2EEE822DA641FAD3258AE36BD8CF2DDC9AE48. Archive inspection found 73 entries and zero donor, analysis, Git, decision-log or settings entries.

## Budget-aware DecisionView correction (2026-09-02)

Operator live evidence proved Fire Bolt execution and fresh budget readback, then exposed a safe orchestration failure: after actionAvailable=false and bonusActionAvailable=false, the provider still showed spent Item cards and allowed action-linked approach requests. Qwen retried Fire Bolt; validation rejected ACTION_BUDGET_SPENT and the run stopped at PLAN_LIMIT. No second Item activation or other Foundry write was dispatched.

The provider now receives a compact copy of the decision request whose actions array contains only cards still selectable under the current turn lease. The full normalized state remains inside DecisionRunner for reference, freshness and legality validation. The structured-output schema is narrowed from the same budget state: spent action/bonus Items cannot be selected; approach is absent when no usable action remains; movement-only state permits position/retreat PLAN_REQUEST or end_turn; when movement and Item slots are exhausted only end_turn remains. Deterministic code still does not choose whether to move or end the turn.

Offline regression coverage reproduces the post-Fire-Bolt budget state, proves that spent Item IDs are absent from the OpenRouter DecisionView, proves the movement-only and end-turn-only schema shapes, and confirms the validator still rejects an injected spent action. npm run check passes 98/98 tests. No live Foundry or OpenRouter call was made while implementing this correction. Live acceptance remains pending one supervised run from the refreshed build.

## Live budget-aware Fire Bolt full-turn checkpoint (2026-09-02)

Operator-supplied live evidence confirms the corrected bounded turn completed successfully on Foundry VTT 12.343 / D&D5e 3.3.1 / Midi-QOL. Real Qwen selected the Actor-owned Fire Bolt against Ethan; PLAN_NOT_NEEDED safely rejected an unnecessary approach and the repaired activate_item intent passed reference/freshness validation. The existing Bridge performed target reset, one Item activation and target cleanup. Midi reported attackTotal=13, damageTotal=15, hitTargets=0 and failedSaves=0. This run therefore proves the invocation/workflow seam and a miss; it does not prove applied HP damage.

Fresh observation then exposed movementRemaining=30, actionAvailable=false and bonusActionAvailable=false. In the budget-aware second decision, Qwen selected end_turn. One guarded next-turn command was dispatched and fresh combat readback confirmed a different current combatant at round 5 turn 0. Final status was TURN_ADVANCED and writesDispatched=4, exactly accounting for target reset, one activation, target cleanup and next-turn. There was no repeated Item activation.

The first model response took 52,473 ms and its repair took 6,600 ms, close to the 60-second bounded deadline. The existing unscoped Midi RollComplete correlation risk remains; concurrent workflow safety is not proven. This checkpoint proves one supervised NPC turn against one selected target. It does not prove automatic multi-NPC continuation, multi-target tactics, reactions, AoE/templates, concentration, upcasting or levelled prepared spell execution.
