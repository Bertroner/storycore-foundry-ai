# Proven POC Baseline

Do not throw away these established results:

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
- `dnd5e/activate-item` + Midi-QOL performed real weapon attacks.
- Both hit and miss behavior were observed.
- Foundry HP changed only on actual hit.
- `next-turn` works.
- Runtime/random-position branch choice POC passed for melee and ranged.

Important observations:
- write responses may contain stale token coordinates;
- always perform a fresh observation after mutation;
- `workflow` contains useful Midi results even when `rolls` is empty.
