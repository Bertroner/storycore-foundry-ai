# CODEX START PROMPT — STORYCORE FOUNDRY AI

You are working in the repository `storycore-foundry-ai`.

Read `AGENTS.md` first and obey it as the project contract.

## Goal

Design the minimal StoryCore ↔ Foundry V12 integration by harvesting proven architecture from the pinned reference projects in `_references/`.

The end-state is:

StoryCore
(memory / NPC personality / relationships / LLM / voice / media)
↕
StoryCore Foundry AI Adapter
(READ → NORMALIZE → LLM DECIDE → VALIDATE → COMMAND → OBSERVE)
↕
Foundry API Bridge
↕
Foundry VTT 12.343 + D&D5e 3.3.1 + Midi-QOL

Foundry/D&D5e/Midi remain authoritative for rules and live state.

## Critical runtime facts

The following have already been proven live. Do not re-litigate them unless source audit finds a direct incompatibility:

- API Bridge local bidirectional transport works.
- combat state/context, walls, LOS, Actors, Items, effects and scene tokens are readable.
- token movement/writes work.
- `dnd5e/activate-item` successfully executes a legacy imported D&D5e Scimitar with `hasActivities:false`.
- Midi-QOL auto-resolves attack/hit/damage and mutates Foundry HP.
- immediate `move-token` response coordinates may be stale; fresh readback is authoritative.
- Actor ID is stable; Token ID is scene-instance identity.
- explicit sceneId should be passed for scene/combat writes.
- random-distance melee/ranged POCs passed.
- wall avoidance POC passed.

## Reference projects

Inspect these source trees:

1. `_references/foundry-api-bridge`
2. `_references/foundry-ai-tool`
3. `_references/foundry-ai`
4. `_references/mookAI-12`
5. `_references/lib-find-the-path-12`
6. `_references/pf2e-ai-combat-assistant`

Treat PF2e AI Combat Assistant as architecture-only unless a clear reusable license is verified in its repository.

## Audit questions

For each donor identify exact files/classes/functions for:

- transport and request correlation;
- tool registry/function schema;
- Foundry query/command dispatch;
- D&D5e system adapter;
- Midi-QOL workflow capture;
- combat state gathering;
- normalized Actor/Item representation;
- turn state machine;
- targeting;
- movement/path planning;
- post-command observation/readback;
- error/timeout/reconnect handling;
- transaction/rollback patterns;
- event hooks;
- LLM prompt/tool-call loop;
- structured intent validation.

## Deliverables — documentation first

Create these files before production implementation:

### `docs/SOURCE_AUDIT.md`
Exact source map with repository pin, path, symbol and why it matters.

### `docs/COMPATIBILITY_MATRIX.md`
For every borrowed component classify:
- compatible with Foundry 12.343 as-is;
- adaptable;
- Foundry 13/14 only;
- system-specific;
- obsolete for us.

### `docs/REUSE_PLAN.md`
Table:
- REUSE
- ADAPT
- USE NATIVE FOUNDRY/API BRIDGE
- ARCHITECTURE ONLY
- DO NOT COPY

### `docs/WIRE_CONTRACT.md`
Minimal StoryCore ↔ adapter and adapter ↔ API Bridge envelopes.

### `docs/NORMALIZED_COMBAT_STATE.md`
A compact schema appropriate for an LLM. It must not expose giant raw Actor dumps.

Include:
- current combatant;
- actor core stats/resources;
- legal/available actions;
- nearby visible actors;
- IDs and scene/combat identity;
- LOS/distance;
- movement/path summary;
- conditions/effects;
- enough item metadata to choose an action.

### `docs/COMBAT_INTENT_SCHEMA.md`
Define strict structured LLM output, e.g.:
- target actor;
- action/item;
- movement goal;
- optional reasoning summary for logs only;
- no arbitrary JS/code.

Then define validator behavior.

## Design rule

The LLM decides **intent**.
Deterministic code validates legality and translates intent into Bridge commands.
D&D5e/Midi resolve the rules.

Do not replace the LLM's decision-making with hardcoded tactical AI such as:
`if distance > movement then use bow`.
Hardcoded rules may validate legality, but personality/tactics belong in StoryCore's LLM decision layer.

## Pathfinding

Do not permanently keep the temporary PowerShell/BAT pathfinder from the POCs.

Inspect API Bridge and V12 pathfinding donors. Propose the smallest Bridge extension that can return a path preview/plan without moving the token, for example:

`plan-token-path`

The final design should reuse one pathfinding implementation, not maintain a duplicate StoryCore A*.

## Stop point

After the six documentation deliverables are complete, summarize:
1. exact minimal production modules/classes to build;
2. what source is reused/adapted;
3. Foundry V12 compatibility risks;
4. the shortest implementation sequence.

Do **not** build the entire integration in the same pass unless explicitly instructed.
