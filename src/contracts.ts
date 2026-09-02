import { Ajv2020 } from "ajv/dist/2020.js";
import { z } from "zod";
import schema from "./decision-schema.json" with { type: "json" };
import type { CombatStateV1, PlanGoalV1, PlanSummary, TargetRef } from "./combat-state.js";
import { ensure, strictJson } from "./safety.js";
export const decisionSchema = schema;
export const finalDecisionSchema = {
  $schema: schema.$schema, title: "FinalDecisionResponseV1", ...schema.oneOf[1], $defs: schema.$defs
};
function schemaWithoutMove<T>(source: T, title: string): T {
  const copy = structuredClone(source) as T & { title: string; $defs: { finalIntent: {
    oneOf: { properties?: { kind?: { const?: string } } }[]
  } } };
  copy.title = title;
  copy.$defs.finalIntent.oneOf = copy.$defs.finalIntent.oneOf.filter(branch =>
    branch.properties?.kind?.const !== "move");
  return copy;
}
export const initialDecisionSchema = schemaWithoutMove(schema, "InitialDecisionResponseV1");
export const nonMovementFinalDecisionSchema = schemaWithoutMove(finalDecisionSchema, "NonMovementFinalDecisionResponseV1");
type DecisionJsonSchema = typeof schema | typeof finalDecisionSchema;
export function actionAvailableForDecision(state: CombatStateV1, action: CombatStateV1["actions"][number]) {
  if (action.availability === "unavailable" || action.execution === "unsupported") return false;
  if (action.activation.type === "action") return state.budgets.actionAvailable !== false;
  if (action.activation.type === "bonus") return state.budgets.bonusActionAvailable !== false;
  return false;
}
export function compactDecisionRequest(request: DecisionRequestV1): DecisionRequestV1 {
  const copy = structuredClone(request);
  copy.state.actions = copy.state.actions.filter(action => actionAvailableForDecision(copy.state, action));
  return copy;
}
export function budgetAwareDecisionSchema(request: DecisionRequestV1, repairCode: string | null) {
  const readyPlan = request.planFeedback.some(feedback => feedback.summary?.planId);
  const movementAvailable = request.state.budgets.movementRemaining === null || request.state.budgets.movementRemaining > 0;
  const directChoiceOnly = repairCode === "PLAN_NOT_OFFERED" || repairCode === "PLAN_NOT_NEEDED" || !movementAvailable;
  const visibleActions = request.state.actions.filter(action => actionAvailableForDecision(request.state, action));
  const base: DecisionJsonSchema = readyPlan ? finalDecisionSchema :
    directChoiceOnly ? nonMovementFinalDecisionSchema : initialDecisionSchema;
  const copy = structuredClone(base) as any;
  copy.$defs.finalIntent.oneOf = copy.$defs.finalIntent.oneOf.filter((branch: any) => {
    const kind = branch.properties?.kind?.const;
    if (kind === "activate_item") return visibleActions.length > 0;
    if (kind === "move") return readyPlan && movementAvailable;
    return kind === "end_turn";
  });
  if (!readyPlan && !directChoiceOnly) {
    const canApproach = visibleActions.some(action => action.canPlanApproach && action.eligibleTargets.length > 0);
    if (!canApproach) copy.$defs.planGoal.oneOf = copy.$defs.planGoal.oneOf.filter((branch: any) =>
      branch.properties?.kind?.const !== "approach");
  }
  if (visibleActions.length === 0) copy.title = readyPlan && movementAvailable ? "MoveOrEndDecisionResponseV1" :
    !directChoiceOnly && movementAvailable ? "MovementOrEndDecisionResponseV1" : "EndTurnDecisionResponseV1";
  return copy;
}
const validator = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
type Base = { schemaVersion: "1.0"; decisionId: string; snapshotId: string; stepId: string };
type ItemIntentAction = { actionId: string; itemId: string; target: TargetRef | null };
type MovementIntent = { planId: string; goalKind: "approach" | "position" | "retreat" };
export type CombatIntentV1 =
  | { kind: "activate_item"; action: ItemIntentAction; movement?: null; reason?: string }
  | { kind: "move"; action?: null; movement: MovementIntent; reason?: string }
  | { kind: "end_turn"; action?: null; movement?: null; reason?: string };
