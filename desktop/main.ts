import { app, dialog } from "electron";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { SettingsStore, localDirectory } from "../src/settings.js";
import { createApp } from "../src/server.js";
import { DesktopService } from "../src/desktop-service.js";
import { safeError } from "../src/safety.js";
import { createDesktopWindow } from "./window.js";

app.setName("StoryCore Foundry AI");
app.enableSandbox();
const directory = localDirectory();
const profile = join(directory, "desktop-profile");
mkdirSync(profile, { recursive: true });
app.setPath("userData", profile);
let shutdown: (() => Promise<void>) | null = null;
let quitting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", event => {
    if (quitting || !shutdown) return;
    event.preventDefault(); quitting = true;
    void shutdown().finally(() => app.quit());
  });
  app.whenReady().then(async () => {
    const settings = new SettingsStore(directory); await settings.load();
    const runtime = await createApp(settings);
    const service = new DesktopService(settings, runtime.bridge);
    shutdown = async () => { await service.close(); await runtime.close(); };
    const window = await createDesktopWindow(service, app.getAppPath());
    app.on("second-instance", () => { if (!window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.focus(); } });
  }).catch(error => {
    const code = safeError(error);
    console.error(code);
    dialog.showErrorBox("StoryCore Foundry AI", code === "LOCAL_PORT_UNAVAILABLE"
      ? "Port 3210 is already in use. Close the old adapter or another instance, then try again."
      : "The desktop app could not start: " + code);
    app.quit();
  });
}
