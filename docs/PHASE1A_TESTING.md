# Phase 1A — Windows testing

Implemented boundary: READ → NORMALIZE → REAL OpenRouter request → strict decision validation → stored dry-run result. **No Foundry writes exist in this runtime.** Production entry points cannot select a mock provider; test doubles exist only in tests/.

## Install and start

Use PowerShell in the repository. Verified locally with Node 24.15.0, npm 11.12.1 and Windows PowerShell for DPAPI. Node >=22.14 is required; no global software is installed by this project.

~~~powershell
Set-Location C:\StoryCore-Dev\storycore-foundry-ai
npm ci
npm run check
npm start
~~~

npm run check runs typecheck, tests and build. npm start uses the built files; after changes rebuild or use npm run dev. Keep the terminal running. Open [http://127.0.0.1:3210](http://127.0.0.1:3210). The HTTP service and WebSocket listener bind only 127.0.0.1. localhost and other Host values are intentionally rejected; use the numeric URL. Do not expose the port through a proxy/tunnel or LAN binding.

## Settings and connection test

1. Paste your OpenRouter key into the password field on the local page, never chat, Foundry settings, source or a shell command.
2. Keep or edit the model ID. Default: qwen/qwen3-30b-a3b-instruct-2507; temperature 0.25; max output 700 tokens.
3. Enter a separate local Bridge key, at least 16 characters. You may use an existing local Bridge key that you control. This is not the OpenRouter key.
4. Click **Save**. Blank key fields preserve existing values. The fields clear afterward. Status exposes only hasKey/hasBridgeKey.
5. Click **Test connection**. It uses the saved settings and sends a tiny real OpenRouter request (up to 24 output tokens), independent of Foundry. Success displays success, model and latency. It does not prove combat sensing or structured decisions.

Keys are encrypted using Windows DPAPI CurrentUser and stored in %LOCALAPPDATA%\StoryCoreFoundryAI\settings.json. They are passed to the DPAPI helper through stdin, not command-line arguments. The file is outside git. Local processes running as your Windows user can decrypt it; this is not isolation from a compromised account. Non-secret model/temperature settings are plaintext. There is no browser localStorage key storage. To clear saved secrets, stop the adapter and delete that specific settings.json file using Explorer; restart and configure again.

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

## Prepare one supported scene and run

1. Manually prepare one active combat with the desired NPC's turn current. The GM client must view that combat's scene. Use a linked NPC Actor, a unique token, grid-aligned 1x1 participants on a square grid in feet, elevation zero, normal walking, no difficult terrain and no doors.
2. Enter Scene ID, Combat ID, current NPC Actor ID and Token ID on the page. Use Foundry's copy-document-ID controls. If an ID is not shown, these optional GM console expressions only READ IDs:

~~~javascript
game.scenes.active?.id
game.combat?.id
game.combat?.combatant?.actorId
game.combat?.combatant?.tokenId
~~~

Do not run mutation scripts. Copy target IDs from their Actor/token documents. Do not paste full Actor dumps into the UI or model.

3. Enter verified linked Actor IDs (NPC plus the targets), and only token IDs the NPC actually perceives. Empty perceived-token list means no target is offered. GM visibility alone is insufficient. Hidden/secret tokens are rejected even if listed.
4. Tick the per-run scope attestation only after verifying it. It covers facts absent from current Bridge reads, not new native capabilities. The checkbox clears for each run.
5. Edit the small development-only personality/motivation and optional relationships/memory JSON. Relationships use known Actor IDs, e.g. [{"actorId":"YOUR_TARGET_ACTOR_ID","summary":"Hostile intruder"}]. Memory is an array of plain strings. No key, hidden information, scripts or tactical if/else rules belong here.
6. Click **Run one real LLM dry-run** once. A fresh combat bracket and dependent reads produce the DTO; real OpenRouter decides. Every accepted response is checked against another fresh read.
7. Inspect state, narrative, sanitized model/format/temperature/token/byte/latency metadata, model output and validation. These appear in pretty JSON. The output does not execute.

Expected terminal results:

- DRY-RUN VALIDATED INTENT: final schema, IDs, known blockers and snapshot freshness passed. It is **not proof of full native action legality**; budgets/effects/perception remain qualified.
- PLANNING_UNAVAILABLE on an event: the LLM requested a schema-valid goal. No plan-token-path command was sent, no route/planId was invented. Feedback returns into the same bounded decision; a later final may be accepted.
- A clear rejection/pause: unknown ID, known out-of-range/blocked LOS, stale read, unsupported scope, schema/provider error or limit. No automatic fallback tactic, movement or end-turn occurs.

One click is one decision, at most two plan attempts, two repair continuations, five model calls and 30 seconds from the captured snapshot. No next-NPC loop. Provider calls have no hidden retries. Failed/invalid responses consume their slots. A final seals that invocation. Repeated completed HTTP requestId returns the cached result, changed body is rejected; concurrent requests are refused. At most 100 distinct runs per service process; restart explicitly for another session.

## Live acceptance matrix — perform manually

After the first supported run, manually move the target close, farther away, then change LOS if practical. Reverify the per-run attestation/known targets, then click once for each fresh decision. Do not let this adapter move a token.

Record for each run: time, decisionId, runtime versions, selected model, state snapshot/bytes, PLAN_REQUEST/FINAL_INTENT, validator status, latency and zero writes. Different intentions are observations of the real model, not pass criteria forced by code. If a target is no longer perceived, remove it from the list; do not leak its current position to the model. A wall test with an actually known/perceived target may show a blocking wall and a safely rejected attack.

## Evidence recorded on 2026-08-31

| Check | Result |
|---|---|
| npm run check | Typecheck and build passed; 32/32 automated tests passed on Windows. |
| Transport tests | Real loopback WebSocket with simulated Bridge replies: correlation, timeout, disconnect and no replay passed. Not a live Foundry test. |
| Privacy/settings tests | Strict DTO projection, hidden/raw omission, redaction, provider credentials separation, public settings masking, CurrentUser DPAPI round-trip passed. |
| Local HTTP smoke | Built app started on 127.0.0.1:3210, served UI/status; no keys and no Bridge connection at inspection, readsSent=0. |
| Visual browser check | Not completed: browser-control runtime failed with the local Windows sandbox ACL error. HTTP/UI source and API tests passed; do not claim a rendered-browser acceptance. |
| Public OpenRouter catalogue | Default Qwen model exists and advertises response_format and structured_outputs. This unauthenticated metadata read is not an inference/combat test. |
| Real authenticated OpenRouter Test connection | NOT RUN: no configured key at inspection. |
| Live Foundry → normalized state → real Qwen | NOT RUN: Bridge disconnected and no configured key at inspection. |
| Manual close/far/LOS variation | NOT RUN. |
| Foundry mutation | No writes implemented or dispatched. No new POC/live combat mutation test was run. |

Provider HTTP tests use test doubles and do not prove actual inference. PROVEN_POC.md retains the earlier live evidence; **movement-exhaustion-across-multiple-NPC-turns is not independently proven**.

## Exact limits and safe failures

- Current Bridge does not expose actorLink, combat.scene validation, full NPC perception, module versions or action economy in these responses. Linking/viewed scene/single-active-combat/normal-walking claims require explicit operator attestation each run; native linking stays null when absent, scopeVerified=false, automaticExecution=false.
- Distance is the Bridge's grid approximation. Its true LOS can be a missing-backend fallback, so Phase 1A emits wallLos=null for true, false for a reported obstruction. No new LOS/path engine is added.
- quality.completeForDecision=false describes incomplete full native legality. Only this supervised read-only checkpoint permits the qualified subset to be discussed by the LLM. It is never executable approval. Oversized supported catalogues fail instead of tactically pruning.
- Only legacy mwak/rwak weapon metadata with one action and no activities is offered. Explicit non-single targets, spells, AoE, saves, bonus/reaction activation and item consumption dependencies are omitted with an aggregate count. Legacy empty target metadata stays null rather than fabricating a numeric target count. Normal/long range, uses and movement capacity remain null when absent. Ammunition/resource-linked weapons may therefore be omitted pending a later native legality boundary.
- Unsupported synthetic/unlinked or duplicate instances, non-NPC current Actors, non-1x1/grid-aligned/elevated tokens, non-square/non-ft grids and doors reject the run. Unavailable linking cannot be independently detected by this Bridge; attestation is a testing limitation, not synthetic Actor support.
- Observations are bracketed reads and a local SHA-256 fingerprint, not an atomic snapshot or Foundry revision. A change-and-revert between reads is not detectable. Any observed relevant change closes the decision.
- Raw Bridge payload cap 2 MiB; state cap 24 KiB; DecisionRequest cap 32 KiB; model output cap 8 KiB/depth 32. Unsupported/overflow data never becomes raw LLM context.
- No pathfinder, IntentExecutor, item activation, targeting write, next-turn, Midi modification, memory write, donor modification, Combat Mappers work or Foundry upgrade.

## Logs and stopping

The page shows the latest result. Sanitized per-decision JSON files are stored outside git at %LOCALAPPDATA%\StoryCoreFoundryAI\decisions\<decisionId>.json; these contain normalized state/narrative and should still be treated as private campaign information. They do not contain raw Actor dumps or credentials. Terminal output is a small status/decisionId/stateBytes/zero-writes summary. Provider error bodies and Authorization headers are never logged. Settings are encrypted; decision logs are not encrypted.

Click **Cancel decision** to abort a model call and pause; pending reads may take up to their five-second timeout. Stop the adapter with Ctrl+C in its terminal. This disconnects Bridge and rejects pending reads; nothing is replayed. Foundry can continue manually. Restore your prior local Bridge settings manually if desired; do not reconnect a remote controller unintentionally.

Next step: complete and review the real authenticated/manual acceptance matrix above. **Stop before path-preview or any command execution implementation.** Movement and Midi execution require a separate reviewed checkpoint.
