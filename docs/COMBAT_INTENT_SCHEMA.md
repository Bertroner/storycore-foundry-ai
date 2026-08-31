# Combat intent schema v1

**Canonical contract; Phase 1A parsing/validation implemented, execution deferred.** The LLM chooses intent; deterministic code validates facts and supported legality, then native Foundry/D&D5e/Midi execute. [WIRE_CONTRACT.md](WIRE_CONTRACT.md) owns transport/trusted scope; [NORMALIZED_COMBAT_STATE.md](NORMALIZED_COMBAT_STATE.md) owns the selectable catalogue.

## Phase 1A implementation status

src/decision-schema.json contains the normative schema below; an automated test prevents drift. Runtime parsing rejects duplicate keys, unknown fields, comments, prose/fences, oversized/deep output and invented references. The real provider uses this same schema when supported; validation remains mandatory without native structured output.

Phase 1A never executes an intent. No plans are offered, so FINAL_INTENT movement and kind=move are rejected as PLAN_NOT_OFFERED. Valid PLAN_REQUEST goals are recorded with PLANNING_UNAVAILABLE feedback into the same bounded decision. Known range/LOS/resource blockers can reject an action; unknown native legality stays explicitly unverified. Acceptance means schema/references/freshness validated for a supervised dry-run, not native legal permission. No deterministic tactic or fallback action is selected. See PHASE1A_TESTING.md for limits and real-test status.

## One bounded decision

Each LLM response is exactly one DecisionResponseV1 branch: **PLAN_REQUEST** or **FINAL_INTENT**, never both or an array. A decision may include read-only planning responses before its single accepted terminal intent; exactly one response branch is allowed per model call. The adapter issues a fresh stepId for each model call, and the LLM echoes it. decisionId/snapshotId stay the same through valid preview feedback.

- PLAN_REQUEST chooses one movement goal. It cannot contain intent, planId, waypoints, commands or writes; unknown fields are rejected. Adapter validates the goal and requests Bridge plan-token-path; it returns PlanSummary or a bounded planning error to the same decision.
- FINAL_INTENT contains the CombatIntentV1 payload: activate_item, move or end_turn. Movement may reference only a planId explicitly offered to this decision. Acceptance seals the decision; no more previews or mutations may be appended by another response.

Phase 1 is limited to one NPC, one active combat, a linked Actor with a unique token instance, 1x1 square-grid walking without doors, and legacy single-target melee/ranged weapons. Unlinked/synthetic Actors, duplicate Actor instances, spells, AoE, reactions, bonus-action complexity, difficult terrain, flying/elevation, doors and multi-NPC tactics are deferred. Broader types/extensions below describe future compatibility; Phase 1 rejects those cases rather than implementing them. [PROJECT_STATE.md](PROJECT_STATE.md) defines the reviewed scope.

The LLM chooses the Actor target, action/weapon and movement goal. For approach it names target plus an offered actionId; the adapter derives stop distance/units from that Item's verified native range metadata. For position/retreat the LLM supplies a single destination grid cell. Grid coordinates describe a goal, not arbitrary waypoints or movement instructions. Deterministic code may choose a geometric route/tie-break; it must not choose a different target, weapon or tactic.

Token IDs are resolved from fresh scene/combat data. Optional combatantId is validated as a scope hint; it does not enable duplicate-instance support in Phase 1. The acting linked Actor/token and authorization come from the trusted request.

Per decision: at most two PLAN_REQUESTs, two repair responses, five LLM responses total, and one accepted FINAL_INTENT; stop at the 30-second decision deadline or earlier snapshot/plan expiry. Plan results do not reset counters or deadline. Stale source state closes the decision and invalidates its offers. A supervised Phase 1 invocation permits at most eight decision cycles and 120 seconds total, with no automatic restart or next-NPC handoff.

