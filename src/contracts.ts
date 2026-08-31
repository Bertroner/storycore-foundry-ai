import { Ajv2020 } from "ajv/dist/2020.js";
import { z } from "zod";
import schema from "./decision-schema.json" with { type: "json" };
import type { CombatStateV1, PlanGoalV1, TargetRef } from "./combat-state.js";
import { ensure, strictJson } from "./safety.js";
export const decisionSchema = schema;
// The canonical schema uses branch-local required properties; no coercion/defaults/removal.
const validator = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
type Base = { schemaVersion: "1.0"; decisionId: string; snapshotId: string; stepId: string };
export type CombatIntentV1 = { schemaVersion: "1.0"; decisionId: string; snapshotId: string;
  kind: "activate_item" | "move" | "end_turn";
  action: { actionId: string; itemId: string; target: TargetRef } | null;
  movement: { planId: string; goalKind: "approach" | "position" | "retreat" } | null; reason?: string };
export type DecisionResponseV1 = Base & ({ type: "PLAN_REQUEST"; goal: PlanGoalV1 } | { type: "FINAL_INTENT"; intent: CombatIntentV1 });
export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const narrativeText = (n: number) => z.string().max(n).refine(s => !/[<>\u0000-\u001f]/.test(s));
export const mindSchema = z.object({
  actorId: idSchema, personality: narrativeText(500), motivation: narrativeText(500),
  relationships: z.array(z.object({ actorId: idSchema, summary: narrativeText(160) }).strict()).max(12),
  relevantMemory: z.array(narrativeText(240)).max(6),
}).strict();
export type NpcMind = z.infer<typeof mindSchema>;
export interface NpcMindProvider { getMind(actorId: string): Promise<NpcMind> }
export class DevFixtureMindProvider implements NpcMindProvider {
  constructor(private fixture: unknown) {}
  async getMind(actorId: string) {
    const parsed = mindSchema.safeParse(this.fixture); ensure(parsed.success, "MIND_INVALID");
    ensure(parsed.data.actorId === actorId, "MIND_ACTOR_MISMATCH"); return parsed.data;
  }
}
export type DecisionRequestV1 = { schemaVersion: "1.0"; decisionId: string; stepId: string; deadlineAt: string;
  limits: { planRequestsRemaining: number; repairResponsesRemaining: number; modelResponsesRemaining: number };
  planFeedback: { requestStepId: string; summary: null; error: { code: string; message: string } }[];
  state: CombatStateV1; narrative: NpcMind };
export function parseDecision(text: string): DecisionResponseV1 {
  const value = strictJson(text); ensure(validator(value), "DECISION_SCHEMA_INVALID"); return value as DecisionResponseV1;
}
export function validateDecision(response: DecisionResponseV1, request: DecisionRequestV1, now = Date.now()) {
  const state = request.state;
  ensure(now < Date.parse(state.expiresAt) && now < Date.parse(request.deadlineAt), "STALE_SNAPSHOT");
  ensure(response.decisionId === request.decisionId && response.snapshotId === state.snapshotId &&
    response.stepId === request.stepId, "DECISION_ID_MISMATCH");
  const target = (ref: TargetRef) => {
    const found = state.nearby.find(t => t.actorId === ref.actorId && (!ref.combatantId || ref.combatantId === t.combatantId));
    ensure(found, "UNKNOWN_TARGET"); return found;
  };
  const action = (actionId: string) => {
    const found = state.actions.find(a => a.actionId === actionId);
    ensure(found, "UNKNOWN_ACTION"); ensure(found.availability !== "unavailable" && found.execution !== "unsupported", "ACTION_UNAVAILABLE");
    return found;
  };
  if (response.type === "PLAN_REQUEST") {
    ensure(request.limits.planRequestsRemaining > 0, "PLAN_LIMIT");
    if (response.goal.kind === "approach") { target(response.goal.target); action(response.goal.actionId); }
    else ensure(Math.abs(response.goal.destination.x) <= 10000 && Math.abs(response.goal.destination.y) <= 10000, "GOAL_OUT_OF_BOUNDS");
    return;
  }
  const intent = response.intent;
  ensure(intent.decisionId === request.decisionId && intent.snapshotId === state.snapshotId, "DECISION_ID_MISMATCH");
  // Phase 1A offers no plans; even a forged ready plan cannot enable movement here.
  ensure(intent.movement === null && intent.kind !== "move", "PLAN_NOT_OFFERED");
  if (intent.kind === "activate_item") {
    ensure(intent.action, "ACTION_REQUIRED");
    const card = action(intent.action.actionId); const selected = target(intent.action.target);
    ensure(card.itemId === intent.action.itemId, "UNKNOWN_ITEM");
    ensure(card.eligibleTargets.some(t => t.actorId === selected.actorId), "TARGET_NOT_ELIGIBLE");
    ensure(selected.wallLos !== false, "WALL_LOS_BLOCKED");
    const range = card.range.long !== null && card.range.long > 0 ? card.range.long : card.range.normal;
    if (range !== null && selected.distance !== null && selected.units === card.range.units)
      ensure(selected.distance <= range, "KNOWN_OUT_OF_RANGE");
  }
}
