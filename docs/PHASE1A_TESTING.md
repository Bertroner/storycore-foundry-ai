# Phase 1A — Windows testing

Implemented boundary: READ → NORMALIZE → REAL OpenRouter request → strict decision validation → stored dry-run result. **No Foundry writes exist in this runtime.** Production entry points cannot select a mock provider; test doubles exist only in tests/.

Current checkpoint: real live read -> normalization -> Qwen tactical response is proven; full Phase 1A acceptance remains OPEN. The operator-reported evidence and unresolved issues are recorded below. This checkpoint performs verification/documentation only, with no new live run or production change.

## Install and start

Use PowerShell in the repository. Verified locally with Node 24.15.0, npm 11.12.1 and Windows PowerShell for DPAPI. Node >=22.14 is required; no global software is installed by this project.

~~~powershell
Set-Location C:\StoryCore-Dev\storycore-foundry-ai
npm ci
npm run check
npm run dev
~~~

npm run check runs typecheck, all regression/unit tests and build. npm run dev builds and opens the Electron desktop window directly. npm start also launches Electron using the last build. No Chrome/external browser is required and the old HTTP settings page is removed. Keep the development terminal running; use the window to configure and test the adapter. The first launch after dependency installation may download/unpack the project-local Electron binary; allow it to finish. No globally installed Electron is required.

The app has one window and one trusted backend. Only the Bridge WebSocket listener remains on 127.0.0.1:3210; a tiny /health endpoint contains no settings/state. Do not expose the port through a proxy/tunnel or LAN binding. If port 3210 is occupied by the old adapter, stop that adapter before launching Electron; the app reports a safe startup error rather than taking over another process.

## Settings and connection test

1. Expand **Connection settings (keys and model)** if needed. In the desktop window, paste the OpenRouter key into its masked password field. Never paste it into chat, Foundry settings, source or a shell command.
2. Keep or edit the model ID. Default: qwen/qwen3-30b-a3b-instruct-2507; temperature 0.25; max output 700 tokens.
3. Enter a separate local Bridge key, at least 16 characters. You may preserve the already saved Bridge key by leaving its field blank. This is not the OpenRouter key.
4. Click **Save settings**. Main validates/encrypts/stores newly typed keys; the submitted fields clear only after success, confirmed by SETTINGS_SAVED and a Saved on this PC label beside each stored key. On failure, unsaved typed values remain for correction; a short Bridge key gets a specific explanation. Edits made while saving are not cleared. Blank fields preserve existing values. The UI exposes only hasOpenRouterKey/hasBridgeKey, never stored plaintext or encrypted blobs. Status refresh never fills or overwrites a typed key.
5. Click **Test OpenRouter**. It uses the saved settings in main and sends a tiny real request (up to 24 output tokens), independent of Foundry. It reports success/failure, selected model, latency and a safe error code. It does not prove combat sensing or structured decisions.

The Show/Hide buttons reveal only the currently typed unsaved value. They cannot reveal a stored key. Electron uses an isolated app session, not the user's Chrome profile or password manager; defensive new-password/off semantics are also present. No passwords are generated automatically.

Keys remain encrypted with Windows DPAPI CurrentUser in %LOCALAPPDATA%\StoryCoreFoundryAI\settings.json, with the same format/path as the previous UI. Existing saved keys are reused without migration. Main sends DPAPI helper data through stdin, never process arguments. Local processes running as your Windows user can decrypt it; this is not isolation from a compromised account. Model/temperature settings are plaintext. Electron profile/cache data uses the separate desktop-profile subdirectory; renderer has no arbitrary filesystem access or key storage.

Use **Clear OpenRouter key** or **Clear Bridge key** for explicit removal. Main persists an empty value for only the selected key. Clearing/changing the Bridge key disconnects its current session; configure the same replacement in Foundry manually. Blank Save does not clear keys. Busy operations must finish or be cancelled before changing settings.

