import { z } from "zod";
import type { BridgeCommander } from "./bridge-session.js";
import { CombatNormalizer } from "./combat-normalizer.js";
import { CombatSensor, combatSchema, parseBridgeData, type ScopeFixture } from "./combat-sensor.js";
import type { CombatStateV1 } from "./combat-state.js";
import type { CombatIntentV1 } from "./contracts.js";
import { ensure, safeError } from "./safety.js";

export type ExecutionLogEntry = {
  at: string;
  phase: "OBSERVE" | "DECIDE" | "VALIDATE" | "PLAN" | "COMMAND" | "MIDI" | "RESULT" | "STOP";
  status: string;
  message: string;
  details?: Record<string, string | number | boolean | null>;
};
export type ExecutionOutcome = {
  status: string;
  writesDispatched: number;
  command: "move-token" | "dnd5e/activate-item" | "next-turn";
  result: Record<string, unknown>;
  observedState: CombatStateV1 | null;
};

const moveResultSchema = z.object({ id: z.string(), x: z.number(), y: z.number(),
  pathCost: z.number().nonnegative().optional() }).passthrough();
const activationSchema = z.object({
  itemId: z.string(), itemName: z.string(), itemType: z.string(), activated: z.boolean(),
  targetsSet: z.number().int().nonnegative(), chatMessageId: z.string().optional(),
  workflow: z.object({ attackTotal: z.number().optional(), damageTotal: z.number().optional(),
    isCritical: z.boolean(), isFumble: z.boolean(), hitTargetIds: z.array(z.string()),
    saveTargetIds: z.array(z.string()), failedSaveTargetIds: z.array(z.string()) }).optional()
}).passthrough();

