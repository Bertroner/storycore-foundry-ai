# LAARU spell-compendium audit

Pre-Phase-2 static audit, 2026-08-31. **Audit complete; Phase 2 production implementation has not begun.** No live Foundry session, OpenRouter/Qwen call, Midi, movement, path planning or execution was used. Review this audit before authorizing the next experiment.

**640 standalone spell templates + 9,452 Actor-embedded spell Items = 10,092 retained documents.** These are document instances, not 10,092 distinct spell concepts. [Mechanical dataset](../analysis/laaru-spells-mechanical.json) and [offline extractor](../analysis/extract-laaru-spells.cjs) are research artifacts, not a production catalogue, bulk LLM prompt or replacement rules database.

Evidence labels: **Observed** = inspected metadata/current database records; **Inference** = limited interpretation of fields; **Proposed** = future design, not implemented capability. Descriptions were not used to infer mechanics.

## 1. Module architecture and source pin

Observed source root: `C:/StoryCore-Dev/storycore-foundry-ai/_references/laaru-dnd5-hw/`. Donor-relative paths below start here.

- `module.json`: id `laaru-dnd5-hw`, version **3.64.0**, author Laaru. Supplied directory snapshot, not a Git-pinned checkout; version alone is insufficient to reproduce contents.
- Foundry compatibility: minimum `11`, verified `12`, maximum `12`. `relationships.systems`: dnd5e minimum `3.2.0`, maximum `3.3.99`. Project **Foundry 12.343 / D&D5e 3.3.1** is within the declared ranges. This is metadata compatibility, not new live acceptance. No upgrade/migration performed.
- Recommendations: socketlib, lib-wrapper, dae (minimum 11.3.47). No `relationships.requires`. Recommendations do not prove individual effect automation works without those modules.
- 18 packs, all tagged system dnd5e. `packFolders` is display grouping, not storage/type evidence. Pack name `racesMPMM` differs from lowercase path `packs/racesmpmm`; use declared pack names for identity.
- Esmodules: `scripts/changelog.js`, `scripts/make.js`, `scripts/add.js`. Static inspection: make.js registers a ready hook that can fetch/create a journal; add.js changes `CONFIG.DND5E.sourcePacks` on init. **None was executed.** Offline extraction does not require enabling this module.
- No `languages` catalogue declared. Russian names, English suffixes and `flags.babele.originalName` are display/translation evidence, not stable identity.
- Entire tree: **7,505 files / 417,383,087 bytes**. Assets: 7,341 files, primarily images. Packs: 158 files / 79,109,471 bytes. Three scripts, module.json, readme.txt and screenshot.webp complete the tree.
- `readme.txt` describes older version 3.18.10 and 540 spells. Actual current records, not that old count, determine this audit.

| Fingerprint | SHA-256 |
|---|---|
| module.json bytes | `f37a5411307a57324a77f36585997c277ffd6d9699576eae285a2f5a551195cc` |
| Entire donor tree | `e977badf00312a6326bd375984b0c82295566608890b4dc28b026d1b412caa57` |
| Mechanical JSON bytes | `693a248e6c77e42d52f90fee4be50ddd8f46b6d17b7aaf348da73cca0e5b4c0d` |

Tree hash = SHA-256 of UTF-8 `JSON.stringify` of lexically sorted `[relative/path, fileSHA256]` pairs, using `/`. Dataset `sourceFingerprint` records this algorithm/count. All 7,505 paths/content hashes were compared before/after extraction; donor unchanged.

No reusable module/content license was found in metadata, readme, scripts or license-file inventory. The two other text files under assets/images supply no grant; spell `system.source.license` is absent or empty. No donor code or expressive content is copied: only bounded mechanics and traceable names/IDs. This does **not** establish permission to redistribute the original compendium. Future code/text reuse requires separate license review.

## 2. Pack architecture, spell locations and counts

