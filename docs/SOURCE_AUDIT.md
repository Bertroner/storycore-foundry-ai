# Source audit — StoryCore Foundry AI

Audit date: 2026-08-31. Target: **Foundry 12.343, D&D5e 3.3.1, installed Midi-QOL**. Documentation only; no donor changes or live writes. [PROVEN_POC.md](PROVEN_POC.md) remains the live baseline. Source limitations below constrain generalization beyond those POCs; they do not invalidate the successful local transport, movement, wall avoidance, or legacy Scimitar activation.

## Pins and licensing

All six checkouts were clean and their exact tags matched. Source paths in this document are relative to the named donor root under _references/. The revision, not the current upstream branch, identifies the audited source.

| Key / local directory / repository | Tag | Exact HEAD | License evidence |
|---|---|---|---|
| B / foundry-api-bridge / alexivenkov/foundry-api-bridge-module | v8.11.2 | f71ea11b708d78c85c979ddae04d371be66e766e | LICENSE: MIT, copyright 2025 AI DM Project |
| T / foundry-ai-tool / Gnuminator/Foundry-VTT-MCP-Ai-Tool | v0.18.0 | bfbc93bf61a8d606b4efde76aaeda2bd1113bcb0 | LICENSE: MIT, copyrights 2026 Gnuminator and 2025 Adam Dooley |
| F / foundry-ai / derekhearst/FoundryAI | 1.3.0 | e06ba6a127b8eb12b24e87987f475aefbbe13aff | LICENSE: MIT, copyright 2026 Derek Hearst |
| M / mookAI-12 / CircusGM/mookAI-12 | 1.0.5 | 4cc9b1b11996e86338e4c6c592c427eba5c8b8de | LICENSE: MIT, copyright 2020 David Wonderley |
| P / lib-find-the-path-12 / CircusGM/lib-find-the-path-12 | 2.0.5 | 7450438fde2cbf6aab8867620e349cc3ee7081ed | LICENSE: MIT, copyright 2020 David Wonderley |
| A / pf2e-ai-combat-assistant / AI-DM-Foundry/AI-Combat-Assistant-Pf2e | 1.07 | 9a1c03d6e52f4dfd602a20bee6aebd97611845e4 | No license file/grant found in repository, README or manifest: architecture only |

Preserve full MIT copyright/permission/disclaimer notices with any future copied or substantially adapted code. Record donor path, pin, destination and changes in third-party notices at implementation time. T's LICENSE separately identifies restricted model and bundled binary licenses: no models, installers or binaries are selected. A's source and prompt text must not be copied. No production code was copied in this audit. Donors remain read-only and gitignored.

## B — Existing runtime, primary donor