export class IntentExecutor {
  private sensor: CombatSensor;
  constructor(private bridge: BridgeCommander, private append: (entry: ExecutionLogEntry) => void) {
    this.sensor = new CombatSensor(bridge);
  }
  private log(phase: ExecutionLogEntry["phase"], status: string, message: string,
    details?: ExecutionLogEntry["details"]) {
    this.append({ at: new Date().toISOString(), phase, status, message, ...(details ? { details } : {}) });
  }
  async execute(state: CombatStateV1, intent: CombatIntentV1, fixture: ScopeFixture): Promise<ExecutionOutcome> {
    const beforeWrites = this.bridge.writesSent;
    this.log("VALIDATE", "REVALIDATING", "Re-reading Foundry scope immediately before command.");
    const before = await this.sensor.capture(fixture);
    ensure(before.fingerprint === state.scope.revision && before.epoch === state.scope.sessionEpoch, "STALE_SNAPSHOT");
    ensure(before.combat.current?.id === state.self.combatantId &&
      before.combat.current.tokenId === state.self.tokenId, "SCOPE_STALE");

    if (intent.kind === "move") {
      const plan = state.movement.plans.find(p => p.planId === intent.movement?.planId);
      ensure(plan?.status === "ready" && plan.endpoint, "PLAN_NOT_OFFERED");
      this.log("COMMAND", "DISPATCH", "Moving token through Bridge wall-aware move-token.", {
        fromX: state.self.position.x, fromY: state.self.position.y,
        toX: plan.endpoint.x, toY: plan.endpoint.y
      });
      const rawResult = await this.bridge.write("move-token", {
        sceneId: state.scope.sceneId, tokenId: state.self.tokenId,
        x: plan.endpoint.x * state.movement.grid.sizePixels,
        y: plan.endpoint.y * state.movement.grid.sizePixels,
        animate: true, canOpenDoors: false
      });
      const moved = moveResultSchema.safeParse(rawResult); ensure(moved.success, "BRIDGE_DATA_INVALID:move-token");
      this.log("OBSERVE", "READBACK", "Movement command settled; reading authoritative token state.");
      const observed = await this.sensor.capture(fixture);
      const normalized = new CombatNormalizer().normalize(observed);
      ensure(normalized.self.position.x === plan.endpoint.x && normalized.self.position.y === plan.endpoint.y,
        "MOVE_READBACK_MISMATCH");
      const remaining = state.budgets.movementRemaining ?? state.self.movement.walk;
      const maxCells = remaining === null ? null :
        Math.floor(remaining / state.movement.grid.distance);
      const overBudget = moved.data.pathCost !== undefined && maxCells !== null && moved.data.pathCost > maxCells;
      this.log("RESULT", overBudget ? "MOVED_BUDGET_WARNING" : "MOVED", "Fresh Foundry coordinates confirmed.", {
        x: normalized.self.position.x, y: normalized.self.position.y,
        pathCostCells: moved.data.pathCost ?? null, movementCapacityCells: maxCells
      });
      return { status: overBudget ? "MOVED_BUDGET_WARNING" : "MOVED",
        writesDispatched: this.bridge.writesSent - beforeWrites, command: "move-token",
        result: { tokenId: moved.data.id, x: normalized.self.position.x, y: normalized.self.position.y,
          pathCostCells: moved.data.pathCost ?? null }, observedState: normalized };
    }

    if (intent.kind === "end_turn") {
      this.log("COMMAND", "DISPATCH", "Advancing the validated active combat once.");
      await this.bridge.write("next-turn", { combatId: state.scope.combatId });
      const combat = parseBridgeData(combatSchema,
        await this.bridge.read("get-combat-state", { combatId: state.scope.combatId }), "get-combat-state");
      ensure(combat.id === state.scope.combatId && combat.current?.id !== state.self.combatantId, "NEXT_TURN_READBACK_MISMATCH");
      this.log("RESULT", "TURN_ADVANCED", "Fresh combat read confirms a different current combatant.", {
        round: combat.round, turn: combat.turn
      });
      return { status: "TURN_ADVANCED", writesDispatched: this.bridge.writesSent - beforeWrites,
        command: "next-turn", result: { round: combat.round, turn: combat.turn }, observedState: null };
    }

    ensure(intent.action, "ACTION_REQUIRED");
    const card = state.actions.find(a => a.actionId === intent.action?.actionId);
    ensure(card && card.itemId === intent.action.itemId, "UNKNOWN_ITEM");
    const target = intent.action.target === null ? null : state.nearby.find(t =>
      t.actorId === intent.action?.target?.actorId &&
      (!intent.action.target.combatantId || t.combatantId === intent.action.target.combatantId));
    ensure(intent.action.target === null || target, "UNKNOWN_TARGET");
let activation: z.infer<typeof activationSchema> | null = null;
    let commandError: unknown = null;
    let cleanupError: unknown = null;
    try {
      this.log("COMMAND", "TARGET_RESET", "Clearing stale Foundry user targets before Item use.");
      await this.bridge.write("clear-targets", {});
      this.log("COMMAND", "DISPATCH", "Invoking the real Actor-owned legacy Item through dnd5e/activate-item.", {
        item: card.name, itemType: card.itemType, target: target?.name ?? "self/none"
      });
      const rawResult = await this.bridge.write("dnd5e/activate-item", {
        actorId: state.self.actorId, itemId: card.itemId,
        targetTokenIds: target ? [target.tokenId] : []
      });
      const parsed = activationSchema.safeParse(rawResult);
      ensure(parsed.success, "BRIDGE_DATA_INVALID:dnd5e/activate-item");
      activation = parsed.data;
    } catch (error) { commandError = error; }
    finally {
      this.log("COMMAND", "TARGET_CLEANUP", "Clearing supervised targets after Item workflow settlement.");
      try { await this.bridge.write("clear-targets", {}); }
      catch (error) { cleanupError = error; }
    }

    this.log("OBSERVE", "READBACK", "Attempting a fresh Actor, effects, token and combat read after all Item-path writes.");
    let normalized: CombatStateV1 | null = null;
    let observationError: unknown = null;
    try { normalized = new CombatNormalizer().normalize(await this.sensor.capture(fixture)); }
    catch (error) { observationError = error; }
    if (commandError || cleanupError || observationError) {
      const status = commandError ? "COMMAND_UNCERTAIN" : cleanupError ? "TARGET_STATE_UNCERTAIN" : "OBSERVATION_FAILED";
      this.log("STOP", status, "Item path stopped after a failed or uncertain write/readback; no retry.", {
        error: safeError(commandError ?? cleanupError ?? observationError)
      });
      throw commandError ?? cleanupError ?? observationError;
    }
    ensure(activation?.activated && activation.itemId === card.itemId, "ITEM_ACTIVATION_NOT_CONFIRMED");
    const targeted = target !== null;
    const status = targeted && !activation.workflow ? "WORKFLOW_CORRELATION_UNCERTAIN" : "ITEM_ACTIVATED";
    if (activation.workflow) this.log("MIDI", "WORKFLOW_OBSERVED", "Midi workflow result returned by Bridge.", {
      attackTotal: activation.workflow.attackTotal ?? null,
      damageTotal: activation.workflow.damageTotal ?? null,
      hitTargets: activation.workflow.hitTargetIds.length,
      failedSaves: activation.workflow.failedSaveTargetIds.length
    });
    this.log("RESULT", status, status === "ITEM_ACTIVATED" ?
      "Actor-owned Item invocation and fresh Foundry observation completed." :
      "Item was invoked but no correlated Midi workflow was returned; stopped without retry.", {
      item: activation.itemName, target: target?.name ?? "self/none"
    });
    return { status, writesDispatched: this.bridge.writesSent - beforeWrites,
      command: "dnd5e/activate-item",
      result: { itemId: activation.itemId, itemName: activation.itemName, itemType: activation.itemType,
        target: target?.name ?? null, chatMessageId: activation.chatMessageId ?? null,
        workflow: activation.workflow ?? null }, observedState: normalized };
  }
}
