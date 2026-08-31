# Fire Bolt execution-seam test — automatic discovery checkpoint

Started: 2026-08-31. Harness checkpoint completed: 2026-09-01.
Starting repository HEAD: `46375c254d9d4a907bd618f1069532e4d96f383c` (`Audit V12 spell execution architecture`), branch `main`.

**Spell execution: NOT_PERFORMED. Latest live discovery: CASTER_NOT_FOUND. Execution: DISABLED_REVIEW_REQUIRED. writesDispatched: 0.**

No Fire Bolt was cast. This is neither PASS–HIT nor PASS–MISS, and it does not prove the spell execution seam. Automatic discovery was exercised against live Foundry; successful complete selection was verified separately with offline fixtures.

## Correction to the earlier stop

The earlier `NOT_PERFORMED — PRECONDITIONS_UNVERIFIED` stop incorrectly required the operator to supply scene/caster/target identifiers and certify the absence of other workflows. That was an unnecessarily manual **test-harness precondition**, not a Foundry or Bridge limitation. The runtime must resolve technical identities itself. The old request for IDs and isolation attestation is withdrawn.

The current instruction authorizes fixing and checking discovery only. **Do not activate an Item in the same pass that changes the harness.** Review the automatically discovered setup before separately authorizing a live Run. No manual IDs or workflow-isolation checkbox are required by the new UI.

## Implemented test-only boundary

Run the separate discovery application with `run-fire-bolt-discovery.bat` (double-click in Explorer) or `npm run fire-bolt:discover`. Close the normal StoryCore desktop first because both use the existing loopback Bridge listener on port 3210. Existing locally protected credentials are reused in memory; no key entry, settings rewrite or Foundry configuration change is needed. The normal portable application has not been repackaged or given spell support.

- `harness/fire-bolt/discovery.ts`: active scope, native ownership, unique linked participants, current-caster preference/fallback, owned Fire Bolt eligibility, row selection and fresh revalidation.
- `harness/fire-bolt/bridge.ts`: isolated READ allowlist, adding only bounded `filter-actors` and `resolve-uuid` requests to the existing reader. There is no live write method.
- `harness/fire-bolt/service.ts`, `window.ts`, `preload.cts`, `renderer.ts`, `ui/`: sandboxed desktop review screen. Scene, round, current combatant and participant names are displayed when discovery succeeds. Multiple eligible candidates require a human-readable row selection, including numbered rows when names coincide. IDs are diagnostic output inside collapsed Advanced details, never editable input.
- `harness/fire-bolt/guard.ts`: one-shot policy tested with injected **fake** dispatch/observation ports. It is deliberately not imported by the discovery application and has no live transport binding.
- `src/bridge-session.ts` and `src/server.ts`: small reuse seams for a test reader and safe failure labels. Production retains exactly its original eight READ commands, authentication, correlation and timeout behavior; its default failure label is unchanged. No production CombatNormalizer, DecisionRunner or intent schema changed.

The review UI exposes fixed `status`, `saveBridgeKey`, `detect`, and `choose` IPC methods. Bridge status is displayed separately from execution state. The only editable connection value is a masked Bridge key; it is validated, encrypted with the existing Windows DPAPI settings store, cleared from the field after a successful save, and never returned by IPC. Foundry API Bridge remains the outbound client and reconnects to the loopback listener automatically. **Run one Fire Bolt test is disabled; no activation IPC or HTTP endpoint exists in this build.** Renderer networking, arbitrary RPC, arbitrary UUID resolution, Node integration and untrusted-frame IPC are denied. No OpenRouter/provider client is bound.

## Exact ownership/source evidence

Canonical read-only donor: `_references/foundry-api-bridge`, v8.11.2, commit `f71ea11b708d78c85c979ddae04d371be66e766e`; donor worktree remained clean.