Observed format: **LevelDB**, with CURRENT, MANIFEST-*, numbered .ldb tables/.log write-ahead log, LOCK, LOG and LOG.old in each declared pack directory. Example `packs/spells/`: CURRENT, MANIFEST-001852, 000857.ldb, 001854.log. This is not JSON or a line-delimited .db. A table alone is not the database: manifest/log state must be honored, not binary string scanning.

All 18 databases were read from disposable copies with installed **classic-level 1.4.1 (MIT)** at `C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/classic-level`. No dependency added. Only the database library was loaded, not Foundry/backend/module scripts. LevelDB housekeeping writes occurred solely in ignored `tmp/laaru-extract-*` copies. Donor databases were never opened by the library, repaired or migrated.

Current-key iteration returned **58,906 records**, including **14,430 root documents** and **370 folders**. Embedded Items/effects, journal pages and table results are separate records. Record count is not spell count.

Root non-spells = root docs minus root spells. Embedded non-spells = denominator minus numerator. All labels/paths below are declared metadata.

| Pack | Label | Root type | Path | Root docs | Root spells | Embedded spells / Items | Folders |
|---|---|---|---|---:|---:|---:|---:|
| `backgrounds` | # Происхождения | Item | `packs/backgrounds` | 140 | 0 | 0/0 | 1 |
| `classes` | # Классы | Item | `packs/classes` | 38 | 0 | 0/0 | 0 |
| `subclasses` | # Подклассы | Item | `packs/subclasses` | 363 | 0 | 0/0 | 37 |
| `classfeatures` | # Особенности | Item | `packs/classfeatures` | 4901 | 0 | 0/0 | 234 |
| `races` | # Расы | Item | `packs/races` | 116 | 0 | 0/0 | 0 |
| `racesMPMM` | # Расы — вариативные | Item | `packs/racesmpmm` | 48 | 0 | 0/0 | 0 |
| `actions` | # Действия | Item | `packs/actions` | 55 | 0 | 0/0 | 2 |
| `conditions` | # Состояния | Item | `packs/conditions` | 32 | 0 | 0/0 | 0 |
| `spells` | # Заклинания | Item | `packs/spells` | 640 | 640 | 0/0 | 13 |
| `monsters` | # Чудовища том 1 | Actor | `packs/monsters` | 2235 | 0 | 6031/19774 | 41 |
| `monsters2` | # Чудовища том 2 | Actor | `packs/monsters2` | 1083 | 0 | 3421/10173 | 18 |
| `intro` | # Справочник | JournalEntry | `packs/intro` | 56 | 0 | 0/0 | 5 |
| `list` | # Контент из книг | JournalEntry | `packs/list` | 40 | 0 | 0/0 | 0 |
| `items` | # Предметы | Item | `packs/items` | 2954 | 0 | 0/0 | 1 |
| `goods` | # Товары | Item | `packs/goods` | 1121 | 0 | 0/0 | 0 |
| `tables-extra` | # Дополнительные таблицы | RollTable | `packs/tables-extra` | 174 | 0 | 0/0 | 14 |
| `tables` | # Таблицы происхождений | RollTable | `packs/tables` | 396 | 0 | 0/0 | 0 |
| `macro` | # Полезные макросы | Macro | `packs/macro` | 38 | 0 | 0/0 | 4 |

Exact spell namespaces:

- `packs/spells`, `!items!<itemId>`: **640 spells, 0 non-spell Items**. Also 13 folders and 23 `!items.effects!<itemId>.<effectId>` records; these are not additional spells.
- `packs/monsters`, `!actors.items!<actorId>.<itemId>`: **6,031 spells / 13,743 non-spell embedded Items**; 2,235 root Actors are non-spell documents.
- `packs/monsters2`, same namespace: **3,421 spells / 6,752 non-spell embedded Items**; 1,083 root Actors.
- Other 10 Item packs: **9,768 non-spell root Items, zero spells**. Checked structurally, not excluded by label. Journal/RollTable/Macro namespaces were inventoried; mentions/UUID links were not treated as spells.

