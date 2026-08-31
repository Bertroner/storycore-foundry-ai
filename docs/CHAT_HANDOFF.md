# StoryCore Foundry AI — Chat Handoff

Last updated: 2026-08-31
Repository: Bertroner/storycore-foundry-ai
Branch: main

## Phase status

**Phase 0 is COMPLETE.**
**Current phase: Phase 1 — Minimal Vertical Slice; Phase 1A read-only runtime, Electron desktop UI and automatic turn detection implemented.**
**Exact next step: supervised live Phase 1A acceptance and review; no movement/Midi execution yet.**

The source audit and six design documents are complete and are canonical inputs. Do not repeat the audit or replay CODEX_START_PROMPT.md as a new task. Phase 1A now implements the read-only decision checkpoint. Static verification passed. The first reported live read failed before normalization/Qwen; a later operator-reported attempt reached OpenRouter/Qwen but timed out at the old 30-second deadline. End-to-end live acceptance remains unverified.

PROJECT_STATE.md is the canonical checkpoint; CHAT_HANDOFF.md mirrors its status, scope, evidence and next step. The Phase 1 scope below limits the broader future architecture described in the audit documents. Deferred capabilities are not prerequisites to implement for this slice; unsupported cases must be rejected.


Settings UI follow-up: saved keys have an explicit per-field indicator; successful Save clears only submitted values after confirmation, while failed Save preserves typed values. Offline Electron regression checks cover short-key rejection, main-process validation failure, successful save and DPAPI disk reload with fake keys. No live model or combat request was made.

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
- Per Run click: one decision, at most two plan attempts, two repair continuations, five model calls and 60 seconds from snapshot observation, using PHASE1A_DECISION_LIFETIME_MS for both snapshot expiry and the decision deadline. PLAN_REQUEST gets PLANNING_UNAVAILABLE in the same decision; no preview command or fabricated plan. FINAL_INTENT is validated/stored only. No automatic combat loop.
- Native scope/actorLink/perception/action budget completeness is absent in installed reads. Explicit per-run operator attestation enables only supervised degraded dry-run; unknown native fields stay null/false, scopeVerified=false and automaticExecution=false. All actual writes remain impossible. Full source/data limitations are in [PHASE1A_TESTING.md](PHASE1A_TESTING.md).
- Detect/Refresh discovers active combat and scene through audited v8.11.2 reads without manual IDs. Main stores the latest detected scope and filters candidates to safe current-combat participants; the user can deselect targets and confirms one attestation. Read-only IDs are collapsed in Advanced diagnostics. Default development personality/memory needs no editing; only selected hostile combatants generate factual relationships.
- Run accepts only the detection ID, offered candidate handles, attestation and editable non-ID mind fields. Main derives all scope/Actor/token lists, checks active scene and repeats the full read bracket before the model. Changed scope/selected targets reject as DETECTED_SCOPE_STALE; no silent switch.
- Fresh combat consistency bracket and full pre-acceptance readback reject observed state changes. Fingerprint is local, not atomic/native. Target catalogues omit hidden/unknown actors; raw Actor/HTML/flags/ASCII/Compendiums never enter model DTOs.
- Static result: npm run check passed, including typecheck, build and 63/63 automated tests on Windows. All original 32 regression cases remain; the retired HTTP-page case now verifies removal. IPC, secret-clear/preserve, trusted-provider and renderer-boundary tests passed, plus seven token-wire/diagnostic, ten auto-detection/scope/IPC and five deadline/cancellation regressions.
- Actual offline Electron smoke passed with fake credentials: OS sandbox, real IPC, no renderer Node/network, empty saved-key fields and main-process DPAPI clear. Detect/deselect/attest/Run passed through real IPC and a local fake Bridge with a test-only model; no deselected target entered the model and no writes were dispatched. Screenshot inspected. Portable Windows x64 package refreshed; startup/health was proven in the earlier desktop checkpoint. See [DESKTOP_BOUNDARY.md](DESKTOP_BOUNDARY.md).
- Live result (operator-reported): the first real Foundry read reached the adapter, but BRIDGE_DATA_INVALID stopped the attempt with stateBytes=0 and writesDispatched=0, before normalization/Qwen. Source verification against Bridge v8.11.2 (f71ea11b708d78c85c979ddae04d371be66e766e) confirmed numeric summary disposition versus string detail disposition. Separate adapter schemas now match those wire contracts; each READ schema has safe boundary/field diagnostics. No donor changes or new live calls were made for this fix. Phase 1A live acceptance is still unverified; stop for another supervised live test.


- Supervised timeout fix (operator-reported live evidence): qwen/qwen3-30b-a3b-instruct-2507 reached OpenRouter but returned DECISION_DEADLINE at latencyMs=29999 with returnedModel=null and writesDispatched=0. It required more time than the previous 30-second supervised window. src/phase1a-config.ts now defines PHASE1A_DECISION_LIFETIME_MS=60000; snapshot expiry and the entire bounded decision share it. The provider receives cancellation at expiry, late replies cannot be accepted, and fresh-state validation remains mandatory. Results/log summaries include timing.timeoutMs, timing.elapsedMs (snapshot age), and timing.providerLatencyMs (last model-call latency); deadline events also carry timeoutMs/latencyMs, never keys/headers. All response counts, per-invocation/session limits and READ-ONLY restrictions are unchanged. No new live calls were made for this fix; Phase 1A live acceptance is not complete.

Current timeout-fix portable artifact: release/phase1a-60s/StoryCoreFoundryAI-win32-x64/StoryCoreFoundryAI.exe. The standard release folder could not be replaced while the previous app was open (Windows EBUSY); it was not updated. The separate package uses the same saved DPAPI settings. Close the old window before launching this build.

## Exact next step

Use [PHASE1A_TESTING.md](PHASE1A_TESTING.md) to launch Electron with npm run dev, configure its masked settings and the Bridge manually, run an authenticated connection test, then Detect current Foundry turn, inspect/deselect targets, confirm the one checkbox and Run one real LLM dry-run. Repeat Detect/Refresh and confirmation for manual close/far/LOS variations. No manual document IDs or console expressions are needed. Record real model/latency/validation evidence with zero writes and review it. No key belongs in this checkpoint or chat. Chrome is not part of the recommended flow; the existing DPAPI file is preserved. Optional local portable executable: release/StoryCoreFoundryAI-win32-x64/StoryCoreFoundryAI.exe.

Only after that review and a separate instruction may a later Phase 1 checkpoint implement Bridge plan-token-path or movement/native activation/observation. Future preview reuses Bridge GridPathfinder; no StoryCore A*, permanent POC PowerShell/BAT pathfinder or donor modification in Phase 1A.

Existing Bridge gaps (scene scope, perception/budgets, global next-workflow capture) remain documented risks. No proposed extension is presented as installed. Do not build another command bus, rules engine, Compendium database, Midi replacement or effects engine. Combat Mappers stays frozen: no Phase 5 or merge.

## Review boundary and handoff discipline

Commit this checkpoint as **Increase Phase 1A LLM decision timeout** and push origin/main. Stop for Phase 1A review; do not proceed to movement or Midi execution.

PROJECT_STATE.md and CHAT_HANDOFF.md must stay aligned. Preserve the six completed audit documents as canonical inputs and PROVEN_POC.md as the authority for previous live evidence. Update live claims only after independently observed tests.
