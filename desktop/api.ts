import type { DesktopService, ConnectionResult, DryRunResult } from "../src/desktop-service.js";
import type { ScopeFixture } from "../src/combat-sensor.js";
import type { NpcMind } from "../src/contracts.js";
export type PublicStatus = ReturnType<DesktopService["status"]>;
export type PublicSettings = PublicStatus["settings"];
export type SaveSettingsInput = { provider: "openrouter"; model: string; temperature: number; apiKey?: string; bridgeKey?: string };
export type RunDecisionInput = { requestId: string; fixture: ScopeFixture; mind: NpcMind };
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };
export interface DesktopApi {
  status(): Promise<IpcResult<PublicStatus>>;
  saveSettings(input: SaveSettingsInput): Promise<IpcResult<PublicSettings>>;
  clearOpenRouterKey(): Promise<IpcResult<PublicSettings>>;
  clearBridgeKey(): Promise<IpcResult<PublicSettings>>;
  testOpenRouter(): Promise<IpcResult<ConnectionResult>>;
  runDecision(input: RunDecisionInput): Promise<IpcResult<DryRunResult>>;
  cancelDecision(): Promise<IpcResult<{ status: string; writesDispatched: number }>>;
}