All Item scopes: **10,408 root + 29,947 embedded = 40,355 Items; 10,092 spells / 30,263 non-spells**. Across all root document types: 640 spells / 13,790 non-spells. These different-scope totals must not be added. The standalone spells pack is pure spell Items; Actor packs mix embedded spell/non-spell Items.

Selection requires an Item namespace and exact native `type === "spell"`. Every embedded parent and membership in its root Actor `items` ID array were verified. No Actor body, feature, equipment or macro document is emitted.

## 3. Duplicates and multiple versions

No deduplication was performed.

| Scope | Rows | Distinct exact names | Repeated-name groups / rows | Distinct bare Item IDs | Repeated-ID groups / rows |
|---|---:|---:|---:|---:|---:|
| Standalone | 640 | 640 | 0 / 0 | 640 | 0 / 0 |
| Embedded | 9,452 | 408 | 335 / 9,379 | 8,976 | 184 / 660 |
| Combined | 10,092 | 1,036 | 345 / 9,401 | 9,616 | 184 / 660 |

Examples of repeated embedded display names: Магическая рука (348), Обнаружение магии (282), Рассеивание магии (192). Counts are embedded instances, not additional standalone templates.

**Zero duplicate scoped identities** `(module, pack, parentActorId-or-null, documentId)`. Bare ID `JLzvdeQZRB6tEgJu`, for example, occurs 12 times across parent scopes. Keep parentActorId for embedded Items.

Observed alternatives despite unique full template names: Shield `tEmEo2XrdBVhIlfr` versus Shield (Alternate) `PENjM4pav3tXf9MQ`; True Strike `WC1772HPAbCIGAcb` versus True Strike (Alternate) `TZYYKwDMcTbcg1qT`. The latter pair differs in activation, range/target, components and formula. Labels provide variant evidence, not a resolver/classifier; do not merge them.

**316 embedded exact-name groups have multiple retained mechanical representations**, excluding source/name/origin references when comparing. This may reflect Actor overlays, edits or historical variants; identical names do not establish a common original spell.

## 4. Real schema, legacy/activity distinction and variation

All 10,092 spells have `_id`, name, type, system, effects (embedded effect IDs), _stats. `_stats.coreVersion=12.330` throughout; all 640 templates record systemVersion 3.3.1. Embedded versions include null (3,553), 2.3.1 (2,205), 2.1.5 (1,653), 2.4.0 (1,194) and smaller 2.x/3.x groups. These are historical provenance fields, not effective-schema guarantees or a new 12.343 runtime test.

**system.activities is absent in all 10,092 spells.** Mechanics are legacy Item-level fields. No activities, modern schema or V13/V14 migration is invented.

