import type { TestReader } from "./bridge.js";
import { FireBoltDiscovery } from "./discovery.js";
import { ensure, safeError } from "../../src/safety.js";

export class FireBoltService {
  readonly discovery: FireBoltDiscovery;
  private busy=false;
  constructor(private reader: TestReader) { this.discovery=new FireBoltDiscovery(reader); }
  status() {
    const view=this.discovery.view();
    if (!this.reader.connected || (view && view.advanced.epoch!==this.reader.epoch)) this.discovery.invalidate();
    return {connected:this.reader.connected,execution:"DISABLED_REVIEW_REQUIRED",writesDispatched:0,view:this.discovery.view()};
  }
  private async review(work: () => Promise<unknown>) {
    ensure(!this.busy,"TEST_BUSY"); this.busy=true;
    try {
      await work(); const view=this.discovery.view()!;
      if (view.status==="READY_FOR_REVIEW") await this.discovery.prepare({detectionId:view.detectionId});
      return this.discovery.view()!;
    } catch (error) { this.discovery.invalidate(); throw error; }
    finally { this.busy=false; }
  }
  detect() { return this.review(()=>this.discovery.detect()); }
  choose(choice: unknown) { return this.review(async()=>this.discovery.choose(choice)); }
}
export const TEST_UI_URL="storycore-test://ui/index.html";
// Fixed local IPC: no arbitrary Bridge RPC, IDs, settings, provider calls or live Run endpoint.
export function testHandlers(service: FireBoltService, trusted: (event: unknown)=>boolean) {
  const handler=(count:number,fn:(input?:unknown)=>unknown) => async(event:unknown,...args:unknown[])=>{
    try {
      ensure(trusted(event),"IPC_CALLER_DENIED"); ensure(args.length===count,"IPC_ARGS_INVALID");
      ensure(Buffer.byteLength(JSON.stringify(args))<=2048,"IPC_ARGS_INVALID");
      return {ok:true,data:await fn(args[0])};
    } catch(error) { return {ok:false,error:safeError(error)}; }
  };
  return {"fire-bolt:status":handler(0,()=>service.status()),"fire-bolt:detect":handler(0,()=>service.detect()),
    "fire-bolt:choose":handler(1,input=>service.choose(input))};
}