Every model response, including malformed output, consumes one of the five responses. Every recognized PLAN_REQUEST consumes one of the two preview slots even if invalid/blocked/timed out; the adapter may issue at most one Bridge preview per slot, with no hidden retries. Invalid output/validation failure consumes a repair allowance when another model response is requested. After the second preview, only a FINAL_INTENT is permitted. Limit exhaustion, cancellation or timeout pauses for manual control without choosing a tactic or auto-ending the turn.

## Normative JSON Schema (Draft 2020-12)

The root validates DecisionResponseV1; $defs.finalIntent defines CombatIntentV1. Unknown keys are rejected at every boundary, without coercion or defaults. Provider function schemas and runtime parsing must use this same union. Nested intent decisionId/snapshotId must match the outer response and trusted request (semantic validation).

~~~json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DecisionResponseV1",
  "oneOf": [
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "schemaVersion",
        "decisionId",
        "snapshotId",
        "stepId",
        "type",
        "goal"
      ],
      "properties": {
        "schemaVersion": {
          "const": "1.0"
        },
        "decisionId": {
          "$ref": "#/$defs/id"
        },
        "snapshotId": {
          "$ref": "#/$defs/id"
        },
        "stepId": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "PLAN_REQUEST"
        },
        "goal": {
          "$ref": "#/$defs/planGoal"
        }
      }
    },
    {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "schemaVersion",
        "decisionId",
        "snapshotId",
        "stepId",
        "type",
        "intent"
      ],
      "properties": {
        "schemaVersion": {
          "const": "1.0"
        },
        "decisionId": {
          "$ref": "#/$defs/id"
        },
        "snapshotId": {
          "$ref": "#/$defs/id"
        },
        "stepId": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "const": "FINAL_INTENT"
        },
        "intent": {
          "$ref": "#/$defs/finalIntent"
        }
      }
    }
  ],
  "$defs": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128
    },
    "target": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "actorId"
      ],
      "properties": {
        "actorId": {
          "$ref": "#/$defs/id"
        },
        "combatantId": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "itemAction": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "actionId",
        "itemId",
        "target"
      ],
      "properties": {
        "actionId": {
          "$ref": "#/$defs/id"
        },
        "itemId": {
          "$ref": "#/$defs/id"
        },
        "target": {
          "$ref": "#/$defs/target"
        }
      }
    },
    "movement": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "planId",
        "goalKind"
      ],
      "properties": {
        "planId": {
          "$ref": "#/$defs/id"
        },
        "goalKind": {
          "enum": [
            "approach",
            "position",
            "retreat"
          ]
        }
      }
    },
    "finalIntent": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "schemaVersion",
        "decisionId",
        "snapshotId",
        "kind",
        "action",
        "movement"
      ],
      "properties": {
        "schemaVersion": {
          "const": "1.0"
        },
        "decisionId": {
          "$ref": "#/$defs/id"
        },
        "snapshotId": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "enum": [
            "activate_item",
            "move",
            "end_turn"
          ]
        },
        "action": {
          "oneOf": [
            {
              "type": "null"
            },
            {
              "$ref": "#/$defs/itemAction"
            }
          ]
        },
        "movement": {
          "oneOf": [
            {
              "type": "null"
            },
            {
              "$ref": "#/$defs/movement"
            }
          ]
        },
        "reason": {
          "type": "string",
          "maxLength": 240
        }
      },
      "oneOf": [
        {
          "properties": {
            "kind": {
              "const": "activate_item"
            },
            "action": {
              "$ref": "#/$defs/itemAction"
            }
          }
        },
        {
          "properties": {
            "kind": {
              "const": "move"
            },
            "action": {
              "type": "null"
            },
            "movement": {
              "$ref": "#/$defs/movement"
            }
          }
        },
        {
          "properties": {
            "kind": {
              "const": "end_turn"
            },
            "action": {
              "type": "null"
            },
            "movement": {
              "type": "null"
            }
          }
        }
      ]
    },
    "gridPoint": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "x",
        "y"
      ],
      "properties": {
        "x": {
          "type": "integer"
        },
        "y": {
          "type": "integer"
        }
      }
    },
    "planGoal": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "target",
            "actionId"
          ],
          "properties": {
            "kind": {
              "const": "approach"
            },
            "target": {
              "$ref": "#/$defs/target"
            },
            "actionId": {
              "$ref": "#/$defs/id"
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "destination"
          ],
          "properties": {
            "kind": {
              "enum": [
                "position",
                "retreat"
              ]
            },
            "destination": {
              "$ref": "#/$defs/gridPoint"
            }
          }
        }
      ]
    }
  }
}
~~~

