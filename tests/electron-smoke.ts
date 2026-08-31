// Offline integration harness; not shipped in the portable app. Uses only fake credentials and local IPC.
import { app } from "electron";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { SettingsStore } from "../src/settings.js";
import { createApp } from "../src/server.js";
import { DesktopService } from "../src/desktop-service.js";
import { createDesktopWindow } from "../desktop/window.js";
import { UI_URL } from "../desktop/ipc.js";
import { safeError } from "../src/safety.js";
app.enableSandbox();
async function smoke() {
const directory = await mkdtemp(join(tmpdir(), "storycore-electron-smoke-"));
app.setPath("userData", join(directory, "profile"));
let cleanup: (() => Promise<void>) | null = null;
const timer = setTimeout(() => { console.error("DESKTOP_SMOKE_TIMEOUT"); app.exit(1); }, 60000);
try {
  await app.whenReady(); console.log("SMOKE_STAGE_APP_READY");
  const store = new SettingsStore(directory);
  await store.save({ provider: "openrouter", model: "offline/smoke", temperature: .25,
    apiKey: "offline-openrouter-test-key", bridgeKey: "offline-bridge-test-key" });
  console.log("SMOKE_STAGE_SETTINGS_READY");
  const runtime = await createApp(store, 0); const service = new DesktopService(store, runtime.bridge);
  console.log("SMOKE_STAGE_LISTENER_READY");
  const window = await createDesktopWindow(service, resolve("."), false);
  console.log("SMOKE_STAGE_WINDOW_READY");
  cleanup = async () => { window.destroy(); await service.close(); await runtime.close(); };
  const rendererProcess = app.getAppMetrics().find(metric => metric.pid === window.webContents.getOSProcessId());
  assert.equal(rendererProcess?.sandboxed, true);
  assert.equal(window.webContents.getURL(), UI_URL);
  const result = await window.webContents.executeJavaScript(`(async () => {
    const status = await window.storycore.status();
    const networkBlocked = await fetch("https://openrouter.ai").then(() => false, () => true);
    return { status, methods: Object.keys(window.storycore).sort(), node: typeof require,
      process: typeof process, networkBlocked,
      apiValue: document.getElementById("apiKey").value,
      bridgeValue: document.getElementById("bridgeKey").value,
      apiType: document.getElementById("apiKey").type,
      bridgeType: document.getElementById("bridgeKey").type };
  })()`);
  console.log("SMOKE_STAGE_RENDERER_READY");
  assert.equal(result.status.ok, true); assert.equal(result.status.data.settings.hasOpenRouterKey, true);
  assert.equal(result.apiValue, ""); assert.equal(result.bridgeValue, "");
  assert.equal(result.apiType, "password"); assert.equal(result.bridgeType, "password");
  assert.equal(result.node, "undefined"); assert.equal(result.process, "undefined"); assert.equal(result.networkBlocked, true);
  assert.ok(!JSON.stringify(result).includes("offline-openrouter-test-key"));
  assert.deepEqual(result.methods, ["cancelDecision", "clearBridgeKey", "clearOpenRouterKey", "runDecision", "saveSettings", "status", "testOpenRouter"]);
  // Exercise real Save clicks: failed input must survive; successful persistence must clear it.
  async function saveViaUi(model: string, bridgeKey: string) {
    return window.webContents.executeJavaScript(`(async () => {
      const field = document.getElementById("bridgeKey");
      document.getElementById("model").value = ${JSON.stringify(model)};
      field.value = ${JSON.stringify(bridgeKey)};
      field.dispatchEvent(new Event("input"));
      document.getElementById("settingsResult").textContent = "pending";
      document.getElementById("save").click();
      for (let attempt = 0; attempt < 150; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        if (!document.getElementById("save").disabled && document.getElementById("settingsResult").textContent !== "pending") {
          return { value: field.value, type: field.type,
            message: document.getElementById("settingsResult").textContent,
            label: document.getElementById("bridgeKeyStatus").textContent };
        }
      }
      throw new Error("SAVE_UI_TIMEOUT");
    })()`);
  }
  const shortKey = await saveViaUi("offline/smoke", "short");
  assert.equal(shortKey.value, "short"); assert.match(shortKey.message, /at least 16/);
  const rejected = await saveViaUi("invalid model", "offline-replacement-bridge-key");
  assert.equal(rejected.value, "offline-replacement-bridge-key");
  assert.match(rejected.message, /not confirmed saved/);
  assert.equal(store.credentials().bridgeKey, "offline-bridge-test-key");
  const saved = await saveViaUi("offline/smoke", "offline-replacement-bridge-key");
  assert.equal(saved.value, ""); assert.equal(saved.type, "password");
  assert.match(saved.message, /SETTINGS_SAVED/); assert.match(saved.label, /Saved on this PC/);
  assert.ok(!saved.message.includes("offline-replacement-bridge-key"));
  const reloaded = new SettingsStore(directory); await reloaded.load();
  assert.equal(reloaded.credentials().bridgeKey, "offline-replacement-bridge-key");
  assert.equal(reloaded.credentials().apiKey, "offline-openrouter-test-key");
  console.log("SMOKE_STAGE_SAVE_FAILURE_AND_RELOAD_PASSED");
  const clear = await window.webContents.executeJavaScript("window.storycore.clearOpenRouterKey()");
  assert.equal(clear.ok, true); assert.equal(store.credentials().apiKey, ""); assert.equal(store.credentials().bridgeKey, "offline-replacement-bridge-key");
  assert.equal(runtime.bridge.readsSent, 0);
  const artifact = resolve("tmp", "desktop-smoke.png"); await mkdir(resolve("tmp"), { recursive: true });
  await writeFile(artifact, (await window.webContents.capturePage()).toPNG());
  console.log("DESKTOP_SMOKE_PASSED: local renderer, real IPC, sandbox, DPAPI, masked status, network denial, explicit clear, zero Bridge reads/writes.");
} catch (error) {
  console.error("DESKTOP_SMOKE_FAILED: " + safeError(error));
  // Assertions contain only fixed fixture/non-secret values; never emit error objects or messages.
  process.exitCode = 1;
} finally {
  clearTimeout(timer); await cleanup?.();
  // Electron may retain profile files until process exit; cleanup is best-effort and confined to this generated temp path.
  if (resolve(directory).startsWith(resolve(tmpdir()) + "\\") || resolve(directory).startsWith(resolve(tmpdir()) + "/"))
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  app.exit(process.exitCode ? 1 : 0);
}

}
void smoke().catch(() => { console.error("DESKTOP_SMOKE_SETUP_FAILED"); app.exit(1); });
