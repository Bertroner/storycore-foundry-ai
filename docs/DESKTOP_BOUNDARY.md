# Phase 1A desktop boundary

The Electron UI replaces the browser-facing developer page. This checkpoint does not extend combat logic.

| Boundary | Owner and restrictions |
|---|---|
| desktop/main.ts | Trusted entry point. Loads existing DPAPI settings, starts DesktopService and loopback Bridge listener, creates one window, closes pending work/listener on exit. No auto-update. |
| desktop/window.ts | Local storycore-app://ui/index.html plus two exact bundled assets. contextIsolation=true, nodeIntegration=false, sandbox=true, webSecurity=true. Permissions/downloads/new windows/webviews/navigation denied. A nonpersistent app-only session is separate from Chrome. |
| desktop/preload.cts | Seven fixed methods: status, saveSettings, clearOpenRouterKey, clearBridgeKey, testOpenRouter, runDecision, cancelDecision. Typed by desktop/api.ts. No ipcRenderer, invoke, event, filesystem, shell or Bridge-command API exposed. |
| desktop/ipc.ts | Main validates exact WebContents/main-frame identity, local URL, argument count and payload size. Existing strict settings/decision validation follows. Unregistered IPC channels have no handler. |
| src/desktop-service.ts | Trusted settings/provider/decision lifecycle extracted from former HTTP server. Serializes only safe status/results, keeps request correlation/cache/cancellation and sanitized logs. OpenRouter network request and credentials remain here/in its existing provider. |
| src/server.ts | Existing Bridge protocol and direction, bound only to 127.0.0.1:3210. /bridge WebSocket upgrade authenticates local Bridge key. /health returns only status and execution=DISABLED. Former UI, settings and decision HTTP routes are removed. |
| src/settings.ts | Same DPAPI CurrentUser format and %LOCALAPPDATA%/StoryCoreFoundryAI/settings.json. Blank save preserves existing keys; explicit main-process clear removes only the selected key. No saved plaintext or encrypted blob is serialized into renderer status. |
| scripts/package.mjs | Explicit staging of compiled runtime, desktop assets and production dependencies. Donors, tests, workspace secrets and live settings excluded. Local unsigned portable win32-x64 package; no installation or auto-update. |

Renderer CSP uses connect-src 'none'; its session also rejects every request except three exact local assets. There is no renderer OpenRouter client. Model output is displayed using textContent, never interpreted as HTML/code. Show/hide toggles only the currently typed unsaved field. Fields have new-password/off autofill semantics; no Chrome profile, password generator or stored-secret reveal exists.

Main follows [Electron's security checklist](https://www.electronjs.org/docs/latest/tutorial/security); the narrow context bridge follows [Electron preload guidance](https://www.electronjs.org/docs/latest/tutorial/tutorial-preload). The application uses project-local Electron 44.0.0 and @electron/packager 20.3.0, pinned in package-lock.json.

All eight Bridge read commands and the existing combat sensor, normalizer, response schema and bounded decision logic are unchanged. No IPC can request generic reads or writes. PLAN_REQUEST remains PLANNING_UNAVAILABLE; FINAL_INTENT remains a dry-run only.

Verification: 41 unit/regression tests (all original 32 cases retained; former HTTP-page case adapted to assert its removal), plus an actual offline Electron smoke run. The latter verifies OS sandbox metrics, absence of renderer Node APIs, real preload IPC, empty saved-key fields, DPAPI clear and renderer network denial with fake credentials and zero Bridge reads/writes. The generated screenshot was inspected. Portable package startup was independently checked by its visible Windows title and /health response. These checks do not prove a live combat/LLM decision.