| Local source | Observed behavior / harness use |
|---|---|
| `_references/foundry-api-bridge/src/main.ts:249` | Registers **`filter-actors`**, not `dnd5e/filter-actors` |
| `_references/foundry-api-bridge/src/commands/handlers/actor/FilterActorsHandler.ts` | Returns filtered Actor IDs/names, total and pagination status |
| `_references/foundry-api-bridge/src/filtering/actors/infrastructure/FoundryActorMapper.ts` | Copies native `raw.hasPlayerOwner` into the filter model |
| `_references/foundry-api-bridge/src/filtering/actors/domain/specifications/HasPlayerOwnerSpecification.ts` | Compares the native boolean with the requested value |
| `_references/foundry-api-bridge/src/commands/handlers/world/ResolveUuidHandler.ts` and native UUID-resolution service | Return document identity, parent UUID and document data; used to verify Combat scene/active state, native Token `actorLink` and owned Item parent |
| `_references/foundry-api-bridge/src/commands/handlers/combat/combatTypes.ts` | Uses current `game.combat`, current combatant and combat participants; exact no-combat failure maps safely to `NO_ACTIVE_COMBAT` |

Both native ownership partitions are read with bounded pagination: `hasPlayerOwner=true` and `false`, 200 per page, at most eight pages each. Missing, overlapping or inconsistent results reject with an ownership error; absence from the player-owned list is **not** interpreted as proof of NPC ownership. Each capture also has a 100-read / 60-second bound and uses the existing per-read timeout. No User registry or raw ownership permission map is sent to the renderer.

Control ownership is independent of disposition, Actor type/name and relationships. A player-owned Actor can only be offered as a target fixture, never an AI caster. No nearest-target, lowest-HP, faction or hostility inference is used. The predicate naming Fire Bolt is confined to this explicitly requested one-spell test fixture; it is not a production per-spell handler.

## Discovery and pre-call checks

1. Read active combat and active scene, current turn and live runtime versions; resolve the native Combat document to verify its scene and active flag. No combat yields `NO_ACTIVE_COMBAT`.
2. Read scene tokens and native ownership partitions. Count **all** Actor instances in the scene, including hidden tokens. Duplicate instances, duplicate combat membership, hidden/defeated participants and unlinked tokens are not eligible. Synthetic Actor overlays remain outside this isolated test.
3. Prefer the current eligible combatant; otherwise offer the eligible NPC participants. The caster must own exactly one matching `type=spell`, `name=Fire Bolt`, `level=0` Item with the supported legacy single-target attack shape, no concentration/template/activity/resource-charge requirement. Zero candidates yields `CASTER_NOT_FOUND`; multiple fallback candidates require a name/row choice.
4. Offer player-owned combat participants as target fixtures. One is automatic; multiple require a name/row choice. Zero valid targets yields `TARGET_NOT_FOUND`. No technical identity can be submitted by the UI; selection accepts only issued detection/row handles.
5. For a complete selection, repeat reads and compare scope, connection epoch, ownership, token and Item identity. Resolve `Actor.<actualActorId>.Item.<actualOwnedItemId>` and verify its parent. Read bounded HP/resource fields. Fresh bracket reads reject scope/identity changes with `SCOPE_STALE`.

The Compendium Fire Bolt ID is never an executable identity. No Item is imported, created or edited to satisfy discovery. Foundry version stays 12.343 / D&D5e 3.3.1; incompatible version data rejects rather than upgrading.

## What was actually observed live

The old normal StoryCore desktop listener was closed to free port 3210; only the isolated test UI was started/restarted. Foundry and its world were not restarted, upgraded or modified.

The initial development read returned `BRIDGE_READ_FAILED` because the new harness incorrectly requested `dnd5e/filter-actors`. Inspection of the pinned registration established the correct generic command `filter-actors`. The harness and fixtures were corrected and all tests rerun. Read failures now include a safe command label rather than exposing raw Bridge errors.

The corrected discovery application's sanitized outcome was:

```json
{
  "status": "CASTER_NOT_FOUND",
  "execution": "DISABLED_REVIEW_REQUIRED",
  "writesDispatched": 0
}
```

