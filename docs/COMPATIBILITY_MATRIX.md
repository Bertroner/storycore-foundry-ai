# Compatibility matrix

Target is fixed at **Foundry V12 build 343 + D&D5e 3.3.1 + installed Midi-QOL**. Never upgrade Foundry or redesign around V13/14 APIs. Donor IDs, exact revisions and license evidence are in [SOURCE_AUDIT.md](SOURCE_AUDIT.md).

Classifications: **compatible as-is** means the selected surface fits V12 under stated scope (live evidence only where indicated); **adaptable** needs a change/guard; **Foundry 13/14 only** describes donor runtime support, not every pure helper; **system-specific** needs the named system; **obsolete for us** is redundant or violates project ownership. Categories may overlap. Static inspection is not a live compatibility test.

## Manifest evidence

| Donor | File | Minimum / verified / maximum | Consequence |
|---|---|---|---|
| B | dist/module.json (tracked) | 11 / 14 / unspecified | V12 lies within declared range; proven POCs confirm selected paths, not every command. |
| T | packages/foundry-module/module.json | 13 / 14 / 14 | Do not install its Foundry runtime on V12. |
| F | module.json | 13 / 13 / 13 | Do not install its runtime/UI on V12. |
| M | module.json | 12 / 12.331 / 13 | V12-targeted, but no new 12.343 testing performed here. |
| P | module.json | 12 / 12.331 / 13 | V12-targeted alternative engine; not needed as another dependency. |
| A | module.json | 12 / 12.331 / unspecified; PF2e >=6.0.0 | System-specific and unlicensed for copying, regardless of Foundry generation. |

## Components

| Component (exact source symbols in audit) | Classification | Decision / required constraint |
|---|---|---|
| B WebSocketClient + CommandRouter + Command/CommandResponse | Compatible as-is | Preserve proven transport. Add caller correlation/timeout ledger, not another command bus. No native exactly-once guarantee. |
| B createChannel dual channels | Compatible as-is, scoped | One authorized adapter session/writer; do not send the same write through both channels. Redact query API key. |
| B world/combat/scene/token/wall reads | Compatible as-is, scoped | Proven reads. Explicit IDs where accepted; current combat response lacks scene binding. |
| B getActorHandler / getActorItemsHandler / getActorEffectsHandler | Compatible as-is for world Actors; adaptable for instances | Legacy fields available; full effective token Actor resources/effects need scope extension. Do not claim raw payload equals complete document. |
| B getTokenByActorHandler | Adaptable usage | First-match lookup cannot resolve repeated Actor instances safely. Enumerate scene tokens and use combatant identity. |
| B getCombatTurnContextHandler | Adaptable | Current canvas dependency, combatants-only list, wall LOS, simple distance/centers. Add explicit scene/current-token scope and perception completeness; do not copy default-true LOS. |
| B Dnd5eItemActivationService / Gateway legacy item.use | Compatible as-is for proven POC; system-specific; adaptable for production scope | Preserve legacy path with hasActivities:false. Add acting-token effective Actor lookup and explicit scene/turn guards without changing D&D resolution. |
| B resolveActivity activity.use branch | System-specific, adaptable | Not a requirement for D&D5e 3.3.1. Omit selectors for legacy items. Activities-only donors are not the primary path. |
| B spell-level config / setupAutoTemplatePlace | System-specific, adaptable | Activity-era config/prototype patch not proven with legacy spells. Disable auto spells/templates until targeted native compatibility evidence exists. |
| B Dnd5eTargetingGateway | Adaptable | Pre-resolve targets, scene guard, clean/restore shared target state in finally; avoid empty-target inheritance. |
| B Dnd5eMidiWorkflowGateway | Adaptable | Capture-before-use is correct; next global event is not enough. Match actor/item/token/workflow; report timeout/cancel distinctly and retain provenance. |
| B GridPathfinder.findGridPath | Adaptable | Reuse sole search engine. Square-grid/flat/uniform-cost initial profile. Add bounds/occupancy inputs and explicit search-limit status; no second A*. |
| B MoveTokenHandler | Adaptable | Share preview/planner; require ready matching canvas, collision backend and budget. Fresh readback, segment revalidation, no door auto-open. Never fall through to unchecked direct move. |
| B DoorAwareCollision / door movement | Obsolete for us initially; adaptable later | Door interaction is an additional world action, not a hidden preview effect. Keep disabled. |
| B NextTurnHandler | Compatible native operation; adaptable guard | Explicit combatId plus proposed scene/expected-turn guard. No retry after uncertain dispatch. |
| B foundryGeneration / isV14Plus | Compatible as-is | Leave V12 branch intact; presence of newer branches is not a mandate to upgrade. |
| B macros/raw rules/document write command surface | Obsolete for us | LLM gets none of this generic power. No roll-attack plus roll-damage plus HP writes. |
| T FoundryConnector pendingQueries / FoundryClient | Adaptable (pure backend pattern) | Adapt ID map, cleanup, timeout behavior to B envelope; no donor wire or WebRTC stack. |
| T buildToolRouter / tool definitions / shared schemas | Adaptable (pure protocol pattern) | Small explicit registry and strict schemas derived from one contract. No full generic tool catalogue. |
| T QueryHandlers / SocketBridge runtime | Foundry 13/14 only | Architecture study; CONFIG.queries and runtime bootstrap not ported. |
| T DnD5eAdapter.extractCharacterStats / CharacterDataAccess | System-specific, adaptable | Project measured fields; missing stays null. Do not ship whole sanitized system object. |
| T CombatDataAccess / EventTracker | Adaptable architecture; runtime Foundry 13/14 only | Summary/readback/invalidation concepts, no inferred action economy or chat-based authoritative damage. |
| T TransactionManager | Adaptable architecture; obsolete as combat rollback | Best-effort compensation, limited document support. No rollback around Midi. |
| T movement/target tools and damage/effect tools | Obsolete for us | Existing Bridge/native stack already owns these. |
| T dashboard AI / map generation / installer | Obsolete for us | StoryCore owns LLM/media; separately licensed bundle assets not selected. |
| F ToolDefinition / ToolCall / result association / bounded loop | Adaptable | Framework-independent protocol ideas, finite cap, sequential writes, strict intent parsing. No new provider service. |
| F CollectionReader summaries | Adaptable | Compactness ideas, not giant dumps or a replacement memory database. |
| F Foundry/Svelte runtime | Foundry 13/14 only (specifically 13) | Do not port UI/module bootstrap. |
| F generic mutation/macro tools | Obsolete for us | No arbitrary code, raw HP/damage/effects/tools exposed to decisions. |
| M startTurn/sense/act/Abort/busy and hooks | Adaptable | Lifecycle only; use fresh state and ID guards rather than copying cached tactics. |
| M Behaviors / MookModel5e / BetterRolls use | System-specific; obsolete for us | Hardcoded targeting/action economy violates LLM and D&D/Midi authority split. |
| P Path/PathManager/PointFactory | Adaptable alternative, not selected | MIT and V12, but replacing/adding B pathfinder increases scope. Study edge cases only. |
| P FTPUtility traversability/execution | Adaptable, not as-is | Uses sight collision and canvas highlights; cannot be assumed pure movement preview. |
| A gatherGameState / single-suggestion loop | System-specific; architecture only | Conceptual feedback loop only; no source/prompt reuse without license. |
| A parsing, PF2e MAP/ranks/actions, UI/execution | System-specific; obsolete for us | No D&D rules port, regex intent parser or source copying. |

