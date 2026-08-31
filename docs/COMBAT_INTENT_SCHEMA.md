# Combat intent schema v1

**Proposed contract, not an implemented API.** The LLM chooses intent; deterministic code validates facts and supported legality, then native Foundry/D&D5e/Midi execute. [WIRE_CONTRACT.md](WIRE_CONTRACT.md) owns transport/trusted scope; [NORMALIZED_COMBAT_STATE.md](NORMALIZED_COMBAT_STATE.md) owns the selectable catalogue.

## One bounded decision

The sole write-intent tool is submit_combat_intent. One complete JSON object is accepted per decisionId. It chooses one native item use, optionally preceded by one offered path; a path only; or explicit end-turn. There are no arbitrary commands, scripts, macros, roll formulas, damage amounts, HP changes, effect instructions or attack counts.

The model selects **target Actor identity**. Optional combatantId disambiguates repeated instances. Token IDs are resolved from fresh scene/combat data at validation and again before execution, never remembered as stable identity. The acting Actor/token and authorization come from the trusted request, not LLM-selected scope.

A movement plan is a reference to a concrete **movement goal** already previewed by Bridge, such as approach a specified Actor within an item-derived reach, retreat to a specified grid cell, or move to a specified grid cell. goalKind echoes that goal class; planId binds exact destination, target, budget and snapshot. The model may request other previews through the read-only planning operation before submitting intent. Path tie-breaking is deterministic geometry; no adapter rule picks a tactic or weapon.

Initial automatic catalogue: supported single-target legacy weapon item use and supported walking path. Other native actions can be represented as unavailable/manual in state but cannot execute automatically until capability/availability verification is added. No generic attack-count inference for Multiattack, Extra Attack, reactions or bonus actions.

## Normative JSON Schema (Draft 2020-12)

Runtime validation must implement this schema plus semantic checks below. Unknown keys are rejected at every object boundary, without coercion/default insertion. Provider-specific schemas are generated from it; a provider's function declaration is not a substitute for runtime validation.

~~~json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "CombatIntentV1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "decisionId", "snapshotId", "kind", "action", "movement"],
  "properties": {
    "schemaVersion": { "const": "1.0" },
    "decisionId": { "$ref": "#/$defs/id" },
    "snapshotId": { "$ref": "#/$defs/id" },
    "kind": { "enum": ["activate_item", "move", "end_turn"] },
    "action": {
      "oneOf": [
        { "type": "null" },
        { "$ref": "#/$defs/itemAction" }
      ]
    },
    "movement": {
      "oneOf": [
        { "type": "null" },
        { "$ref": "#/$defs/movement" }
      ]
    },
    "reason": { "type": "string", "maxLength": 240 }
  },
  "oneOf": [
    {
      "properties": {
        "kind": { "const": "activate_item" },
        "action": { "$ref": "#/$defs/itemAction" }
      }
    },
    {
      "properties": {
        "kind": { "const": "move" },
        "action": { "type": "null" },
        "movement": { "$ref": "#/$defs/movement" }
      }
    },
    {
      "properties": {
        "kind": { "const": "end_turn" },
        "action": { "type": "null" },
        "movement": { "type": "null" }
      }
    }
  ],
  "$defs": {
    "id": { "type": "string", "minLength": 1, "maxLength": 128 },
    "target": {
      "type": "object",
      "additionalProperties": false,
      "required": ["actorId"],
      "properties": {
        "actorId": { "$ref": "#/$defs/id" },
        "combatantId": { "$ref": "#/$defs/id" }
      }
    },
    "itemAction": {
      "type": "object",
      "additionalProperties": false,
      "required": ["actionId", "itemId", "target"],
      "properties": {
        "actionId": { "$ref": "#/$defs/id" },
        "itemId": { "$ref": "#/$defs/id" },
        "target": { "$ref": "#/$defs/target" }
      }
    },
    "movement": {
      "type": "object",
      "additionalProperties": false,
      "required": ["planId", "goalKind"],
      "properties": {
        "planId": { "$ref": "#/$defs/id" },
        "goalKind": { "enum": ["approach", "position", "retreat"] }
      }
    }
  }
}
~~~

IDs are opaque: do not assume Foundry UUID format/length beyond the bound, derive IDs from names, or accept a name instead. Reject duplicate JSON keys, trailing non-JSON content, truncated tool arguments, non-finite numbers and payloads over 8 KiB UTF-8 before semantic processing. In this schema there are no model-supplied numeric rule values.

Example, using catalogue IDs from the state document:

~~~json
{
  "schemaVersion": "1.0",
  "decisionId": "decision-17",
  "snapshotId": "snapshot-42",
  "kind": "activate_item",
  "action": {
    "actionId": "action-scimitar",
    "itemId": "item-scimitar",
    "target": { "actorId": "actor-hero", "combatantId": "combatant-hero" }
  },
  "movement": { "planId": "plan-approach-hero", "goalKind": "approach" },
  "reason": "Close with the intruder guarding the doorway."
}
~~~