| Area | Exact file: symbol | Finding and relevance |
|---|---|---|
| Wire | src/commands/types.ts: Command, CommandResponse, CommandType, CommandParamsMap, CommandResultMap | Request {id,type,params}; response {id,success,data?,error?}. Preserve these envelopes. |
| Transport/correlation | src/transport/WebSocketClient.ts: WebSocketClient.connect, send, handleMessage, isValidCommand, scheduleReconnect | Foundry is a WebSocket client receiving commands. Envelope checks are shallow. Responses retain ID via router. Disconnected send logs/drops; no replay. Reconnect defaults: 5 seconds exponential, 10 attempts, reset on open. |
| Dispatch/channels | src/commands/CommandRouter.ts: register, execute, hasHandler; src/main.ts: initializeWebSocket, createChannel | Existing bus. Channel URL includes apiKey query parameter; reply uses originating channel. Exceptions become string errors. Commands can overlap; no deduplication or transaction. |
| Hooks | src/main.ts: init, ready, renderSettingsConfig hook registrations | Lifecycle/settings hooks, not a general world-state event stream. |
| Version/world reads | src/commands/handlers/world/GetWorldInfoHandler.ts: getWorldInfoHandler | World ID, system ID/version and Foundry version; no Midi/module version/capability report. |
| Combat | src/commands/handlers/combat/GetCombatStateHandler.ts: getCombatStateHandler; combatTypes.ts: getActiveCombat, mapCombatToResult, mapCombatantToResult | Explicit combatId, ordered combatants/current IDs. Result omits combat's scene ID; proposed scope guard must verify it inside Foundry. |
| Turn context | src/commands/handlers/combat/GetCombatTurnContextHandler.ts: getCombatTurnContextHandler, chebyshevDistance | Combat selectable, scene always canvas.scene. Only combatant tokens; distance is grid Chebyshev. LOS tests sight collision; missing backend defaults true. One-cell centers even for large tokens. Not full perception. |
| Scene/walls | src/commands/handlers/scene/GetSceneHandler.ts: getSceneHandler; src/commands/handlers/wall/GetWallsHandler.ts: getWallsHandler; src/commands/handlers/scene/AsciiMapGenerator.ts: generateAsciiMap | Reuse reads. ASCII map, images and raw walls are not default LLM input. |
| Actor sensor | src/commands/handlers/actor/GetActorHandler.ts: getActorHandler | Uses game.actors.get(actorId); system is actor.getRollData(), items contain item.toObject(false).system. Not a complete raw document or necessarily the token's effective Actor. |
| Item sensor | src/commands/handlers/item/GetActorItemsHandler.ts: getActorItemsHandler, mapItemToSummary | Equipped, quantity, hasActivities, activity types, description, damage and range. Need Actor item payload for legacy activation/uses/consume details. hasActivities:false does not mean unusable. |
| Effects | src/commands/handlers/effect/GetActorEffectsHandler.ts: getActorEffectsHandler; effectTypes.ts: mapEffectToSummary | Actor-owned effects plus actor.statuses. Does not prove every transferred/suppressed applicable effect is included. |
| Token identity/readback | src/commands/handlers/token/GetTokenByActorHandler.ts: getTokenByActorHandler; GetTokenHandler.ts: getTokenHandler; GetSceneTokensHandler.ts: getSceneTokensHandler; tokenTypes.ts: mapTokenToDetail | Actor lookup picks first match. Resolve all candidates against current combatant instead. Token detail reads token Actor HP/AC but lacks full synthetic Actor resources and actorLink. |
| Activation boundary | src/commands/handlers/item/ActivateItemHandler.ts: activateItemHandler; src/systems/dnd5e/item-actions/validation/ActivateItemRequestSchema.ts: activateItemRequestSchema; RequestToCommandMapper.ts | Zod boundary, not strict unknown-key rejection. No declared sceneId/actingTokenId; sending them to this pin does not enforce scope. |
| D&D5e execution order | src/systems/dnd5e/item-actions/application/Dnd5eItemActivationService.ts: Dnd5eItemActivationService.activate | Set targets → arm Midi capture → activate → await capture. Preserve. activated:true alone does not prove completed rules resolution. |
| Legacy item use | src/systems/dnd5e/item-actions/infrastructure/Dnd5eItemActivationGateway.ts: Dnd5eItemActivationGateway.activate; activityResolver.ts: resolveActivity | World Actor/embedded Item lookup; no activity yields item.use(config). Directly supports proven legacy Scimitar behavior. Never require activities or separately apply damage. |
| Spell/template caveat | Same gateway: setupAutoTemplatePlace, activate | Activity-shaped spell.slot config and AbilityTemplate.drawPreview prototype patch; patch restores when preview runs. Legacy spell/template compatibility is unproven; exclude initially. Null use result still permits service activated:true. |
| Targets | src/systems/dnd5e/item-actions/infrastructure/Dnd5eTargetingGateway.ts: setTargets | Clears user's targets, resolves canvas.tokens, no restoration; partial failure may leave partial targets. Empty target list skips gateway and can retain old targets. |
| Midi capture | src/systems/dnd5e/item-actions/infrastructure/Dnd5eMidiWorkflowGateway.ts: captureNext, toMidiWorkflowOutcome; domain/ItemActivationOutcome.ts | Hooks.once('midi-qol.RollComplete'), 30-second timeout returns undefined. No actor/item/token/workflow match. Returns attack/damage totals and hit/save IDs, not workflow UUID. workflow is useful when rolls is empty. |
| Path search | src/commands/handlers/token/GridPathfinder.ts: findGridPath, isBlocked, reconstructPath, PathfinderConfig | Existing A*: 8 neighbors, Chebyshev heuristic, cost 1 per cell by default, 2,500-node cap. Pixel top-left waypoints exclude start. getCellCost exists but movement does not supply it. Null combines exhaustion/no route. |
| Movement/readback | src/commands/handlers/token/MoveTokenHandler.ts: moveTokenHandler, isDirectPathBlocked, moveAlongPath, moveDoorAware, moveAlongPathWithDoors | Native move collision + B A*. Canvas grid/backend can mismatch requested scene. Missing backend falls through to direct update. No remaining-movement guard. Direct route may omit pathCost. Fresh caller readback remains mandatory. |
| Doors | src/commands/handlers/token/DoorAwareCollision.ts: createDoorAwareCollision, findDoorsAlongPath; movement helpers above | Optional movement opens doors; preview must not call write helpers. First profile disables door opening. |
| Turn advance | src/commands/handlers/combat/NextTurnHandler.ts: nextTurnHandler | Native combat.nextTurn(), combatId only; no expected-turn or scene guard. Repeated request advances repeatedly. |
| Versions | src/compat/foundryVersion.ts: foundryGeneration, isV14Plus; tracked dist/module.json | Minimum 11, verified 14. V14 branches do not make the proven V12 path V14-only. Preserve V12 behavior. |