This status is emitted after successful capture of active combat/scene, version checks, token/ownership reads and the scope bracket, when the eligible caster set is empty. **It does not establish which specific eligibility requirement excluded a particular Actor.** No eligible caster or complete human-readable caster/target setup can be reported from this attempt; none was invented from the historical Mage/Goblin/Ethan examples. Actual owned Item verification and target selection were not completed live. The runtime stopped instead of choosing another Actor or changing the world.

| Evidence | Result / limit |
|---|---|
| Live Foundry/D&D5e version checks | Passed before `CASTER_NOT_FOUND`: Foundry 12.343, D&D5e 3.3.1 |
| Installed Midi / Bridge / DAE metadata from earlier preflight | Midi 11.5.5, Bridge 8.11.2, DAE 11.3.64; not proof of active automation settings or a workflow |
| Chosen caster / target / owned spell identities | No complete live selection; no executable Item ID substituted from Compendium |
| Activation request ID / workflow / attack / hit / damage | None; no activation dispatched |
| HP and resources before/after a cast | Not evaluated; no cast and no unchanged-value claim |
| Current `game.user.targets` before/after a cast | Not observed; no target writes or restoration attempted |
| Foundry writes / LLM calls / memory writes | 0 / 0 / 0 |
| Result | Spell execution remains **NOT_PERFORMED** |

No movement, path planning, activation, Midi invocation, manual roll, slot/HP/effect change, next-turn or other Foundry write was issued. These reads are not a new proven spell POC. `PROVEN_POC.md` remains unchanged.

## Bounded guard: tested policy, not live correlation proof

The test-only guard burns a single-use fuse before preparation, then can invoke only one fixed activation request with the actual Actor ID, owned Item ID and one target Token ID. No spell level, activity, template or resource parameter is constructed. A second or concurrent Run is rejected; no retry can follow a timeout or partial/uncertain failure.

After any dispatch attempt it requests fresh observation, including after dispatch failure/timeout. Changed scope or explicitly observed interference yields `TEST_INTERFERENCE`. Missing, unrelated, unsettled or unscoped workflow evidence yields `WORKFLOW_CORRELATION_UNCERTAIN`; late completion cannot change the returned result into success. Observation itself is bounded. Preparation failure prevents dispatch.

**These assertions were tested with fake ports, not against Midi.** An unscoped Bridge `RollComplete` is never accepted as sufficient proof. The future separately reviewed live binding must provide the scoped observer and target-state observation/restoration described in the donor audit, or stop uncertain. Neither production workflow correlation nor a live target lifecycle was implemented. The guard's matching-workflow outcome is not PASS–HIT/PASS–MISS or proof of HP correctness.

## Verification and next boundary

- `npm run check`: **84/84 tests passed**, including the existing 63 plus 21 Fire Bolt harness regressions; typecheck and build passed.
- `npm run test:fire-bolt-ui`: offline Electron UI/backend integration passed. The actual sandboxed renderer automatically displayed fixture Scene=Test Arena, Round=1, Caster=Mage; the operator-row simulation selected Alice from Ethan/Alice, and backend resolved `token-alice` plus the real fixture-owned Item. No manual IDs, network/provider call or live write. These are **fixture names**, not a claimed live detected setup.
- `git diff --check`: passed. Only harness/reuse seams, tests, scripts and documentation are included. Local credentials, settings, DPAPI data, logs, screenshots, packaged binaries and donor repositories are excluded.

Review the harness and the `CASTER_NOT_FOUND` result. A suitable linked, uniquely instanced non-player-owned combat participant with a real owned Fire Bolt must exist before a complete setup can be reviewed. This task does not create it or request technical IDs. Any later discovery still resolves identities automatically. A live cast requires separate authorization and reviewed live binding/observation; **do not cast in this checkpoint**.

Commit: **Automate Fire Bolt test discovery**. STOP. No Phase 2 implementation or full spell/Phase 1A acceptance is claimed.