## Optional Windows package and desktop smoke test

~~~powershell
npm run test:desktop
npm run package
.\release\StoryCoreFoundryAI-win32-x64\StoryCoreFoundryAI.exe
~~~

The offline desktop smoke test uses fake credentials in a temporary directory and an ephemeral port; it does not load your real settings, call OpenRouter or contact live Foundry. A local fake Bridge responds through the real WebSocket transport, and a test-only model exercises Detect/deselect/attest/Run with zero writes. It validates the real Electron renderer/preload/main boundary and saves a non-secret screenshot in tmp/desktop-smoke.png.

The portable package starts directly without Node/npm installed on the destination machine. Keep the entire StoryCoreFoundryAI-win32-x64 folder together; do not copy only the .exe. It is a local unsigned development package, not an installer, and has no auto-update. Windows may show an unsigned-app warning. The package is under gitignored release/ and is not pushed to git. Packaging stages only compiled runtime/UI plus production dependencies; no donors, tests or live settings are included. Existing per-user DPAPI settings are still used by the packaged app.


## Exact Foundry API Bridge configuration

Do this manually as GM in the already proven Foundry 12.343 / D&D5e 3.3.1 world. Never upgrade.

Configure Settings → Foundry API Bridge:

| Setting | Value |
|---|---|
| API WebSocket URL (apiUrl) | ws://127.0.0.1:3210/bridge |
| MCP WebSocket URL (wsUrl) | Empty for this isolated local test |
| API Key (apiKey) | The same separate local Bridge key saved in the adapter |
| Allow Script Macros | Disabled |

The module appends ?apiKey=... itself: do not append or paste the key into a URL. Save and reload the Foundry client after changing its connection settings. Foundry connects outward to the adapter. Use one GM client/channel: a second simultaneous connection is refused. Existing Bridge reconnect behavior is retained; adapter does not replay requests. If reconnect attempts have stopped, reload the Foundry client after the service is running.

These are the setting labels/keys of the pinned, audited Bridge. If your installed UI differs, inspect its version/configuration before changing anything. Configure only the local channel for testing; do not accidentally leave another remote controller connected. A HTTPS-hosted Foundry client may reject insecure ws:// as mixed content: use the already proven local Foundry access path, not disabled browser security.

No module code is changed. The runtime sends only: get-world-info, get-combat-state, get-scene-tokens, get-token, get-actor, get-actor-effects, get-combat-turn-context, get-scene. get-scene is needed for grid/door checks and is always called with includeScreenshot:false. The installed handler also generates an ASCII map, but it is discarded from model/UI data.

## Detect one supported turn and run

1. In Foundry, open and activate the intended combat scene, start combat and make the NPC current. Phase 1A supports one active combat, linked Actors, unique grid-aligned 1x1 tokens on a square grid in feet, elevation zero, normal walking, no difficult terrain and no doors. The GM must view that active scene.
2. In StoryCore Foundry AI, click **Detect current Foundry turn**. The read-only panel shows scene name, combat round/turn, current NPC, HP, token name and detected combat participants. No console, F12, document-ID copying or comma-separated ID entry is needed. **Refresh** repeats detection and replaces the previous detected scope.
3. Inspect **Allowed attack targets for this NPC turn**. Only active-combat participants with matching scene/context identity, supported geometry, no hidden/secret flag and no explicit LOS obstruction are eligible. A checked row is explicit per-run authorization to treat that participant as an enemy the NPC may attack; uncheck every participant that must not be attacked. Zero selected targets is permitted. Foundry disposition is displayed only as diagnostic table state and never defines the NPC relationship.
4. Confirm the single checkbox: selected targets are perceived enemies this NPC may attack; this is the intended linked-Actor scene with one active combat and normal walking. The Bridge cannot prove actorLink, full NPC perception or all terrain facts. Detect never claims those were verified automatically. Confirmation resets after detection/refresh, selection changes and each run.
5. The **Development NPC mind fixture** is prefilled with a cautious personality, survival/defence motivation and empty memory. Editing is optional. Main generates an `Enemy selected for this supervised run` relationship for every selected row, independent of Foundry disposition. Only selected targets enter nearby and every ActionCapability eligibleTargets; the validator rejects all others. No hidden/unselected participants or tactical if/else instructions are inserted. This is not the connected StoryCore memory provider.
6. Click **Run one real LLM dry-run**. Main accepts the latest detection ID plus the selected offered candidate handles and attestation; it derives scene/combat/Actor/token IDs and both internal ID lists itself. Renderer-supplied scope/Actor IDs are rejected. Before Qwen, the adapter checks the active scene and performs the existing fresh-read combat bracket again. Changed combat, round/turn, current identity or disappeared/invalid selected target rejects as **DETECTED_SCOPE_STALE**. Detect/Refresh and reconfirm; it never silently switches NPC or target.
7. Inspect the compact state, narrative, sanitized model/token/byte/latency metadata, model output and validation. Output remains a dry-run and does not execute. Exact document IDs are available only in collapsed **Advanced diagnostics**, as read-only debugging information.

