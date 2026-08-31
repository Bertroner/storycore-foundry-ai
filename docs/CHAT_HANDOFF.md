# StoryCore Foundry AI — Chat Handoff

Last updated: 2026-08-31
Repository: Bertroner/storycore-foundry-ai
Branch: main

## Phase status

**Phase 0 is COMPLETE.**
**Exact next phase: Phase 1 — Minimal Vertical Slice.**

The source audit and six design documents are complete and are canonical inputs. Do not repeat the audit or replay CODEX_START_PROMPT.md as a new task. This review changes documentation only; Phase 1 implementation has not started.

PROJECT_STATE.md is the canonical checkpoint; CHAT_HANDOFF.md mirrors its status, scope, evidence and next step. The Phase 1 scope below limits the broader future architecture described in the audit documents. Deferred capabilities are not prerequisites to implement for this slice; unsupported cases must be rejected.

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

[PROVEN_POC.md](PROVEN_POC.md) is authoritative for live evidence. No new POC/live combat tests were performed during this review.

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

## Bounded decision protocol

Each LLM response within a decision is exactly one of:

- PLAN_REQUEST: one LLM-chosen goal, read-only, no arbitrary waypoints. Adapter validates scope and asks Bridge plan-token-path; returned PlanSummary goes back into the same bounded decision.
- FINAL_INTENT: activate_item, move or end_turn. Movement references only an offered, still-valid planId.

Per decision: at most two PLAN_REQUESTs, two repair responses, five LLM responses total, and one accepted FINAL_INTENT; stop at the 30-second decision deadline or earlier snapshot/plan expiry. Plan results do not reset counters or deadline. Stale source state closes the decision and invalidates its offers. A supervised Phase 1 invocation permits at most eight decision cycles and 120 seconds total, with no automatic restart or next-NPC handoff. Limits, response IDs and failure behavior are specified in WIRE_CONTRACT.md.

The LLM chooses tactics. Deterministic code plans geometry, validates and executes; it never substitutes hardcoded rules such as distance-too-far → bow. There is no unrestricted autonomous tool loop and no arbitrary JavaScript.

## Exact next step

In a separately requested Phase 1 implementation pass:

1. Define the strict decision contracts and minimal BridgeSession around the proven local transport, initially read-only.
2. Build compact sensing/normalization for the linked, unique-token scope and connect StoryCore's actual LLM decision callback.
3. Expose read-only plan-token-path using Bridge's existing GridPathfinder, shared with guarded movement; no second StoryCore A* or permanent PowerShell/BAT pathfinder.
4. Add deterministic validation, serial native weapon activation and fresh observation. Address current-canvas scope and Midi workflow matching for the selected slice; reject synthetic/duplicate instances rather than implementing them.
5. Complete one supported NPC vertical slice before expanding scope. Do not infer new live proof from design or static checks.

Existing Bridge gaps (scene scope on context/activation, global next-workflow capture, perception/budget completeness) remain documented risks. Proposed extensions are not already-installed capabilities.

Do not build another command bus, rules engine, Compendium database, Midi replacement or effects engine. Combat Mappers is frozen/reference-only: no Phase 5 and no merge.

## Review boundary and handoff discipline

This Phase 0 review is documentation only: no production implementation, donor modifications, new POC/live combat tests or Foundry upgrade. Commit and push this review as **Finalize Phase 0 review and Phase 1 scope**.

Future steps must keep PROJECT_STATE.md and CHAT_HANDOFF.md aligned, distinguish static checks from live evidence, and update PROVEN_POC.md only when supported by independent evidence.
