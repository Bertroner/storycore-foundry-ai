# StoryCore Foundry AI — Codex Rules

## Mission

Build the StoryCore ↔ Foundry integration where:

- StoryCore owns narrative memory, NPC personality, relationships, LLM decisions, voice, and generated media.
- Foundry VTT is authoritative for scene state, tokens, walls, LOS, combat tracker, Actors, Items, Compendiums and documents.
- D&D5e + Midi-QOL are authoritative for D&D combat resolution.
- The LLM produces structured intents only. It must never execute arbitrary JavaScript in Foundry.

## Hard runtime constraints

- Foundry VTT: **Version 12 Stable — Build 343**
- D&D5e: **3.3.1**
- Midi-QOL: installed and already proven in live tests
- Foundry API Bridge: installed and proven locally
- **NEVER upgrade Foundry as part of this project.**
- Do not redesign the project around Foundry 13/14 APIs.

## Proven live facts — preserve them

1. Local bidirectional API Bridge transport works.
2. `get-world-info`, combat state, scene tokens, full Actor data, embedded Items, effects and combat-turn context work.
3. Foundry walls affect LOS and are visible through the Bridge.
4. Token writes/movement work.
5. `dnd5e/activate-item` executes legacy D&D5e Items with `hasActivities:false` through the D&D5e/Midi pipeline.
6. Midi-QOL has auto-resolved real Scimitar attacks and changed Foundry HP.
7. After writes, fresh readback is authoritative. Do not trust immediate write-response coordinates as final state.
8. `workflow` is authoritative for Midi combat results; native `rolls` may be empty.
9. Stable identity rule:
   - Actor ID = stable entity identity.
   - Token ID = scene-local instance identity and must be resolved at runtime.
10. Pass explicit `sceneId` for combat/scene writes instead of relying on active scene.
11. A wall-aware approach, movement, melee/ranged decision and real Midi attack have all been proven in POC scripts.
12. StoryCore must not calculate attack rolls, damage, saves, HP mutation, spell-slot consumption, resistance or other D&D rules that D&D5e/Midi already own.

## Architectural target

READ → NORMALIZE → LLM DECIDE → VALIDATE → COMMAND → OBSERVE

The normalized combat state must be compact. Never send raw multi-thousand-line Actor dumps directly to the LLM.

Conceptual split:

- Actor/card sensor → what the NPC can do.
- Combat context → what/who it sees and current distances/LOS.
- Path planning → where it can legally move.
- D&D5e/Midi-QOL → what happens under the rules.
- StoryCore memory/personality → why the NPC chooses one legal option over another.

## Reference-source policy

External repositories are fetched under `_references/` and are read-only donors.

Preferred donors:
- alexivenkov/foundry-api-bridge-module — command bus / D&D5e adapter / item activation.
- Gnuminator/Foundry-VTT-MCP-Ai-Tool — backend/tool registry/wire-contract architecture.
- derekhearst/FoundryAI — LLM tool/function-calling architecture.
- CircusGM/mookAI-12 — turn state-machine/execution ideas.
- CircusGM/lib-find-the-path-12 — V12 pathfinding reference.
- AI-DM-Foundry/AI-Combat-Assistant-Pf2e — architecture/behavior study only unless license is separately verified.

Do not copy code from a repository without recording and respecting its license.
MIT code may be adapted with required notices.
If a repo has no clear license, treat its source as architectural reference only.

## First Codex phase

Do a **source audit before writing production code**.

Create:
- `docs/SOURCE_AUDIT.md`
- `docs/COMPATIBILITY_MATRIX.md`
- `docs/REUSE_PLAN.md`
- `docs/WIRE_CONTRACT.md`
- `docs/COMBAT_INTENT_SCHEMA.md`
- `docs/NORMALIZED_COMBAT_STATE.md`

Do not implement the full integration before the audit is complete.

## Do not reinvent

Do NOT create:
- another generic Foundry command bus;
- another complete D&D rules engine;
- another Compendium database;
- another Midi replacement;
- another full effects engine.

Only add the StoryCore-specific adapter, normalizer, validator, decision protocol, and thin extensions missing from the Bridge.

## Combat Mappers

The old StoryCore Combat Mappers project is frozen/reference material only.
Do not begin its Phase 5.
Do not merge it into this project.