Detection uses the pinned Bridge v8.11.2 contract: `src/commands/types.ts::GetSceneParams` has optional sceneId, and `src/commands/handlers/scene/sceneTypes.ts::getScene` resolves `game.scenes.active` when omitted. The first read is get-combat-state with empty parameters. The active-scene read is get-scene with includeScreenshot:false and no sceneId; subsequent dependent reads use the discovered IDs. The current combat token and context positions must match that scene. Active scene and viewed canvas are not interchangeable native proofs: the existing GM-view attestation remains required.

Detection is on demand only, performs no model call or writes, and invalidates its previous result if refresh fails. Selected targets are bound to main's latest detection; reconnects invalidate the session identity. Schema failures retain safe boundary labels such as BRIDGE_DATA_INVALID:get-combat-state:current. The window gives a readable instruction alongside the code. If Bridge cannot read an active combat, start combat and make an NPC current before detecting again.

Current runtime results (not all are the desired acceptance behavior):

- DRY-RUN VALIDATED INTENT: final schema, IDs, known blockers and snapshot freshness passed. It is **not proof of full native action legality**; budgets/effects/perception remain qualified.
- PLANNING_UNAVAILABLE on an event: a schema-valid goal was requested, but the adapter offers no plan or route. The runner now stops the supervised decision immediately when pathPreview=false. It does not ask the model again for an unusable planId.
- A clear rejection/pause: unknown ID, known out-of-range/blocked LOS, stale read, unsupported scope, schema/provider error or limit. No automatic fallback tactic, movement or end-turn occurs.

One click is one decision, at most two plan attempts, two repair continuations, five model calls and 60 seconds from the captured snapshot (PHASE1A_DECISION_LIFETIME_MS). Snapshot expiresAt is also the decision deadlineAt; provider calls and continuations share the remaining time and cannot extend it. No next-NPC loop. Provider calls have no hidden retries. Failed/invalid responses consume their slots. A final seals that invocation. Repeated completed runDecision requestId returns the cached result, changed body is rejected; concurrent requests are refused. At most 100 distinct runs per service process; restart explicitly for another session.

## Live acceptance matrix - deferred follow-up

For a separately authorized follow-up after reviewing the open issues, vary target distance/LOS manually in Foundry. Do not perform those tests as part of this documentation checkpoint. Click Detect/Refresh after each manual change, inspect selected targets and reconfirm the attestation before each fresh decision. Do not let this adapter move a token.

Record for each run: time, decisionId, runtime versions, selected model, state snapshot/bytes, PLAN_REQUEST/FINAL_INTENT, validator status, latency and zero writes. Different intentions are observations of the real model, not pass criteria forced by code. If a target is no longer perceived, uncheck it in the detected list; do not leak its current position to the model. A wall test with an actually known/perceived target may show a blocking wall and a safely rejected attack.

