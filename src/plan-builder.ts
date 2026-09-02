import { randomUUID } from "node:crypto";
import type { CombatStateV1, PlanGoalV1, PlanSummary } from "./combat-state.js";
import { ensure } from "./safety.js";

function toward(from: number, to: number, steps: number) {
  const delta = to - from;
  return from + Math.sign(delta) * Math.min(Math.abs(delta), steps);
}
function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function buildPlan(state: CombatStateV1, decisionId: string, requestStepId: string, goal: PlanGoalV1): PlanSummary {
  const grid = state.movement.grid;
  const walk = state.budgets.movementRemaining ?? state.self.movement.walk;
  const maxCells = walk !== null && grid.distance > 0 ? Math.max(0, Math.floor(walk / grid.distance)) : null;
  const base = {
    offeredFor: { decisionId, snapshotId: state.snapshotId, requestStepId },
    units: grid.units, expiresAt: state.expiresAt
  };
  if (maxCells === null) return {
    ...base, planId: null, goal: { kind: goal.kind, target: goal.kind === "approach" ? goal.target : null,
      destination: goal.kind === "approach" ? null : goal.destination, within: null, units: grid.units },
    endpoint: null, status: "unknown", distance: null, cost: null, withinBudget: null, reachesGoal: false,
    blockers: ["Movement budget is unknown"]
  };

  const start = state.self.position;
  let endpoint: { x: number; y: number };
  let within: number | null = null;
  let reachesGoal = true;
  let normalizedGoal: PlanSummary["goal"];

  if (goal.kind === "approach") {
    const target = state.nearby.find(t => t.actorId === goal.target.actorId &&
      (!goal.target.combatantId || t.combatantId === goal.target.combatantId));
    const action = state.actions.find(a => a.actionId === goal.actionId);
    ensure(target && action, "PLAN_REFERENCE_INVALID");
    ensure(action.range.units === grid.units && action.range.normal !== null, "PLAN_RANGE_UNKNOWN");
    within = Math.max(0, action.range.normal);
    const desiredCells = Math.floor(within / grid.distance);
    const needed = Math.max(0, chebyshev(start, target.position) - desiredCells);
    const steps = Math.min(needed, maxCells);
    endpoint = { x: toward(start.x, target.position.x, steps), y: toward(start.y, target.position.y, steps) };
    reachesGoal = steps >= needed;
    normalizedGoal = { kind: "approach", target: goal.target, destination: null, within, units: grid.units };
  } else {
    endpoint = goal.destination;
    normalizedGoal = { kind: goal.kind, target: null, destination: goal.destination, within: null, units: grid.units };
  }

  const cells = chebyshev(start, endpoint);
  const withinBudget = cells <= maxCells;
  // The runner checks explicit position/retreat goals against raw scene bounds.
  // Approach endpoints lie between two already validated scene tokens.
  const inBounds = endpoint.x >= 0 && endpoint.y >= 0;
  const ready = withinBudget && Number.isInteger(endpoint.x) && Number.isInteger(endpoint.y) && inBounds;
  return {
    ...base,
    planId: ready ? "plan:" + randomUUID() : null,
    goal: normalizedGoal,
    endpoint: ready ? endpoint : null,
    status: ready ? "ready" : "over_budget",
    distance: cells * grid.distance,
    cost: cells * grid.distance,
    withinBudget,
    reachesGoal,
    blockers: ready && !reachesGoal ? ["This move approaches the goal but another fresh decision may still be required"] :
      ready ? ["Bridge validates walls and resolves the route during supervised execution"] : ["Destination exceeds movement budget"]
  };
}
