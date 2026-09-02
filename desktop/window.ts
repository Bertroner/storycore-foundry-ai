import { BrowserWindow, ipcMain, protocol, session } from "electron";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DesktopService } from "../src/desktop-service.js";
import { createIpcHandlers, UI_URL } from "./ipc.js";

protocol.registerSchemesAsPrivileged([{ scheme: "storycore-app", privileges: { standard: true, secure: true, supportFetchAPI: false } }]);
export async function createDesktopWindow(service: DesktopService, root: string, show = true) {
  // Nonpersistent app-only partition; no Chrome profile, password manager or saved forms.
  const isolated = session.fromPartition("storycore-desktop");
  isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  isolated.setPermissionCheckHandler(() => false);
  isolated.on("will-download", event => event.preventDefault());
  const assets = new Map([
    [UI_URL, { path: join(root, "desktop/ui/index.html"), type: "text/html" }],
    ["storycore-app://ui/renderer.js", { path: join(root, "dist/desktop/renderer.js"), type: "text/javascript" }],
    ["storycore-app://ui/style.css", { path: join(root, "desktop/ui/style.css"), type: "text/css" }],
  ]);
  const csp = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  await isolated.protocol.handle("storycore-app", async request => {
    const asset = assets.get(request.url);
    if (!asset || request.method !== "GET") return new Response(null, { status: 404 });
    return new Response(await readFile(asset.path), { headers: { "Content-Type": asset.type + "; charset=utf-8",
      "Content-Security-Policy": csp, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  });
  isolated.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !assets.has(details.url) }));
  const window = new BrowserWindow({ width: 1120, height: 900, minWidth: 820, minHeight: 650, show: false,
    title: "StoryCore Foundry AI - Supervised Turn", autoHideMenuBar: true,
    webPreferences: { preload: join(root, "dist/desktop/preload.cjs"), session: isolated,
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      allowRunningInsecureContent: false, webviewTag: false, spellcheck: false, devTools: false } });
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", event => event.preventDefault());
  window.webContents.on("will-frame-navigate", event => event.preventDefault());
  window.webContents.on("will-attach-webview", event => event.preventDefault());
  const handlers = createIpcHandlers(service, event => event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame);
  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler);
  const dispose = () => {
    for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel);
    isolated.protocol.unhandle("storycore-app");
  };
  window.once("closed", dispose);
  if (show) window.once("ready-to-show", () => window.show());
  await window.loadURL(UI_URL);
  return window;
}