The reason is an optional short decision summary for logs, not hidden chain-of-thought and never executable instructions. Escape it in logs/UI. Do not forward it to a Bridge handler or use it to override validation.

## Validator order and behavior

| Stage | Required behavior | Failure result |
|---|---|---|
| Parse/version | Exact schema, size, one terminal intent, recognized version and IDs; no unknown keys or prose fallback | INVALID_INTENT |
| Authorization | Trusted session controls this world/scene/Actor/combatant and permits the requested operation; current Bridge is GM and capabilities are verified | NOT_AUTHORIZED / UNSUPPORTED |
| Correlation/replay | decisionId and snapshotId match an open trusted decision. Same ID/body returns cached progress/result; same ID/different body rejects. No new dispatch for a closed/in-flight decision | DUPLICATE_CONFLICT / cached result |
| Freshness | Fresh READ bracket agrees on combat.scene, combatId, round, turn, current combatant/Actor/token, connection generation, scene revision and relevant Actor/item/resource/target facts | STALE_STATE |
| Acting instance | Resolve from current combatant, verify token.actorId/base Actor relationship; effective Actor/resources/item come from this token; reject missing or ambiguous matches | INSTANCE_MISMATCH / AMBIGUOUS_TARGET |
| Catalogue | actionId and itemId are paired in the supplied catalogue, Item still owned by effective acting Actor; do not reject solely for hasActivities:false | ITEM_UNAVAILABLE |
| Native availability | Known counters/preparation/equipment/recharge/activation metadata and native constraints allow operation in supported profile. Missing constraints do not become available; native pipeline still has final say | UNAVAILABLE / UNKNOWN_LEGALITY |
| Target | Resolve actorId (+ combatantId if supplied) to fresh scene token. Must be one known perceived target in allowed target set, matching Item target type/count, Foundry disposition and StoryCore relationship context without making a tactical choice | AMBIGUOUS_TARGET / TARGET_UNAVAILABLE |
| Path | Plan exists, same actor/token/scene/decision snapshot, unexpired, same goalKind and target/destination, still valid under native collision/occupancy/bounds; native measured cost within known remaining budget | STALE_PLAN / PATH_UNAVAILABLE |
| Item after movement | Plan endpoint provisionally permits intended action; after actual movement, OBSERVE then recheck target position/perception, native range, resources, item and current turn | ACTION_INVALIDATED |
| Execution | Translator emits only allowlisted guarded move-token, dnd5e/activate-item or next-turn fields. LLM arguments are never spread into Bridge params | INTERNAL_CONTRACT_ERROR |
| Completion | Fresh readback and matched workflow (when expected) determine observation. Transport success or activated:true alone is not completed rules resolution | UNKNOWN_OUTCOME / PARTIAL |

Use unavailable for a known negative, unknown for missing evidence and unsupported for a capability outside the automatic profile. None may be silently upgraded to legal. Native range/collision measurement and prepared resource values are facts, not a second D&D rules engine. Do not calculate attacks, damage, saves, resistance, HP changes or spend spell slots/items locally.

Known action economy requires a native/verified source or an explicitly initialized exclusive turn lease with observed ledger. Turn index alone cannot prove action/reaction availability. Maximum one activation per decision prevents command bursts but does not by itself enforce a D&D turn. Unknown or externally changed budget pauses automatic execution.

## Rejection, cancellation and partial work

- Return code, affected fields, short explanation and a fresh snapshot/allowed catalogue when safe. **Do not replace the requested action with a tactical fallback.**
- Allow at most two schema/legality repair attempts for a decision (initial response plus two repairs); stale state opens a new decisionId. Cap a runner at eight decision cycles and 120 seconds before pausing. Bounds are operational limits, not combat rules.
- No LLM/provider success by the deadline: pause for manual control. Do not auto-end a turn as a fallback.
- Cancellation before dispatch sends no writes. After movement/item dispatch, finish readback/reconciliation; report actual partial state.
- If movement succeeds but the item becomes invalid, retain observed movement and spent budget. Request a fresh LLM decision; never undo movement automatically or choose another Item.
- If an item response is lost or capture is ambiguous, do not retry it, roll again, spend resources again, or advance turn. Observe, mark unknown and pause.
- end_turn is explicit and guarded. It is never appended implicitly after a timeout/error, and repeated submissions cannot advance twice.

## Cases to verify during implementation

Accept: known legacy Scimitar with hasActivities:false; pure move using a valid offered plan; explicit end_turn. A matched workflow with empty native rolls is an observed result, not an error.

Reject: invented Item or plan; extra code/command/damage fields; mismatched actionId/itemId; ambiguous Actor instances; hidden or unknown-perception target; stale round/current token; unknown budget; movement beyond budget; unsupported spell/template/multiattack; reuse of a plan after a door/target/token change.

Pause: uncertain activation, unrelated Midi completion, manual movement during execution, partial route, disconnect after write dispatch. These tests validate boundaries and failure behavior, not a duplicate implementation of D&D.

