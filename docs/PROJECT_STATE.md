# StoryCore Foundry AI — Project State

Last updated: 2026-08-31
Repository: `Bertroner/storycore-foundry-ai`
Branch: `main`
Baseline commit before this state file: `baad611a9fdb5f4abaddbc0bb5445415d7941be4`

## Current phase

**Phase 0 — Source harvest / architecture audit complete (2026-08-31).**

The six audit/design deliverables are complete: [SOURCE_AUDIT.md](SOURCE_AUDIT.md), [COMPATIBILITY_MATRIX.md](COMPATIBILITY_MATRIX.md), [REUSE_PLAN.md](REUSE_PLAN.md), [WIRE_CONTRACT.md](WIRE_CONTRACT.md), [NORMALIZED_COMBAT_STATE.md](NORMALIZED_COMBAT_STATE.md), and [COMBAT_INTENT_SCHEMA.md](COMBAT_INTENT_SCHEMA.md). All six donor tags/commits and licenses were inspected; donors remain unchanged. No production implementation or new live verification was performed.

Selected direction: reuse Bridge transport and its existing GridPathfinder; add a read-only path preview plus shared guarded movement, scoped effective-token Actor reads/activation, and matched Midi capture. Preserve legacy item.use. Current Bridge lacks declared scene scope on activation/context and uses an unfiltered next-workflow hook; production must not assume those safety features already exist.

Next step, in a separately requested implementation pass: contracts and BridgeSession in read-only fixture mode, then the sequence in REUSE_PLAN.md. The historical first-task instructions below describe the completed audit phase and should not trigger a repeat audit.

The experimental POC stage for basic melee/ranged execution is complete enough to stop writing throwaway BAT tests. The next task is to audit donor repositories and define the minimal production architecture before implementation.

## Mission

Build the StoryCore ↔ Foundry integration where:

- StoryCore owns narrative memory, NPC personality, relationships, LLM decisions, voice and generated media.
- Foundry VTT owns scene state, tokens, walls, LOS, combat tracker, Actors, Items, Compendiums and document state.
- D&D5e + Midi-QOL own D&D rules and combat resolution.
- The LLM outputs strict structured combat intents only; it never executes arbitrary JavaScript.

Core loop:

`READ → NORMALIZE → LLM DECIDE → VALIDATE → COMMAND → OBSERVE`

## Hard runtime constraints

- Foundry VTT: **Version 12 Stable — Build 343**
- D&D5e: **3.3.1**
- Midi-QOL: installed and proven in live tests
- Foundry API Bridge: installed and proven locally
- **Do not upgrade Foundry.**
- Do not redesign around Foundry 13/14 APIs.

## Proven live POC results

The following are already established and should not be re-tested without a concrete reason:

1. Local bidirectional StoryCore-like process ↔ Foundry API Bridge transport works.
2. `get-world-info` works against the live world.
3. Combat state/current turn can be read.
4. Scene tokens can be read and resolved by Actor ID.
5. Full Actor data, embedded Items and effects can be read.
6. Spell-slot/resource state is present in full Actor data.
7. Combat-turn context exposes grid position, nearby combatants, distance, LOS and wall-aware scene context.
8. Foundry walls block LOS and are visible through Bridge data.
9. Token writes and movement work.
10. Actor ID is stable entity identity; Token ID is scene-local/ephemeral and must be resolved at runtime.
11. Explicit `sceneId` should be supplied for combat/scene writes.
12. Immediate `move-token` response coordinates can be stale; fresh OBSERVE/readback is authoritative.
13. Goblin movement speed was read live from Actor data.
14. Wall avoidance was proven in live combat.
15. Movement-budget enforcement was proven.
16. Multi-turn movement continuation was proven.
17. `dnd5e/activate-item` successfully executes legacy imported D&D5e Items with `hasActivities:false`.
18. Midi-QOL successfully auto-resolved real Scimitar attacks.
19. Both hit and miss behavior were observed.
20. Foundry HP changed only when the attack actually hit; StoryCore must never apply `workflow.damageTotal` manually.
21. `workflow` is the useful Midi result surface even when native `rolls` is empty.
22. `next-turn` works.
23. Random-distance decision POC passed both branches:
    - legal melee route within movement → approach + Scimitar;
    - melee route beyond movement → Shortbow.
24. The random-distance POC proved decisions can be made *after* observing live state. The final product must not replace the LLM with those hardcoded tactical `if/else` rules.

## Architecture rules already decided

- Foundry is authoritative for live game state.
- D&D5e/Midi-QOL are authoritative for rules.
- StoryCore must not duplicate attack rolls, saves, damage, HP mutation, resistance, spell-slot consumption or other rules already owned by D&D5e/Midi.
- Do not build another generic command bus; reuse Foundry API Bridge.
- Do not duplicate the Compendium into StoryCore.
- Do not keep the temporary PowerShell/BAT pathfinder as final architecture.
- Prefer a Bridge/native path-preview capability so one pathfinding implementation is authoritative.
- LLM chooses intent/personality/tactics; deterministic code validates legality and executes through Bridge.
- Normalized state sent to the LLM must be compact; never send giant raw Actor dumps.

## Donor repositories to audit

Pinned donor sources are fetched into `_references/` and remain gitignored/read-only:

- `alexivenkov/foundry-api-bridge-module` @ `v8.11.2`
- `Gnuminator/Foundry-VTT-MCP-Ai-Tool` @ `v0.18.0`
- `derekhearst/FoundryAI` @ `1.3.0`
- `CircusGM/mookAI-12` @ `1.0.5`
- `CircusGM/lib-find-the-path-12` @ `2.0.5`
- `AI-DM-Foundry/AI-Combat-Assistant-Pf2e` @ `1.07`

Licensing rule:

- MIT code may be adapted with required notices.
- If a donor has no clear license, use it as architecture/behavior reference only and do not copy its source.

## Immediate next task

Run `scripts/01_FETCH_REFERENCES.ps1` (or the BAT wrapper) locally if `_references/` is not yet populated.

Then open the repository in Codex and give Codex the contents of `CODEX_START_PROMPT.md`.

Codex must first produce these six audit documents:

- `docs/SOURCE_AUDIT.md`
- `docs/COMPATIBILITY_MATRIX.md`
- `docs/REUSE_PLAN.md`
- `docs/WIRE_CONTRACT.md`
- `docs/COMBAT_INTENT_SCHEMA.md`
- `docs/NORMALIZED_COMBAT_STATE.md`

**Stop after the audit. Do not build the full integration in the same pass.**

## Expected minimal production direction after audit

Likely shape, subject to source audit:

```text
StoryCore
  memory / personality / relationships / LLM / voice / media
                       |
                       v
StoryCore Foundry AI Adapter
  sensors
  normalizer
  intent/tool schema
  validator
  executor
  observer
                       |
                       v
Foundry API Bridge
                       |
          Foundry V12 + D&D5e + Midi-QOL
```

## Frozen project

`storycore-combat-Mappers` is frozen as specification/reference/UX/test material. Do not begin its Phase 5 and do not merge it into this repository.

## Update discipline

At the end of each completed development step:

1. run relevant tests/build/checks;
2. update this file with the new phase, proven facts, risks and exact next step;
3. update `docs/CHAT_HANDOFF.md`;
4. commit;
5. push to `main` (or merge the reviewed working branch into `main`).

This file is the canonical current-state checkpoint for future chats and Codex sessions.
