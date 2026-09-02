import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BridgeSession } from "./bridge-session.js";
import { TurnDetector, detectedRunSchema } from "./turn-detector.js";
import { CombatSensor } from "./combat-sensor.js";
import { DecisionRunner } from "./decision-runner.js";
import { OpenRouterDecisionProvider } from "./openrouter-provider.js";
import type { LlmDecisionGateway } from "./llm-gateway.js";
import type { SettingsStore } from "./settings.js";
import type { CombatStateV1 } from "./combat-state.js";
import { applyTurnLedger, combatTurnKey, consumeTurnIntent, createTurnLedger, type TurnLedger } from "./turn-budget.js";
import { IntentExecutor, type ExecutionLogEntry, type ExecutionOutcome } from "./intent-executor.js";
import { ensure, redact, safeError } from "./safety.js";

export type DryRunResult = Awaited<ReturnType<DecisionRunner["run"]>>;
export type TurnRunResult = DryRunResult & {
  execution: "ENABLED_SUPERVISED";
  writesDispatched: number;
  log: ExecutionLogEntry[];
  decisions: { decisionId: string; status: string; accepted: boolean }[];
  outcomes: ExecutionOutcome[];
};
export type ConnectionResult = { success: boolean; model: string; latencyMs: number; error?: string };
type TrustedProvider = LlmDecisionGateway & { testConnection(signal: AbortSignal): Promise<ConnectionResult> };

