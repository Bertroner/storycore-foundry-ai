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