IDs are opaque nonempty strings <=128 characters. Reject duplicate JSON keys, trailing prose, truncated arguments and responses over 8 KiB UTF-8. Validate destination cells against the selected scene bounds; do not accept a path/waypoint array or model-supplied budget/rule values.

Example first response: request a preview without committing to movement or activation.

~~~json
{
  "schemaVersion": "1.0",
  "decisionId": "decision-17",
  "snapshotId": "snapshot-42",
  "stepId": "step-1",
  "type": "PLAN_REQUEST",
  "goal": {
    "kind": "approach",
    "target": {
      "actorId": "actor-hero",
      "combatantId": "combatant-hero"
    },
    "actionId": "action-scimitar"
  }
}
~~~

After the adapter supplies the offered PlanSummary back to this same decision, the model may choose the final intent. It remains free to choose another supported tactic instead; requesting an approach preview does not commit to Scimitar use.

~~~json
{
  "schemaVersion": "1.0",
  "decisionId": "decision-17",
  "snapshotId": "snapshot-42",
  "stepId": "step-2",
  "type": "FINAL_INTENT",
  "intent": {
    "schemaVersion": "1.0",
    "decisionId": "decision-17",
    "snapshotId": "snapshot-42",
    "kind": "activate_item",
    "action": {
      "actionId": "action-scimitar",
      "itemId": "item-scimitar",
      "target": {
        "actorId": "actor-hero",
        "combatantId": "combatant-hero"
      }
    },
    "movement": {
      "planId": "plan-approach-hero",
      "goalKind": "approach"
    },
    "reason": "Close with the intruder guarding the doorway."
  }
}
~~~

The reason is an optional short decision summary for logs, not hidden chain-of-thought and never executable instructions. Escape it in logs/UI. Do not forward it to a Bridge handler or use it to override validation.

## Validator order and behavior

Only FINAL_INTENT proceeds to item/path-write validation and execution. PLAN_REQUEST branches after shared parse, authorization, freshness and scope checks, and can invoke only read-only geometry planning.

| Stage | Required behavior | Failure result |
|---|---|---|
| Parse/version | Exactly one PLAN_REQUEST or FINAL_INTENT branch, size, recognized version, open decision/snapshot/step IDs; no unknown keys or prose fallback | INVALID_INTENT |
| Authorization | Trusted session controls this world/scene/Actor/combatant and permits the requested operation; current Bridge is GM and capabilities are verified | NOT_AUTHORIZED / UNSUPPORTED |
| Correlation/replay | Match the issued stepId within decisionId/snapshotId. Same (decisionId, stepId)/body returns cached feedback/result; changed body for that pair rejects. Distinct issued steps allow preview → final or bounded repair. An accepted FINAL_INTENT seals the decision | DUPLICATE_CONFLICT / cached result |
| Freshness | Fresh READ bracket agrees on combat.scene, combatId, round, turn, current combatant/Actor/token, connection generation, scene revision and relevant Actor/item/resource/target facts | STALE_STATE |
| Acting instance | Require linked Actor and unique scene token for Phase 1; resolve current combatant and reject synthetic or duplicate instances. Effective Actor/resources/item must agree | INSTANCE_MISMATCH / UNSUPPORTED |
| Planning branch | Validate one PlanGoalV1, catalogue action/target, scene bounds, remaining preview slots and deadline. Translate to Bridge plan-token-path only; return PlanSummary to same decision. Do not execute a write | INVALID_GOAL / PLAN_LIMIT |
| Catalogue | actionId and itemId are paired in the supplied catalogue, Item still owned by effective acting Actor; do not reject solely for hasActivities:false | ITEM_UNAVAILABLE |
| Native availability | Known counters/preparation/equipment/recharge/activation metadata and native constraints allow operation in supported profile. Missing constraints do not become available; native pipeline still has final say | UNAVAILABLE / UNKNOWN_LEGALITY |
| Target | Resolve actorId (+ combatantId if supplied) to fresh scene token. Must be one known perceived target in allowed target set, matching Item target type/count, Foundry disposition and StoryCore relationship context without making a tactical choice | AMBIGUOUS_TARGET / TARGET_UNAVAILABLE |
| Path | Non-null ready planId was offered to this decision, present in movement.plans with matching offeredFor.decisionId/snapshotId, scope and goal; unexpired, native cost within known budget and geometry still valid | STALE_PLAN / PATH_UNAVAILABLE |
| Item after movement | Plan endpoint provisionally permits intended action; after actual movement, OBSERVE then recheck target position/perception, native range, resources, item and current turn | ACTION_INVALIDATED |
| Execution | Translator emits only allowlisted guarded move-token, dnd5e/activate-item or next-turn fields. LLM arguments are never spread into Bridge params | INTERNAL_CONTRACT_ERROR |
| Completion | Fresh readback and matched workflow (when expected) determine observation. Transport success or activated:true alone is not completed rules resolution | UNKNOWN_OUTCOME / PARTIAL |