## Evidence recorded on 2026-08-31

| Check | Result |
|---|---|
| Old local UI | Stopped before rework; port 3210 was confirmed no longer listening. It is not restarted as an HTTP UI. |
| npm ci | Fresh project-local install succeeded; npm audit reported zero vulnerabilities at this check. |
| npm run dev | Opened the visible desktop window directly; no external browser. |
| npm run check | Typecheck and build passed; 63/63 tests passed, including all original 32 regression cases. The retired HTTP-page case now asserts 404/no UI/settings exposure. |
| New desktop unit tests | Exact IPC sender/frame/URL, fixed method allowlist, secret-free status/results/errors/logs, blank-preserve, explicit-clear, trusted OpenRouter invocation and no Bridge writes passed. |
| npm run test:desktop | Real Electron 44.0.0 window/preload/main test passed using fake credentials. OS sandbox enabled, renderer Node absent, network denied, fields empty for saved keys, DPAPI clear passed; failed Save retained typed values, successful Save cleared fields with confirmation, and disk reload preserved the saved replacement; zero Bridge writes. Offline Detect/deselect/attest/Run through real IPC and a local fixture Bridge also passed; the test-only model received no deselected target. Screenshot inspected. |
| npm run package | Portable Windows x64 build succeeded; archive excludes donors, tests and settings. |
| Packaged startup | Visible StoryCore Foundry AI - Phase 1A window appeared; /health returned status=ok and execution=DISABLED. No combat/model action triggered by this startup check. |
| Real authenticated OpenRouter / live Foundry | Operator-reported live Goblin state reached Qwen and produced a SCHEMA_AND_REFERENCES_VALID approach PLAN_REQUEST at 2778 ms. The whole run ended PLAN_LIMIT with zero writes. The vertical slice through the first tactical response is proven; full acceptance remains open. |
| Manual close/far/LOS variation | Not performed in this checkpoint. |
| Foundry mutation | No writes added or dispatched by the test harness. No movement/item/Midi/path-planning implementation or donor modification. |

Provider/unit tests use test doubles; they are not proof of actual Qwen inference. The first operator-reported real Foundry read reached the adapter but stopped with BRIDGE_DATA_INVALID, stateBytes=0 and writesDispatched=0. It did not reach normalization or Qwen and is not Phase 1A live acceptance. The token-detail contract mismatch exposed by that early attempt was fixed as described below. The later real-Qwen run recorded here supersedes that earlier failure as the latest live milestone; no live test was rerun during this documentation checkpoint. PROVEN_POC.md retains the earlier live evidence; **movement-exhaustion-across-multiple-NPC-turns is not independently proven**.


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

## Live token contract correction (2026-08-31)

Verified the read-only local donor at v8.11.2, commit f71ea11b708d78c85c979ddae04d371be66e766e: src/commands/handlers/token/tokenTypes.ts (mapTokenToResult/mapTokenToDetail), GetSceneTokensHandler.ts and GetTokenHandler.ts. The adapter now uses separate schemas/types:

- get-scene-tokens: numeric disposition (-2/-1/0/1), img, conditions, optional hp {value,max} and optional ac.
- get-token: string disposition (secret/hostile/neutral/friendly), explicit sceneId, rotation, textureSrc, nullable actorId, nullable hp {current,max} and nullable ac. It does not report actorLink; normalized actorLink remains null and linked-Actor operator attestation is still required.

Disposition mapping is explicit; invalid values, scene mismatches and secret perceived targets still reject. Schema errors now report fixed READ/field labels, e.g. BRIDGE_DATA_INVALID:get-token:disposition. All eight READ boundaries are labelled; no payload values, arbitrary record keys, raw Actor/Token dumps or Zod messages enter these errors. Nested failures identify their safe top-level field (e.g. tokens), not raw paths.

