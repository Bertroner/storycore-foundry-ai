import type { TestReader } from "./bridge.js";
import { FireBoltDiscovery } from "./discovery.js";
import { ensure, safeError } from "../../src/safety.js";
import { z } from "zod";

export interface BridgeSettings {
  hasBridgeKey(): boolean;
  saveBridgeKey(key: string): Promise<void>;
}
export type HarnessStatus = { connected: boolean; hasBridgeKey: boolean; execution: "DISABLED_REVIEW_REQUIRED";
  writesDispatched: 0; diagnostics: ReturnType<FireBoltDiscovery["diagnostics"]>; view: ReturnType<FireBoltDiscovery["view"]> };
const bridgeKeyInput = z.object({ bridgeKey: z.string().trim().min(16).max(512) }).strict();

export class FireBoltService {
  readonly discovery: FireBoltDiscovery;
  private busy=false;
  constructor(private reader: TestReader, private settings?: BridgeSettings) { this.discovery=new FireBoltDiscovery(reader); }
  status(): HarnessStatus {
    const view=this.discovery.view();
    if (!this.reader.connected || (view && view.advanced.epoch!==this.reader.epoch)) this.discovery.invalidate();
    return {connected:this.reader.connected,hasBridgeKey:this.settings?.hasBridgeKey()??false,execution:"DISABLED_REVIEW_REQUIRED",writesDispatched:0,diagnostics:this.discovery.diagnostics(),view:this.discovery.view()};
  }
  async saveBridgeKey(input: unknown): Promise<HarnessStatus> {
    ensure(this.settings,"BRIDGE_SETTINGS_UNAVAILABLE");
    const parsed=bridgeKeyInput.safeParse(input);ensure(parsed.success,"BRIDGE_KEY_INVALID");
    await this.settings.saveBridgeKey(parsed.data.bridgeKey);return this.status();
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
  return {"fire-bolt:status":handler(0,()=>service.status()),
    "fire-bolt:save-bridge-key":handler(1,input=>service.saveBridgeKey(input)),"fire-bolt:detect":handler(0,()=>service.detect()),
    "fire-bolt:choose":handler(1,input=>service.choose(input))};
}