Use unavailable for a known negative, unknown for missing evidence and unsupported for a capability outside the automatic profile. None may be silently upgraded to legal. Native range/collision measurement and prepared resource values are facts, not a second D&D rules engine. Do not calculate attacks, damage, saves, resistance, HP changes or spend spell slots/items locally.

Known action economy requires a native/verified source or an explicitly initialized exclusive turn lease with observed ledger. Turn index alone cannot prove action/reaction availability. Maximum one activation per decision prevents command bursts but does not by itself enforce a D&D turn. Unknown or externally changed budget pauses automatic execution.

## Rejection, cancellation and partial work

- Return code, affected fields, short explanation and a fresh snapshot/allowed catalogue when safe. **Do not replace the requested action with a tactical fallback.**
- Apply the shared bounds above to previews, final-intent repairs and all model responses together. New decisionId after stale state consumes the same supervised invocation budget; it does not reset the eight-cycle/120-second cap.
- No LLM/provider success by the deadline: pause for manual control. Do not auto-end a turn as a fallback.
- Cancellation before dispatch sends no writes. After movement/item dispatch, finish readback/reconciliation; report actual partial state.
- If movement succeeds but the item becomes invalid, retain observed movement and spent budget. Request a fresh LLM decision; never undo movement automatically or choose another Item.
- If an item response is lost or capture is ambiguous, do not retry it, roll again, spend resources again, or advance turn. Observe, mark unknown and pause.
- end_turn is explicit and guarded. It is never appended implicitly after a timeout/error, and repeated submissions cannot advance twice.

## Cases to verify during implementation

Accept: known legacy Scimitar with hasActivities:false; pure move using a valid offered plan; explicit end_turn. A matched workflow with empty native rolls is an observed result, not an error.

Reject: invented Item or plan; extra code/command/damage fields; mismatched actionId/itemId; ambiguous Actor instances; hidden or unknown-perception target; stale round/current token; unknown budget; movement beyond budget; unsupported spell/template/multiattack; reuse of a plan after a door/target/token change.

Pause: uncertain activation, unrelated Midi completion, manual movement during execution, partial route, disconnect after write dispatch. These tests validate boundaries and failure behavior, not a duplicate implementation of D&D.

Planning cases to verify in future implementation: PLAN_REQUEST without any write; feedback returns to the same decision; rejected arbitrary waypoints; rejected combined plan/final response; unknown/unoffered planId; second-preview limit; malformed responses cannot reset budgets; replayed step returns cached feedback; final acceptance closes planning. This review runs no implementation or live POC tests.
