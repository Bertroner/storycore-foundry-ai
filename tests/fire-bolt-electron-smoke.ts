// Offline UI/backend integration: fake Bridge data only, no live Foundry or provider connection.
import { app } from "electron";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { FireBoltService } from "../harness/fire-bolt/service.js";
import { createTestWindow } from "../harness/fire-bolt/window.js";
import { FireBoltFixture, participant } from "./fire-bolt-fixtures.js";
app.enableSandbox();
async function smoke() {
const directory=await mkdtemp(join(tmpdir(),"storycore-fire-bolt-smoke-"));app.setPath("userData",directory);
const timer=setTimeout(()=>{console.error("FIRE_BOLT_UI_TIMEOUT");app.exit(1);},30000);
try {
  await app.whenReady();console.log("FIRE_BOLT_UI_APP_READY");const reader=new FireBoltFixture();reader.participants.push(participant("alice","Alice",true,false));
  const window=await createTestWindow(new FireBoltService(reader),resolve("."),false);
  const metrics=app.getAppMetrics().find(m=>m.pid===window.webContents.getOSProcessId());assert.equal(metrics?.sandboxed,true);
  console.log("FIRE_BOLT_UI_WINDOW_READY");
  const initial=await window.webContents.executeJavaScript(`(async()=>{
    for(let i=0;i<100&&document.getElementById("status").textContent!=="SELECT_TARGET";i++)await new Promise(r=>setTimeout(r,30));
    return {status:document.getElementById("status").textContent,scene:document.getElementById("scene").textContent,
      caster:document.getElementById("caster").selectedOptions[0].textContent,
      targets:Array.from(document.getElementById("target").options,o=>o.textContent),
      inputs:document.querySelectorAll("input").length,runDisabled:document.getElementById("run").disabled,
      methods:Object.keys(window.fireBolt).sort(),node:typeof require,networkBlocked:await fetch("https://example.com").then(()=>false,()=>true)};
  })()`);
  assert.equal(initial.status,"SELECT_TARGET");assert.equal(initial.scene,"Test Arena");assert.equal(initial.caster,"Mage");
  assert.deepEqual(initial.targets,["Choose a participant","Ethan","Alice"]);assert.equal(initial.inputs,0);
  assert.equal(initial.runDisabled,true);assert.deepEqual(initial.methods,["choose","detect","status"]);assert.equal(initial.node,"undefined");assert.equal(initial.networkBlocked,true);
  const selected=await window.webContents.executeJavaScript(`(async()=>{
    const target=document.getElementById("target");target.value=target.options[2].value;target.dispatchEvent(new Event("change"));
    for(let i=0;i<100&&document.getElementById("status").textContent!=="READY_FOR_REVIEW";i++)await new Promise(r=>setTimeout(r,30));
    return {status:document.getElementById("status").textContent,target:target.selectedOptions[0].textContent,
      advanced:JSON.parse(document.getElementById("advanced").textContent),advancedOpen:document.querySelector("details").open,
      runDisabled:document.getElementById("run").disabled};
  })()`);
  assert.equal(selected.status,"READY_FOR_REVIEW");assert.equal(selected.target,"Alice");assert.equal(selected.advanced.targetTokenId,"token-alice");
  assert.equal(selected.advanced.itemId,"owned-mage");assert.equal(selected.advancedOpen,false);assert.equal(selected.runDisabled,true);
  assert.ok(reader.calls.some(c=>c.type==="resolve-uuid"&&c.params.uuid==="Actor.mage.Item.owned-mage"));
  assert.ok(reader.calls.every(c=>!["move-token","next-turn","dnd5e/activate-item"].includes(c.type)));
  console.log("FIRE_BOLT_UI_ASSERTIONS_PASSED");
  await new Promise(resolve=>setTimeout(resolve,500));
  await mkdir("tmp",{recursive:true});await writeFile("tmp/fire-bolt-ui-smoke.png",(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  console.log("FIRE_BOLT_UI_PASS: automatic scene/combat/caster/owned Item, name-row target selection, IDs advanced-only, run disabled, zero writes");
  window.destroy();clearTimeout(timer);app.exit(0);
} catch(error) {console.error(error instanceof Error?error.message:"FIRE_BOLT_UI_FAILED");clearTimeout(timer);app.exit(1);}

}
void smoke();