npm run check passed 48/48 tests, including all previous 41 and seven added contract/diagnostic regressions. Tests use distinct numeric-summary and string-detail fixtures. The runner regression confirms an invalid detail stops before normalization/model invocation with zero writes and preserves only the safe diagnostic. The portable desktop build is refreshed for the next manual live test. No movement, activation, Midi, next-turn, path planning, donor modification or Foundry upgrade was performed. **Historical fix checkpoint; the later real-Qwen evidence above now applies. Full acceptance remains open.**

## Supervised real-LLM timeout correction

A later operator-reported live attempt reached OpenRouter with qwen/qwen3-30b-a3b-instruct-2507 but stopped at DECISION_DEADLINE, latencyMs=29999 and returnedModel=null. No model response was accepted and writesDispatched remained 0. The earlier 30-second supervised window was insufficient for that request; this is evidence of reaching the provider, not successful Phase 1A live acceptance.

The supervised Phase 1A lifetime is now **60 seconds**, defined once as PHASE1A_DECISION_LIFETIME_MS in src/phase1a-config.ts. CombatNormalizer sets expiresAt to observedAt plus that lifetime. DecisionRunner uses exactly that expiry as deadlineAt and schedules cancellation using its remaining time. The provider wait is rejected at deadline even if the provider does not cooperate with cancellation; late replies are not logged as accepted output, normalized into a new snapshot, or acted upon. Validation before and after fresh readback still rejects expired or changed state. Two plan requests, two repair continuations, five model responses, one decision per click, existing session/invocation limits and zero writes remain unchanged.

Timeout results report DECISION_DEADLINE with timing.timeoutMs=60000, timing.elapsedMs (milliseconds since the captured snapshot) and timing.providerLatencyMs (elapsed time of the last provider call, including capability lookup). The pause event carries timeoutMs and latencyMs too. These fixed numeric diagnostics also enter the sanitized summary log; no API key or Authorization header is included. Cancellation requested by the user remains CANCELLED. Connection-test and Bridge-read timeouts are unchanged.

npm run check passed **63/63 tests**, including fake-clock tests for a response after 30 but before 60 seconds, shared snapshot/decision expiry, OpenRouter cancellation at the deadline, rejection of an uncooperative late response, expiry during readback and already-expired snapshots. No real minute-long provider call or live Foundry test was performed for this fix. The 60-second value remains unchanged as an emergency supervised ceiling, not expected NPC-turn latency. **The later live milestone above is proven through the first tactical response; full Phase 1A acceptance remains open.**


Current timeout-fix portable artifact: release/phase1a-60s/StoryCoreFoundryAI-win32-x64/StoryCoreFoundryAI.exe. The standard release folder could not be replaced while the previous app was open (Windows EBUSY); it was not updated. The separate package uses the same saved DPAPI settings. Close the old window before launching this build.

## Exact limits and safe failures

