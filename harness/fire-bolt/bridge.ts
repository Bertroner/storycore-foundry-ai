import { z } from "zod";
import { BridgeSession, READ_COMMANDS, type ReadCommand } from "../../src/bridge-session.js";
import { ensure } from "../../src/safety.js";

export type TestReadCommand = ReadCommand | "filter-actors" | "resolve-uuid";
export interface TestReader { readonly epoch: string; readonly connected: boolean; read(type: TestReadCommand, params: Record<string, unknown>): Promise<unknown> }
const extra = {
  "filter-actors": z.object({ hasPlayerOwner: z.boolean(), limit: z.literal(200), offset: z.number().int().min(0).max(1400) }).strict(),
  "resolve-uuid": z.object({ uuid: z.string().regex(/^(?:Combat\.[A-Za-z0-9_-]{1,128}|Scene\.[A-Za-z0-9_-]{1,128}\.Token\.[A-Za-z0-9_-]{1,128}|Actor\.[A-Za-z0-9_-]{1,128}\.Item\.[A-Za-z0-9_-]{1,128})$/) }).strict(),
};
// Test-only reader: the production BridgeSession still exposes eight READs. No write method exists here.
export class FireBoltReadBridge extends BridgeSession implements TestReader {
  protected override readFailureCode(type: string, error: string | undefined) {
    // Only this exact audited native failure has a special safe label. Never echo raw errors.
    return type === "get-combat-state" && error === "No active combat" ? "NO_ACTIVE_COMBAT" : `BRIDGE_READ_FAILED_${type.replaceAll("-","_").toUpperCase()}`;
  }
  override async read(type: TestReadCommand, params: Record<string, unknown>): Promise<unknown> {
    if (READ_COMMANDS.includes(type)) return super.read(type as ReadCommand, params);
    ensure(Object.hasOwn(extra, type), "READ_ONLY_COMMAND_DENIED");
    ensure(extra[type as keyof typeof extra].safeParse(params).success, "READ_PARAMS_INVALID");
    return this.sendRead(type, params);
  }
}
