import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("fireBolt",Object.freeze({
  status:()=>ipcRenderer.invoke("fire-bolt:status"),
  detect:()=>ipcRenderer.invoke("fire-bolt:detect"),
  choose:(selection:unknown)=>ipcRenderer.invoke("fire-bolt:choose",selection),
}));
