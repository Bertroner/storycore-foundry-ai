import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { FireBoltDiscovery } from "../harness/fire-bolt/discovery.js";
import { FireBoltService, testHandlers } from "../harness/fire-bolt/service.js";
import { FireBoltReadBridge, type TestReadCommand } from "../harness/fire-bolt/bridge.js";
import { BridgeSession, type ReadCommand } from "../src/bridge-session.js";
import { OneShotTestGuard, type TestPorts, type OneCast } from "../harness/fire-bolt/guard.js";
import { FireBoltFixture, participant } from "./fire-bolt-fixtures.js";

test("Fire Bolt discovery resolves all IDs internally, native ownership overrides label/disposition, real owned Item verified",async()=>{
  const reader=new FireBoltFixture();const service=new FireBoltService(reader);const view=await service.detect();
  assert.equal(view.status,"READY_FOR_REVIEW");assert.equal(view.scene,"Test Arena");assert.equal(view.round,1);
  assert.equal(view.caster,"Mage");assert.equal(view.target,"Ethan");assert.equal(view.advanced.itemId,"owned-mage");
  assert.equal(view.advanced.sceneId,"scene");assert.equal(view.advanced.combatId,"combat");
  assert.equal(view.advanced.actorId,"mage");assert.equal(view.advanced.tokenId,"token-mage");assert.equal(view.advanced.targetTokenId,"token-ethan");
  assert.ok(reader.calls.some(c=>c.type==="resolve-uuid"&&c.params.uuid==="Actor.mage.Item.owned-mage"));
  assert.equal(view.writesDispatched,0);assert.equal(view.execution,"DISABLED_REVIEW_REQUIRED");
  assert.ok(reader.calls.every(c=>!c.type.includes("activate")&&!c.type.includes("move")&&!c.type.includes("next-turn")));
  assert.equal(reader.calls.filter(c=>c.type==="filter-actors").every(c=>Object.keys(c.params).sort().join() === "hasPlayerOwner,limit,offset"),true);
  assert.ok(!JSON.stringify(view).includes("description"));assert.ok(!JSON.stringify(view).includes("<p>"));
});
test("current eligible combatant wins without tactical sorting among NPC candidates",async()=>{
  const reader=new FireBoltFixture();reader.participants.unshift(participant("other","Other Mage",false));
  const v=await new FireBoltDiscovery(reader).detect();assert.equal(v.caster,"Mage");assert.equal(v.casters.length,1);
});
test("player-owned current caster is never AI controlled; unique eligible NPC fallback selected",async()=>{
  const reader=new FireBoltFixture();reader.participants.push(participant("playerMage","Player Mage",true));reader.current="playerMage";
  const v=await new FireBoltDiscovery(reader).detect();assert.equal(v.caster,"Mage");assert.equal(v.status,"SELECT_TARGET");assert.equal(v.target,null);
});
test("multiple fallback NPCs and targets require offered human-readable rows, never nearest/HP heuristic",async()=>{
  const reader=new FireBoltFixture();reader.current="ethan";reader.participants.push(participant("other","Other Mage",false),participant("alice","Alice",true,false));
  const d=new FireBoltDiscovery(reader);const v=await d.detect();assert.equal(v.status,"SELECT_CASTER");assert.equal(v.caster,null);assert.equal(v.target,null);
  assert.deepEqual(v.targets.map(p=>p.name),["Ethan","Alice"]);
  const selected=d.choose({detectionId:v.detectionId,casterRow:v.casters[1]!.row,targetRow:v.targets[1]!.row});
  assert.equal(selected.caster,"Other Mage");assert.equal(selected.target,"Alice");assert.equal(selected.advanced.targetTokenId,"token-alice");
  await d.prepare({detectionId:v.detectionId});
});
test("no active combat emits NO_ACTIVE_COMBAT and never asks for an ID",async()=>{
  for(const started of [true,false]){const r=new FireBoltFixture();r.noCombat=started;r.started=started;await assert.rejects(()=>new FireBoltDiscovery(r).detect(),/NO_ACTIVE_COMBAT/);}
});
test("missing owned Fire Bolt stops instead of importing from Compendium or using another item",async()=>{
  const r=new FireBoltFixture();r.participants[0]!.actor.items=[];
  await assert.rejects(()=>new FireBoltDiscovery(r).detect(),/CASTER_NOT_FOUND/);
});
test("unlinked, duplicate scene tokens and multiple owned Fire Bolt items fail caster discovery",async()=>{
  for(const mode of ["unlinked","duplicate","items"]){const r=new FireBoltFixture();const p=r.participants[0]!;
    if(mode==="unlinked")p.linked=false;
    if(mode==="duplicate")r.duplicateTokens.push({...p.token,id:"second-token",hidden:true});
    if(mode==="items")p.actor.items.push({...p.actor.items[0]!,id:"second-item"});
    await assert.rejects(()=>new FireBoltDiscovery(r).detect(),/CASTER_NOT_FOUND/);
  }
});
test("template, concentration, non-cantrip and activity Item are not this isolated test",async()=>{
  for(const change of [{target:{type:"sphere",value:20}},{properties:["concentration"]},{level:1},{activities:{activity:{type:"attack"}}},
    {consume:{type:"charges",target:"other-item"}}]){const r=new FireBoltFixture();Object.assign(r.participants[0]!.actor.items[0]!.system,change);
    await assert.rejects(()=>new FireBoltDiscovery(r).detect(),/CASTER_NOT_FOUND/);
  }
});
test("duplicate/unlinked player target is never silently accepted",async()=>{
  for(const duplicate of [true,false]){const r=new FireBoltFixture();const p=r.participants[1]!;
    if(duplicate)r.duplicateTokens.push({...p.token,id:"target-duplicate"});else p.linked=false;
    await assert.rejects(()=>new FireBoltDiscovery(r).detect(),/TARGET_NOT_FOUND/);
  }
});
test("missing/overlapping native ownership evidence fails closed, not inferred from lack of player results",async()=>{
  for(const overlap of [true,false]){const r=new FireBoltFixture();const read=r.read.bind(r);
    r.read=async(type,params)=>type==="filter-actors"&&params.hasPlayerOwner===false?
      {results:overlap?r.participants.map(p=>({id:p.actor.id,name:p.actor.name})):[],total:overlap?2:0,hasMore:false}:read(type,params);
    await assert.rejects(()=>new FireBoltDiscovery(r).detect(),/OWNERSHIP_UNVERIFIED/);
  }
});
test("native ownership pagination is complete, bounded and rejects inconsistent totals",async()=>{
  const r=new FireBoltFixture();const read=r.read.bind(r);let pages=0;
  r.read=async(type,p)=>{if(type!=="filter-actors"||p.hasPlayerOwner!==false)return read(type,p);
    pages++;const rows=[...Array.from({length:200},(_,i)=>({id:`extra-${i}`,name:"Extra"})),{id:"mage",name:"Mage"}];
    return {results:rows.slice(p.offset as number,(p.offset as number)+200),total:201,hasMore:p.offset===0};};
  assert.equal((await new FireBoltDiscovery(r).detect()).caster,"Mage");assert.equal(pages,2);
  r.read=async(type,p)=>type==="filter-actors"?{results:[],total:2,hasMore:false}:read(type,p);
  await assert.rejects(()=>new FireBoltDiscovery(r).detect(),/OWNERSHIP_UNVERIFIED/);
});
test("selection rejects injected technical IDs, invented row and old detection handles",async()=>{
  const d=new FireBoltDiscovery(new FireBoltFixture());const v=await d.detect();
  assert.throws(()=>d.choose({detectionId:v.detectionId,actorId:"mage"}),/TEST_READ_DATA_INVALID/);
  assert.throws(()=>d.choose({detectionId:v.detectionId,targetRow:randomUUID()}),/SELECTION_INVALID/);
  await d.detect();assert.throws(()=>d.choose({detectionId:v.detectionId}),/SCOPE_STALE/);
});
test("fresh pre-call resolution rejects scope, ownership, token and Item changes",async()=>{
  for(const mode of ["scene","round","epoch","owner","token","item"]){const r=new FireBoltFixture();const d=new FireBoltDiscovery(r);const v=await d.detect();
    if(mode==="scene")r.scene.id="other-scene";if(mode==="round")r.round++;if(mode==="epoch")r.epoch="reconnect";
    if(mode==="owner")r.participants[0]!.owner=true;if(mode==="token")r.participants[0]!.token.x++;
    if(mode==="item")r.participants[0]!.actor.items[0]!.id="changed-item";
    await assert.rejects(()=>d.prepare({detectionId:v.detectionId}),/SCOPE_STALE/);
  }
});
test("discovery stops on scene change during reading and owned Item parent mismatch",async()=>{
  const r=new FireBoltFixture();let scenes=0;r.beforeRead=type=>{if(type==="get-scene"&&++scenes===2)r.scene.id="other";};
  await assert.rejects(()=>new FireBoltDiscovery(r).detect(),/SCOPE_STALE/);
  const other=new FireBoltFixture();const read=other.read.bind(other);
  other.read=async(type,p)=>{const data=await read(type,p);return type==="resolve-uuid"&&String(p.uuid).startsWith("Actor.")?{...data as object,parentUuid:"Actor.wrong"}:data;};
  await assert.rejects(()=>new FireBoltService(other).detect(),/ITEM_NOT_OWNED_OR_UNSUPPORTED/);
});
test("test IPC exposes fixed detection/row and DPAPI-key channels; caller, shape and secret output stay bounded",async()=>{
  let saved="";const service=new FireBoltService(new FireBoltFixture(),{hasBridgeKey:()=>!!saved,saveBridgeKey:async key=>{saved=key;}});
  const h=testHandlers(service,e=>e==="trusted");
  assert.deepEqual(Object.keys(h),["fire-bolt:status","fire-bolt:save-bridge-key","fire-bolt:detect","fire-bolt:choose"]);
  assert.deepEqual(await h["fire-bolt:detect"]("untrusted"),{ok:false,error:"IPC_CALLER_DENIED"});
  assert.deepEqual(await h["fire-bolt:detect"]("trusted",{sceneId:"scene"}),{ok:false,error:"IPC_ARGS_INVALID"});
  assert.deepEqual(await h["fire-bolt:save-bridge-key"]("trusted",{bridgeKey:"short"}),{ok:false,error:"BRIDGE_KEY_INVALID"});
  const key="offline-bridge-key-value";const savedReply=await h["fire-bolt:save-bridge-key"]("trusted",{bridgeKey:key});
  assert.equal(saved,key);assert.equal(savedReply.ok,true);assert.equal(JSON.stringify(savedReply).includes(key),false);
  assert.equal(savedReply.ok&&(savedReply.data as {hasBridgeKey:boolean}).hasBridgeKey,true);assert.equal((await h["fire-bolt:detect"]("trusted")).ok,true);
});
test("read-only test Bridge rejects activation/arbitrary UUIDs; production extra reads still denied",async()=>{
  const bridge=new FireBoltReadBridge();const prod=new BridgeSession();
  for(const type of ["dnd5e/activate-item","move-token","next-turn","execute-script"])
    await assert.rejects(()=>bridge.read(type as TestReadCommand,{}),/READ_ONLY_COMMAND_DENIED/);
  await assert.rejects(()=>bridge.read("resolve-uuid",{uuid:"Compendium.module.pack.spell"}),/READ_PARAMS_INVALID/);
  await assert.rejects(()=>bridge.read("resolve-uuid",{uuid:"User.gm"}),/READ_PARAMS_INVALID/);
  await assert.rejects(()=>prod.read("filter-actors" as ReadCommand,{hasPlayerOwner:false}),/READ_ONLY_COMMAND_DENIED/);
  assert.equal(bridge.readsSent,0);assert.equal(prod.readsSent,0);
});
test("real read transport maps only exact no-combat failure, redacts other Bridge errors",async()=>{
  const server=new WebSocketServer({port:0,host:"127.0.0.1"});await once(server,"listening");const addr=server.address();assert.ok(addr&&typeof addr!=="string");
  const peer=new WebSocket(`ws://127.0.0.1:${addr.port}`);const [socket]=await once(server,"connection");await once(peer,"open");
  const bridge=new FireBoltReadBridge();bridge.attach(socket);let error="No active combat";
  peer.on("message",raw=>{const req=JSON.parse(raw.toString());peer.send(JSON.stringify({id:req.id,success:false,error}));});
  try{
    await assert.rejects(()=>bridge.read("get-combat-state",{}),/NO_ACTIVE_COMBAT/);
    error="secret credentials here";await assert.rejects(()=>bridge.read("get-combat-state",{}),/^Error: BRIDGE_READ_FAILED_GET_COMBAT_STATE$/);
  }finally{bridge.disconnect();peer.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
async function guardFixture(){const r=new FireBoltFixture();const d=new FireBoltDiscovery(r);const v=await d.detect();const before=await d.prepare({detectionId:v.detectionId});
  const commands:OneCast[]=[];let observations=0;
  const ports:TestPorts={prepare:async()=>before,dispatch:async command=>{commands.push(command);return {unscoped:"not proof"};},observe:async command=>{
    observations++;return {scopeKey:before.snapshot.scopeKey,settled:true,interference:false,workflow:{source:"SCOPED_OBSERVATION",requestId:command.id,
      actorId:before.caster.actor.id,tokenId:before.caster.token.id,itemId:before.caster.item.id,targetTokenIds:[before.target.token.id]}};}};
  return {r,d,v,before,commands,ports,observations:()=>observations};
}
test("one-shot guard uses exactly real owned Item and one target; no extra parameters/writes/retry",async()=>{
  const f=await guardFixture();const guard=new OneShotTestGuard(f.ports);const result=await guard.run();
  assert.equal(result.status,"OBSERVED_MATCHING_WORKFLOW");assert.equal(result.writesDispatched,1);assert.equal(f.observations(),1);
  assert.deepEqual(f.commands[0]!.params,{actorId:"mage",itemId:"owned-mage",targetTokenIds:["token-ethan"]});
  await assert.rejects(()=>guard.run(),/TEST_ALREADY_ATTEMPTED/);assert.equal(f.commands.length,1);
});
test("one-shot guard always observes failed/ambiguous dispatch and never treats unscoped workflow as correlation",async()=>{
  for(const mode of ["sendFailure","unscoped","wrongItem","wrongTarget","interference","scope"]){const f=await guardFixture();const observe=f.ports.observe;
    if(mode==="sendFailure")f.ports.dispatch=async c=>{f.commands.push(c);throw new Error("uncertain partial mutation");};
    f.ports.observe=async(c,b)=>{const o=await observe(c,b);if(mode==="unscoped")o.workflow!.source="UNSCOPED_BRIDGE";
      if(mode==="wrongItem")o.workflow!.itemId="other";if(mode==="wrongTarget")o.workflow!.targetTokenIds=["other"];
      if(mode==="interference")o.interference=true;if(mode==="scope")o.scopeKey="other";return o;};
    const guard=new OneShotTestGuard(f.ports);assert.equal((await guard.run()).status,["scope","interference"].includes(mode)?"TEST_INTERFERENCE":"WORKFLOW_CORRELATION_UNCERTAIN");
    assert.equal(f.observations(),1);await assert.rejects(()=>guard.run(),/TEST_ALREADY_ATTEMPTED/);assert.equal(f.commands.length,1);
  }
});
test("timed-out/late dispatch is observed once and can never trigger retry or late success",async()=>{
  const f=await guardFixture();let settle!:()=>void;f.ports.dispatch=c=>{f.commands.push(c);return new Promise<void>(resolve=>{settle=resolve;});};
  const guard=new OneShotTestGuard(f.ports,10);const result=await guard.run();assert.equal(result.status,"WORKFLOW_CORRELATION_UNCERTAIN");
  settle();await Promise.resolve();assert.equal(result.status,"WORKFLOW_CORRELATION_UNCERTAIN");assert.equal(f.observations(),1);
  await assert.rejects(()=>guard.run(),/TEST_ALREADY_ATTEMPTED/);assert.equal(f.commands.length,1);
});
test("stale preflight causes zero writes, concurrent double Run cannot pass the fuse",async()=>{
  const f=await guardFixture();f.r.round++;f.ports.prepare=()=>f.d.prepare({detectionId:f.v.detectionId});
  await assert.rejects(()=>new OneShotTestGuard(f.ports).run(),/SCOPE_STALE/);assert.equal(f.commands.length,0);
  const g=await guardFixture();const guard=new OneShotTestGuard(g.ports);const first=guard.run();
  await assert.rejects(()=>guard.run(),/TEST_ALREADY_ATTEMPTED/);await first;assert.equal(g.commands.length,1);
});
