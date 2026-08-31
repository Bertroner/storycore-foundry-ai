import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { BridgeSession } from "./bridge-session.js";
import { CombatSensor } from "./combat-sensor.js";
import { DecisionRunner } from "./decision-runner.js";
import { OpenRouterDecisionProvider } from "./openrouter-provider.js";
import type { LlmDecisionGateway } from "./llm-gateway.js";
import type { SettingsStore } from "./settings.js";
import { ensure, redact, safeError } from "./safety.js";

export type DryRunResult = Awaited<ReturnType<DecisionRunner["run"]>>;
export type ConnectionResult = { success: boolean; model: string; latencyMs: number; error?: string };
type TrustedProvider = LlmDecisionGateway & { testConnection(signal: AbortSignal): Promise<ConnectionResult> };
// Constructed only in trusted Electron main (or isolated tests), never in preload/renderer.
export class DesktopService {
  private latest: DryRunResult | null = null;
  private busy = false;
  private closing = false;
  private controller: AbortController | null = null;
  private active: Promise<unknown> | null = null;
  private runs = new Map<string, { hash: string; result: DryRunResult }>();
  private provider: TrustedProvider;
  private runner: DecisionRunner;
  constructor(private settings: SettingsStore, private bridge: BridgeSession,
    provider?: TrustedProvider, private log: (text: string) => void = text => console.log(text)) {
    this.provider = provider ?? new OpenRouterDecisionProvider(() => settings.credentials());
    this.runner = new DecisionRunner(new CombatSensor(bridge), this.provider, () => this.secrets());
  }
  private secrets() { const s = this.settings.credentials(); return [s.apiKey, s.bridgeKey]; }
  private clean<T>(data: T): T { return JSON.parse(redact(JSON.stringify(data), this.secrets())) as T; }
  private publicSettings() {
    const s = this.settings.publicView();
    return { provider: s.provider, model: s.model, temperature: s.temperature, maxOutputTokens: s.maxOutputTokens,
      hasOpenRouterKey: s.hasKey, hasBridgeKey: s.hasBridgeKey };
  }
  status() { return this.clean({ settings: this.publicSettings(), bridge: { connected: this.bridge.connected,
    epoch: this.bridge.epoch, readsSent: this.bridge.readsSent }, busy: this.busy, execution: "DISABLED" as const, latest: this.latest }); }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    ensure(!this.closing, "SERVICE_CLOSING"); ensure(!this.busy, "SERVICE_BUSY"); this.busy = true;
    const active = Promise.resolve().then(operation); this.active = active;
    try { return this.clean(await active); } finally { this.busy = false; this.active = null; this.controller = null; }
  }
  saveSettings(input: unknown) {
    return this.exclusive(async () => {
      const oldKey = this.settings.credentials().bridgeKey;
      await this.settings.save(input);
      if (oldKey !== this.settings.credentials().bridgeKey) this.bridge.disconnect();
      return this.publicSettings();
    });
  }
  clearOpenRouterKey() { return this.exclusive(async () => { await this.settings.clearSecret("apiKey"); return this.publicSettings(); }); }
  clearBridgeKey() { return this.exclusive(async () => {
    await this.settings.clearSecret("bridgeKey"); this.bridge.disconnect(); return this.publicSettings();
  }); }
  testOpenRouter() {
    return this.exclusive(async (): Promise<ConnectionResult> => {
      this.controller = new AbortController(); const started = Date.now();
      try { return await this.provider.testConnection(AbortSignal.any([this.controller.signal, AbortSignal.timeout(15000)])); }
      catch (error) { return { success: false, model: this.settings.publicView().model, latencyMs: Date.now() - started,
        error: this.controller.signal.aborted ? "CANCELLED" : safeError(error) }; }
    });
  }
  runDecision(input: unknown) {
    return this.exclusive(async () => {
      const parsed = z.object({ requestId: z.string().uuid(), fixture: z.unknown(), mind: z.unknown() }).strict().safeParse(input);
      ensure(parsed.success, "REQUEST_INVALID");
      ensure(Buffer.byteLength(JSON.stringify(parsed.data)) <= 16384, "HTTP_BODY_TOO_LARGE");
      const data = parsed.data; const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
      const previous = this.runs.get(data.requestId);
      if (previous) { ensure(previous.hash === hash, "REPLAY_BODY_CHANGED"); return previous.result; }
      ensure(this.runs.size < 100, "SESSION_RUN_LIMIT"); ensure(this.settings.publicView().hasKey, "MODEL_KEY_REQUIRED");
      this.controller = new AbortController();
      const result = await this.runner.run(data.fixture, data.mind, this.controller.signal);
      this.latest = this.clean(result); this.runs.set(data.requestId, { hash, result: this.latest });
      await mkdir(join(this.settings.directory, "decisions"), { recursive: true });
      await writeFile(join(this.settings.directory, "decisions", result.decisionId + ".json"), JSON.stringify(this.latest, null, 2), { mode: 0o600 });
      this.log(JSON.stringify({ status: result.status, decisionId: result.decisionId, stateBytes: result.stateBytes, writesDispatched: 0 }));
      return this.latest;
    });
  }
  cancel() { this.controller?.abort(); return { status: "CANCEL_REQUESTED", writesDispatched: 0 }; }
  async close() {
    this.closing = true; this.cancel(); this.bridge.disconnect();
    await this.active?.catch(() => {});
  }
}