- Current Bridge does not expose actorLink, combat.scene validation, full NPC perception, module versions or action economy in these responses. Active combat/scene IDs are discovered, but linking/viewed scene/single-active-combat/normal-walking claims still require explicit operator attestation each run; native linking stays null when absent, scopeVerified=false, automaticExecution=false.
- Distance is the Bridge's grid approximation. Its true LOS can be a missing-backend fallback, so Phase 1A emits wallLos=null for true, false for a reported obstruction. No new LOS/path engine is added.
- quality.completeForDecision=false describes incomplete full native legality. Only this supervised read-only checkpoint permits the qualified subset to be discussed by the LLM. It is never executable approval. Oversized supported catalogues fail instead of tactically pruning.
- Only legacy mwak/rwak weapon metadata with one action and no activities is offered. Explicit non-single targets, spells, AoE, saves, bonus/reaction activation and item consumption dependencies are omitted with an aggregate count. Legacy empty target metadata stays null rather than fabricating a numeric target count. Normal/long range, uses and movement capacity remain null when absent. Ammunition/resource-linked weapons may therefore be omitted pending a later native legality boundary.
- Unsupported synthetic/unlinked or duplicate instances, non-NPC current Actors, non-1x1/grid-aligned/elevated tokens, non-square/non-ft grids and doors reject the run. Unavailable linking cannot be independently detected by this Bridge; attestation is a testing limitation, not synthetic Actor support.
- Observations are bracketed reads and a local SHA-256 fingerprint, not an atomic snapshot or Foundry revision. A change-and-revert between reads is not detectable. Any observed relevant change closes the decision.
- Raw Bridge payload cap 2 MiB; state cap 24 KiB; DecisionRequest cap 32 KiB; model output cap 8 KiB/depth 32. Unsupported/overflow data never becomes raw LLM context.
- Auto-detection UX verification: npm run check passed 58/58 tests, retaining all prior 48 cases and adding ten discovery/scope/IPC regressions. The desktop smoke exercises actual UI clicks without editable IDs and verifies deselection and automatic confirmation reset. These fixture-only checks are not live LLM acceptance.

- No pathfinder, IntentExecutor, item activation, targeting write, next-turn, Midi modification, memory write, donor modification, Combat Mappers work or Foundry upgrade.

## Logs and stopping

The desktop window shows the latest result. Sanitized per-decision JSON files are stored outside git at %LOCALAPPDATA%\StoryCoreFoundryAI\decisions\<decisionId>.json; these contain normalized state/narrative and should still be treated as private campaign information. They do not contain raw Actor dumps or credentials. In development, terminal output is a small status/decisionId/stateBytes/zero-writes summary. The portable app also stores per-decision JSON; it does not require a console. Provider error bodies and Authorization headers are never logged. Settings are encrypted; decision logs are not encrypted.

Click **Cancel decision** to abort a model call and pause; pending reads may take up to their five-second timeout. Close the desktop window to stop the app. Main cancels pending model work, disconnects Bridge, rejects pending reads and closes the listener; nothing is replayed. In development, Ctrl+C is also available, preferably after Cancel/closing the window. Foundry can continue manually. Restore your prior local Bridge settings manually if desired; do not reconnect a remote controller unintentionally.

Next separately authorized stage: OPTIMIZATION / GENERALIZATION, first auditing universal Item-to-capability normalization, then also addressing the unavailable-planning loop, disposition semantics and compact DecisionView. **This checkpoint stops after documentation, npm run check, commit and push.** No implementation, additional live tests or execution is authorized here.

Electron security/IPC module map: [DESKTOP_BOUNDARY.md](DESKTOP_BOUNDARY.md). No settings, decision, or generic Bridge commands are exposed through HTTP.


## Latest checkpoint — Stop after unavailable planning (2026-09-01)

Operator-supplied live evidence from the packaged read-only build confirmed the known orchestration defect. The first real Qwen response was a schema/reference-valid PLAN_REQUEST to approach the selected target using the offered ranged dagger. That response completed in 33,872 ms and correctly produced PLANNING_UNAVAILABLE because pathPreview=false and no plans were offered. The old runner then made additional model calls: an invented move planId was rejected, another PLAN_REQUEST again produced PLANNING_UNAVAILABLE, and a fourth call reached the shared 60-second deadline. Final elapsed time was 60,002 ms. Execution remained DISABLED and writesDispatched remained 0.

`DecisionRunner.run` now terminates the current decision immediately after that first valid unavailable PLAN_REQUEST. The returned status is PLANNING_UNAVAILABLE, accepted=false and writesDispatched=0. No second model call occurs, no fabricated plan is offered, and all existing deadline, repair, response, cancellation, stale-state and read-only protections remain active.

Regression coverage proves both a first valid PLAN_REQUEST and a repair followed by a valid PLAN_REQUEST stop without later provider calls. This fix adds no pathfinding, movement, Item activation, Midi execution, turn advancement or other Foundry write. It does not make Phase 1A live acceptance complete; a new live run is still required to confirm the packaged behavior.

