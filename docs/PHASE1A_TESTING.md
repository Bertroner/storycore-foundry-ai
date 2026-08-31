# Phase 1A — Windows testing

Implemented boundary: READ → NORMALIZE → REAL OpenRouter request → strict decision validation → stored dry-run result. **No Foundry writes exist in this runtime.** Production entry points cannot select a mock provider; test doubles exist only in tests/.

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
3. Inspect the detected target checkboxes. Only active-combat participants with matching scene/context identity, supported geometry, no hidden/secret flag and no explicit LOS obstruction are eligible. Missing-context, blocked, hidden/secret and duplicate participants are excluded. Uncheck any candidate the NPC does not actually perceive. Zero selected targets is permitted. Arbitrary GM-visible scene tokens are never offered. Foundry disposition is displayed as reported, not reinterpreted as a tactic or inferred allegiance to the NPC.
4. Confirm the single checkbox: selected targets are perceived by this NPC; this is the intended linked-Actor scene with one active combat and normal walking. The Bridge cannot prove actorLink, full NPC perception or all terrain facts. Detect never claims those were verified automatically. Confirmation resets after detection/refresh, selection changes and each run.
5. The **Development NPC mind fixture** is prefilled with a cautious personality, survival/defence motivation and empty memory. Editing is optional. Main generates only factual `Hostile combatant` relationships for selected hostile combatants. No hidden/unselected participants or tactical if/else instructions are inserted. This is not the connected StoryCore memory provider.
6. Click **Run one real LLM dry-run**. Main accepts the latest detection ID plus the selected offered candidate handles and attestation; it derives scene/combat/Actor/token IDs and both internal ID lists itself. Renderer-supplied scope/Actor IDs are rejected. Before Qwen, the adapter checks the active scene and performs the existing fresh-read combat bracket again. Changed combat, round/turn, current identity or disappeared/invalid selected target rejects as **DETECTED_SCOPE_STALE**. Detect/Refresh and reconfirm; it never silently switches NPC or target.
7. Inspect the compact state, narrative, sanitized model/token/byte/latency metadata, model output and validation. Output remains a dry-run and does not execute. Exact document IDs are available only in collapsed **Advanced diagnostics**, as read-only debugging information.

Detection uses the pinned Bridge v8.11.2 contract: `src/commands/types.ts::GetSceneParams` has optional sceneId, and `src/commands/handlers/scene/sceneTypes.ts::getScene` resolves `game.scenes.active` when omitted. The first read is get-combat-state with empty parameters. The active-scene read is get-scene with includeScreenshot:false and no sceneId; subsequent dependent reads use the discovered IDs. The current combat token and context positions must match that scene. Active scene and viewed canvas are not interchangeable native proofs: the existing GM-view attestation remains required.

Detection is on demand only, performs no model call or writes, and invalidates its previous result if refresh fails. Selected targets are bound to main's latest detection; reconnects invalidate the session identity. Schema failures retain safe boundary labels such as BRIDGE_DATA_INVALID:get-combat-state:current. The window gives a readable instruction alongside the code. If Bridge cannot read an active combat, start combat and make an NPC current before detecting again.

Expected terminal results:

- DRY-RUN VALIDATED INTENT: final schema, IDs, known blockers and snapshot freshness passed. It is **not proof of full native action legality**; budgets/effects/perception remain qualified.
- PLANNING_UNAVAILABLE on an event: the LLM requested a schema-valid goal. No plan-token-path command was sent, no route/planId was invented. Feedback returns into the same bounded decision; a later final may be accepted.
- A clear rejection/pause: unknown ID, known out-of-range/blocked LOS, stale read, unsupported scope, schema/provider error or limit. No automatic fallback tactic, movement or end-turn occurs.

One click is one decision, at most two plan attempts, two repair continuations, five model calls and 60 seconds from the captured snapshot (PHASE1A_DECISION_LIFETIME_MS). Snapshot expiresAt is also the decision deadlineAt; provider calls and continuations share the remaining time and cannot extend it. No next-NPC loop. Provider calls have no hidden retries. Failed/invalid responses consume their slots. A final seals that invocation. Repeated completed runDecision requestId returns the cached result, changed body is rejected; concurrent requests are refused. At most 100 distinct runs per service process; restart explicitly for another session.

## Live acceptance matrix — perform manually

After the first supported run, manually move the target close, farther away, then change LOS if practical. Click Detect/Refresh after each manual change, inspect selected targets and reconfirm the attestation before each fresh decision. Do not let this adapter move a token.

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
| Real authenticated OpenRouter / live Foundry acceptance | No new authenticated model or combat decision acceptance was performed in this UI rework. Earlier live end-to-end acceptance remains unverified. |
| Manual close/far/LOS variation | Not performed in this checkpoint. |
| Foundry mutation | No writes added or dispatched by the test harness. No movement/item/Midi/path-planning implementation or donor modification. |

