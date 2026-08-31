// Offline audit utility only. Never import this into the production adapter.
// Requires an external classic-level installation; no project dependency changes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const donor = path.join(root, '_references/laaru-dnd5-hw');
const output = path.join(__dirname, 'laaru-spells-mechanical.json');
const readerPath = process.argv[2];
assert(readerPath, 'Usage: node analysis/extract-laaru-spells.cjs <classic-level directory> [--check]');
const { ClassicLevel } = require(path.resolve(readerPath));
const checkOnly = process.argv.includes('--check');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function fingerprint(dir) {
  const entries = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), 'Symlinks are outside this audit');
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) entries.push([path.relative(dir, file).replaceAll('\\', '/'), sha(fs.readFileSync(file))]);
    }
  }
  walk(dir);
  entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return entries;
}
// Strict leaf whitelist. Unknown source fields are not traversed or copied.
const specs = {
  preparation: { mode: 's', prepared: 'b' },
  duration: { value: 's', units: 's' },
  range: { value: 'n?', long: 'n?', units: 's' },
  target: { value: 'sn?', width: 'n?', units: 's', type: 's' },
  critical: { threshold: 'n?', damage: 's' },
  save: { ability: 's', dc: 'n?', scaling: 's' },
  scaling: { mode: 's', formula: 's' },
  uses: { value: 'n?', max: 's', per: 's?', recovery: 's' },
  consume: { type: 's', target: 's?', amount: 'n?', scale: 'b' },
  attack: { bonus: 's', flat: 'b' },
  components: { vocal: 'b', somatic: 'b', material: 'b', concentration: 'b', ritual: 'b' }
};
function leaf(value, spec) {
  if (value === null) { assert(spec.includes('?'), 'Unexpected null'); return null; }
  assert(value !== undefined, 'Missing required mechanical field');
  const t = typeof value;
  assert((t === 'string' && spec.includes('s')) || (t === 'number' && spec.includes('n') && Number.isFinite(value)) || (t === 'boolean' && spec.includes('b')), 'Unexpected mechanical type');
  if (t === 'string') {
    assert(value.length <= 160, 'Mechanical string exceeds audit limit');
    assert(!/[<>\x00-\x1f`{};]/.test(value), 'Markup/code/control characters are not allowed');
    assert(!/(?:javascript:|authorization|bearer\s|sk-or-v1-|api[_-]?key|\b(?:eval|require|function)\s*\()/i.test(value), 'Unsafe text');
  }
  return value;
}
function pick(value, spec) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected mechanical object');
  return Object.fromEntries(Object.entries(spec).map(([k, type]) => [k, leaf(value[k], type)]));
}
function ident(value) { assert(/^[a-zA-Z0-9]{16}$/.test(value), 'Invalid document identity'); return value; }
function reference(value) {
  leaf(value, 's');
  assert(/^(?:Compendium|Actor|Item)\.[a-zA-Z0-9_.-]+$/.test(value), 'Unexpected source reference');
  return value;
}
function property(system, key) {
  const a = system.components ? system.components[key] : undefined;
  const b = system.properties ? system.properties.includes(key) : undefined;
  if (a !== undefined && b !== undefined && a !== b) return null;
  return a ?? b ?? null;
}
function extract(pack, key, doc, parentActorId) {
  assert.equal(doc.type, 'spell');
  const s = doc.system;
  assert(!Object.hasOwn(s, 'activities'), 'New activity schema requires a separate audit');
  const source = { module: 'laaru-dnd5-hw', pack: pack.name, documentId: ident(doc._id) };
  if (parentActorId) source.parentActorId = ident(parentActorId);
  const expected = parentActorId ? `!actors.items!${parentActorId}.${doc._id}` : `!items!${doc._id}`;
  assert.equal(key, expected, 'Storage identity mismatch');
  const references = {};
  for (const [label, value] of Object.entries({
    compendiumSource: doc._stats?.compendiumSource,
    coreSourceId: doc.flags?.core?.sourceId,
    dnd5eSourceId: doc.flags?.dnd5e?.sourceId
  })) if (value) references[label] = reference(value);
  const item = { source, name: leaf(doc.name, 's'), type: 'spell', level: leaf(s.level, 'n'), school: leaf(s.school, 's') };
  assert(Number.isInteger(item.level) && item.level >= 0 && item.level <= 9, 'Unexpected spell level');
  if (Object.keys(references).length) item.originReferences = references;
  item.preparation = pick(s.preparation, specs.preparation);
  item.activation = { ...pick(s.activation, { type: 's', cost: 'n?' }), conditionPresent: Boolean(s.activation.condition) };
  for (const field of ['duration', 'range', 'target']) item[field] = pick(s[field], specs[field]);
  item.actionType = leaf(s.actionType, 's');
  item.ability = leaf(s.ability, 's?');
  if (Object.hasOwn(s, 'attack')) item.attack = pick(s.attack, specs.attack);
  if (Object.hasOwn(s, 'attackBonus')) item.attackBonus = leaf(s.attackBonus, 's');
  item.critical = pick(s.critical, specs.critical);
  item.save = pick(s.save, specs.save);
  assert(Array.isArray(s.damage.parts) && s.damage.parts.length <= 16, 'Damage parts limit');
  item.damage = { parts: s.damage.parts.map(p => { assert(Array.isArray(p) && p.length === 2); return p.map(v => leaf(v, 's')); }), versatile: leaf(s.damage.versatile, 's') };
  item.formula = leaf(s.formula, 's');
  for (const field of ['scaling', 'uses', 'consume']) item[field] = pick(s[field], specs[field]);
  if (Object.hasOwn(s, 'components')) item.components = pick(s.components, specs.components);
  if (Object.hasOwn(s, 'properties')) {
    assert(Array.isArray(s.properties) && s.properties.length <= 8);
    item.properties = s.properties.map(v => { assert(['vocal','somatic','material','concentration','ritual','mgc'].includes(v)); return v; });
  }
  item.materials = { ...pick(s.materials, { consumed: 'b', cost: 'n?', supply: 'n?' }), valuePresent: Boolean(s.materials.value) };
  item.concentration = property(s, 'concentration');
  item.ritual = property(s, 'ritual');
  assert(Array.isArray(doc.effects) && doc.effects.length <= 16);
  item.effectCount = doc.effects.length;
  const summons = s.summons;
  if (summons) assert(Array.isArray(summons.profiles) && summons.profiles.length <= 32);
  item.summons = { present: Boolean(summons), profileCount: summons?.profiles.length ?? 0 };
  item.activities = { present: false, count: 0, types: [] };
  assert(Buffer.byteLength(JSON.stringify(item)) <= 4096, 'Per-spell mechanical byte limit');
  return item;
}
async function main() {
  const before = fingerprint(donor);
  const meta = JSON.parse(fs.readFileSync(path.join(donor, 'module.json'), 'utf8'));
  assert.equal(meta.id, 'laaru-dnd5-hw');
  assert.equal(meta.version, '3.64.0', 'Different module snapshot requires review');
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  const work = fs.mkdtempSync(path.join(root, 'tmp/laaru-extract-'));
  const spells = [], packs = [], scopedIds = new Set();
  let verified = 0;
  try {
    for (const pack of meta.packs) {
      const src = path.resolve(donor, pack.path);
      assert(src.startsWith(path.join(donor, 'packs') + path.sep), 'Donor path boundary');
      const copy = path.join(work, pack.name);
      assert(copy.startsWith(work + path.sep), 'Copy path boundary');
      fs.cpSync(src, copy, { recursive: true, errorOnExist: true, force: false });
      // LevelDB may write housekeeping files on open. This is ONLY a disposable copy.
      const db = new ClassicLevel(copy, { keyEncoding: 'utf8', valueEncoding: 'json', createIfMissing: false });
      const records = new Map();
      try {
        await db.open();
        for await (const [key, value] of db.iterator({ fillCache: false, verifyChecksums: true })) {
          assert(!records.has(key), 'Duplicate live database key');
          records.set(key, value);
        }
      } finally { await db.close(); }
      const rootPrefix = { Item: '!items!', Actor: '!actors!', JournalEntry: '!journal!', RollTable: '!tables!', Macro: '!macros!' }[pack.type];
      assert(rootPrefix, 'Unknown pack document type');
      const report = { name: pack.name, label: pack.label, type: pack.type, path: pack.path, records: records.size, rootDocuments: 0, rootSpells: 0, embeddedItems: 0, embeddedSpells: 0, folders: 0 };
      for (const [key, doc] of records) {
        if (key.startsWith(rootPrefix)) report.rootDocuments++;
        if (key.startsWith('!folders!')) report.folders++;
        const standalone = pack.type === 'Item' && key.startsWith('!items!');
        const embedded = pack.type === 'Actor' && key.startsWith('!actors.items!');
        if (embedded) report.embeddedItems++;
        if (!(standalone || embedded) || doc.type !== 'spell') continue;
        const parent = embedded ? key.slice('!actors.items!'.length).split('.')[0] : undefined;
        if (parent) {
          const actor = records.get(`!actors!${parent}`);
          assert(actor && actor._id === parent && Array.isArray(actor.items) && actor.items.includes(doc._id), 'Orphaned embedded spell');
          report.embeddedSpells++;
        } else report.rootSpells++;
        const scope = `${pack.name}:${parent ?? ''}:${doc._id}`;
        assert(!scopedIds.has(scope), 'Duplicate scoped Item identity');
        scopedIds.add(scope);
        let item;
        try { item = extract(pack, key, doc, parent); }
        catch (error) { throw new Error(`${pack.name}:${key}: ${error.message}`); }
        spells.push(item);
        verified++;
      }
      packs.push(report);
    }
  } finally {
    assert.deepEqual(fingerprint(donor), before, 'READ-ONLY DONOR CHANGED');
    // Intentionally leave the isolated workspace in ignored tmp for local review.
  }
  spells.sort((a,b) => {
    const key = x => `${x.source.pack}:${x.source.parentActorId ?? ''}:${x.source.documentId}`;
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
  const metadata = {
    format: 'laaru-spell-mechanical-audit-v1',
    module: meta.id, moduleVersion: meta.version,
    sourceFingerprint: { algorithm: 'sha256 of JSON.stringify(sorted [relativePath,sha256] pairs)', fileCount: before.length, sha256: sha(JSON.stringify(before)), moduleJsonSha256: sha(fs.readFileSync(path.join(donor, 'module.json'))) },
    scope: 'All native type=spell Items; standalone templates and Actor-embedded instances retained separately. Not live Actor state.',
    totals: { spells: spells.length, standalone: spells.filter(s => !s.source.parentActorId).length, actorEmbedded: spells.filter(s => s.source.parentActorId).length },
    packs
  };
  // One bounded spell per line: compact storage with inspectable, stable diffs.
  const data = JSON.stringify(metadata, null, 2).slice(0, -2) + ',\n  "spells": [\n' + spells.map(s => '    ' + JSON.stringify(s)).join(',\n') + '\n  ]\n}\n';
  assert.equal(JSON.parse(data).spells.length, verified);
  if (checkOnly) assert.equal(fs.readFileSync(output, 'utf8'), data, 'Derived dataset differs from source extraction');
  else fs.writeFileSync(output, data, 'utf8');
  console.log(JSON.stringify({ mode: checkOnly ? 'verified' : 'extracted', ...metadata.totals, verifiedSourceItems: verified, duplicateScopedIds: 0, bytes: Buffer.byteLength(data), sha256: sha(data), sourceFingerprint: metadata.sourceFingerprint, donorUnchanged: true, work: path.relative(root, work) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
