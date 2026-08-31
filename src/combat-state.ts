// Canonical DTO from docs/NORMALIZED_COMBAT_STATE.md. No raw Foundry data.
export type ID = string;
export type ShortText = string;
export type FactSource = "native" | "bridge-approximation" | "turn-lease" | "unknown";
export type Counter = { value: number | null; max: number | null };
export type TargetRef = { actorId: ID; combatantId?: ID };
export type GridPoint = { x: number; y: number };
export type PlanGoalV1 =
  | { kind: "approach"; target: TargetRef; actionId: ID }
  | { kind: "position" | "retreat"; destination: GridPoint };
export type Availability = "available" | "conditional" | "unavailable" | "unknown";
export type Goal = {
  kind: "approach" | "position" | "retreat";
  target: TargetRef | null;
  destination: GridPoint | null;
  within: number | null;
  units: string;
};
export type ActionCard = {
  actionId: ID;
  itemId: ID;
  name: ShortText;
  itemType: "weapon" | "spell" | "feat" | "consumable" | "other";
  hasActivities: boolean | null;
  activation: {
    type: string | null;
    cost: number | null;
    source: FactSource;
  };
  execution: "automatic" | "manual" | "unsupported";
  availability: Availability;
  blockers: ShortText[];
  equipped: boolean | null;
  quantity: number | null;
  uses: Counter | null;
  rechargeReady: boolean | null;
  range: { normal: number | null; long: number | null; units: string | null };
  target: { kind: string | null; count: number | null };
  damageTypes: string[];
  saveAbility: string | null;
  spell: { level: number | null; prepared: boolean | null } | null;
  resourceCosts: { resourceId: ID; amount: number | null; source: FactSource }[];
  summary: ShortText;
  eligibleTargets: TargetRef[];
};
export type PlanSummary = {
  planId: ID | null;
  offeredFor: { decisionId: ID; snapshotId: ID; requestStepId: ID };
  goal: Goal;
  endpoint: GridPoint | null;
  status: "ready" | "over_budget" | "blocked" | "unsupported" | "unknown";
  distance: number | null;
  cost: number | null;
  units: string;
  withinBudget: boolean | null;
  reachesGoal: boolean;
  expiresAt: string;
  blockers: ShortText[];
};
export type CombatStateV1 = {
  schemaVersion: "1.0";
  snapshotId: ID;
  observedAt: string;
  expiresAt: string;
  scope: {
    worldId: ID; sceneId: ID; combatId: ID;
    sessionEpoch: ID; revision: ID;
  };
  runtime: {
    foundryVersion: string;
    systemId: "dnd5e";
    systemVersion: string;
    bridgeVersion: string | null;
    midiVersion: string | null;
    scopeVerified: boolean;
    pathPreview: boolean;
    workflowMatching: boolean;
    automaticExecution: boolean;
  };
  combat: {
    started: boolean; round: number; turn: number;
    current: { combatantId: ID; actorId: ID; tokenId: ID };
  };
  self: {
    actorId: ID; tokenId: ID; combatantId: ID;
    effectiveActorUuid: string | null;
    actorLink: boolean | null;
    name: ShortText; actorType: string;
    position: GridPoint; elevation: number | null;
    footprint: { width: number; height: number };
    hp: { current: number | null; max: number | null; temp: number | null };
    ac: number | null;
    abilities: {
      str: number | null; dex: number | null; con: number | null;
      int: number | null; wis: number | null; cha: number | null;
    };
    movement: { walk: number | null; units: string | null };
    resources: { resourceId: ID; label: ShortText; counter: Counter; source: FactSource }[];
    spellSlots: { key: ID; level: number | null; counter: Counter }[];
    conditions: ShortText[];
    effects: {
      id: ID; name: ShortText; disabled: boolean;
      suppressed: boolean | null; remaining: number | null; units: string | null;
    }[];
    effectsComplete: boolean;
  };
  budgets: {
    movementRemaining: number | null;
    units: string;
    actionAvailable: boolean | null;
    bonusActionAvailable: boolean | null;
    reactionAvailable: boolean | null;
    source: FactSource;
    leaseId: ID | null;
  };
  actions: ActionCard[];
  nearby: {
    actorId: ID; tokenId: ID; combatantId: ID | null;
    name: ShortText;
    disposition: "hostile" | "neutral" | "friendly" | "secret" | "unknown";
    position: GridPoint;
    distance: number | null; units: string; distanceSource: FactSource;
    wallLos: boolean | null;
    perceived: true;
    perceptionSource: "native" | "verified-fixture";
    conditions: ShortText[];
    health: "unharmed" | "injured" | "down" | "unknown";
  }[];
  movement: {
    profile: string;
    grid: { type: string; sizePixels: number; distance: number; units: string };
    plans: PlanSummary[];
  };
  quality: {
    unknowns: ShortText[];
    warnings: ShortText[];
    omittedActions: number;
    omittedNearby: number;
    completeForDecision: boolean;
  };
};