export type DecisionResponseV1 = Base & ({ type: "PLAN_REQUEST"; goal: PlanGoalV1 } |
  { type: "FINAL_INTENT"; intent: CombatIntentV1 });
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
  planFeedback: { requestStepId: string; summary: PlanSummary | null; error: { code: string; message: string } | null }[];
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
    const found = state.nearby.find(t => t.actorId === ref.actorId &&
      (!ref.combatantId || ref.combatantId === t.combatantId));
    ensure(found && found.targetAuthorized && found.relationToSelf === "enemy", "UNKNOWN_TARGET"); return found;
  };
  const action = (actionId: string) => {
    const found = state.actions.find(a => a.actionId === actionId);
    ensure(found, "UNKNOWN_ACTION");
    if (found.activation.type === "action") ensure(state.budgets.actionAvailable !== false, "ACTION_BUDGET_SPENT");
    if (found.activation.type === "bonus") ensure(state.budgets.bonusActionAvailable !== false, "BONUS_ACTION_BUDGET_SPENT");
    ensure(found.availability !== "unavailable" && found.execution !== "unsupported", "ACTION_UNAVAILABLE");
    return found;
  };
  if (response.type === "PLAN_REQUEST") {
    ensure(state.budgets.movementRemaining === null || state.budgets.movementRemaining > 0, "MOVEMENT_EXHAUSTED");
    ensure(!request.planFeedback.some(feedback => feedback.summary?.planId), "PLAN_ALREADY_READY");
    ensure(request.limits.planRequestsRemaining > 0, "PLAN_LIMIT");
    if (response.goal.kind === "approach") {
      const selected = target(response.goal.target); const card = action(response.goal.actionId);
      ensure(card.canPlanApproach, "PLAN_RANGE_UNKNOWN");
      ensure(card.eligibleTargets.some(t => t.actorId === selected.actorId &&
        (!t.combatantId || t.combatantId === selected.combatantId)), "TARGET_NOT_ELIGIBLE");
      if (card.range.normal !== null && selected.distance !== null && card.range.units === selected.units)
        ensure(selected.distance > card.range.normal, "PLAN_NOT_NEEDED");
    }
    else ensure(Math.abs(response.goal.destination.x) <= 10000 &&
      Math.abs(response.goal.destination.y) <= 10000, "GOAL_OUT_OF_BOUNDS");
    return;
  }
  const intent = response.intent;
  if (intent.kind === "move") {
    ensure(state.budgets.movementRemaining === null || state.budgets.movementRemaining > 0, "MOVEMENT_EXHAUSTED");
    const plan = state.movement.plans.find(p => p.planId === intent.movement?.planId && p.status === "ready" &&
      p.offeredFor.decisionId === request.decisionId && p.offeredFor.snapshotId === state.snapshotId);
    ensure(plan && plan.endpoint && Date.now() < Date.parse(plan.expiresAt), "PLAN_NOT_OFFERED");
    ensure(plan.goal.kind === intent.movement.goalKind, "PLAN_GOAL_MISMATCH");
    return;
  }
  if (intent.kind === "end_turn") return;
  const card = action(intent.action.actionId);
  ensure(card.itemId === intent.action.itemId, "UNKNOWN_ITEM");
  if (intent.action.target === null) {
    ensure(["self", "none", null].includes(card.target.kind), "TARGET_REQUIRED");
    return;
  }
  const selected = target(intent.action.target);
  ensure(card.eligibleTargets.some(t => t.actorId === selected.actorId &&
    (!t.combatantId || t.combatantId === selected.combatantId)), "TARGET_NOT_ELIGIBLE");
  ensure(selected.wallLos !== false, "WALL_LOS_BLOCKED");
  const range = card.range.normal;
  if (range !== null && selected.distance !== null && selected.units === card.range.units)
    ensure(selected.distance <= range, "KNOWN_OUT_OF_RANGE");
}