| Source field (system unless noted) | Observed shape / variation |
|---|---|
| Top-level _id/name/type | 16-character IDs, localized names, exact spell type; parent scope from database key. |
| level / school | Integer 0–9 / string code. Template level counts 0..9: 66,101,109,94,63,76,52,29,26,24. |
| preparation | mode string/prepared boolean. Template modes prepared 585, always 55. Embedded prepared 3,803; innate 3,532; always 1,966; pact 131; atwill 20. Not current live preparation. |
| activation | type string, cost number/null, condition string. 11 null template costs. action/bonus/reaction/minute/hour plus 11 template special cases. Nonempty condition prose: 24 templates / 267 embedded; retain presence only. |
| duration | value string (including empty), units string; no numeric coercion/duration calculation. |
| range | value number/null, long null, units string. ft/touch/self/mi/spec/empty. Template values: 433 numbers / 207 nulls. |
| target / area | value string/number/null, width number/null, units/type strings, prompt boolean. Templates: 575 string / 63 number / 2 null values. Embedded: 1,185 string / 6,429 number (2 fractional) / 1,838 null. Five template widths numeric, other widths null. Omit UI prompt. |
| area/template | No separate system.area or system.template. Geometry in target.type/value/width/units: cone,cube,cylinder,line,radius,sphere,square,wall. Also creature/self/space/object/willing/empty. A target value is not always a count. |
| actionType / ability | Legacy action code string; ability string/null (7 templates / 1 embedded null). Empty is unspecified, not a chosen spellcasting ability. |
| Attack / critical | attack {bonus:string,flat:boolean} on 575 templates/all embedded; attackBonus string on other 65 templates. All bonuses empty, flat=false. critical {threshold:number/null,damage:string}; one numeric threshold. |
| save | ability/scaling strings, dc number/null. Template DCs all null; three embedded flat DCs 13,13,15. Scaling spell/ability/flat. Default scaling alone does not imply a save. |
| damage | parts [[formulaString,typeString],...], versatile string. Empty parts: 377 templates / 7,132 embedded. Types include damage codes, healing, temphp, empty. Conditional labels in formulas remain opaque. |
| healing | No system.healing. Evidence is actionType=heal and/or healing/temphp parts; they can disagree. Empty healing formulas occur. |
| formula / scaling | Auxiliary formula string; scaling {mode,formula} strings. References include @mod, @item.level, @details.level; cantrip/level/none scaling. No evaluation or rule calculation. |
| uses | value number/null, max string, per string/null, recovery string, prompt boolean. All template max strings empty; 2,690 embedded configured. Empty max is not zero usable charges. Omit UI prompt. |
| consume | type string, target string/null, amount number/null, scale boolean. Templates unconfigured. 29 embedded spells consume charges from same-Actor sibling Items. |
| components/properties | 575 templates properties-only, 29 components-only, 36 both (consistent). All embedded properties-only. Components: vocal/somatic/material/concentration/ritual booleans; properties uses those names plus mgc. |
| concentration / ritual | Explicit components booleans and/or properties membership: 290 / 35 templates; 3,419 / 614 embedded. Conflicts would be unknown; zero conflicts observed. |
| materials | value text, consumed boolean, cost/supply number/null. Retain three structured fields and text presence, not named-material prose. Cost alone cannot establish requirements. |
| summons / enchantment | Structured summons on 24 templates / 1 embedded (profiles, UUIDs, bonuses, matching options); else null/absent. Enchantment null where present. Extract summon presence/profile count only. |
| Top-level effects | 20 templates reference 23 effects; 547 embedded spells reference 577 effects. Extract count only, not changes/scripts/flags. |

system.source is `{custom}` or `{book,custom,license,page}`; no universal structured spell identifier was observed. Neither bibliography nor historical versions establish current capability/availability.

## 5. Extraction contract and deliberate information loss

JSON contains source metadata/pack counts and a spells array. One compact record per line retains every duplicate separately. **11,676,322 bytes**, maximum observed record **1,402 UTF-8 bytes**. The 9,452 embedded instances explain the size; this is not an LLM context payload. analysis/.gitattributes pins this JSON to LF so Windows checkout preserves its reproducible byte hash.

source contains module, declared pack, documentId and parentActorId for embedded Items; it reconstructs exact source keys. Optional originReferences retains only `_stats.compendiumSource`, `flags.core.sourceId`, `flags.dnd5e.sourceId`, renamed to flat labels. These are provenance hints, not resolver output; no arbitrary flags object is copied.

Retained mechanics are listed in section 4. Missing attack/components/properties remain absent; empty strings and nulls remain distinct. No synthetic area/healing object is fabricated. Activity summary is `{present:false,count:0,types:[]}` throughout; summons summary has presence/profile count. Concentration/ritual derive only from explicit fields.

Excluded: HTML/descriptions/flavor, material/trigger prose, images, biographies, journals, class/feat/equipment data, macros, effect bodies, arbitrary flags, scripts, permissions, sort/folder metadata and user IDs. Names/formulas must be rendered as plain text and never evaluated or treated as model instructions. A bounded formula label is not authoritative interpretation of its conditional semantics.

