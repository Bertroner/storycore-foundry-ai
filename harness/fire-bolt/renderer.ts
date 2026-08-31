import type { DiscoveryView } from "./discovery.js";
import type { HarnessStatus } from "./service.js";
type Reply<T>={ok:true;data:T}|{ok:false;error:string};
declare global { interface Window { fireBolt:{status():Promise<Reply<HarnessStatus>>;
  saveBridgeKey(key:unknown):Promise<Reply<HarnessStatus>>;detect():Promise<Reply<DiscoveryView>>;
  choose(input:unknown):Promise<Reply<DiscoveryView>>} } }
const element=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let view:DiscoveryView|null=null; let busy=false; let userStarted=false; let connectionLoop=false;
const text=(id:string,value:string)=>{element(id).textContent=value;};
function connection(status:HarnessStatus){
  text("bridgeStatus",status.connected?"CONNECTED":status.hasBridgeKey?"WAITING_FOR_FOUNDRY_BRIDGE":"BRIDGE_KEY_REQUIRED");
}
function options(id:string,rows:{row:string;name:string}[],selected:string|null){
  const select=element<HTMLSelectElement>(id); select.replaceChildren();
  if(!selected) select.add(new Option("Choose a participant", ""));
  rows.forEach((row,index)=>{
    const duplicate=rows.filter(other=>other.name===row.name).length>1;
    select.add(new Option(duplicate?`${row.name} (row ${index+1})`:row.name,row.row));
  });
  select.value=selected??"";select.disabled=busy || rows.length===1;
}
function showDiagnostics(status:HarnessStatus){
  text("candidateDiagnostics",status.diagnostics.map(row=>`${row.name}: ${row.reason}`).join("\n"));
}
function render(next:DiscoveryView){
  view=next;text("candidateDiagnostics","");text("scene",next.scene);text("combat",`Round ${next.round}`);text("current",next.currentCombatant??"No current combatant");
  options("caster",next.casters,next.casterRow);options("target",next.targets,next.targetRow);
  text("status",next.status);text("advanced",JSON.stringify(next.advanced,null,2));
}
async function perform(action:()=>Promise<Reply<DiscoveryView>>){
  if(busy)return; busy=true;element<HTMLButtonElement>("refresh").disabled=true;
  element<HTMLSelectElement>("caster").disabled=true;element<HTMLSelectElement>("target").disabled=true;text("status","Reading Foundry…");
  try {const result=await action(); if(result.ok)render(result.data);else{view=null;text("status",result.error);text("advanced","");text("scene","—");text("combat","—");text("current","—");options("caster",[],null);options("target",[],null);const current=await window.fireBolt.status();if(current.ok){connection(current.data);showDiagnostics(current.data);}}}
  catch {view=null;text("status","HARNESS_UNAVAILABLE");}
  finally{busy=false;element<HTMLButtonElement>("refresh").disabled=false;if(view)render(view);}
}
element("refresh").onclick=()=>{userStarted=true;void (async()=>{
  const result=await window.fireBolt.status();if(!result.ok){text("status",result.error);return;}connection(result.data);
  if(result.data.connected)await perform(()=>window.fireBolt.detect());else text("status","BRIDGE_DISCONNECTED — save the matching key and wait for Foundry Bridge");
})();};
for(const key of ["caster","target"] as const) element(key).onchange=()=>{
  if(!view)return; const row=element<HTMLSelectElement>(key).value;if(!row)return;
  void perform(()=>window.fireBolt.choose({detectionId:view!.detectionId,[`${key}Row`]:row}));
};
element("saveBridgeKey").onclick=()=>{void (async()=>{
  const input=element<HTMLInputElement>("bridgeKey");const button=element<HTMLButtonElement>("saveBridgeKey");button.disabled=true;input.disabled=true;
  text("bridgeMessage","Saving encrypted Bridge key…");
  try {const result=await window.fireBolt.saveBridgeKey(input.value);
    if(!result.ok){text("bridgeMessage",result.error);return;}
    input.value="";connection(result.data);text("bridgeMessage",result.data.connected?"BRIDGE_KEY_SAVED — Bridge is connected":"BRIDGE_KEY_SAVED — waiting for Foundry API Bridge to reconnect automatically");
    userStarted=false;void firstDetection();
  } catch {text("bridgeMessage","HARNESS_UNAVAILABLE");}
  finally {button.disabled=false;input.disabled=false;}
})();};
// Bounded connection wait only; no repeated decision/read loop. Refresh is an explicit operator action.
async function firstDetection(){
  if(connectionLoop)return;connectionLoop=true;
  try {for(let attempt=0;attempt<120&&!userStarted;attempt++){
    const result=await window.fireBolt.status();
    if(result.ok){connection(result.data);if(result.data.connected){await perform(()=>window.fireBolt.detect());return;}}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!userStarted)text("status","BRIDGE_CONNECTION_WAIT_EXPIRED — verify the key, Foundry module URL, and port 3210");
  } finally {connectionLoop=false;}
}
void firstDetection();
