// Isolated test policy, deliberately NOT wired to a live dispatcher in discovery mode.
// A later reviewed execution binding must supply independently scoped observation.
import { randomUUID } from "node:crypto";
import { ensure } from "../../src/safety.js";
import type { Selection } from "./discovery.js";

export type OneCast = { id: string; type: "dnd5e/activate-item"; params: { actorId: string; itemId: string; targetTokenIds: [string] } };
export type TestObservation = { scopeKey: string; settled: boolean; interference: boolean;
  workflow: null | { source: "SCOPED_OBSERVATION" | "UNSCOPED_BRIDGE"; requestId: string;
    actorId: string; tokenId: string; itemId: string; targetTokenIds: string[] } };
export interface TestPorts {
  prepare(): Promise<Selection>;
  dispatch(command: OneCast): Promise<unknown>;
  observe(command: OneCast, before: Selection): Promise<TestObservation>;
}
export type GuardResult = { requestId: string; writesDispatched: 1;
  status: "OBSERVED_MATCHING_WORKFLOW" | "TEST_INTERFERENCE" | "WORKFLOW_CORRELATION_UNCERTAIN" };
// A timeout does not cancel a Foundry mutation. The fuse stays spent forever; observe, never retry.
async function bounded<T>(work: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve().then(work), new Promise<T>((_r,reject) => {
    timer=setTimeout(()=>reject(new Error("TEST_TIMEOUT")),ms);
  })]); } finally { clearTimeout(timer); }
}
export class OneShotTestGuard {
  private spent=false;
  constructor(private ports: TestPorts, private deadlineMs=15000) {
    ensure(Number.isFinite(deadlineMs) && deadlineMs>0 && deadlineMs<=60000,"TEST_TIMEOUT_INVALID");
  }
  async run(): Promise<GuardResult> {
    ensure(!this.spent,"TEST_ALREADY_ATTEMPTED"); this.spent=true;
    const before=await this.ports.prepare(); // Fresh scope/ownership/owned-Item check; fails before any dispatch.
    const command: OneCast={id:randomUUID(),type:"dnd5e/activate-item",params:{actorId:before.caster.actor.id,
      itemId:before.caster.item.id,targetTokenIds:[before.target.token.id]}};
    let dispatchSettled=false;
    try { await bounded(()=>this.ports.dispatch(command),this.deadlineMs); dispatchSettled=true; } catch { /* Observe even send failure/timeout. */ }
    const result: GuardResult={requestId:command.id,writesDispatched:1,status:"WORKFLOW_CORRELATION_UNCERTAIN"};
    try {
      const after=await bounded(()=>this.ports.observe(command,before),this.deadlineMs);
      if (after.interference || after.scopeKey!==before.snapshot.scopeKey) return {...result,status:"TEST_INTERFERENCE"};
      const w=after.workflow;
      // Unscoped RollComplete alone is never evidence of correlation, even if its totals look plausible.
      if (dispatchSettled && after.settled && w?.source==="SCOPED_OBSERVATION" && w.requestId===command.id &&
        w.actorId===before.caster.actor.id && w.tokenId===before.caster.token.id && w.itemId===before.caster.item.id &&
        w.targetTokenIds.length===1 && w.targetTokenIds[0]===before.target.token.id) result.status="OBSERVED_MATCHING_WORKFLOW";
    } catch { /* Observation failure also burns the attempt; no retries or inferred success. */ }
    return result;
  }
}