`analysis/extract-laaru-spells.cjs` is original offline audit tooling, not a production ActionNormalizer/resolver. It uses an explicit nested leaf whitelist, finite/type checks, 160-character strings, 16 damage parts/effects, bounded properties/summon profiles and a 4,096-byte record ceiling. It fails on markup/code markers, identity mismatch, orphaned Items or newly present activities. No src imports/network requests. Current data passes without truncating records or omitting spells. Missing semantics are documented rather than silently supplied.

## 6. Structural spell families

**A — directly observed structure.** These are overlapping field predicates, not mutually exclusive tactical classes. The explicit single-target predicate accepts source 1 or "1" without changing stored data. Typed non-healing parts exclude empty/healing/temphp types; no damage outcome is asserted/calculated.

| Predicate | Templates | Embedded |
|---|---:|---:|
| actionType=rsak | 31 | 409 |
| actionType=msak | 21 | 305 |
| Attack code plus nonempty damage parts | 43 | 564 |
| actionType=save | 258 | 3,050 |
| Save + creature/willing + explicit target value 1 | 53 | 1,320 |
| Save + one of eight area target types in section 4 | 111 | 1,127 |
| Save + non-healing typed parts | 153 | 1,118 |
| Area target + non-healing typed parts | 84 | 800 |
| actionType=heal | 23 | 223 |
| Explicit healing part | 22 | 217 |
| Explicit temphp part | 4 | 26 |
| actionType=util | 265 | 5,370 |
| No damage parts | 377 | 7,132 |
| actionType=summ | 24 | 4 |
| Structured summons object | 24 | 1 |
| Reaction activation | 16 | 270 |
| Concentration | 290 | 3,419 |
| Ritual | 35 | 614 |

Other actionType values: empty 14/54, other 3/2, abil 1/35 (templates/embedded). Nine mutually exclusive actionType counts sum to 640/9,452; util is a code, not proof of harmless utility.

**B — limited additional semantics required.** Generic mapping of rsak/msak to ranged/melee spell attack, target codes to geometry, healing/temphp to capability labels, or effect paths to attribute-modification hints is feasible. It still does not prove creature eligibility, triggers, resources, save outcomes, repeated damage or effect application. Mappings require reviewed version-specific D&D5e meaning, not name handlers.

**C — prose or separately reviewed semantic evidence required.** Specific debuff/control identity, teleport constraints, exclusions, willingness, repeat saves, success behavior and alternative outcomes frequently lack sufficient structured data. No prose was converted to rules here. Buff/control/teleport therefore have no defensible corpus-wide counts in this pass.

**D — unknown/exceptional.** Templates include 157 empty target types, 50 empty range units and 14 empty action codes. Two templates/two embedded spells combine heal code and non-healing typed parts. Auxiliary formulas and sparse provenance also require uncertainty. A structural family never implies automatic-execution eligibility.

## 7. Representative real spells and unsafe classification cases

All representatives below are actual root spell Items in **pack spells**, physical path **packs/spells**, key `!items!<ID>`. Names exactly match source display names. IDs locate fixtures; names are not rules. Unless stated otherwise activation is action/1. Formulas are inert source metadata.