Provider/unit tests use test doubles; they are not proof of actual Qwen inference. The first operator-reported real Foundry read reached the adapter but stopped with BRIDGE_DATA_INVALID, stateBytes=0 and writesDispatched=0. It did not reach normalization or Qwen and is not Phase 1A live acceptance. The token-detail contract mismatch exposed by that attempt is fixed as described below; no new live test was performed for the fix. PROVEN_POC.md retains the earlier live evidence; **movement-exhaustion-across-multiple-NPC-turns is not independently proven**.


## Live token contract correction (2026-08-31)

Verified the read-only local donor at v8.11.2, commit f71ea11b708d78c85c979ddae04d371be66e766e: src/commands/handlers/token/tokenTypes.ts (mapTokenToResult/mapTokenToDetail), GetSceneTokensHandler.ts and GetTokenHandler.ts. The adapter now uses separate schemas/types:

- get-scene-tokens: numeric disposition (-2/-1/0/1), img, conditions, optional hp {value,max} and optional ac.
- get-token: string disposition (secret/hostile/neutral/friendly), explicit sceneId, rotation, textureSrc, nullable actorId, nullable hp {current,max} and nullable ac. It does not report actorLink; normalized actorLink remains null and linked-Actor operator attestation is still required.

Disposition mapping is explicit; invalid values, scene mismatches and secret perceived targets still reject. Schema errors now report fixed READ/field labels, e.g. BRIDGE_DATA_INVALID:get-token:disposition. All eight READ boundaries are labelled; no payload values, arbitrary record keys, raw Actor/Token dumps or Zod messages enter these errors. Nested failures identify their safe top-level field (e.g. tokens), not raw paths.

npm run check passed 48/48 tests, including all previous 41 and seven added contract/diagnostic regressions. Tests use distinct numeric-summary and string-detail fixtures. The runner regression confirms an invalid detail stops before normalization/model invocation with zero writes and preserves only the safe diagnostic. The portable desktop build is refreshed for the next manual live test. No movement, activation, Midi, next-turn, path planning, donor modification or Foundry upgrade was performed. **Stop for another live test; do not mark live acceptance complete.**

## Supervised real-LLM timeout correction

A later operator-reported live attempt reached OpenRouter with qwen/qwen3-30b-a3b-instruct-2507 but stopped at DECISION_DEADLINE, latencyMs=29999 and returnedModel=null. No model response was accepted and writesDispatched remained 0. The earlier 30-second supervised window was insufficient for that request; this is evidence of reaching the provider, not successful Phase 1A live acceptance.

The supervised Phase 1A lifetime is now **60 seconds**, defined once as PHASE1A_DECISION_LIFETIME_MS in src/phase1a-config.ts. CombatNormalizer sets expiresAt to observedAt plus that lifetime. DecisionRunner uses exactly that expiry as deadlineAt and schedules cancellation using its remaining time. The provider wait is rejected at deadline even if the provider does not cooperate with cancellation; late replies are not logged as accepted output, normalized into a new snapshot, or acted upon. Validation before and after fresh readback still rejects expired or changed state. Two plan requests, two repair continuations, five model responses, one decision per click, existing session/invocation limits and zero writes remain unchanged.

Timeout results report DECISION_DEADLINE with timing.timeoutMs=60000, timing.elapsedMs (milliseconds since the captured snapshot) and timing.providerLatencyMs (elapsed time of the last provider call, including capability lookup). The pause event carries timeoutMs and latencyMs too. These fixed numeric diagnostics also enter the sanitized summary log; no API key or Authorization header is included. Cancellation requested by the user remains CANCELLED. Connection-test and Bridge-read timeouts are unchanged.

npm run check passed **63/63 tests**, including fake-clock tests for a response after 30 but before 60 seconds, shared snapshot/decision expiry, OpenRouter cancellation at the deadline, rejection of an uncooperative late response, expiry during readback and already-expired snapshots. No real minute-long provider call or live Foundry test was performed for this fix. Restart the refreshed portable build for the next supervised manual test. **Phase 1A live acceptance remains unverified.**


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

Next step: complete and review the real authenticated/manual acceptance matrix above. **Stop before path-preview or any command execution implementation.** Movement and Midi execution require a separate reviewed checkpoint.

Electron security/IPC module map: [DESKTOP_BOUNDARY.md](DESKTOP_BOUNDARY.md). No settings, decision, or generic Bridge commands are exposed through HTTP.