export class DesktopService {
  private latest: TurnRunResult | null = null;
  private currentLog: ExecutionLogEntry[] = [];
  private busy = false;
  private closing = false;
  private controller: AbortController | null = null;
  private active: Promise<unknown> | null = null;
  private runs = new Map<string, { hash: string; result: TurnRunResult }>();
  private turnLedgers = new Map<string, TurnLedger>();
  private provider: TrustedProvider;
  private runner: DecisionRunner;
  private detector: TurnDetector;
  constructor(private settings: SettingsStore, private bridge: BridgeSession,
    provider?: TrustedProvider, private log: (text: string) => void = text => console.log(text)) {
    this.detector = new TurnDetector(bridge);
    this.provider = provider ?? new OpenRouterDecisionProvider(() => settings.credentials());
    this.runner = new DecisionRunner(new CombatSensor(bridge), this.provider, () => this.secrets());
  }
  private secrets() { const s = this.settings.credentials(); return [s.apiKey, s.bridgeKey]; }
  private clean<T>(data: T): T { return JSON.parse(redact(JSON.stringify(data), this.secrets())) as T; }
  private append(entry: ExecutionLogEntry) {
    this.currentLog.push(entry); if (this.currentLog.length > 200) this.currentLog.shift();
    this.log(JSON.stringify(this.clean(entry)));
  }
  private mark(phase: ExecutionLogEntry["phase"], status: string, message: string,
    details?: ExecutionLogEntry["details"]) {
    this.append({ at: new Date().toISOString(), phase, status, message, ...(details ? { details } : {}) });
  }
  private recordDecisionEvent(event: Record<string, unknown>) {
    const metadata = event.metadata as { latencyMs?: number } | undefined;
    const rejected = event.validation === "REJECTED";
    const rejectionCode = rejected && typeof event.error === "string" ? event.error : "REJECTED";
    this.mark(event.status === "PLAN_READY" ? "PLAN" : rejected ? "VALIDATE" : "DECIDE",
      rejected ? rejectionCode : String(event.status ?? event.validation ?? event.error ?? "MODEL_RESPONSE"),
      event.status === "PLAN_READY" ? "Movement endpoint offered back to the same bounded decision." :
        rejected ? "Model response rejected: " + rejectionCode + ". Bounded repair rules applied." :
          "Model response processed.", { latencyMs: metadata?.latencyMs ?? null,
            ...(rejected ? { error: rejectionCode } : {}) });
  }
  private prepareTurnState(state: CombatStateV1) {
    const key = combatTurnKey(state);
    let ledger = this.turnLedgers.get(key);
    if (!ledger) {
      ledger = createTurnLedger(state);
      if (this.turnLedgers.size >= 512) this.turnLedgers.clear();
      this.turnLedgers.set(key, ledger);
    }
    applyTurnLedger(state, ledger);
    return ledger;
  }
  private publicSettings() {
    const s = this.settings.publicView();
    return { provider: s.provider, model: s.model, temperature: s.temperature, maxOutputTokens: s.maxOutputTokens,
      hasOpenRouterKey: s.hasKey, hasBridgeKey: s.hasBridgeKey };
  }
  status() {
    return this.clean({ settings: this.publicSettings(), bridge: { connected: this.bridge.connected,
      epoch: this.bridge.epoch, readsSent: this.bridge.readsSent, writesSent: this.bridge.writesSent },
      busy: this.busy, execution: "ENABLED_SUPERVISED" as const, log: this.currentLog, latest: this.latest });
  }
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    ensure(!this.closing, "SERVICE_CLOSING"); ensure(!this.busy, "SERVICE_BUSY"); this.busy = true;
    const active = Promise.resolve().then(operation); this.active = active;
    try { return this.clean(await active); }
    finally { this.busy = false; this.active = null; this.controller = null; }
  }
  saveSettings(input: unknown) {
    return this.exclusive(async () => {
      const oldKey = this.settings.credentials().bridgeKey;
      await this.settings.save(input);
      if (oldKey !== this.settings.credentials().bridgeKey) this.bridge.disconnect();
      return this.publicSettings();
    });
  }
  clearOpenRouterKey() { return this.exclusive(async () => {
    await this.settings.clearSecret("apiKey"); return this.publicSettings();
  }); }
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
  detectTurn() { return this.exclusive(() => this.detector.detect()); }
  runDecision(input: unknown) {
    return this.exclusive(async () => {
      const parsed = detectedRunSchema.safeParse(input); ensure(parsed.success, "REQUEST_INVALID");
      ensure(Buffer.byteLength(JSON.stringify(parsed.data)) <= 16384, "IPC_PAYLOAD_TOO_LARGE");
      const data = parsed.data; const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
      const previous = this.runs.get(data.requestId);
      if (previous) { ensure(previous.hash === hash, "REPLAY_BODY_CHANGED"); return previous.result; }
      ensure(this.runs.size < 100, "SESSION_RUN_LIMIT");
      ensure(this.settings.publicView().hasKey, "MODEL_KEY_REQUIRED");
      const prepared = this.detector.prepare(data);
      this.controller = new AbortController();
      this.currentLog = [];
      const startWrites = this.bridge.writesSent;
      const decisions: TurnRunResult["decisions"] = [];
      const outcomes: ExecutionOutcome[] = [];
      let last: DryRunResult | null = null;
      let finalStatus = "PAUSED";
      const executor = new IntentExecutor(this.bridge, entry => this.append(entry));
      this.mark("OBSERVE", "START", "Starting one bounded supervised NPC turn.", {
        scene: prepared.fixture.sceneId, combat: prepared.fixture.combatId
      });
      try {
        for (let cycle = 0; cycle < 5; cycle++) {
          this.mark("DECIDE", "MODEL_REQUEST", cycle === 0 ?
            "Reading fresh Foundry state and requesting the first tactical decision." :
            "Previous command observed; requesting the next intent with remaining turn budgets.", { cycle: cycle + 1 });
          const result = await this.runner.run(prepared.fixture, prepared.mind, this.controller.signal,
            cycle === 0 ? prepared.capture : undefined, event => this.recordDecisionEvent(event),
            state => { this.prepareTurnState(state); });
          last = result;
          decisions.push({ decisionId: result.decisionId, status: result.status, accepted: result.accepted });
          if (!result.accepted || !result.acceptedIntent || !result.state) {
            finalStatus = result.status;
            this.mark("STOP", finalStatus, "No executable validated intent was produced.");
            break;
          }
          this.mark("VALIDATE", "INTENT_ACCEPTED", "Structured intent passed schema, references and freshness.", {
            kind: result.acceptedIntent.kind
          });
          const ledger = this.turnLedgers.get(combatTurnKey(result.state));
          ensure(ledger, "TURN_LEASE_MISSING");
          const writesBeforeCommand = this.bridge.writesSent;
          let outcome: ExecutionOutcome | null = null;
          try { outcome = await executor.execute(result.state, result.acceptedIntent, prepared.fixture); }
          finally {
            if (this.bridge.writesSent > writesBeforeCommand && result.acceptedIntent.kind !== "end_turn") {
              const pathCost = outcome?.command === "move-token" &&
                typeof outcome.result.pathCostCells === "number" ? outcome.result.pathCostCells : null;
              consumeTurnIntent(ledger, result.state, result.acceptedIntent, pathCost);
            }
          }
          ensure(outcome, "EXECUTION_OUTCOME_MISSING");
          outcomes.push(outcome);
          finalStatus = outcome.status;
          this.mark("OBSERVE", "TURN_BUDGET", "Updated supervised turn lease after fresh command observation.", {
            movementRemaining: ledger.movementRemaining,
            actionAvailable: ledger.actionAvailable,
            bonusActionAvailable: ledger.bonusActionAvailable,
            movementWrites: ledger.movementWrites
          });
          if (result.acceptedIntent.kind === "end_turn") break;
          const canContinue = outcome.status === "ITEM_ACTIVATED" || outcome.status === "MOVED";
          if (!canContinue) break;
          if (cycle === 4) {
            finalStatus = "TURN_DECISION_LIMIT";
            this.mark("STOP", finalStatus, "Five supervised decisions completed without end_turn; no additional write dispatched.");
            break;
          }
        }
      } catch (error) {
        finalStatus = safeError(error);
        this.mark("STOP", finalStatus, "Execution stopped. No automatic retry was attempted.");
      }
      ensure(last, "DECISION_NOT_STARTED");
      const combined: TurnRunResult = { ...last, status: finalStatus,
        execution: "ENABLED_SUPERVISED", writesDispatched: this.bridge.writesSent - startWrites,
        log: [...this.currentLog], decisions, outcomes };
      this.latest = this.clean(combined);
      this.runs.set(data.requestId, { hash, result: this.latest });
      await mkdir(join(this.settings.directory, "decisions"), { recursive: true });
      await writeFile(join(this.settings.directory, "decisions", last.decisionId + ".json"),
        JSON.stringify(this.latest, null, 2), { mode: 0o600 });
      return this.latest;
    });
  }
  cancel() {
    this.controller?.abort();
    return { status: "CANCEL_REQUESTED", writesDispatched: this.bridge.writesSent };
  }
  async close() {
    this.closing = true; this.cancel(); this.bridge.disconnect();
    await this.active?.catch(() => {});
  }
}