## Production gates, not repeated POC questions

- Read and record the **installed** Bridge and Midi versions/configuration; donor pin is not proof that live installation is byte-identical. Do not rerun basic transport or Scimitar proofs without a concrete mismatch.
- New scope/capability response must verify combat.scene, canvas.scene, readiness, GM session, actorLink/effective Actor and extension version. Missing capability means read-only mode.
- Actor ID remains narrative identity. Unlinked tokens need token-scoped reads and activation; multiple instances need combatant/token disambiguation, never first-match selection.
- Retain wall LOS as a labeled geometry fact. Full actor perception (light, blindness, invisibility, detection modes) needs a V12 native sensor or explicit supported fixture; GM visibility is not NPC visibility. Unknown perception is not permission to target.
- First path profile: grid-aligned 1×1 token, flat square grid, native-measured uniform distance, normal terrain, walking, no doors and no occupied cells. Reject unsupported terrain/diagonals/footprints/elevation instead of inventing rules.
- Walking speed is capacity, not remaining turn budget. Only use a native/verified turn-budget source or an exclusive, externally initialized execution lease with observed bookkeeping. Mid-turn attachment/manual changes/reconnect invalidate unknown budgets.
- First action profile: one supported single-target legacy item activation. Native rules remain responsible for rolls, saves, damage, consumption and effects. Multiattack, reactions, bonus-action interactions and spells require native availability evidence before being advertised automatic.
- Shared user targets/global Midi hooks require serialized adapter execution and matching capture. Humans/other modules can still act; conflicting observations invalidate the decision.
- No general atomic snapshot or compare-and-swap exists in B. Proposed guarded operations narrow races but do not make Foundry database transactions or make HP/resource rollbacks safe.

Verification scope for the audit: static sources/manifests and existing recorded live facts. No runtime upgrades, builds in donor trees, dependency installs, combat writes or new POC claims.

