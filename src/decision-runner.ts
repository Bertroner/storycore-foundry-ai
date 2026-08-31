import { randomUUID } from "node:crypto";
import { CombatNormalizer } from "./combat-normalizer.js";
import type { CombatSensor, RawSnapshot } from "./combat-sensor.js";
import { DevFixtureMindProvider, parseDecision, validateDecision, type DecisionRequestV1 } from "./contracts.js";
import { ProviderFailure, type LlmDecisionGateway } from "./llm-gateway.js";
import { ensure, ensureNoSecrets, safeError, strictJson } from "./safety.js";
export class DecisionRunner {
  private busy = false;
  constructor(private sensor: CombatSensor, private gateway: LlmDecisionGateway, private secrets: () => string[]) {}
  async run(fixture: unknown, mindFixture: unknown, signal: AbortSignal, captureDetected?: () => Promise<RawSnapshot>) {
    ensure(!this.busy, "DECISION_BUSY"); this.busy = true;
    const events: Record<string, unknown>[] = [];
    let state: ReturnType<CombatNormalizer["normalize"]> | null = null;
    let narrative: Awaited<ReturnType<DevFixtureMindProvider["getMind"]>> | null = null;
    let accepted = false; let status = "PAUSED"; const decisionId = randomUUID();
    try {
      // Desktop supplies a trusted detected-scope guard; standalone tests still use the same sensor.
      const raw = await (captureDetected ? captureDetected() : this.sensor.capture(fixture));
      state = new CombatNormalizer().normalize(raw);
      narrative = await new DevFixtureMindProvider(mindFixture).getMind(state.self.actorId);
      // Perceived and self IDs are the only relationship identities accepted in the model DTO.
      ensure(narrative.relationships.every(r => r.actorId === state!.self.actorId || state!.nearby.some(t => t.actorId === r.actorId)), "MIND_UNKNOWN_ACTOR");
      ensureNoSecrets(JSON.stringify({ state, narrative }), this.secrets());
      const deadlineAt = state.expiresAt;
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Date.parse(deadlineAt) - Date.now()))]);
      let plans = 2, repairs = 2, responses = 5, repairCode: string | null = null;
      const planFeedback: DecisionRequestV1["planFeedback"] = [];
      while (responses > 0 && !accepted) {
        ensure(!deadline.aborted && Date.now() < Date.parse(deadlineAt), "DECISION_DEADLINE");
        const request: DecisionRequestV1 = { schemaVersion: "1.0", decisionId, stepId: randomUUID(), deadlineAt,
          limits: { planRequestsRemaining: plans, repairResponsesRemaining: repairs, modelResponsesRemaining: responses },
          state, narrative, planFeedback: [...planFeedback] };
        responses--;
        const reply = await this.gateway.decide(request, repairCode, deadline);
        ensureNoSecrets(reply.text, this.secrets());
        const event: Record<string, unknown> = { metadata: reply.metadata, output: reply.text }; events.push(event);
        let recognizedPlan = false;
        try { recognizedPlan = (strictJson(reply.text) as { type?: string })?.type === "PLAN_REQUEST"; } catch { /* Parsing error is recorded by the strict validator below. */ }
        if (recognizedPlan) { ensure(plans > 0, "PLAN_LIMIT"); plans--; }
        let freshnessFailed = false;
        try {
          const response = parseDecision(reply.text); validateDecision(response, request);
          if (response.type === "PLAN_REQUEST" && response.goal.kind !== "approach") {
            const { x, y } = response.goal.destination;
            ensure(x >= 0 && y >= 0 && (x + 1) * raw.scene.grid.size <= raw.scene.width &&
              (y + 1) * raw.scene.grid.size <= raw.scene.height, "GOAL_OUT_OF_BOUNDS");
          }
          try { await this.sensor.assertFresh(raw); } catch (error) { freshnessFailed = true; throw error; }
          ensure(!deadline.aborted && Date.now() < Date.parse(deadlineAt), "STALE_SNAPSHOT");
          repairCode = null;
          if (response.type === "PLAN_REQUEST") {
            event.validation = "SCHEMA_AND_REFERENCES_VALID"; event.status = "PLANNING_UNAVAILABLE";
            event.response = response;
            planFeedback.push({ requestStepId: request.stepId, summary: null,
              error: { code: "PLANNING_UNAVAILABLE", message: "Phase 1A has no path preview implementation; no route or planId offered." } });
          } else {
            event.validation = "SCHEMA_REFERENCES_AND_FRESHNESS_VALID"; event.response = response;
            event.status = "DRY-RUN VALIDATED INTENT"; accepted = true; status = "DRY-RUN VALIDATED INTENT";
          }
        } catch (error) {
          const code = safeError(error); event.validation = "REJECTED"; event.error = code;
          if (freshnessFailed || ["STALE_SNAPSHOT", "BRIDGE_DISCONNECTED", "DECISION_DEADLINE"].includes(code)) throw error;
          if (!repairs || !responses) { status = "VALIDATION_LIMIT"; break; }
          repairs--; repairCode = code;
        }
      }
      if (!accepted && status === "PAUSED") status = "RESPONSE_LIMIT";
    } catch (error) {
      const code = signal.aborted ? "CANCELLED" : state && Date.now() >= Date.parse(state.expiresAt) ? "DECISION_DEADLINE" : safeError(error);
      events.push({ status: "PAUSED", error: code, ...(error instanceof ProviderFailure ? { metadata: error.metadata } : {}) }); status = code;
    } finally { this.busy = false; }
    return { decisionId, status, accepted, execution: "DISABLED", writesDispatched: 0, state, narrative, events,
      stateBytes: state ? Buffer.byteLength(JSON.stringify(state)) : 0 };
  }
}