Absent in B: StoryCore LLM loop, NPC intent validator, read-only plan-token-path command, atomic move+attack, durable request ledger, authoritative action-economy tracker, general push/readback protocol. Do not confuse command correlation with workflow correlation or idempotency.

## T — Backend/schema patterns, not another runtime

| Area | Exact file: symbol | Finding and use |
|---|---|---|
| Transport/correlation/errors | packages/mcp-server/src/foundry-connector.ts: FoundryConnector.start, query, handleMessage, stop, pendingQueries | ID→promise/timer map; 10-second timeout; pending queries rejected/cleared on disconnect/stop. Adapt pattern, not WebRTC/HTTP stack or Midi timeout. |
| Client boundary | packages/mcp-server/src/foundry-client.ts: FoundryClient.connect, query | Thin transport facade; useful shape for BridgeSession. |
| Backend/registry | packages/mcp-server/src/backend.ts: startBackend; tool-router.ts: buildToolRouter, ToolRouterDeps | Dependency-injected null-prototype name→handler registry. Reuse idea with a very small StoryCore allowlist. |
| Function schema/validation | packages/mcp-server/src/tools/combat.ts: CombatTools.getToolDefinitions, handleAdvanceCombatTurn; shared/src/schemas.ts: MCPQuerySchema, MCPResponseSchema, CharacterInfoSchema, CharacterItemSchema | Function declarations plus runtime parsing. Generic system objects are not compact combat DTOs. |
| Wire | shared/src/protocol.ts: ControlRequestSchema, CallToolParamsSchema, FoundryQueryFrame, FoundryResponseFrame, FoundryFrameSchema | Separate control and Foundry framing. Its {type,id,data:{method,data}} is not API Bridge's envelope. |
| Foundry dispatch/reconnect | packages/foundry-module/src/queries.ts: QueryHandlers.registerHandlers, withGmGate, validateGMAccess; socket-bridge.ts: SocketBridge, scheduleReconnect | CONFIG.queries and separate socket/WebRTC bridge. Runtime targets V13–14. Access policy can allow non-GMs; do not inherit it. |
| D&D5e projection | packages/mcp-server/src/systems/dnd5e/adapter.ts: DnD5eAdapter.getDataPaths, extractCharacterStats; systems/system-registry.ts: SystemRegistry | Field projection pattern; do not inherit defaults turning missing HP/abilities into plausible values. |
| Actor/Item cards | packages/foundry-module/src/data-access/characters.ts: CharacterDataAccess.getCharacterInfo, summarizeItem, summarizeEffect, searchCharacterItems | Summary/detail split. summarizeItem still includes sanitized whole system; reduce further. |
| Combat/readback | packages/foundry-module/src/data-access/combat.ts: CombatDataAccess.getCombatState, summarizeCombatant, advanceCombatTurn | Compact current combatant/native advance. actedThisRound is index-derived, not D&D action economy. |
| Movement/targets | packages/mcp-server/src/tools/movement.ts: MovementTools; tools/token-manipulation.ts: TokenManipulationTools; packages/foundry-module/src/data-access/scenes-tokens.ts: ScenesTokensDataAccess | Position/distance/target and token command surface. Not selected as replacement path engine. |
| Transactions | packages/foundry-module/src/transaction-manager.ts: TransactionManager.startTransaction, addAction, commitTransaction, rollbackTransaction, revertAction | Reverse-order best-effort compensation collects failures; limited Actor/Token operations, token undo uses current scene. Not ACID or combat rollback. Study journaling only. |
| Events/observations | packages/foundry-module/src/session-events.ts: EventTracker.registerHooks, onUpdateActor, onUpdateCombat, onActiveEffect, getSessionLog, buildPlayByPlay | Bounded event history/cache ideas. Chat-derived damage/source inference is not Midi proof. |
| LLM subsystem | packages/cogm-dashboard/src/ai/anthropic-co-gm.ts: CoGm | Separate dashboard AI/commentary, not selected for StoryCore decisions. Tool registry alone is not a turn planner. |