| Role | ID / exact name | Level | Main observed mechanics | Usefulness / semantic limit |
|---|---|---:|---|---|
| Ranged attack | `5M8uw6ooTsh9S92G` — Огненный снаряд / Fire bolt | 0 | rsak; 120 ft; creature "1"; 1d10 fire; cantrip 1d10 scaling | A/B: attack/range/damage without prose; not complete eligibility. |
| Melee attack | `9E1TLV8eksiMDiuE` — Нанесение ран / Inflict wounds | 1 | msak; touch; creature/empty count; 3d10 necrotic; level 1d10 scaling | A/B: preserve touch and unknown count, no invented numeric reach. |
| Save single target | `6CxYBftoMCZk449F` — Священное пламя / Sacred flame | 0 | save dex; creature "1"; 60 ft; 1d8 radiant; DC null/scaling spell | A/B: native/Actor-dependent DC remains unknown. |
| AoE damage | `j2cNLHZYnbKl46gZ` — Огненный шар / Fireball | 3 | save dex; 150 ft; sphere "20" ft; 8d6 fire; level 1d6 scaling | A/B: geometry not target count; save-success behavior absent here. |
| Healing | `tFpK65jZTM6X4wgG` — Исцеление ран / Cure Wounds | 1 | heal; touch/creature; 1d8 + @mod healing; level 1d8 scaling | A/B: explicit healing type; no invented healing field/modifier. |
| Buff candidate | `jYsMCeg6AbSHzq1F` — Благословение / Bless | 1 | util; 30 ft; creature "3"; 1 minute; concentration; one effect | B with separate effect evidence below; Item alone does not explain precise buff behavior. |
| Control candidate | `hHdE2G8F8VR08bxF` — Паралич гуманоида / Hold person | 2 | save wis; creature "1"; 60 ft; 1 minute; concentration; no parts/effects | A for save; C for paralysis/control/humanoid restriction. Name cannot supply mechanics. |
| Teleport candidate | `DulrpjBUeVVgrrNA` — Туманный шаг / Misty step | 2 | util; bonus/1; range self; space "30" ft; instant; no parts/effects | A for space/bonus; C for teleport/destination constraints. No explicit teleport field. |
| Reaction | `tEmEo2XrdBVhIlfr` — Щит / Shield | 1 | reaction/1; condition present; 1 round; self target; empty actionType/range units; one effect | A timing, B/C effect/trigger. Preserve missing range. |
| Concentration / target gap | `03FUETm5aXg2DQJi` — Единство сущностей / Tether Essence | 7 | save con; 60 ft; 1 hour; concentration; empty target type/value; no parts | A save/concentration, C/D linked-target semantics; no invented count. |
| Conflicting code | `3DmrqW87SyWdaa8T` — Желание / Wish | 9 | heal; self; instant; 1d10 necrotic | D: heal code does not make this ordinary healing. Alternative behavior unknown. |
| Mixed loss/healing | `R5bXD9vSRJPlFcOm` — Передача жизни / Life Transference | 3 | heal; 4d8 necrotic plus empty-formula healing | D: no derived numeric healing or recipient choice. |
| Summon | `24IA6xKSySVzSzlT` — Призыв духа исчадия / Summon Fiend | 6 | summ; 90 ft; space "1"; 1 hour; concentration; three profiles | A/B summon structure; Actor/profile mechanics summarized, not imported as rules. |
| Legacy alternative | `PENjM4pav3tXf9MQ` — Щит (альт.) / Shield (Alternate) | 1 | util; reaction/1; self/0; instant; components-only; formula @item.level + @mod | A/D: real alternate schema, do not merge with Shield. |

Additional inspected effect records in packs/spells, not copied to JSON:

- `!items.effects!jYsMCeg6AbSHzq1F.8kLGThMBIyJsD2p5`: disabled=false, transfer=false, statuses empty; paths system.bonuses.abilities.save and system.bonuses.All-Attacks, mode 2/value 1d4. Supports a bonus-modification hypothesis; presence does not prove All-Attacks is natively compatible.
- `!items.effects!tEmEo2XrdBVhIlfr.6pbotGIvqQkraPva`: system.attributes.ac.bonus, mode 2/value 5; disabled=false, transfer=false. Trigger still in omitted condition text.
- Fire Shield `A38TKmeBfSxdEKX7` has two resistance-change effects, both disabled=true/transfer=true. Count alone cannot establish an active buff or select a variant.

These are candidate fixtures, not per-spell handlers or claims that prose semantics were verified. Coverage includes explicit unknowns instead of filling gaps using outside D&D knowledge.

