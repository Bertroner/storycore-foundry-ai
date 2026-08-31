import type { DesktopService, ConnectionResult, DryRunResult } from "../src/desktop-service.js";
import type { DetectedRunInput, DetectedTurn } from "../src/turn-detector.js";
export type PublicStatus = ReturnType<DesktopService["status"]>;
export type PublicSettings = PublicStatus["settings"];
export type SaveSettingsInput = { provider: "openrouter"; model: string; temperature: number; apiKey?: string; bridgeKey?: string };
export type RunDecisionInput = DetectedRunInput;
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string };
export interface DesktopApi {
  status(): Promise<IpcResult<PublicStatus>>;
  saveSettings(input: SaveSettingsInput): Promise<IpcResult<PublicSettings>>;
  clearOpenRouterKey(): Promise<IpcResult<PublicSettings>>;
  clearBridgeKey(): Promise<IpcResult<PublicSettings>>;
  testOpenRouter(): Promise<IpcResult<ConnectionResult>>;
  detectTurn(): Promise<IpcResult<DetectedTurn>>;
  runDecision(input: RunDecisionInput): Promise<IpcResult<DryRunResult>>;
  cancelDecision(): Promise<IpcResult<{ status: string; writesDispatched: number }>>;
}