No strict StoryCore combat-intent validator or matching Midi capture port identified in the selected T path. Direct damage/resource/effect tools are excluded from StoryCore's LLM interface.

## F — LLM call/result loop

| Area | Exact file: symbol | Finding and use |
|---|---|---|
| Model transport | src/core/openrouter-service.ts: ToolDefinition, ToolCall, LLMMessage, OpenRouterService.chatCompletion, chatCompletionStream | Provider messages/stream fragments and AbortSignal, not Foundry transport. Keep StoryCore's existing provider. |
| Tool registry/dispatch | src/core/tool-system.ts: TOOL_DEFINITIONS, getEnabledTools, executeTool | JSON function definitions/name dispatch. JSON.parse alone is not strict validation; broad mutation/macro surface excluded. |
| Actual prompt/tool loop | src/ui/components/ChatWindow.svelte: handleStreamingResponse, handleNonStreamingResponse, handleToolCalls | Accumulate fragments, pair results by tool_call_id, continue with results. maxToolDepth can be disabled; tool calls run in Promise.all. Adapt to finite, sequential decisions; never parallel writes. |
| Actor/combat normalization | src/core/collection-reader.ts: CollectionReader.extractActorContent, getCombatContext, getCurrentSceneInfo | Human-readable context/retrieval, not a strict state schema. |
| Prompt | src/core/system-prompt.ts: buildSystemPrompt, buildActorRoleplayPrompt | Separation of instruction/context. No donor memory/RAG/personality subsystem required; StoryCore owns these. |
| Movement/target commands | src/core/tool-system.ts: handleMoveToken, handleTokensInRange, handleNextTurn | Generic scene operations, no selected wall-aware path planner. |
| Excluded rules/code | src/core/tool-system.ts: handleApplyDamage, handleApplyCondition, handleExecuteMacro | Do not expose rules mutation or executable code to LLM. |
| Hooks/errors | src/module.ts: lifecycle hook registrations; executeTool and chatCompletion above | Local lifecycle and error handling; no selected combat rollback, Bridge reconnect/readback, or Midi workflow correlation. |

module.json minimum/verified/maximum are all 13. No wholesale runtime/UI reuse on V12. No dedicated strict structured combat-intent validator or autonomous turn state machine selected; adapt the LLM feedback loop only.

## M — Turn execution concepts

| Area | Exact file: symbol | Finding and use |
|---|---|---|
| State machine/errors | scripts/mook.js: Mook.startTurn, sense, planTurn, act, Abort; scripts/mookAI.js: MookAI, ready, busy | Sense/plan/action queue, bounded attempts, abort/busy state. Use lifecycle concept in serialized runner. |
| Hooks/readback hints | scripts/mookAI.js: MookAI.ready, handleSceneChange; scripts/mook.js: handleTokenUpdate | Token, combat/combatant and scene changes can invalidate execution. Not a durable observation protocol. |
| Targeting/tactics | scripts/behaviors.js: Behaviors.chooseTarget, attackByDistance, attackByCurrentHealth, surprise; scripts/mook.js: target, clearTargets, canSee, viableTargets (getter) | Hardcoded tactics and PC-only sensing must not become StoryCore decision logic. Target cleanup is separable. |
| Actor/action representation | scripts/mookModel.js: MookModel, MookModel5e, startTurn, recordMovement, attack, doAttack; scripts/mookModelSettings.js: MookModelSettings5e | Caches actions/movement/attacks with system assumptions; direct item/BetterRolls path is not our proven Midi activation pipeline. Do not copy rules/action counts. |
| Movement | scripts/mook.js: sense, planTurn, act (PathManager/FTPUtility usage) | Plan then traverse; useful separation, not a second path stack. |

No remote transport/correlation, function-schema registry, LLM loop, strict structured validator or combat transaction/rollback. Manifest minimum 12, verified 12.331, maximum 13; V12-targeted, not live-tested here on 12.343.

## P — Pathfinding comparison

| Area | Exact file: symbol | Finding and use |
|---|---|---|
| Search/preview | scripts/pathManager.js: Path.findPath, within, unwind; PathManager.pathFromData, pathToSegment, addToken, pointsWithinRange, pointsWithinRangeOfToken | Path construction separate from traversal, target caches, two-second search cutoff and partial/budget concepts. Check valid before claiming destination reached. |
| Geometry | scripts/point.js: Point, Segment, PointFactory, MinkowskiParameter | Footprints and metrics; PF2e diagonal accounting must not be imported into D&D rules. |
| Collision/target geometry | scripts/utility.js: FTPUtility.collision, isTraversable, los, losCenter | Occupancy whitelist concept useful. Traversability los uses sight collision, not move collision. Constructor creates canvas highlight layer, so not entirely side-effect-free. |
| Execution | scripts/utility.js: FTPUtility.moveTokenToSegment, traverse | Token updates, waits, control/rotation/highlights. Not selected as separate executor. |