## 8. Compendium-to-Actor identity evidence

| Mechanism | Templates | Embedded spell Items | Limits |
|---|---|---|---|
| Module + pack + _id | 640 unique | Requires parent Actor ID | Unique within pinned snapshot; pack rebuilds/edits need version checks. |
| _stats.compendiumSource / flags.core.sourceId | 35 populated pairs: Compendium.world.lllama-spells, llmagus, shamanspell | 4,734 populated pairs | Pairs agree throughout. Embedded: 4,658 world Item refs, 71 world Actor...Item refs, 3 LAARU monster refs, 1 world.spell, 1 LAARU spells. Most do not identify this spell catalogue. |
| flags.dnd5e.sourceId | Absent | 51, all LAARU spells | All referenced IDs exist in audited root spell pack. |
| flags.scene-packer.sourceId | 10 world Item refs | Absent | No direct template resolver; reported, not retained. |
| _stats.duplicateSource | null | null | No usable duplicate lineage. |
| flags.babele.originalName / flags.srd5e.source | 609 / 527 | 2,343 / 4,678 | Translation/import hints, not guaranteed identity. |
| system.source / importer metadata | Custom/bibliographic; one DDB importer record, two Plutonium source records | Historical import data | No universal structured identifier or verified cross-import mapping. |

Explicit core/D&D5e references connect **52 embedded Items to 29 distinct existing standalone spell IDs**; zero missing targets in this subset. The other **9,400 embedded Items lack a direct reference to this spell pack**. This is static reference coverage, not proof that live imports retain it. Names/descriptive links were not used to manufacture matches.

Observed older reference form: `Compendium.laaru-dnd5-hw.spells.bM98WJMhzC5LjfrO`. A fully qualified locator can be constructed as `Compendium.laaru-dnd5-hw.spells.Item.bM98WJMhzC5LjfrO`. Runtime resolution of syntax/availability is future work; no fromUuid/live import performed. Embedded locators also need Actor/Item segments. Bare Item IDs are not global.

Observed overlay example: template `bM98WJMhzC5LjfrO` (Приказ / Command) links via dnd5e.sourceId from monsters Actor `AO6wqmIpI3GKnweV`, Item `ZKQwGAFDM2PKgKlR`. Template mode prepared/ability empty differs from embedded pact/cha. Template `KcziiS01MniKTNZ9` links to monsters Actor `WTsVFzcYiAxk1hau`, Item `4sJZl70pF5j339P5`: prepared=false versus true, empty ability versus wis, with a changed localized name. These are static overlay examples, not live resource readings.

Resource scope: monsters Actor `EYVcCv8FWNguxRTx`, spell `VvcCkyhbjtWn3EbQ` consumes one charge from sibling `JDSEnWLNeWm5Xp7Q`. All 29 configured charge references resolve inside their source Actor. The extraction retains references, not the non-spell resource Items.

## 9. Proposed future architecture and authority boundary

Proposed only; no production resolver/ActionNormalizer implemented:

```text
Compendium spell -> reviewed semantic/mechanical template
                                     +
Actor-owned Item -> current live mechanical overlay
                                     |
                              ActionCapability
                                     |
                           Compact DecisionView -> LLM
```

Live Actor-owned Items remain authoritative for spell ownership, preparation, current uses/resources, modifications and Actor-specific changes. Even embedded records here are **compendium snapshots**, not live Actor state. Templates can explain capabilities but cannot grant spells, restore charges, overwrite changes or assert current availability.

Runtime/validator keeps full internal state; a future DecisionView exposes only necessary capability facts and explicit unknowns. NORMALIZED_COMBAT_STATE.md and COMBAT_INTENT_SCHEMA.md remain canonical/unchanged. Spell enablement needs a separately reviewed extension; this dataset is not wired into Phase 1A.

