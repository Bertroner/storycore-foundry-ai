import { BrowserWindow, ipcMain, protocol, session } from "electron";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FireBoltService, TEST_UI_URL, testHandlers } from "./service.js";
protocol.registerSchemesAsPrivileged([{scheme:"storycore-test",privileges:{standard:true,secure:true,supportFetchAPI:false}}]);
export async function createTestWindow(service:FireBoltService, root:string, show=true) {
  const isolated=session.fromPartition("storycore-fire-bolt-test");
  isolated.setPermissionRequestHandler((_c,_p,callback)=>callback(false));
  isolated.setPermissionCheckHandler(()=>false);
  isolated.on("will-download",event=>event.preventDefault());
  const assets=new Map([
    [TEST_UI_URL,{path:join(root,"harness/fire-bolt/ui/index.html"),type:"text/html"}],
    ["storycore-test://ui/renderer.js",{path:join(root,"dist/harness/fire-bolt/renderer.js"),type:"text/javascript"}],
    ["storycore-test://ui/style.css",{path:join(root,"harness/fire-bolt/ui/style.css"),type:"text/css"}],
  ]);
  await isolated.protocol.handle("storycore-test",async request=>{
    const asset=assets.get(request.url);
    if(!asset || request.method!=="GET") return new Response(null,{status:404});
    return new Response(await readFile(asset.path),{headers:{"Content-Type":asset.type+"; charset=utf-8",
      "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  });
  isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!assets.has(details.url)}));
  const window=new BrowserWindow({width:850,height:780,minWidth:650,minHeight:600,show:false,
    title:"StoryCore — Fire Bolt test discovery",autoHideMenuBar:true,
    webPreferences:{preload:join(root,"dist/harness/fire-bolt/preload.cjs"),session:isolated,contextIsolation:true,
      nodeIntegration:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,webviewTag:false,spellcheck:false,devTools:false}});
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  window.webContents.on("will-navigate",event=>event.preventDefault());
  window.webContents.on("will-frame-navigate",event=>event.preventDefault());
  window.webContents.on("will-attach-webview",event=>event.preventDefault());
  const handlers=testHandlers(service,event=>{
    const e=event as Electron.IpcMainInvokeEvent;
    return e.sender===window.webContents && e.senderFrame===window.webContents.mainFrame && e.senderFrame.url===TEST_UI_URL;
  });
  for(const [channel,handler] of Object.entries(handlers)) ipcMain.handle(channel,handler);
  window.once("closed",()=>{for(const channel of Object.keys(handlers)) ipcMain.removeHandler(channel); isolated.protocol.unhandle("storycore-test");});
  if(show) window.once("ready-to-show",()=>window.show());
  await window.loadURL(TEST_UI_URL); return window;
}