Manifest minimum 12, verified 12.331, maximum 13. No network/tool registry, LLM loop, Actor/Item cards, D&D5e/Midi gateway, combat state machine, event journal or rollback. **Select existing B A*, not P's alternative.** P supplies comparison cases for bounds, occupancy, footprint, partial routes and preview purity.

## A — PF2e, architecture only

All symbols below are in scripts/main.js. No code/prompt copied.

| Area | Exact symbols | Architectural observation |
|---|---|---|
| Combat/Actor/Item state | gatherGameState, nested formatSpellForPrompt, summarizeAbilityDetails, _extractSpellDetails | Self/others/actions and descriptive metadata before prompt; PF2e ranks, MAP and action budgets are system-specific. |
| Turn/LLM loop | requestNextAISuggestion, craftSingleActionPrompt, craftTurnSummaryPrompt, callLLM | One suggestion, interim outcomes/manual notes, then another suggestion. Feedback shape is useful. |
| Structured parsing/validation | parseLLMSuggestion, identifySuggestionTypeAndCost, determineAuthoritativeCost, isAbilityOnCooldown, isSpellAvailable | Regex/fallback parsing of labeled text; missing cost may default to one. Not strict JSON validation; do not port. |
| Targeting/execution | _onConfirmActionClick, _onExecuteStrikeClick, _onCastSpellClick, _onSkipActionClick, _onEndTurnClick | Human-mediated, PF2e-specific execution. Use IDs in our protocol, not prose/name rematching. |
| Observation/hooks | handleChatMessage; updateCombat, deleteCombat, deleteCombatant, createChatMessage hook registrations | Turn history, interim results and cleanup. Chat content is context, not transaction proof. |
| Error/retry | callLLM, _onRetryTurnClick | HTTP errors/retry UI, no Bridge correlation/reconnect or durable idempotency. |

No reusable V12 D&D5e/Midi adapter, independent path engine, generic command bus, strict function registry or transactional rollback selected. module.json: minimum 12, verified 12.331, PF2e >=6.0.0. Foundry compatibility does not imply D&D5e compatibility.

## Findings driving the design

1. **One bus, one pathfinder.** Keep Bridge transport/router/native activation; expose its existing path engine through a read-only handler. No second MCP runtime or StoryCore A*.
2. **Scope needs actual validation.** Existing move-token has sceneId; context/activation do not, next-turn has combatId only. Proposed fields must be declared/implemented, not silently sent to old handlers. Fail on canvas mismatch; never automatically switch the GM's scene.
3. **Actor identity differs from instance state.** Preserve base Actor ID for StoryCore identity; resolve scene token and use its effective Actor for resources/items. V12 distinguishes linked and synthetic Actors. [V12 TokenDocument.actor](https://foundryvtt.com/api/v12/classes/client.TokenDocument.html#actor).
4. **Match Midi workflows.** Serializing adapter writes cannot prevent a human/module's unrelated completion event. Match actor, item, acting token and workflow identity where available; ambiguous/missing capture pauses execution.
5. **Geometry is not complete legality.** Wall LOS is not full perception; A* cost is not remaining movement. Native resources/conditions/rule validation remain authoritative. Missing values stay unknown.
6. **Measure a route natively.** V12 BaseGrid.measurePath measures supplied waypoints; it does not find wall-avoiding routes. Use it on B's route; never interpret raw A* grid-step cost as feet. [V12 BaseGrid.measurePath](https://foundryvtt.com/api/v12/classes/foundry.grid.BaseGrid.html#measurePath).
7. **No combat rollback.** Partial moves and lost responses are possible after resource/HP changes. Journal stages, read back and pause; never restore HP/resources from snapshots or replay an uncertain attack.

See [COMPATIBILITY_MATRIX.md](COMPATIBILITY_MATRIX.md), [REUSE_PLAN.md](REUSE_PLAN.md), [WIRE_CONTRACT.md](WIRE_CONTRACT.md), [NORMALIZED_COMBAT_STATE.md](NORMALIZED_COMBAT_STATE.md), and [COMBAT_INTENT_SCHEMA.md](COMBAT_INTENT_SCHEMA.md).

