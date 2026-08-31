# V12 Spell Execution Donor Audit

Date: 2026-08-31. Starting project HEAD: `eaea65b4397533394477c73ca1044eeefaa543d9` (`main`, clean).

## 1. Executive conclusion

**OBSERVED:** Legacy spells are another Actor-owned Item type through the existing API Bridge `dnd5e/activate-item` gateway. A new spell command, REST transport, per-spell executor or StoryCore rules engine is not justified. Native D&D5e 3.3.1 already owns use configuration, consumption, upcast preparation, concentration initiation and template construction; Midi wraps this same `Item.use` seam to orchestrate attacks, saves, damage and configured effects.

**INFERENCE:** A simple spell can plausibly use the already-proven legacy Scimitar gateway. This is source compatibility, **not a live spell-execution result**. Native invocation, workflow completion and complete automation of the spell's meaning are different claims.

| Capability | Already handled by D&D5e/Midi? | StoryCore responsibility | Confidence |
|---|---|---|---|
| Spell attack | INVOKABLE; native attack API, Midi can drive attack/hit workflow | Choose current Item and exact target; validate and observe | High source; spell live result unproven |
| Save spell | INVOKABLE; native save rolls/DC, Midi can request/resolve saves when configured | Choose/validate targets; report missing automation | High conditional source; not full effect proof |
| Damage | Native damage rolls; Midi damage application/mitigation workflow when enabled | Never roll or mutate HP; fresh target readback | High source; Scimitar live evidence only |
| Healing | Native typed healing rolls/application primitives; Midi damage/healing pipeline when enabled | Select capability/target; observe HP/resources | High conditional source; not tested here |
| Single target | Native/Midi can use user targets | Fresh scene-token resolution; exact target set and lifecycle | High source; current Bridge lacks safe lifecycle |
| Self target | Midi workflow replaces targets with caster token for `target.type=self` | Resolve unique caster instance; reject ambiguity | High source; no Shield live proof |
| AoE | Native template geometry plus Midi target/save/damage pipeline | Select point, validate scope and supported family | Conditional; NOT proven unattended |
| Template placement | Native interactive preview; programmatic factory/document API; Bridge preview override exists | Future safe placement integration, cleanup and validation | High API evidence; Bridge override unsafe/unverified live |
| Spell slot | Native consumption called through Midi wrapper | Read availability, select allowed slot; never decrement | High source; settings/Actor data determine actual cost |
| Upcast level | Native flat `slotLevel`; Midi reads resulting card level | Validate explicit choice and translate legacy config | High source; current Bridge `spellLevel` mapping incompatible with flat legacy field |
| Concentration | Native begin/end lifecycle; Midi/DAE can attach dependent effects | Observe; no parallel concentration manager | High source; settings and dependent effects conditional |
| Effects | Native ActiveEffect system; Midi/DAE apply configured Item effects | Distinguish effect data/automation from descriptive meaning | Conditional; missing effect data is not automated |
| Reaction | Item invokable; Midi has reaction prompting/tracking | Remains deferred; do not infer legal trigger from invocation | High seam evidence; full reaction semantics unproven |
| Target selection | Foundry stores targets; Midi consumes/re-reads them | LLM chooses; deterministic code validates/resolves/scopes/restores | High source; donor target handling incomplete |
| Workflow completion | Midi emits completion/cleanup hooks | Correlate correct invocation; bounded wait; fresh OBSERVE | High source; Bridge currently captures unrelated first completion |

**PROPOSED:** Retain API Bridge. First review these findings; only then separately authorize one supervised **Fire Bolt** activation of a real Actor-owned Item against one unique token. Do not begin with Fireball. Section 22 defines the experiment and stop conditions. Current Phase 1A execution remains DISABLED and acceptance OPEN.

## 2. Donor revisions, licenses and evidence map

**OBSERVED:** Sources were inspected statically, never imported/executed as Foundry modules. No live world, settings database or credentials were read. Foundry remains **12.343**, D&D5e **3.3.1**. Installed module versions below are disk inventory, not proof of active world settings. Existing Scimitar/Midi POC evidence remains authoritative in [PROVEN_POC.md](PROVEN_POC.md).

Repository root `R = C:/StoryCore-Dev/storycore-foundry-ai`; installed static-data root `F = C:/Users/Professional/AppData/Local/FoundryVTT/Data`.

| Key | Exact local source root / revision | License evidence and permitted use |
|---|---|---|
| H | `R/_references/threehats-foundryvtt-rest-api`; `a31e4cfb10eebc204b8cb8fa6139e5880728cb00` | Root `LICENSE`: MIT, Copyright 2025 Three Hats. Architecture now; any later copying retains notices. |
| C | `R/_references/dnd-ai-dm`; `7659a53e776471877a8671aedad41dab08de6b09` | No LICENSE/COPYING/NOTICE found in pinned tracked tree; no reusable project license verified. ARCHITECTURE ONLY. |
| G | `R/_references/foundryvtt-ai-gm`; `34f681e4720bce836520c86aa75347af2a57f82a` | No project license found in pinned tracked tree. README:299 credits MIT **relay submodule**, not the AI engine. ARCHITECTURE ONLY. |
| B | `R/_references/foundry-api-bridge`; v8.11.2, `f71ea11b708d78c85c979ddae04d371be66e766e` | Root `LICENSE`: MIT, Copyright 2025 AI DM Project. Existing canonical bus; no donor edits. |
| D | `F/systems/dnd5e`; `system.json` version 3.3.1 | Installed `LICENSE.txt`: MIT, Copyright 2021 Andrew Clayton; inspect native implementation, not copy rules. |
| M | `F/modules/midi-qol`; `module.json` version 11.5.5 | Installed `LICENSE` has MIT code license, Copyright 2020 Tim Posney; other asset terms irrelevant, no copying. |
| E | `F/modules/dae`; `module.json` version 11.3.64 | No license file verified in installed package; architecture/source observation only. |
| L | `R/_references/laaru-dnd5-hw`; 3.64.0 snapshot | No reusable license verified; prior audit provenance/hashes apply. No descriptions or module code copied. |

H was acquired at the exact pin. C/G use **sparse pinned checkouts** of required source paths and README/metadata: unrelated large model/assets are not materialized; tracked-tree enumeration still covered license filenames. All four Git donor worktrees are clean. No donor is added to project history. No donor source was modified after acquisition.

