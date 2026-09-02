# Combat intent schema v1

**Canonical contract; supervised execution implemented for the bounded legacy subset.** The LLM chooses intent. Deterministic code validates schema, references, freshness, known range, turn-lease budgets and offered plan IDs. Foundry/D&D5e/Midi execute and resolve rules.

## One bounded decision

Each response is exactly PLAN_REQUEST or FINAL_INTENT. PLAN_REQUEST contains one movement goal and no commands or waypoints. FINAL_INTENT contains activate_item, move or end_turn. Correlation fields appear once on the outer response and must match the issued decision, snapshot and step.

The initial provider schema permits PLAN_REQUEST, activate_item and end_turn, but excludes move because no valid planId exists yet. Once a PlanSummary is ready, only FINAL_INTENT is allowed. After PLAN_NOT_OFFERED or PLAN_NOT_NEEDED, a repair is restricted to non-movement FINAL_INTENT. Deterministic validation independently rejects invented plans, stale IDs, unavailable actions and exhausted budgets.

Each decision permits at most two PLAN_REQUESTs, two repair responses, five total model responses and 60 seconds shared with snapshot expiry. An accepted FINAL_INTENT seals that decision. One supervised turn episode may start at most five fresh decisions after command readbacks; it stops on end_turn, uncertainty, stale scope, cancellation or limit exhaustion.

The current scope offers generic legacy one-cost action and bonus-action Items. The process-local turn lease marks actionAvailable, bonusActionAvailable and movementRemaining. The LLM may select only ActionCards still marked available and targets in eligibleTargets. Reactions, prepared levelled spells, AoE/templates, arbitrary code and model-supplied rule values remain rejected.

## Normative JSON Schema (Draft 2020-12)

The root validates DecisionResponseV1; $defs.finalIntent defines CombatIntentV1. Unknown keys are rejected at every boundary, without coercion or defaults. Provider function schemas and runtime parsing must use this same union. Correlation and freshness IDs exist once on the outer response and must match the trusted request. The nested intent is a strict kind-specific branch with only action, movement or neither.

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
          "oneOf": [
            {
              "type": "null"
            },
            {
              "$ref": "#/$defs/target"
            }
          ]
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
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "action"
          ],
          "properties": {
            "kind": {
              "const": "activate_item"
            },
            "action": {
              "$ref": "#/$defs/itemAction"
            },
            "movement": {
              "type": "null"
            },
            "reason": {
              "type": "string",
              "maxLength": 240
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind",
            "movement"
          ],
          "properties": {
            "kind": {
              "const": "move"
            },
            "action": {
              "type": "null"
            },
            "movement": {
              "$ref": "#/$defs/movement"
            },
            "reason": {
              "type": "string",
              "maxLength": 240
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "kind"
          ],
          "properties": {
            "kind": {
              "const": "end_turn"
            },
            "action": {
              "type": "null"
            },
            "movement": {
              "type": "null"
            },
            "reason": {
              "type": "string",
              "maxLength": 240
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
    "kind": "activate_item",
    "action": {
      "actionId": "action-scimitar",
      "itemId": "item-scimitar",
      "target": {
        "actorId": "actor-hero",
        "combatantId": "combatant-hero"
      }
    },
    "reason": "Attack the selected intruder."
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
| Planning branch | Validate one PlanGoalV1, catalogue action/target, canPlanApproach, eligibleTargets, scene bounds, remaining preview slots and deadline. Translate to geometric planning only; return PlanSummary to the same decision. Do not execute a write | INVALID_GOAL / PLAN_LIMIT |
| Catalogue | actionId and itemId are paired in the supplied catalogue, Item still owned by effective acting Actor; do not reject solely for hasActivities:false | ITEM_UNAVAILABLE |
| Native availability | Known counters/preparation/equipment/recharge/activation metadata and native constraints allow operation in supported profile. Missing constraints do not become available; native pipeline still has final say | UNAVAILABLE / UNKNOWN_LEGALITY |
| Target | Resolve actorId (+ combatantId if supplied) to a fresh scene token. It must be in the operator-selected closed attack-target set, relationToSelf=enemy and the chosen ActionCapability eligibleTargets. Foundry disposition remains diagnostic and never defines this NPC-relative relationship | AMBIGUOUS_TARGET / TARGET_UNAVAILABLE |
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
