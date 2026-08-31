// Standalone supervised discovery app. No activation or OpenRouter binding.
import { app } from "electron";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { SettingsStore, localDirectory } from "../../src/settings.js";
import { createApp } from "../../src/server.js";
import { redact, safeError } from "../../src/safety.js";
import { FireBoltReadBridge } from "./bridge.js";
import { FireBoltService } from "./service.js";
import { createTestWindow } from "./window.js";
app.enableSandbox();
const profile=join(localDirectory(),"fire-bolt-test-profile");mkdirSync(profile,{recursive:true});
app.setPath("userData",profile);
if(!app.requestSingleInstanceLock()) app.exit(0);
else {
  let close:undefined|(()=>Promise<void>); let quitting=false;
  app.on("before-quit",event=>{if(close&&!quitting){event.preventDefault();quitting=true;void close().finally(()=>app.exit());}});
  app.on("window-all-closed",()=>app.quit());
  void (async()=>{
  try {
    const settings=new SettingsStore(localDirectory());await settings.load();
    const bridge=new FireBoltReadBridge();const runtime=await createApp(settings,3210,bridge);close=()=>runtime.close();
    const service=new FireBoltService(bridge,{
      hasBridgeKey:()=>settings.publicView().hasBridgeKey,
      saveBridgeKey:async bridgeKey=>{const current=settings.publicView();await settings.save({provider:"openrouter",
        model:current.model,temperature:current.temperature,bridgeKey});},
    });
    // Safe, compact outcome only; no raw documents, settings, credentials or workflow payloads.
    const detect=service.detect.bind(service);
    service.detect=async()=>{try{const view=await detect();console.log(redact(JSON.stringify({status:view.status,scene:view.scene,
      round:view.round,caster:view.caster,spell:view.spell,target:view.target,casters:view.casters.map(c=>c.name),targets:view.targets.map(t=>t.name),
      execution:view.execution,writesDispatched:0}),[settings.credentials().apiKey,settings.credentials().bridgeKey]));return view;
    }catch(error){console.log(JSON.stringify({status:safeError(error),execution:"DISABLED_REVIEW_REQUIRED",writesDispatched:0}));throw error;}};
    await app.whenReady();const window=await createTestWindow(service,fileURLToPath(new URL("../../../",import.meta.url)));
    window.show();
    app.on("second-instance",()=>{if(!window.isDestroyed()){window.show();window.focus();}});
    console.log("FIRE_BOLT_DISCOVERY_LISTENING_READ_ONLY");
  }catch(error){console.error(safeError(error));await close?.();app.exit(1);}
  })();
}