Primary pinned links: [ThreeHats router](https://github.com/ThreeHats/foundryvtt-rest-api/blob/a31e4cfb10eebc204b8cb8fa6139e5880728cb00/src/ts/network/routers/dnd5e.ts), [AI client](https://github.com/chasecjj/dnd-ai-dm/blob/7659a53e776471877a8671aedad41dab08de6b09/agents/tools/foundry_tool.py), [AI-GM executor](https://github.com/cjkennedy1972/foundryvtt-ai-gm/blob/34f681e4720bce836520c86aa75347af2a57f82a/ai-engine/actions/executors.py), [Bridge gateway](https://github.com/alexivenkov/foundry-api-bridge-module/blob/f71ea11b708d78c85c979ddae04d371be66e766e/src/systems/dnd5e/item-actions/infrastructure/Dnd5eItemActivationGateway.ts). Findings use local pinned contents, not current default branches.

Source map (line numbers refer to these exact copies):

| Source | Path, symbol and evidence |
|---|---|
| H | `src/ts/network/routers/dnd5e.ts:277–515`, `useAbilityHandler`, four route registrations; legacy call at 451. `src/module.json:15–18`: minimum 12, verified 14; inspect legacy branch, do not adopt >=13 activity branch. |
| C | `agents/tools/foundry_tool.py:503–513`, `FoundryClient.cast_spell`; `_request:152–183`, `_post:199–202`. |
| G | `ai-engine/actions/schemas.py:159–167`, `CastSpellAction`; `actions/dispatcher.py::_validate_action`; `actions/executors.py:684–755`, `execute_cast_spell`; `referee/agent.py:40–111`, adjudication/slot check. |
| G | `ai-engine/foundry/client.py:1124–1125,1199–1200`, slot/concentration commands; `foundry/chat_listener.py:686–710,1599–1667`, initial referee and failure retry; `tests/test_referee_cast_spell_integration.py:29–88`, mock integration cases. |
| B | `src/commands/handlers/item/ActivateItemHandler.ts`; below `src/systems/dnd5e/item-actions/`: `validation/ActivateItemRequestSchema.ts`, `validation/RequestToCommandMapper.ts`, `application/Dnd5eItemActivationService.ts:35–73`. |
| B | Same subtree: `infrastructure/Dnd5eItemActivationGateway.ts:29–111`, `setupAutoTemplatePlace`/`activate`; `activityResolver.ts:17–42`; `Dnd5eTargetingGateway.ts::setTargets`; `Dnd5eMidiWorkflowGateway.ts::captureNext`; `foundryItemActionTypes.ts:174–179`. |
| D | `dnd5e.mjs:13693–13698` usage scaling; `14180–14585` ItemUseConfig, `Item5e.use`, `consume`, `_getUsageConfig`, `_getUsageUpdates`, `_handleConsumeUses`; `_handleConsumeResource` follows. |
| D | `dnd5e.mjs:14936–14944` `_formatAttackTargets`; `14961` `rollDamage`; `20656` `Actor5e.beginConcentrating`; `20693` `endConcentration`; `26894–26934` preparation modes. |
| D | `dnd5e.mjs:43070–43255`, `AbilityTemplate.fromItem`, `drawPreview`, preview listeners/confirmation; `44341,48561–48579` exported canvas/global namespace. |
| M | `src/module/patching.js:1511–1528`, legacy config/use/attack/damage wrappers; `src/module/itemhandling.js:164–710`, `doItemUse`; `1700–1762`, `selectTargets`. |
| M | `src/module/workflow.js:99–250` constructor/identity/template hooks; states `752–1005` attack/damage, `1088–1150` saves, `1179–1388` damage/effects, `1488–1534` cleanup/abort, `1719–1734` RollComplete; `3170–3195` native save DC/API. |
| M | `src/module/utils.js:1316–1380`, `getSaveMultiplierForItem`; `2165–2238`, `completeItemUse`; `src/midi-qol.js:724` public export; `src/module/settings.js:666–675`, concentration deprecation; `src/module/Hooks.js:410–426`, legacy save-flag conversion. |
| E | `module/dae.js:1575–1655`, `doEffects` -> `applyNonTransferEffects`; `module/API/api.js:66–71` exposed API. |
| L | `packs/spells`, root keys `!items!<id>`; effect key `!items.effects!tEmEo2XrdBVhIlfr.6pbotGIvqQkraPva`. Mechanical examples were rechecked in the previous audit's disposable cache, never by opening the donor DB writable. |

Installed static source fingerprints (SHA-256; no Git provenance claimed):

| File relative to F | SHA-256 |
|---|---|
| `systems/dnd5e/dnd5e.mjs` | `8e28eaf4464061abbfa99963e4e4228fbb16e4c0bef8722284ff0af18659a746` |
| `modules/midi-qol/src/module/itemhandling.js` | `4369d8dc61d56d75967f6f2bb5403ac1b44c71efe2921718aa50423ae6ff2627` |
| `modules/midi-qol/src/module/workflow.js` | `c47dcfafb2f3f1784214a1ea8217e8f5162c99c4b594ca7b3c5bef6df65bf85a` |
| `modules/midi-qol/src/module/utils.js` | `e3719de14cb5225d7306e6e4cd223981df1c267f8f9328065fdb72f658243cdb` |
| `modules/midi-qol/src/module/patching.js` | `17bc4f2b3fcd658d22e9163ed4c82f4dc1b911defd2370e471249cfb7b0c57f7` |
| `modules/midi-qol/src/module/settings.js` | `5abf5271d6cbeb824c37b954a18ead3b2e6cc76d615323f29e216f2bb9b2e306` |
| `modules/dae/module/dae.js` | `5ec39b006ccec98d849eb23985bc55156a49509e0b3fca6cf67b6b75a2629847` |

M's manifest accepts D&D5e 3.3.0–3.3.99 and Foundry through 12.999 (verified 12.328), with socketlib/lib-wrapper/DAE dependencies. E declares D&D5e through 3.9.99 (verified 3.3.99), Foundry through 12.999 (verified 12.331). These declarations support inspecting these versions; they do not establish automation settings or certify every spell on 12.343.

## 3. ThreeHats architecture

**OBSERVED (H router):** `/dnd5e/use-spell`, `/use-ability`, `/use-feature`, `/use-item` share `useAbilityHandler` via registered action types. Actor is resolved with `fromUuid(actorUuid)`; when request user context exists it checks Actor write permission. Item resolution accepts `abilityUuid` or the first case-insensitive matching `abilityName` among Actor Items. The name branch filters spell type for `use-spell`; the UUID branch does not establish that the resolved Item belongs to the specified Actor or meets the route's Item-type filter.

One target can be resolved by token UUID, Actor UUID (first matching token in active scene) or target name. It changes `game.user.targets` through canvas tokens. Unresolved targets can fall through without rejection, retaining stale user targets. No explicit sceneId, acting-token identity, target restoration or stale snapshot guard is present in this handler.

The **Foundry <13** path invokes exactly `await ability.use({}, { configure: false, configureDialog: false })`. The relevant legacy native option is `configureDialog`; suppressing this dialog does not suppress interactive template placement or every Midi prompt. It does not manually roll attack/damage, pass a cast level, or wait for a scoped Midi outcome. The handler discards the legacy use return value and returns Actor UUID/ability name; a non-throwing cancellation is not distinguished from successful resolution. Exceptions produce error feedback.

The >=13 branch chooses activities and uses additional hooks/roll handling. Those details are **not evidence of V12 behavior**. **PROPOSED reuse:** only the generic real-Item invocation principle; no REST replacement, name resolver, permissive target fallback or global UI patch.

## 4. dnd-ai-dm AI -> spell intent architecture

**OBSERVED (C):** `FoundryClient.cast_spell(actor_uuid, spell_name, target_uuid=None)` constructs `actorUuid`, `abilityName`, optional `targetUuid`, then POSTs `/dnd5e/use-spell`. The client crosses a typed method boundary instead of asking the LLM to generate Foundry JavaScript. It contains no roll/damage calculation in this method, no cast-level/template parameter and no proof that HTTP success means resolved spell mechanics.

`_post` shares `_request`: a 15-second default request timeout, reconnect/rate limiting, three attempts for connection/timeout/rate-limit failures. This also retries mutating POSTs, without a per-cast idempotency guarantee in the inspected path. An uncertain first cast could be duplicated. Error bodies are propagated; do not copy them into StoryCore diagnostics without sanitizing.

**PROPOSED:** Reuse the conceptual AI -> bounded command boundary only. StoryCore should choose an offered Actor-owned **itemId**, not a name; keep its existing bounded intent/validation and API Bridge transport. Never blindly retry an activation after timeout. License unverified: no code copied.

## 5. Secondary AI-GM referee architecture

**OBSERVED (G):** `CastSpellAction` forbids extra fields and contains Actor UUID, spell name (max 200), level 0–9, ritual flag. It has no target Item ID/token/template scope. Dispatcher validates action payloads. `RefereeAgent._check_spell_slot` reads current Foundry slot availability rather than a duplicate database and can reject with actionable feedback. The mock integration tests verify rejection -> one retry and available slot -> dispatcher; they do **not** cast a real spell.

Important exclusions:

- `adjudicate` approves on exceptions/missing client; an absent/empty slot read also fails open. This conflicts with StoryCore's fail-closed execution requirement.
- The referee accepts any sufficient-level or pact slot; that is not an exact validated cast-slot selection or proof of preparation/ownership. Its DC-band rule engine is not our rules authority.
- `execute_cast_spell` requests concentration-conflict information, sends `use_spell_slot`, optionally sends `break_concentration`, and returns narrative/result metadata. **It never calls the actual spell Item.use in this executor.** Ritual handling also lives in the executor. This is not a donor proof of attack/save/effect resolution.
- `client.py` maps those operations to separate `use-spell-slot`/`break-concentration` messages. Copying this orchestration alongside native Item.use risks double consumption and conflicting concentration changes.
- `ChatListener._notify_llm_of_failures` makes one corrective call, but its retry goes directly to dispatcher, without repeating the initial referee stage there. Every future StoryCore repaired intent must be fully revalidated; no copying this bypass.

**PROPOSED:** Study strict output schemas, current-resource reads and bounded failure feedback. Do not adopt the slot/concentration executor, rule engine, name matching, fail-open behavior or retry validation gap. No reusable AI-engine license verified; architecture only.

## 6. Existing API Bridge activate-item architecture

**OBSERVED (B; inspected before importing donor conclusions):** handler -> request schema -> mapper -> service -> targeting/Midi capture/activation gateways. `actorId` and `itemId` resolve through `game.actors.get` then `actor.items.get`: the gateway uses a real current Actor-owned Item, not a Compendium template. No spell-name branching is needed.

`activityId`/`activityType` explicitly select an activity or throw if missing. With neither, `resolveActivity` returns the first activity; with no activities it returns undefined and gateway calls `item.use(config)`. For the audited legacy LAARU spells, leave activity selectors absent. Existing Scimitar live success remains valid; spells share this seam but have additional configuration/automation needs.

| Wire input / behavior | Actual pinned implementation | Legacy 3.3.1 consequence |
|---|---|---|
| `actorId`, `itemId` | World Actor and embedded Item lookup | Good identity basis for linked unique-instance scope; synthetic/duplicate scope not solved |
| `targetTokenIds` | Nonempty list clears/sets receiving user's targets on current canvas | Single/multiple target IDs supported syntactically; no restoration; partial failure can leave partial targets |
| Empty/omitted targets | Service skips targeting entirely | Does **not** mean clear targets; stale targets survive |
| `spellLevel` | Maps to `{spell:{slot:'spellN'}}` | Native expects flat `slotLevel`; requested level does not reach that native field |
| No `templatePosition` | Passes `{create:{measuredTemplate:false}}` | Native expects `createMeasuredTemplate`; does not reliably suppress legacy preview |
| `templatePosition` | Replaces `dnd5e.canvas.AbilityTemplate.prototype.drawPreview` for next call | Existing programmatic seam, but global/unscoped and cancellation can leak patch |
| Dialog configuration | Only first argument supplied to item.use | Does not set native second-argument `configureDialog:false`; resource/template prompts may remain |
| `sceneId`, acting Token ID | Absent from activation schema/mapper | Supplying an extra sceneId does not add enforcement; schema strips unrecognized fields |
| Midi result | Capture armed before activation, then await capture | Correct ordering, unsafe correlation; see section 16 |
| Native return | Reads `.rolls` and `.message.id` | Legacy returns a ChatMessage directly; native card ID/roll details may be absent |
| Outcome | Service sets `activated:true` after nonthrowing return | Not proof of successful use: null/undefined cancellation is not distinguished |

**INFERENCE:** Legacy weapons and spell Items are generic INVOKABLE candidates. Target spells inherit target-state risks; self spells depend on unique caster token and self workflow; AoE needs a safe template lifecycle. **No new command is demonstrated necessary.** Future compatibility repairs, if authorized, belong at this existing narrow gateway; no repairs were made now.

## 7. D&D5e 3.3.1 legacy Item.use behavior

**OBSERVED (D `Item5e.use:14217`):**

1. Check Item ownership; construct default options and usage config; call `dnd5e.preUseItem` (can cancel).
2. If a config value requires configuration and `configureDialog` is not false, await native `AbilityUseDialog`; cancellation can return no result.
3. Resolve selected `slotLevel` / resource amount. Upcasting clones the Item with adjusted level for use, preserving ID; native preparation computes resulting data. Set chat flags including `dnd5e.use.spellLevel`.
4. Call `consume`; apply native Item/Actor/resource updates, or stop if unavailable/cancelled.
5. Begin/end concentration when configured; retain concentration effect ID in use flags.
6. Display native chat card. Optionally create a template through `AbilityTemplate.fromItem(item).drawPreview()` and handle summons.
7. Emit `dnd5e.useItem` with item/config/options/templates/effects/summoned; return card data, normally a ChatMessage.

**Native use alone does not automatically call rollAttack, rollDamage and every target's saving throw.** It exposes the real use/card/roll mechanics that Midi orchestrates through lib-wrapper. A direct call on the running installed Item is still Midi-wrapped when that module is active; bypassing Midi to call an unwrapped implementation is neither proposed nor required.

`ItemUseConfig` has flat `slotLevel`, `consumeSpellSlot`, `consumeResource`, `consumeUsage`, `resourceAmount`, `createMeasuredTemplate`, `beginConcentrating`, `endConcentration`, etc. `configureDialog` belongs to the second options argument. No native legacy `templatePosition`, `targetTokenIds` or activity config contract exists here. The gateway's modern nested spell/create fields must not be mistaken for native 3.3.1 parameters.

Consumption and concentration can occur **before** template cancellation or a later workflow failure. Item.use is not an atomic transaction with automatic cost rollback. Observe partial outcomes; do not retry or refund resources from StoryCore merely because a response is missing.

## 8. Midi-QOL responsibility boundary

**OBSERVED:** M `itemPatching` wraps the native Item use/attack/damage/card methods. `doItemUse` constructs a workflow then calls the native wrapped use; it does not replace native resource consumption with a StoryCore ledger. Workflow settings determine whether to roll automatically, request player/GM input, apply damage or apply effects. These settings were **not read from the live world**.

Classification: **A** D&D5e native; **B** Midi-QOL; **C** other Foundry module; **D** caller/runtime; **E** manual or not automated by inspected Item data; **F** unknown in this runtime until verified.

| Responsibility | Classification | Observed implementation / limit |
|---|---|---|
| Tactical spell/target/cast-level choice | D | StoryCore LLM, constrained to offered capabilities; modules resolve consequences |
| Ownership, native Item data/preparation and cast config | A + D | Native source of truth; caller must reject unavailable/unverified intent, not assume invocation enforces every legality rule |
| Attack roll and roll data | A; B orchestrates | Native Item.rollAttack, Midi `doAttackRoll` / attack workflow states |
| Hit resolution and automatic damage trigger | B | Workflow attack/hit/auto-damage settings; may wait for user |
| Spell save DC | A | Prepared Item save data / native getSaveDC; Midi reads it at workflow:3177 |
| Target saving throws | A + B | Native Actor.rollAbilitySave; Midi selects/requests rolls and waits according to settings/permissions |
| Damage/healing rolls | A + B | Native Item.rollDamage/DamageRoll; Midi orchestrates rolls and typed results |
| Resistance/vulnerability/immunity and HP/healing application | A + B | Native Actor damage primitives and Midi `utils.js::processDamageRoll` / application paths, including configurable v3 path; never duplicate in adapter |
| Save-success damage multiplier | B, F for specific Item/config | `getSaveMultiplierForItem`: Item flags, settings/defaults, optionally localized description matching; not reliably derivable from `actionType=save` alone |
| Slots, charges, resource references | A; B configures wrapper | Native `consume`/usage updates; do not decrement again |
| Upcast calculation/scaling | A + B | Native cast-level clone/preparation/rolls; Midi reads use-card level |
| Concentration start/end | A | Native Actor methods from Item.use; setting-sensitive; M deprecates its older concentration automation in favor of native |
| Concentration checks/dependent lifecycle | A + B + C, F for exact configuration | Native concentration hooks/effects; Midi/DAE link dependent effects; precise enabled behavior unverified |
| ActiveEffect data application to targets | A + B + C | Native documents; Midi chooses hit/failed-save/self targets, calls DAE.doEffects when enabled and effects exist |
| Conditions/effect semantics absent from Item | E/F | A successful save workflow does not create unconfigured paralysis, targeting restrictions or repeat-save behavior |
| Effect duration / special expiry / reaction timing | A + B + C or E/F | Depends on native effect data, Midi/DAE and optional expiry/automation modules; not guaranteed by a spell label |
| Template shape/creation | A | Native AbilityTemplate/MeasuredTemplate; placement is normally interactive |
| Template target acquisition | B (+ optional C) | `selectTargets`/templateTokens, auto-target settings and optional volumetric module; changes user targets |
| Exact scene/acting token/target references | D | Caller must freshly resolve and constrain context; current gateways lack explicit full scope |
| Completion correlation, stale-state guard, no duplicate dispatch | D | Native hooks are evidence, not a command transaction or request-ID protocol |
| Unknown/custom spell meaning | E/F | Descriptive meaning can inform LLM, but cannot certify automation or authorize arbitrary code |

Donor integration differences: H legacy merely calls Item.use and relies on whatever Midi wrapper is installed; C relies on H's endpoint; G's inspected spell executor does not use that complete Item workflow; B explicitly captures Midi completion but insufficiently scopes it. None of those facts makes StoryCore the owner of rolls, saves, HP, slots, concentration or conditions.

## 9. Single-target spell attack — Fire Bolt

**OBSERVED (L `packs/spells/!items!5M8uw6ooTsh9S92G`):** `Огненный снаряд / Fire bolt`, type spell, level 0, action/1, `actionType=rsak`, range 120 ft, target creature value string `"1"`, damage `[["1d10","fire"]]`, vocal/somatic properties, no embedded effects or activities. These are template facts, not proof that a live NPC owns this Item or that the Actor-owned copy has unchanged fields.

**OBSERVED (D/M):** native use prepares the card/use data; Midi's wrapper creates the workflow and native attack/damage methods supply rolls. `getAutoRollAttack`, `getAutoRollDamage` and application settings govern automatic attack, hit and damage. Target set originates from user targets unless supported Midi options override it; Bridge sets a nonempty validated target list before calling use. Cantrip level alone does not require a spell slot; configured Item uses/resources can still matter. Scaling and attack bonus come from the current Actor/Item, not the template's printed base die.

**INFERENCE:** This is the smallest spell-family extension of the proven Scimitar seam: no template, save or concentration dependency in the observed template. Caller should not manually roll attack/damage in addition to Midi. A hit/HP change can be observed in a matching workflow and fresh readback; a miss with unchanged HP is also a valid resolved result. No live Fire Bolt cast occurred in this audit.

## 10. Single-target save spell — Sacred Flame / Hold Person

**OBSERVED (L):**

| ID / name | Structured fields | Automation evidence / gap |
|---|---|---|
| `6CxYBftoMCZk449F`, Священное пламя / Sacred flame | Level 0; action/1; `save`; dex save, DC null/scaling spell; 60 ft; creature `"1"`; 1d8 radiant; no effects | Save/damage shape present; null template DC is resolved from live Actor. Correct success multiplier not certified by these fields. |
| `hHdE2G8F8VR08bxF`, Паралич гуманоида / Hold person | Level 2; action/1; `save`; wis/spell; 60 ft; creature `"1"`; 1 minute; concentration property; no damage parts **and no effects** | Native concentration/save workflow can be invoked; no structured paralysis effect, repeat-save automation or humanoid-only restriction is established by the template. |

**OBSERVED (M):** `WorkflowState_WaitForSaves` re-reads user targets for ordinary non-attack/non-self workflows; then `checkSaves` gets native DC and calls/requests native Actor saves. `autoCheckSaves=none` takes a different/manual path. On configured automatic path, failed-save/hit sets feed damage/effect application. `autoItemEffects=off`, absent DAE/effects, target permissions or requested player saves can prevent full unattended resolution.

The cached Sacred Flame/Fireball templates have older `flags.midiProperties.nodam/halfdam/fulldam=false`, without explicit modern `saveDamage`. M `Hooks.js:401–426` converts true legacy flags and otherwise assigns `default`; `utils.js:1316–1380` resolves multiplier using modern flags or settings/localized description when enabled. **INFERENCE:** do not certify correct save-success damage merely from a successful API call. No migration was run. Inspect actual Actor-owned configuration and later observe result; StoryCore must not compensate by calculating damage itself.

Hold Person's Item can be **INVOKABLE without being FULLY AUTOMATED**. Optional configured effects/other modules may add automation, but none is proven by its name or absent embedded effects. Never add a StoryCore `if Hold Person then paralyzed` handler.

## 11. Self / reaction spell — Shield

**OBSERVED (L `!items!tEmEo2XrdBVhIlfr`):** `Щит / Shield`, level 1, reaction/1 with a nonempty textual trigger, duration 1 round, target self, empty actionType and empty range units. No activities. Its separate embedded effect `6pbotGIvqQkraPva` has `disabled=false`, `transfer=false`, empty statuses, and one change `system.attributes.ac.bonus`, mode 2, value `"5"`, priority 20. Duration has rounds=1; `flags.dae.specialDuration=["None"]`, `selfTarget=false`, `selfTargetAlways=false`. Effect presence proves data, not correct trigger/expiry automation.

**OBSERVED (D/M/E):** native use can be called without an external target; Midi `Workflow` constructor substitutes the acting token for `target.type=self`. Midi can track reaction use and prompt for reactions. Its effect stage can pass non-transfer Item effects to DAE for the workflow's self target when enabled. DAE `applyNonTransferEffects` selects applicable embedded effects and uses native Actor effect creation paths; it is not a spell-name engine.

**INFERENCE:** the +5 AC effect has a plausible generic application path. Whether it actually applies, lasts to the correct point, handles all described exceptions or reacts to a particular triggering attack is not established. Missing automation can still leave a successfully invoked Item/card/slot consumption without complete Shield behavior. A one-round effect alone does not prove precise reaction expiry. Native Item.use does not parse the trigger prose as a timing validator. Reactions remain deferred; no self/reaction execution was implemented or tested.

## 12. AoE / template spell — Fireball

**OBSERVED (L `!items!j2cNLHZYnbKl46gZ`):** `Огненный шар / Fireball`, level 3, action/1, range 150 ft, target sphere value `"20"` ft with `prompt=true`, dex save/scaling spell, 8d6 fire, no effects/activities.

**OBSERVED (D):** `_getUsageConfig` enables `createMeasuredTemplate` from target.prompt for an area Item when a scene and template-creation permission exist. `Item.use` calls `AbilityTemplate.fromItem(item).drawPreview()`. The factory uses native target shape/distance/width/grid configuration and adds origin Item UUID/cast level flags. The preview activates the template layer and mouse listeners; confirmation snaps/creates a MeasuredTemplate, cancellation rejects the preview promise. Thus ordinary use can require human placement, even with the initial configuration dialog suppressed.

Native 3.3.1 offers `AbilityTemplate.fromItem(item, options={})`, template-document `updateSource`, and scene `createEmbeddedDocuments('MeasuredTemplate', ...)`. Factory options can merge location data, but **Item.use has no legacy templatePosition argument** and its own call does not pass those options. Constructing a template separately is also not proof that it is linked to the correct pending Midi workflow. No template was constructed in this audit.

**OBSERVED (B):** `templatePosition{x,y,direction?}` reaches `setupAutoTemplatePlace`, which patches the very native `AbilityTemplate.prototype.drawPreview` exported in D 3.3.1. When called, it updates the template source, restores the prototype and creates it on the current canvas scene. **INFERENCE:** the code is structurally capable of placing a legacy template, so calling it categorically activity-only would be wrong. **However, no live verification exists**, and it is not a safe unattended solution:

- No actor/item/scene/workflow matching; the next unrelated preview can consume it.
- If use cancels before preview, no template is requested, or an exception happens before restoration, the patch is left installed. No surrounding finally restores it.
- No explicit sceneId, placement-range validation or caster scope; it uses current canvas scene and supplied coordinates.
- Native resource configuration or Midi confirmation can still need interaction.
- Omitting templatePosition sends the wrong legacy suppression field; it does not establish a no-template behavior.

**OBSERVED (M):** the workflow can wait for template creation, with `preCreateMeasuredTemplate`/`createMeasuredTemplate` hooks. `itemhandling.js::selectTargets` links via Item origin/workflow, records template ID/UUID and uses native template shape with Midi targeting. Acquisition can occur **after placement**. Auto-target mode, existing targets, self/type filters and optional modules affect the result. Its conditional geometry pass can be skipped when user targets already exist; it later adopts user targets. Some template hooks are also unscoped `once` listeners. A submitted target list is not automatically the geometrically correct AoE set.

Midi's public `completeItemUse` provides a workflow-oriented invocation helper, and self-centered area auto-placement exists (`hasAutoPlaceTemplate`). Neither is evidence of a general safe Fireball-position parameter in this version. The existing Bridge patch is the explicit arbitrary-point seam inspected here.

**PROPOSED:** LLM may eventually choose a semantic target point/orientation; deterministic code validates the fresh scene/capability/range constraints and delegates template shape/target acquisition to Foundry/Midi. Observe the resulting affected tokens, including allies. Do not create a duplicate geometry/rules engine, silently accept a different affected set, or implement this now. Fireball is excluded from the first supervised experiment.

## 13. Target-state handling

**OBSERVED:** `game.user.targets` is mutable state of the receiving Foundry user/client (often the GM), not an isolated argument to one Bridge request. Changing it can alter that user's UI and another in-flight workflow.

| Layer | How targets enter use | Empty/unresolved behavior | Cleanup / ambiguity |
|---|---|---|---|
| ThreeHats | Resolve one target UUID/name, clear/set canvas targets before use | Unresolved/no target can preserve old targets | No restore; Actor target chooses first active-scene instance |
| API Bridge | For nonempty targetTokenIds, clear current set then set each canvas token | Empty list skips clearing; invalid later ID can leave a partial set | No restore/finally; no scene/caster-token argument |
| Native D&D5e | Item.use has no legacy target-list parameter; attack card formatting reads user targets | No general exact-target invariant | Actor speaker/context may select token; not a command-scoped lease |
| Midi wrapper | Initially reads user targets; supports `options.targetsToUse` and target UUID paths | Some empty overrides fall back to user targets; save workflow can re-read later | Mutates global targets, self targets use caster token; templates may replace target set |
| Midi.completeItemUse | Public helper supports `targetUuids`, `targetsToUse`, `ignoreUserTargets` options | Undefined list can use existing targets; does not make every empty-list path safe | Saves/restores targets on non-aborted postCleanup; lacks general timeout/finally restoration |

`completeItemUse` is relevant architecture, **not a drop-in safe replacement**: it removes an existing workflow for the Item, uses item-keyed hooks, and restoration is conditional. Passing direct targets is possible at Midi level but not exposed by the current Bridge's legacy second-argument options; it does not eliminate every global-state read.

**PROPOSED future lifecycle:** fresh Actor-owned Item and exact scene/acting/target tokens -> validate all references before mutation -> serialize the receiving user's activation context -> snapshot old targets -> set exact validated targets, explicitly handling empty/self -> invoke once -> match workflow and await settlement -> fresh OBSERVE -> restore/clear targets in guaranteed cleanup. Abort on external target/scene interference; do not overwrite deliberate operator changes blindly. Timeout cleanup must account for a still-running workflow: quarantine/require supervised reconciliation rather than release the context and dispatch another action while old code can read targets.

Do not restore targets immediately on Item.use return: Midi save processing may still read them. Duplicate Actor instances make acting/target token selection ambiguous; retain the linked-Actor, unique-instance limitation. Unlinked/synthetic Actors and multiple instances remain unsupported. Explicit sceneId is desired but **not implemented for this Bridge command**; enforce/read-check current scope now in any future supervised procedure, propose narrow support later rather than sending an ignored parameter.

## 14. Cast-level / resource handling

**OBSERVED (D):** `usageScaling` selects slot scaling for leveled spells whose preparation mode permits upcasting. `prepared`, `always`, `pact` have upcast=true; `atwill`, `innate`, `ritual` do not. Native `_getUsageConfig` derives slot key (`spellN` or `pact`), resource consumption and limited uses. Cantrips ordinarily do not consume slots; innate/at-will Items can still consume configured uses, charges or referenced resources. Do not equate preparation mode with infinite availability.

Native flat `slotLevel:'spellN'` or `'pact'` with second-argument `configureDialog:false` can express a selected slot without the native configuration dialog. The use code also accepts a numeric slotLevel for level resolution, but consumption looks up Actor spell-slot keys; a proper Actor slot key is the safer documented future mapping. Native dialog/defaults otherwise choose usage configuration. Pact level comes from current Actor pact data. Explicit upcast choice must not be silently replaced with another available slot.

`_getUsageUpdates` checks remaining slot value and prepares decrement; `consume` performs Actor/Item updates. `_handleConsumeUses` covers recharge, limited uses and quantity cases; resource handling follows current Item consume references. This can include Item-owned charges/resources, not only spell slots. Native hooks can cancel or modify the consumption process. The current live Actor Item's preparation, uses, modifications and resource links are authoritative, not the Compendium extraction.

**OBSERVED (B vs D/M):** Bridge's `spellLevel` becomes nested `spell.slot`; neither the inspected legacy native use nor Midi wrapper translates it to flat `slotLevel`. The requested upcast therefore cannot be certified through the current command. A default level or interactive choice may be used instead. Fixing this mapping is a future review decision, not a new spell executor or something implemented now.

**RULE / PROPOSED:** Read and validate current availability, then let D&D5e/Midi consume once. No StoryCore slot decrement, cost ledger, retry-on-timeout or speculative refund. Do not copy G's separate use_spell_slot call. On partial completion, observe resources and stop for reconciliation. No slots/resources were changed during this audit.

## 15. Concentration / effect handling

**OBSERVED (D):** `_getUsageConfig` derives concentration from the Item's native concentration requirement and `dnd5e.disableConcentration`. `Item.use` calls Actor.beginConcentrating and optionally endConcentration; native ActiveEffects represent concentration. Native hook names include `dnd5e.preBeginConcentrating`, emitted `dnd5e.beginConcentrating`, `dnd5e.preEndConcentration`, `dnd5e.endConcentration`; use-card flags carry `dnd5e.use.concentrationId`. The installed code also has Actor.rollConcentration and concentration checking around Actor changes. Do not assume these settings are enabled merely because methods exist.

**OBSERVED (M):** `settings.js:666–675` explicitly deprecates older Midi concentration automation in favor of D&D5e's concentration system. This is source evidence only: its settings-changing code was not run. Midi uses concentration use flags as effect origin/dependency information. Its dynamic-effect stage chooses application targets from failed saves/hits/self targets, and calls DAE when configured Item effects exist. Optional convenient-effects integration can find effects by Item name; that module's catalog/localization is not a universal guarantee or a model for our own name handlers.

**OBSERVED (E):** DAE selects non-transfer Item effects, respects effect flags, sets origin/duration metadata and applies through Foundry. An empty effects collection means no such configured effect to apply through this path. Native concentration existing on the caster does not prove all target conditions, ongoing damage, repeated saves or effect expiry are automated.

**PROPOSED:** Observe caster concentration effect ID/origin/dependents and target effects after the correct workflow. Treat missing required automation as unsupported/manual, not as permission to build a StoryCore concentration/condition engine. Neither manually replace concentration nor duplicate DAE effects. Shield's data and Hold Person's missing effects illustrate why invocation and full automation must be reported separately.

## 16. Result / workflow observation

**OBSERVED:**

| Signal | What it can establish | What it cannot establish alone |
|---|---|---|
| Native Item.use return | Card/use path returned; often ChatMessage | Complete attack/save/damage/effect workflow; no-change may be cancellation |
| `dnd5e.useItem` | Native use hook including template/effect references | Completion of subsequent asynchronous Midi resolution |
| `dnd5e.rollAttack`, `dnd5e.rollDamage`, consumption/concentration hooks | Particular native operation occurred | Whole spell outcome or correct Bridge request correlation |
| `midi-qol.RollComplete` | Matching Midi workflow reached RollFinished; hit/save/damage sets available | Every prose mechanic automated, cleanup fully finished or correct request without matching |
| `midi-qol.postCleanup` / item-suffixed hook | Later workflow cleanup point used by completeItemUse | Unique invocation correlation merely because item UUID matches |
| Workflow/card/template IDs | Useful correlation anchors; use flags include Item UUID/cast level | An ID is not necessarily unique per invocation in this Midi version |
| Fresh Actor/Item/target/effect/combat reads | Authoritative observed resources, HP, effects and scope | Attribution to this command when concurrent mutations were allowed |

B `Dnd5eMidiWorkflowGateway.captureNext` uses `Hooks.once('midi-qol.RollComplete')` with a **30,000 ms capture timeout**, independent of StoryCore's 60-second supervised **LLM** lifetime. Timeout resolves without workflow; it does not cancel a native use, pending dialog or Midi cast. Service can still return `activated:true`. Do not extend/change either timeout in this audit.

The first unrelated workflow (another Actor, Item, reaction, triggered spell) can consume the listener. Spells increase this risk because save requests, templates, configuration dialogs and reactions can outlive simple attack calls. Bridge serializes summary totals/target IDs but not a workflow invocation UUID. A successful bridge transport response is not proof of correlated completion.

M `Workflow` constructor assigns `_id=item.uuid` for ordinary Item workflows; same Item can reuse it on later casts. Item-suffixed RollComplete/postCleanup hooks therefore do **not** solve repeated-use correlation alone. Native chat message ID plus an in-memory workflow object/event sequence is stronger. `RollComplete` occurs before final cleanup/action-used work; delayed auto-target cleanup can run later too. An aborted workflow is not a completed spell.

**PROPOSED scoped strategy, not implemented:**

1. Serialize activations for the receiving user/scene; allocate adapter command ID and capture start time. Revalidate Actor/acting token/current owned Item and intended target scope immediately before use.
2. Register a removable `Hooks.on` listener before invocation; ignore unrelated events instead of consuming them with once. Capture the new workflow object/pre-use relationship and its chat-card ID when available.
3. Match Actor UUID, actual acting-token UUID/scene, Item UUID/owned ID, invocation identity/event lifetime and validated targets. For self use expect caster; for future AoE match the linked template and acquired target set rather than assuming a pre-supplied list equals the area.
4. Wait for that non-aborted workflow's completion and necessary cleanup with a bounded timeout. Remove all listeners/temporary state on every exit. If no unique invocation identity can be established, reject automatic execution rather than weaken matching to Item name.
5. Fresh OBSERVE caster resources/uses/concentration, targets' HP/effects and combat/scene identity. Report partial/unconfirmed outcomes explicitly; do not cast again on uncertainty. Restore targets only when safe relative to any still-running workflow.

A request-ID field could be carried through a future narrow Bridge/Midi context extension if this version actually preserves it; that propagation must be verified, not invented. Native workflow ID alone is insufficient at M 11.5.5. No hook listeners were installed and no workflow was created in this audit.

## 17. Concrete comparison matrix

**OBSERVED unless marked conditional.** Path C means the native 3.3.1 contract; on an actual Midi-enabled Item that method is wrapped. All paths still need a trusted caller. None is an authorization to execute in Phase 1A.

| Concern | A — ThreeHats legacy use-spell | B — existing Bridge activate-item | C — direct D&D5e 3.3.1 Item.use |
|---|---|---|---|
| Actor resolution | fromUuid(actorUuid), optional request-user permission check | game.actors.get(actorId) | Caller supplies/resolves an owned Item and parent Actor |
| Item resolution | abilityUuid or first matching Actor Item name | actor.items.get(itemId) | Actual Item object; no name search required |
| ID vs name | UUID supported; name route ambiguous; UUID ownership not checked against supplied Actor | Stable owned Item ID | Owned Item UUID/object; caller validates parent |
| Token/scene scope | Active scene/canvas; Actor target -> first token | World Actor + current canvas targets | Caller context/speaker; no scene-scoped command envelope |
| Target input | One targetUuid or targetName -> user targets | targetTokenIds array -> user targets | Native use has no target-list argument; Midi options exist when wrapped |
| Explicit sceneId | No | No in this activation contract | No native use parameter; caller must constrain scene/template parent |
| Single target | Invokable if correctly resolved | Invokable; nonempty target list sets exact IDs sequentially | Via user targets / Midi pipeline |
| No external target | Can invoke, but old targets may survive | Can invoke, but empty list skips clearing | Self workflow can use caster; generic no-target does not guarantee isolation |
| Multiple targets | No explicit list; pre-existing global targets can still be read | Explicit array, subject to native/Midi capability and caller validation | User targets / Midi targetsToUse or helper UUIDs; not native config |
| AoE support | Invokes Item; native placement likely interactive | Position override exists but unsafe/unproven; wrong legacy suppression field | Native area factory/preview; Midi workflow/targeting conditional |
| Template coordinates | No parameter in this handler | templatePosition patches next drawPreview globally | fromItem options/document APIs; no direct Item.use position parameter |
| Cast level / upcast | No explicit parameter passed; defaults with dialog suppressed | spellLevel present but nested activity mapping misses native slotLevel | Flat slotLevel + native scaling; use current Actor slot key |
| Resource consumption | Native Item.use through installed wrappers | Native Item.use through installed wrappers | Native consume/update path; config/hook-sensitive |
| Configuration dialog | Requests configureDialog:false in second argument | No second options argument; may prompt | Defaults true; options can suppress native dialog |
| Other interaction | Midi/target/template prompts can remain | Midi/target/template prompts can remain | Native preview and module prompts independently possible |
| Midi integration | Implicit wrapper; no legacy manual attack/damage call | Implicit wrapper plus explicit completion capture | Implicit when Midi registered; native-only use returns card |
| Workflow/results | Legacy result discarded; response identifies Actor/ability | Rolls/message mapping + optional first captured Midi summary | Native ChatMessage/use hooks; observe Midi separately |
| Errors/cancellation | Exceptions handled; null/undefined use can look successful | Schema/lookup errors; nonthrowing cancellation can produce activated:true | Owner/config/consumption/hook cancellations; template errors caught; no transactional result |
| Target cleanup | None | None; invalid target can leave partial state | Caller responsibility; Midi helper has partial restoration only |
| Stale-state protection | None in handler | No snapshot/scene/turn guard in gateway | None as a command protocol; native current data checks do not bind the LLM snapshot |
| Duplicate Actor instances | First active-scene token for Actor target | Acting token unspecified; duplicate instances ambiguous | Item owner may be precise but caller must resolve speaker/acting token |
| V12 compatibility | Explicit <13 branch and min12 manifest; not a spell live test | Legacy weapon proven; generic spell seam; config/template gaps above | Exact installed 3.3.1 source; no upgrade needed |

## 18. What StoryCore must implement later

**PROPOSED, no production implementation now:**

- Generic current Actor-owned Item -> capability/compact DecisionView projection, with offered identity, availability, mechanical facts, bounded descriptive meaning and explicit unsupported/unknown automation. Preserve live overlay priority over reusable Compendium understanding; no name-only resolver.
- Structured LLM choice of offered Item, target(s), and only when supported, cast-slot/semantic template intent. Personality/tactics belong to the LLM. Keep existing response/deadline/repair limits; every repair is revalidated.
- Deterministic fresh scope/reference/availability validation: Actor, unique acting token, scene/combat/turn, current owned Item, target identities and supported family. Preparation/resources/changes must be re-read; fail closed on unknown legality instead of treating descriptive text as authority.
- A thin generic activation coordinator over **existing API Bridge**, with target-state serialization/cleanup, exact legacy config mapping, cancellation/partial-outcome handling and correlated workflow observation. Future Bridge scope/options fixes may be needed; no second bus or spell-specific command family.
- An outcome reader that reports verified workflow and fresh resources/HP/effects, including uncertain/manual results. No duplicate activation on transport timeout. Supervision must be explicit while invocation identity or automation is incomplete.

Minimal future responsibilities are capability projection, validator/resolver, activation coordinator and outcome observer. These extend the existing architecture; they are not new implementations delivered by this audit. The present Phase 1A schemas/runtime remain read-only and spell execution remains deferred.

## 19. What StoryCore must NOT implement

**Architectural constraint:** no spell-name handlers; no independent attack/save/DC/damage/healing/resistance/vulnerability/immunity rules; no manual slot/charge/HP mutation or concentration/effect engine. Missing configured automation is an unsupported/manual case to surface, not permission to recreate D&D inside StoryCore.

Do not copy G's slot/concentration executor, C's retrying mutation wrapper, H's ambiguous name/Actor-target resolution, or B's unscoped global patch/capture as a safety pattern. Do not send arbitrary JavaScript, evaluate spell descriptions, copy Item macros into prompts or let model text select a raw command/API. Existing trusted Foundry module/Item automation is a separate trust boundary that must be reviewed before any future activation.

No production normalizer, decision runner, intent schema, Bridge fork, module or dependency was changed. No new command, LLM request, path planning, movement, item activation, Midi call, turn advancement, HP/resource/Actor/memory mutation or Foundry version change was performed. Phase 0 canonical documents and PROVEN_POC.md are preserved.

## 20. Description vs semantic-card recommendation

**OBSERVED:** The previous [LAARU audit](LAARU_SPELL_COMPENDIUM_AUDIT.md) retained 640 standalone spell templates plus 9,452 Actor-embedded spell Items. The clean mechanical extraction is useful for structure coverage, not a rules database or an action catalogue to send wholesale. Items such as Hold Person expose save/range/concentration but omit the main condition in structured effects. Actor-owned Item data can differ from its Compendium source; names may be localized or changed.

**INFERENCE:** Foundry needs a real current Item, use configuration, target/template context and working module automation to **execute**. The LLM also needs tactical meaning to **select** among Items. These are different inputs. A large handcrafted SemanticSpellCatalogue is not a prerequisite demonstrated by this audit; nor has bounded description input been validated by a new model test.

| Tradeoff | Live facts + short sanitized description | Pre-generated semantic cards |
|---|---|---|
| Token cost | Variable prose cost; bound per Item and total catalogue, send only owned/available candidates | Often smaller/stable fields, but cards can grow and still need source facts |
| Preprocessing | Generic sanitization, selection and budgeting | Generation/extraction/review for every version; larger up-front cost |
| Hallucination / omission risk | Model can misread prose or lose qualifiers through truncation; text can contain prompt injection | Card generator can invent/omit semantics, then repeat mistakes deterministically |
| Custom/homebrew support | Current Item text works without a per-spell entry; unknown mechanics remain unknown | New or edited Items require card generation/revalidation |
| Stale Compendium data | Prefer live owned Item text/facts; no name-based template substitution | Cache must bind source identity/content version and always overlay live Actor facts |
| Localization | Bilingual/current descriptions usable; duplicate-language text costs tokens | Can normalize language, but translation/canonical-name mismatches require maintenance |
| Maintenance | One sanitization/projection pipeline and coverage evaluation | Card schema, generators, exceptions and invalidation; handcrafted cards scale poorly |
| Execution correctness | Never inferred from prose; validator and Foundry remain authoritative | Semantic card is still not an execution engine or automation guarantee |
| Reuse | Optional on-demand source-identity cache | Useful for frequently reused, reviewed structural semantics; not a replacement rules database |

**PROPOSED recommendation:** start by evaluating **generic live mechanical facts + bounded sanitized Actor-owned description**, with optional reusable semantic summaries keyed by stable source identity/content hash. Do not hand-author hundreds of spell cards. Keep the full internal Item/state outside the LLM; expose only decision-relevant facts and mark missing mechanical fields/automation.

Sanitization must remove HTML/scripts/macros/embeds and executable links; output plain bounded text, treat it as untrusted descriptive data, and prevent it from overriding protocol instructions. Preserve the difference between facts, prose interpretation and unknowns. Use both per-Item and whole-request budgets, with explicit truncation/omission markers; if key constraints are lost, mark semantics uncertain rather than manufacture a complete card. Filtering candidates must not choose tactics for the LLM. Licensing still applies: this proposal does not authorize publishing LAARU descriptions or adding a bulk expressive-content catalogue to Git.

Any future comparison should measure coverage, token/latency cost, unsupported-choice rate and schema/reference validity using real structural families. Execution correctness still depends on the current Actor Item and native/Midi automation, regardless of which description strategy wins. No sanitization, card generation, payload optimization or model experiment was implemented here.

## 21. Risks and unresolved evidence

**OBSERVED source risks:**

1. Bridge uses activity-style spell/template config for legacy Item.use; upcast selection and no-template behavior cannot be trusted as currently mapped.
2. Target state is mutable and insufficiently scoped/restored; empty targets retain stale state; save/template workflows may read it later. Duplicate Actor tokens and scene changes are unsafe without explicit constraints.
3. Bridge captures first global RollComplete; Midi ordinary workflow ID equals Item UUID and is reused. Unrelated casts/reactions and repeated same-Item uses need stronger correlation.
4. Global template preview override can leak on cancellation and capture another use; template hooks/target acquisition add concurrency risks. Native use can consume resources before template failure.
5. Nonthrowing cancellation and partial results can still appear as activated/successful in donors. Timeout does not cancel Foundry work; retry/refund could duplicate mutations.
6. Automation is settings/Item/effect/module dependent. Missing Hold Person effect, Shield's non-special expiry and legacy/default save multipliers prevent blanket FULLY AUTOMATED claims. Localized description heuristics are not robust mechanical evidence.
7. AI donor licenses are not verified; G's referee fails open and retry bypasses initial referee, while its spell executor manages slots/concentration separately. These are exclusions, not patterns to copy.

**UNKNOWN:** active world's detailed Midi/DAE/other automation settings, actual owned spell modifications/preparation, unattended spell completion, correct save multipliers/effect expiry in this installed runtime, and safe AoE point placement through the current Bridge. Disk manifests/source were inspected, not live world behavior. No result here extends old POC claims to spells or proves Phase 1A acceptance.

**UNCHANGED:** PLANNING_UNAVAILABLE loop, incomplete universal Action Normalization/Shortbow omission and disposition semantics remain open. Compact DecisionView remains proposed. The 60-second supervised LLM/snapshot lifetime, bounded decisions, linked-Actor operator attestation and zero-write production boundary are untouched. None of the research categories expands current execution scope.

## 22. Smallest next supervised experiment — proposed, NOT performed

**Exact next step: review this audit, then separately authorize one isolated supervised Fire Bolt execution-seam test. Until review/authorization: STOP.** This is not permission to start Phase 2 implementation or enable production execution.

1. In an explicitly approved test scene, use one existing linked mage Actor with one unique token and one actual owned legacy Fire Bolt Item, plus one uniquely resolved target token. Do not create/import/change the world as part of this audit. A later operator must confirm safe test entities and permission for the cast/its native mutations.
2. Read current versions/scene/combat/turn, Actor/Item identity and mechanics, target HP/effects, caster resources and existing targets. Verify the owned Item is the offered one, no template/concentration/reaction dependency is required, and native/Midi automation needed for this simple attack is available. No Compendium ID may substitute for the owned Item ID. Stop if preparation/ownership/scope/automation is unknown.
3. Supervise one client with no concurrent rolls, reactions or template work. Record and isolate exact targets and unique caster context. Use a scoped observer to correlate Actor, acting token, owned Item, target and card/workflow instance. If the existing test mechanism cannot do this safely, stop and separately authorize only the necessary test instrumentation; do not build the production spell system to get a test.
4. Send exactly one existing `dnd5e/activate-item` request with the current Actor ID, owned Item ID and one validated targetTokenId. No activity selector, spellLevel or templatePosition is needed for this cantrip. Do not pretend an unsupported sceneId is enforced: verify active scene immediately before and after. No manual roll/damage/slot call and no movement/next-turn.
5. Observe the correctly matched Midi attack/hit/damage result and fresh caster/target reads after settlement; restore targets safely. Capture only bounded IDs/outcome metrics, never raw Actor/HTML/keys. A miss with unchanged HP is valid evidence; a hit must agree with native/Midi HP readback. Verify no unintended target or resource mutation, rather than force a hit or predicted die result.
6. On cancellation, missing/mismatched workflow, lingering dialog, scene/target change or timeout: stop, fresh-read the potentially partial outcome, and do not retry automatically. `activated:true` alone fails acceptance. Report which seam was demonstrated and which remains unproven.

This first experiment tests **live mage -> real owned spell Item -> validated target -> existing Bridge -> D&D5e/Midi -> fresh OBSERVE**. It does not need a new LLM call to test the invocation seam; a later, separately reviewed end-to-end LLM spell-selection experiment can use the validated capability. Sacred Flame follows only after save-success configuration is understood; Fireball, Shield, concentration and multi-target effects remain later supervised families.

**Offline validation:** npm run check passed: 63/63 tests, typecheck and build. git diff --check and targeted credential/diff review passed; all 22 requested sections are present and PROJECT_STATE.md / CHAT_HANDOFF.md bodies match. Four pinned Git donors remain clean; all 7,505 LAARU file paths/content hashes and the seven installed-source fingerprints above are unchanged. Only this audit and those two checkpoint documents are part of this task's commit. These checks do not establish live spell execution or close Phase 1A acceptance.