LLM owns action/target/tactics. Deterministic code validates structure/provenance/legality without per-spell tactical substitution. Foundry/D&D5e/Midi own rules; no attack/save/damage/resource/concentration/summoning engine is built here.

## 10. Risks and Phase 2 recommendations

- Parse mixed legacy shapes and null/string/number variation explicitly. A universal number assumption or activities requirement would reject real spells.
- Never replace live preparation/uses/resources with template defaults. Empty/null does not mean fabricated zero/full resources.
- Codes alone are not semantics or execution authorization: conflicting heal, blank fields, conditional/untyped formulas and util examples require uncertainty.
- Do not derive control/teleport/reaction rules from names. Use generic structure plus reviewed semantics where needed, never hundreds of per-spell handlers.
- Effect/module automation can supply missing mechanics but is untrusted/module-dependent. Do not evaluate imported flags/scripts; effect count does not prove applicability.
- Prefer resolvable explicit provenance plus compatible mechanical evidence; missing/conflicting/ambiguous identity must stay unresolved. No name-only fallback.
- Evaluate 640 templates separately from 9,452 overlays; repeated instances must not dominate coverage statistics or be silently deduplicated.
- Keep this 11.7 MB corpus offline. Measure future compact input per Actor/turn; do not create another Compendium/rules database.
- No reusable license verified: preserve fingerprints; do not copy donor code/expressive content without separate review.
- Phase 1A issues remain open: PLANNING_UNAVAILABLE loop, universal Action Normalization / Shortbow omitted, disposition semantics. This audit does not fix them or enable execution.

## 11. Exact proposed next experiment — after review only

One **offline, non-production capability-coverage experiment**, after review and separate authorization. No model/Foundry calls.

1. Select the 14 standalone fixtures in section 7, Command/Charm Person linked overlays and charged Item in section 8. Preserve scoped IDs/fingerprint.
2. Compare generic attack/save/healing evidence, target count versus area, activation/duration/concentration, resource/preparation overlay and uncertainty. Include old components, null/empty, conflicting heal, missing provenance and shared bare IDs. No formula evaluation, execution or deployed resolver.
3. Negative expectations: Hold Person must not acquire paralysis from its name; Misty Step must not acquire teleport legality; Wish stays exceptional; template defaults must not overwrite overlays; shared IDs stay parent-scoped.
4. Produce A/B/C/D coverage and a proposed small view with byte counts. Keep unsupported semantics explicit and full mechanics outside model context.
5. Stop for review again. A separately authorized broader universal Item audit should combine this with legacy melee/ranged and monster/class features. No Phase 2 production, pathfinding, movement, Midi, turn advancement or other write is authorized by this proposal.

## 12. Validation and reproduction

From repository root, use an existing external classic-level installation (this does not launch Foundry):

```powershell
node analysis/extract-laaru-spells.cjs 'C:\Program Files\Foundry Virtual Tabletop\resources\app\node_modules\classic-level'
node analysis/extract-laaru-spells.cjs 'C:\Program Files\Foundry Virtual Tabletop\resources\app\node_modules\classic-level' --check
npm run check
git diff --check
```

Every emitted row is a real native spell Item at its reconstructed pack key; all parents/memberships verified. Zero non-spells or duplicate scoped IDs; no deduplication. Strict whitelisting excludes full descriptions/HTML/macros/scripts/arbitrary flags/secrets. Different structural representatives were inspected against mechanics, not just names. Independent comparison validates retained fields against source; fresh-copy --check reproduces exact JSON bytes. Independent verification checked 10,092 rows and 323,119 retained string values; all 14 representative IDs/names/levels matched their source. All 7,505 donor content hashes remain unchanged.

Checkpoint validation: npm run check passed (**63/63 tests**, typecheck/build); git diff --check passed. Production code/tests/dependencies, six canonical Phase 0 documents, PHASE1A_TESTING.md and PROVEN_POC.md unchanged. No new live evidence or Phase 1A acceptance claimed.
