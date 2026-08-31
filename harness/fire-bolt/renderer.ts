import type { DiscoveryView } from "./discovery.js";
type Reply<T>={ok:true;data:T}|{ok:false;error:string};
declare global { interface Window { fireBolt:{status():Promise<Reply<{connected:boolean;view:DiscoveryView|null}>>;
  detect():Promise<Reply<DiscoveryView>>;choose(input:unknown):Promise<Reply<DiscoveryView>>} } }
const element=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let view:DiscoveryView|null=null; let busy=false; let userStarted=false;
const text=(id:string,value:string)=>{element(id).textContent=value;};
function options(id:string,rows:{row:string;name:string}[],selected:string|null){
  const select=element<HTMLSelectElement>(id); select.replaceChildren();
  if(!selected) select.add(new Option("Choose a participant", ""));
  rows.forEach((row,index)=>{
    const duplicate=rows.filter(other=>other.name===row.name).length>1;
    select.add(new Option(duplicate?`${row.name} (row ${index+1})`:row.name,row.row));
  });
  select.value=selected??"";select.disabled=busy || rows.length===1;
}
function render(next:DiscoveryView){
  view=next;text("scene",next.scene);text("combat",`Round ${next.round}`);text("current",next.currentCombatant??"No current combatant");
  options("caster",next.casters,next.casterRow);options("target",next.targets,next.targetRow);
  text("status",next.status);text("advanced",JSON.stringify(next.advanced,null,2));
}
async function perform(action:()=>Promise<Reply<DiscoveryView>>){
  if(busy)return; busy=true;element<HTMLButtonElement>("refresh").disabled=true;
  element<HTMLSelectElement>("caster").disabled=true;element<HTMLSelectElement>("target").disabled=true;text("status","Reading Foundry…");
  try {const result=await action(); if(result.ok)render(result.data);else{view=null;text("status",result.error);text("advanced","");text("scene","—");text("combat","—");text("current","—");options("caster",[],null);options("target",[],null);}}
  catch {view=null;text("status","HARNESS_UNAVAILABLE");}
  finally{busy=false;element<HTMLButtonElement>("refresh").disabled=false;if(view)render(view);}
}
element("refresh").onclick=()=>{userStarted=true;void perform(()=>window.fireBolt.detect());};
for(const key of ["caster","target"] as const) element(key).onchange=()=>{
  if(!view)return; const row=element<HTMLSelectElement>(key).value;if(!row)return;
  void perform(()=>window.fireBolt.choose({detectionId:view!.detectionId,[`${key}Row`]:row}));
};
// Bounded connection wait only; no repeated decision/read loop. Refresh is an explicit operator action.
async function firstDetection(){
  for(let attempt=0;attempt<120&&!userStarted;attempt++){
    const result=await window.fireBolt.status();
    if(result.ok&&result.data.connected){await perform(()=>window.fireBolt.detect());return;}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!userStarted)text("status","BRIDGE_CONNECTION_WAIT_EXPIRED — use Refresh after connecting Bridge");
}
void firstDetection();
