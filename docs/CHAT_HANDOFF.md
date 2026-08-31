# StoryCore Foundry AI — Chat Handoff

This file exists so a new ChatGPT/Codex session can continue the project without reconstructing history from memory.

## Audit checkpoint — 2026-08-31

The six source-audit/design documents are complete; begin with [SOURCE_AUDIT.md](SOURCE_AUDIT.md) and [REUSE_PLAN.md](REUSE_PLAN.md). The latter contains the exact minimal modules, Bridge patch seams, compatibility gates and implementation order. Existing POC facts remain preserved. No production code, donor changes, new live combat tests or Foundry upgrades were made. Proposed wire extensions are explicitly distinct from the current Bridge API. Stop after documentation unless implementation is requested.

## Start here

Repository: `https://github.com/Bertroner/storycore-foundry-ai`
Branch: `main`

Read these files in order:

1. `AGENTS.md`
2. `docs/PROJECT_STATE.md`
3. `docs/PROVEN_POC.md`
4. `docs/ARCHITECTURE_TARGET.md`
5. `docs/REFERENCE_MATRIX.md`
6. `CODEX_START_PROMPT.md`
7. latest commits on `main`

Treat `docs/PROJECT_STATE.md` as the canonical current checkpoint.

## What this project is

StoryCore is the narrative/AI/memory layer. Foundry VTT is the live tabletop/rules state. D&D5e + Midi-QOL are authoritative for combat resolution.

Target loop:

`READ → NORMALIZE → LLM DECIDE → VALIDATE → COMMAND → OBSERVE`

The LLM chooses structured intent. It must never execute arbitrary JavaScript in Foundry.

## Non-negotiable runtime

- Foundry VTT **12 Stable Build 343**
- D&D5e **3.3.1**
- Midi-QOL installed and proven
- Foundry API Bridge installed and proven
- **Never upgrade Foundry as part of this project.**

## Important POC conclusions

Do not restart basic experiments unless there is a concrete bug:

- local Bridge read/write works;
- Actor/Items/effects/combat context can be read;
- walls/LOS can be read;
- movement works;
- wall avoidance works;
- movement budgets work;
- multi-turn continuation works;
- `dnd5e/activate-item` + Midi-QOL performs real attacks;
- HP mutation is authoritative in Foundry;
- melee and ranged branches both passed when starting distance was unknown until runtime;
- immediate move responses may contain stale coordinates, so always re-read state after writes;
- Actor ID is stable, Token ID is scene-instance identity;
- explicit `sceneId` should be used for writes.

The random-distance POC was only proof that a decision can be made from live observed state. Do **not** hardcode tactical AI as `if distance > movement then bow` in the final product. StoryCore's LLM is the decision-maker; deterministic code only validates and executes legal intents.

## Current phase

**Architecture/source audit before production implementation.**

Donor source is expected under local gitignored `_references/` using `scripts/01_FETCH_REFERENCES.ps1`.

Pinned donors:

- Foundry API Bridge v8.11.2
- Foundry AI Tool v0.18.0
- FoundryAI 1.3.0
- mookAI-12 1.0.5
- lib-find-the-path-12 2.0.5
- PF2e AI Combat Assistant 1.07

Codex must first create:

- `docs/SOURCE_AUDIT.md`
- `docs/COMPATIBILITY_MATRIX.md`
- `docs/REUSE_PLAN.md`
- `docs/WIRE_CONTRACT.md`
- `docs/COMBAT_INTENT_SCHEMA.md`
- `docs/NORMALIZED_COMBAT_STATE.md`

Then stop and summarize the minimal production implementation plan.

## Rules for future work

- Reuse Foundry API Bridge; do not build another generic command bus.
- Reuse D&D5e/Midi; do not implement D&D combat rules in StoryCore.
- Do not duplicate Compendium/effect engines.
- Do not keep the temporary PowerShell pathfinder as final production architecture.
- Prefer a thin Bridge/native path-preview extension over a second StoryCore A*.
- Keep LLM input compact and normalized.
- MIT donor code may be adapted with required notices; unclear-license source is architecture-only.
- `storycore-combat-Mappers` is frozen/reference-only; do not start Phase 5.

## End-of-step handoff discipline

After every completed step, update both:

- `docs/PROJECT_STATE.md`
- `docs/CHAT_HANDOFF.md`

Then commit and push. A future chat should never have to infer the current phase from conversation history alone.
