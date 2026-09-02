# Proven POC Baseline

This file is authoritative for the live POC record. This review corrects documentation only; no new POC/live combat tests were run. Preserve these established results:

- Foundry VTT: 12.343
- D&D5e: 3.3.1
- API Bridge local WebSocket path proven.
- Full Actor/item state can be read.
- Spell-slot and item-use counters are present in full Actor data.
- Combat state and current combatant can be read.
- Combat turn context exposes token grid position, distance, LOS, walls/ascii map.
- Scene tokens can be resolved by Actor ID.
- Token movement works.
- Wall avoidance was proven in a live POC.
- Movement budget was read from Actor walk speed.
- Movement-budget enforcement was proven within the POC scope.
- `dnd5e/activate-item` + Midi-QOL performed real weapon attacks.
- Both hit and miss behavior were observed.
- Fresh Foundry HP readback confirmed HP changed only on actual hit.
- `next-turn` works.
- Runtime/random-position branch choice POC passed for melee and ranged.

Important observations:
- write responses may contain stale token coordinates;
- always perform a fresh observation after mutation;
- `workflow` contains useful Midi results even when `rolls` is empty.

## Not independently proven

**Movement-exhaustion-across-multiple-NPC-turns is not independently proven.** Multi-turn movement continuation must not be listed as proven. Movement-budget reading/enforcement and next-turn success do not independently establish exhaustion, reset or continuation across multiple NPC turns.

The runtime melee/ranged POC demonstrated choices based on fresh observed state; it did not establish that StoryCore's LLM made those choices. The Phase 1 slice requires the LLM to make the actual action, target and movement decision.

## Live supervised legacy spell and turn-advance proof (2026-09-02)

A real Qwen decision selected an Actor-owned legacy Fire Bolt cantrip against the operator-authorized Ethan target. The existing API Bridge invoked the Item once, and Midi-QOL returned attackTotal=13, damageTotal=15 and hitTargets=0. This was a miss; no HP damage is claimed from damageTotal alone. After fresh readback reported the action spent, Qwen selected end_turn and Foundry fresh combat readback confirmed a different current combatant. Final status was TURN_ADVANCED with four writes: target reset, one Item activation, target cleanup and next-turn.

This proves one bounded single-target legacy spell-attack invocation and one subsequent LLM-selected turn advance in an isolated supervised run. It does not prove all spells, applied damage on this miss, multi-target/AoE, reactions, concentration, upcasting, prepared levelled spells, concurrent Midi workflow correlation or automatic multi-NPC continuation.
