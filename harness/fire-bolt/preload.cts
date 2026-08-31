import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("fireBolt",Object.freeze({
  status:()=>ipcRenderer.invoke("fire-bolt:status"),
  saveBridgeKey:(bridgeKey:unknown)=>ipcRenderer.invoke("fire-bolt:save-bridge-key",{bridgeKey}),
  detect:()=>ipcRenderer.invoke("fire-bolt:detect"),
  choose:(selection:unknown)=>ipcRenderer.invoke("fire-bolt:choose",selection),
}));