## Supervised execution build — 2026-09-02 (2026-09-01)

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
## Selected-enemy and bounded action-description correction (2026-09-02)

The supervised target checkboxes now define the closed attack-target set for that run. Every selected participant enters the decision state as relationToSelf=enemy and targetAuthorized=true and receives the matching narrative relationship regardless of Foundry Token disposition. Foundry disposition remains unchanged and is shown only in Detect diagnostics. Unselected, hidden, secret, excluded or stale participants cannot enter nearby, ActionCapability eligibleTargets, validation or execution.

Every supported Actor-owned action now carries canPlanApproach plus an optional descriptionHint capped at 240 characters. The hint is extracted locally from the current owned Item and strips HTML, script/style/form/control content, Foundry enrichers, inline rolls, URLs and control characters. It is untrusted selection context only; structured Item fields and fresh Foundry state drive validation, and D&D5e/Midi remain rules authority. No extra model call, handcrafted spell catalogue or Item-name handler was added.

Structural target compatibility now prevents object/ally-target Items from receiving the selected enemy combatants as eligible targets. PLAN_REQUEST approach additionally requires canPlanApproach=true, which requires a numeric range in scene units, and exact eligible target membership. This prevents the earlier Light/object PLAN_RANGE_UNKNOWN path from being presented as a usable enemy approach action while preserving generic Item handling.

Verification: npm run check passed 94/94 tests and the Electron smoke passed. The refreshed portable ZIP is release/StoryCoreFoundryAI-supervised-2026-09-02-win32-x64.zip (163,349,781 bytes; SHA-256 C52DCFC489C82DC5AEE42DB4FFDBE85F29EEBAC7CEF9AA19093CF4DAA8AFD0FF). No live Foundry command or OpenRouter call was made during this correction.

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

## Full-turn live correction pending verification (2026-09-02)

A live Fire Bolt activation succeeded, but the following decision received actionAvailable=false and bonusActionAvailable=false while the provider still exposed spent Items. Repeated Fire Bolt/approach attempts were rejected safely as ACTION_BUDGET_SPENT and ended at PLAN_LIMIT; no second activation occurred. The provider-side DecisionView and response schema are now budget-aware. Offline tests pass, but this correction is not yet live-accepted.

## Live budget-aware Fire Bolt full-turn checkpoint (2026-09-02)

Operator-supplied live evidence confirms the corrected bounded turn completed successfully on Foundry VTT 12.343 / D&D5e 3.3.1 / Midi-QOL. Real Qwen selected the Actor-owned Fire Bolt against Ethan; PLAN_NOT_NEEDED safely rejected an unnecessary approach and the repaired activate_item intent passed reference/freshness validation. The existing Bridge performed target reset, one Item activation and target cleanup. Midi reported attackTotal=13, damageTotal=15, hitTargets=0 and failedSaves=0. This run therefore proves the invocation/workflow seam and a miss; it does not prove applied HP damage.

Fresh observation then exposed movementRemaining=30, actionAvailable=false and bonusActionAvailable=false. In the budget-aware second decision, Qwen selected end_turn. One guarded next-turn command was dispatched and fresh combat readback confirmed a different current combatant at round 5 turn 0. Final status was TURN_ADVANCED and writesDispatched=4, exactly accounting for target reset, one activation, target cleanup and next-turn. There was no repeated Item activation.

The first model response took 52,473 ms and its repair took 6,600 ms, close to the 60-second bounded deadline. The existing unscoped Midi RollComplete correlation risk remains; concurrent workflow safety is not proven. This checkpoint proves one supervised NPC turn against one selected target. It does not prove automatic multi-NPC continuation, multi-target tactics, reactions, AoE/templates, concentration, upcasting or levelled prepared spell execution.
