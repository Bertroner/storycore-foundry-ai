import { randomUUID } from "node:crypto";
import type { CombatStateV1 } from "./combat-state.js";
import type { CombatIntentV1 } from "./contracts.js";
import { ensure } from "./safety.js";

export const MAX_SUPERVISED_MOVEMENT_WRITES = 2;
export type TurnLedger = {
  key: string;
  leaseId: string;
  movementRemaining: number | null;
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  movementWrites: number;
};

export function combatTurnKey(state: CombatStateV1) {
  return [state.scope.combatId, state.combat.round, state.combat.turn,
    state.self.combatantId].join(":");
}

export function createTurnLedger(state: CombatStateV1): TurnLedger {
  const usable = (type: string) => state.actions.some(card =>
    card.activation.type === type && card.availability !== "unavailable" &&
    card.execution !== "unsupported");
  return {
    key: combatTurnKey(state),
    leaseId: "lease:" + randomUUID(),
    movementRemaining: state.self.movement.walk,
    actionAvailable: usable("action"),
    bonusActionAvailable: usable("bonus"),
    movementWrites: 0
  };
}

export function applyTurnLedger(state: CombatStateV1, ledger: TurnLedger) {
  ensure(ledger.key === combatTurnKey(state), "TURN_LEASE_STALE");
  state.budgets = {
    movementRemaining: ledger.movementWrites >= MAX_SUPERVISED_MOVEMENT_WRITES ? 0 : ledger.movementRemaining,
    units: state.movement.grid.units,
    actionAvailable: ledger.actionAvailable,
    bonusActionAvailable: ledger.bonusActionAvailable,
    reactionAvailable: null,
    source: "turn-lease",
    leaseId: ledger.leaseId
  };
  for (const card of state.actions) {
    const spent = card.activation.type === "action" ? !ledger.actionAvailable :
      card.activation.type === "bonus" ? !ledger.bonusActionAvailable : false;
    if (spent) {
      card.availability = "unavailable";
      const slot = card.activation.type === "bonus" ? "Bonus action" : "Action";
      if (!card.blockers.includes(slot + " already used in this supervised turn lease"))
        card.blockers.push(slot + " already used in this supervised turn lease");
    }
    if (state.budgets.movementRemaining === 0) card.canPlanApproach = false;
  }
  state.quality.unknowns = state.quality.unknowns.filter(value =>
    value !== "Movement remaining is not exposed; one supervised move is capped by native walk speed");
  if (!state.quality.warnings.includes("Action economy is a process-local supervised turn lease, not native Foundry history"))
    state.quality.warnings.push("Action economy is a process-local supervised turn lease, not native Foundry history");
}

export function consumeTurnIntent(ledger: TurnLedger, state: CombatStateV1,
  intent: CombatIntentV1, pathCostCells: number | null = null) {
  ensure(ledger.key === combatTurnKey(state), "TURN_LEASE_STALE");
  if (intent.kind === "move") {
    ensure(ledger.movementWrites < MAX_SUPERVISED_MOVEMENT_WRITES, "MOVEMENT_WRITE_LIMIT");
    const plan = state.movement.plans.find(value => value.planId === intent.movement.planId);
    ensure(plan?.status === "ready", "PLAN_NOT_OFFERED");
    const spent = pathCostCells !== null ?
      pathCostCells * state.movement.grid.distance : plan.cost;
    ensure(spent !== null && spent >= 0, "MOVEMENT_COST_UNKNOWN");
    if (ledger.movementRemaining !== null)
      ledger.movementRemaining = Math.max(0, ledger.movementRemaining - spent);
    ledger.movementWrites++;
    if (ledger.movementWrites >= MAX_SUPERVISED_MOVEMENT_WRITES) ledger.movementRemaining = 0;
    return;
  }
  if (intent.kind !== "activate_item") return;
  const card = state.actions.find(value => value.actionId === intent.action.actionId &&
    value.itemId === intent.action.itemId);
  ensure(card, "UNKNOWN_ITEM");
  if (card.activation.type === "action") ledger.actionAvailable = false;
  else if (card.activation.type === "bonus") ledger.bonusActionAvailable = false;
  else ensure(false, "UNSUPPORTED_ACTIVATION");
}
