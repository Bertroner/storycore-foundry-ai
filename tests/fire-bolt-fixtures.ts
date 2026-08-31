import type { TestReader, TestReadCommand } from "../harness/fire-bolt/bridge.js";
import { SafeError } from "../src/safety.js";
export function fireBoltItem(id="owned-fire-bolt") {return {id,name:"Fire Bolt",type:"spell",system:{level:0,actionType:"rsak",
  activation:{type:"action",cost:1},target:{type:"creature",value:1},properties:["vocal","somatic"],
  uses:{value:null,max:"",per:""},consume:{type:"",target:""},damage:{parts:[["1d10","fire"]]},description:{value:"<p>Not exposed to test UI</p>"}}};}
export function participant(actorId:string,name:string,owner:boolean,item=true) {
  return {actor:{id:actorId,name,type:owner?"npc":"character",system:{attributes:{hp:{value:20,max:20,temp:0}},
    spells:{spell1:{value:2,max:2}},resources:{}},items:item?[fireBoltItem(`owned-${actorId}`)]:[]},
    token:{id:`token-${actorId}`,actorId,name,x:100,y:100,hidden:false,disposition:owner?-1:1},linked:true,owner};
}
export class FireBoltFixture implements TestReader {
  connected=true;epoch="fixture-epoch";scene={id:"scene",name:"Test Arena",active:true};
  participants=[participant("mage","Mage",false),participant("ethan","Ethan",true,false)];
  current="mage";round=1;started=true;calls:{type:string;params:Record<string,unknown>}[]=[];
  duplicateTokens:unknown[]=[];noCombat=false;
  beforeRead:((type:TestReadCommand,params:Record<string,unknown>)=>void)|undefined;
  combatant(p:ReturnType<typeof participant>){return {id:`combatant-${p.actor.id}`,actorId:p.actor.id,tokenId:p.token.id,name:p.actor.name,hidden:false,defeated:false};}
  async read(type:TestReadCommand,params:Record<string,unknown>):Promise<unknown>{
    this.calls.push({type,params});this.beforeRead?.(type,params);
    switch(type){
      case "get-world-info":return {world:{id:"world",foundryVersion:"12.343",system:"dnd5e",systemVersion:"3.3.1"}};
      case "get-scene":return structuredClone(this.scene);
      case "get-combat-state":if(this.noCombat)throw new SafeError("NO_ACTIVE_COMBAT");return {id:"combat",started:this.started,round:this.round,turn:0,
        current:this.participants.find(p=>p.actor.id===this.current)?this.combatant(this.participants.find(p=>p.actor.id===this.current)!):null,
        combatants:this.participants.map(p=>this.combatant(p))};
      case "get-scene-tokens":return {sceneId:this.scene.id,tokens:structuredClone([...this.participants.map(p=>p.token),...this.duplicateTokens])};
      case "get-actor":return structuredClone(this.participants.find(p=>p.actor.id===params.actorId)!.actor);
      case "filter-actors":{
        const rows=this.participants.filter(p=>p.owner===params.hasPlayerOwner).map(p=>({id:p.actor.id,name:p.actor.name}));
        const offset=params.offset as number;return {results:rows.slice(offset,offset+200),total:rows.length,hasMore:offset+200<rows.length};}
      case "resolve-uuid":{
        const uuid=params.uuid as string;const parts=uuid.split(".");
        if(parts[0]==="Combat")return {uuid,documentName:"Combat",id:parts[1],parentUuid:null,data:{scene:this.scene.id,active:true}};
        if(parts[0]==="Scene"){
          const p=this.participants.find(p=>p.token.id===parts[3])!;
          return {uuid,documentName:"Token",id:p.token.id,parentUuid:`Scene.${this.scene.id}`,data:{_id:p.token.id,actorId:p.actor.id,
            actorLink:p.linked,x:p.token.x,y:p.token.y,hidden:p.token.hidden}};
        }
        if(parts[0]==="Actor"){
          const p=this.participants.find(p=>p.actor.id===parts[1])!;const item=p.actor.items.find(i=>i.id===parts[3])!;
          return {uuid,documentName:"Item",id:item.id,parentUuid:`Actor.${p.actor.id}`,data:{_id:item.id,name:item.name,type:item.type,system:structuredClone(item.system)}};
        }
      }
    }
    throw new Error("UNEXPECTED_TEST_READ");
  }
}
