import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, SaveSettingsInput, RunDecisionInput } from "./api.js";
// Each method has one fixed channel. Never expose invoke, send, event objects or credentials.
const api: DesktopApi = Object.freeze({
  status: () => ipcRenderer.invoke("storycore:status"),
  saveSettings: (input: SaveSettingsInput) => ipcRenderer.invoke("storycore:save-settings", input),
  clearOpenRouterKey: () => ipcRenderer.invoke("storycore:clear-openrouter-key"),
  clearBridgeKey: () => ipcRenderer.invoke("storycore:clear-bridge-key"),
  testOpenRouter: () => ipcRenderer.invoke("storycore:test-openrouter"),
  detectTurn: () => ipcRenderer.invoke("storycore:detect-turn"),
  runDecision: (input: RunDecisionInput) => ipcRenderer.invoke("storycore:run-decision", input),
  cancelDecision: () => ipcRenderer.invoke("storycore:cancel-decision"),
});
contextBridge.exposeInMainWorld("storycore", api);
