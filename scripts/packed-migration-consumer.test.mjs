import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { X_CASES, RETAINED_ROOT } from '../packages/lyra-ui/scripts/fixtures/lyra-renames/consumer/x-cases.mjs';
import { compatibilityKey } from '../packages/lyra-ui/scripts/published-compatibility.mjs';
import { selectMigrationCases, assertMigrationReport, runMigrationProcess, writeResolvedMigrationEntry } from './packed-migration-consumer.mjs';

function context() {
  const records = Object.fromEntries(X_CASES.map(item => [compatibilityKey(item.key), {
    key: item.key, state: 'retired', removedIn: '23.0.0',
    policy: { removalNotBefore: '23.0.0', replacement: { usage: `Resolve ${item.id}` } },
  }]));
  records[compatibilityKey(RETAINED_ROOT.key)] = { key: RETAINED_ROOT.key, state: 'current',
    policy: { removalNotBefore: '24.0.0', replacement: { usage: 'Use the canonical granular class.' } } };
  return { packageVersion: '23.0.0', records };
}
function report(item, origin = 'lyra-v21') {
  return { schemaVersion: 1, origin, changes: [], filesChanged: 0,
    summary: { rewrites: 0, warnings: 1, acknowledged: 0 }, warnings: [{
      file: `migration-x/input/${item.id}.ts`, line: 1, column: item.column, origin,
      upstreamTag: item.key.tag ?? null, upstreamMember: item.key.name, action: 'manual-review',
      warningCode: item.key.scope === 'member' ? 'DEPRECATED_MEMBER_REVIEW' : 'DEPRECATED_MODULE_REVIEW',
      target: item.record.policy.replacement.usage, message: 'This API was removed in 23.0.0; review replacement.',
    }] };
}
test('X coverage derives exactly nine identities and requires the actual installed retirement state', () => {
  const source = context();
  const selected = selectMigrationCases(source, '23.0.0');
  assert.equal(selected.length, 9);
  for (const mutate of [
    c => { delete c.records[compatibilityKey(X_CASES[0].key)]; },
    c => { c.records[compatibilityKey(X_CASES[1].key)].state = 'current'; },
    c => { c.records[compatibilityKey(X_CASES[2].key)].removedIn = '24.0.0'; },
    c => { c.records[compatibilityKey(RETAINED_ROOT.key)].state = 'retired'; },
    c => { c.records.extra = { key: { scope: 'export', kind: 'type', module: '.', name: 'Extra' }, policy: { removalNotBefore: '23.0.0' }, state: 'retired' }; },
  ]) { const next = structuredClone(source); mutate(next); assert.throws(() => selectMigrationCases(next, '23.0.0')); }
  assert.throws(() => selectMigrationCases(source, '22.0.0'), /version/u);
  assert.throws(() => selectMigrationCases(source, '23.0.0', [...X_CASES, X_CASES[0]]), /duplicate/u);
});
test('reports bind exact owner, source span, target, origin and retirement wording', () => {
  const item = selectMigrationCases(context(), '23.0.0')[0];
  assertMigrationReport(report(item), [{ ...item, file: `migration-x/input/${item.id}.ts` }], 'lyra-v21');
  for (const mutate of [
    r => { r.warnings = []; }, r => { r.warnings.push({ ...r.warnings[0] }); },
    r => { r.warnings[0].upstreamTag = 'lr-other'; }, r => { r.warnings[0].column++; },
    r => { r.warnings[0].target = 'guessed'; }, r => { r.origin = 'lyra-v22'; },
    r => { r.warnings[0].message = 'is deprecated and scheduled for removal in 23.0.0'; },
    r => { r.changes.push({ action: 'rewrite-tag' }); },
  ]) { const next = report(item); mutate(next); assert.throws(() => assertMigrationReport(next, [{ ...item, file: `migration-x/input/${item.id}.ts` }], 'lyra-v21')); }
});
test('retained root review keeps floor24 tense and resolved checks reject orphan warnings', () => {
  const record = context().records[compatibilityKey(RETAINED_ROOT.key)];
  const item = { ...RETAINED_ROOT, id: 'retained-root', file: 'retained.ts', record };
  const result = report(item, 'lyra-v22'); result.warnings[0].file = item.file;
  result.warnings[0].message = 'is deprecated and scheduled for removal in 24.0.0';
  assertMigrationReport(result, [item], 'lyra-v22');
  result.warnings[0].message = 'was removed in 23.0.0';
  assert.throws(() => assertMigrationReport(result, [item], 'lyra-v22'));
  assert.throws(() => assertMigrationReport(result, [], 'lyra-v22'));
});
test('expected process status is checked rather than treating every failure as a negative proof', async () => {
  const ok = await runMigrationProcess(process.execPath, ['-e', "process.stdout.write('checked'); process.exit(1)"], process.cwd(), 1);
  assert.equal(ok.stdout, 'checked');
  await assert.rejects(runMigrationProcess(process.execPath, ['-e', 'process.exit(2)'], process.cwd(), 1), /expected 1/u);
});

test('authored X syntax and report locations match both real published scanner profiles', async () => {
  const { checkPublishedCompatibility } = await import('../packages/lyra-ui/scripts/check-published-compatibility.mjs');
  const { buildMigrationContract, migrateText } = await import('../packages/lyra-ui/scripts/migrate-wa.mjs');
  const { captures } = await checkPublishedCompatibility();
  const published = captures.find(capture => capture.facts.sourceVersion === '22.0.0');
  const inventory = structuredClone(published.publishedMigration);
  const source = context();
  for (const item of [...X_CASES, RETAINED_ROOT]) {
    source.records[compatibilityKey(item.key)].policy = published.facts.records.find(record => compatibilityKey(record.key) === compatibilityKey(item.key)).policy;
  }
  for (const profile of inventory.lyraRenames.profiles) {
    for (const entry of [...profile.reviews, ...profile.moduleReviews]) {
      const key = entry.tag ? { scope: 'member', tag: entry.tag, kind: entry.kind, name: entry.name }
        : { scope: 'export', kind: entry.kind, module: entry.module ?? null, name: entry.name };
      if (X_CASES.some(item => compatibilityKey(item.key) === compatibilityKey(key))) entry.removedIn = '23.0.0';
    }
  }
  const contract = buildMigrationContract(inventory, { lyraVersion: '23.0.0' });
  for (const item of [...selectMigrationCases(source, '23.0.0'), { ...RETAINED_ROOT, id: 'retained-root', record: source.records[compatibilityKey(RETAINED_ROOT.key)] }]) {
    const file = `${item.id}.${item.key.scope === 'member' ? 'html' : 'ts'}`;
    for (const origin of ['lyra-v21', 'lyra-v22']) {
      const result = migrateText(item.input, contract, { file, origin });
      const expected = (origin === 'lyra-v21') === (item.id !== 'retained-root') ? [{ ...item, file }] : [];
      assert.equal(result.content, item.input);
      assert.equal(result.warnings.length, expected.reduce((sum, entry) => sum + 1 + (entry.additionalReviews?.length ?? 0), 0), `${item.id}/${origin}: ${JSON.stringify(result.warnings)}`);
      assertMigrationReport({ schemaVersion: 1, origin, changes: result.changes, warnings: result.warnings,
        filesChanged: 0, summary: { rewrites: result.changes.length, warnings: result.warnings.length, acknowledged: result.acknowledged ?? 0 } }, expected, origin);
      if (item.id !== 'retained-root' || origin === 'lyra-v22') {
        const resolved = migrateText(item.resolved, contract, { file, origin });
        assert.equal(resolved.content, item.resolved);
        assert.deepEqual(resolved.changes, []);
        assert.deepEqual(resolved.warnings, []);
        assert.equal(resolved.acknowledged, item.id === 'retained-root' ? 1 : 0);
      }
    }
  }
});

test('browser fixture version mismatch fails before replacing the authored consumer entry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'packed-migration-entry-'));
  try {
    const packageDir = join(root, 'node_modules', '@aceshooting', 'lyra-ui');
    await mkdir(packageDir, { recursive: true }); await mkdir(join(root, 'src'));
    const entry = join(root, 'src', 'bundle-migratedX.ts'); await writeFile(entry, 'existing entry');
    const proof = { stage: 'exports-and-geojson', packageVersion: '23.0.0', coveredKeys: X_CASES.map(item => item.key) };
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ version: '22.0.0' }));
    await assert.rejects(writeResolvedMigrationEntry({ fixtureDir: root, proof }), /versions differ/u);
    assert.equal(await readFile(entry, 'utf8'), 'existing entry');
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({ version: '23.0.0' }));
    await writeResolvedMigrationEntry({ fixtureDir: root, proof });
    assert.match(await readFile(entry, 'utf8'), /LyraGeojsonView/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('member recipes cover exactly390 immutable identities and resolve every supported syntax kind', async () => {
  const { createMemberMigrationCases } = await import('./packed-migration-consumer-cases.mjs');
  const facts = JSON.parse(await readFile(new URL('../packages/lyra-ui/scripts/fixtures/compatibility-history/22.0.0/facts.json', import.meta.url), 'utf8'));
  const records = Object.fromEntries(facts.records.map(record => [compatibilityKey(record.key), record]));
  const cases = createMemberMigrationCases({ records, sourceComponents: Object.fromEntries(facts.components.map(component => [component.tag, component])) }, facts.renameLedger);
  assert.equal(cases.length, 390);
  assert.equal(new Set(cases.map(item => compatibilityKey(item.key))).size, 390);
  for (const item of cases) { assert.notEqual(item.input, item.resolved); assert.ok(item.column > 0); }
  const avatarEvent = cases.find(item => item.key.tag === 'lr-avatar-group' && item.key.kind === 'event');
  assert.ok(avatarEvent?.input.includes('=${handler}>'), 'Lit event recipe keeps its handler placeholder literal');
  const polarity = cases.find(item => item.key.tag === 'lr-agent-run' && item.key.name === 'showCancel');
  assert.equal(polarity.automatic, false);
  assert.equal(polarity.resolved, "document.querySelector('lr-agent-run')!.withoutCancel = false;\n");
  const next = structuredClone(records); delete next[compatibilityKey(cases[0].key)];
  assert.throws(() => createMemberMigrationCases({ records: next, sourceComponents: Object.fromEntries(facts.components.map(component => [component.tag, component])) }, facts.renameLedger), /exactly390/u);
});

test('all390 member inputs have exact action witnesses in both scanner profiles and reviewed output is clean', async () => {
  const { createMemberMigrationCases, assertMemberMigrationReport } = await import('./packed-migration-consumer-cases.mjs');
  const { checkPublishedCompatibility } = await import('../packages/lyra-ui/scripts/check-published-compatibility.mjs');
  const { buildMigrationContract, migrateText } = await import('../packages/lyra-ui/scripts/migrate-wa.mjs');
  const { captures } = await checkPublishedCompatibility();
  const published = captures.find(capture => capture.facts.sourceVersion === '22.0.0');
  const records = Object.fromEntries(published.facts.records.map(record => [compatibilityKey(record.key), { ...record, state: 'retired', removedIn: '23.0.0' }]));
  const cases = createMemberMigrationCases({ records, sourceComponents: Object.fromEntries(published.facts.components.map(component => [component.tag, component])) }, published.facts.renameLedger);
  const inventory = structuredClone(published.publishedMigration);
  for (const entry of inventory.lyraRenames.profiles[0].reviews) entry.removedIn = '23.0.0';
  const contract = buildMigrationContract(inventory, { lyraVersion: '23.0.0' });
  for (const item of cases) for (const origin of ['lyra-v21', 'lyra-v22']) {
    const file = `${item.id}.${item.extension}`;
    const result = migrateText(item.input, contract, { file, origin });
    const report = { schemaVersion: 1, origin, ...result, filesChanged: Number(result.content !== item.input),
      summary: { rewrites: result.changes.length, warnings: result.warnings.length, acknowledged: result.acknowledged } };
    assertMemberMigrationReport(report, [{ ...item, file }], origin);
    assert.equal(result.content, origin === 'lyra-v21' && item.automatic ? item.resolved : item.input, `${item.id}/${origin}`);
    const resolved = migrateText(item.resolvedByOrigin?.[origin] ?? item.resolved, contract, { file, origin });
    assert.deepEqual(resolved.changes, [], `${item.id}/${origin}`);
    assert.deepEqual(resolved.warnings, [], `${item.id}/${origin}`);
  }
});

test('full member stage remains off until all390 are retired and rejects changed cohort identity', async () => {
  const { createMemberMigrationCases, selectMemberMigrationStage } = await import('./packed-migration-consumer-cases.mjs');
  const facts = JSON.parse(await readFile(new URL('../packages/lyra-ui/scripts/fixtures/compatibility-history/22.0.0/facts.json', import.meta.url), 'utf8'));
  const records = Object.fromEntries(facts.records.map(record => [compatibilityKey(record.key), { ...record, state: 'current' }]));
  const source = { records, sourceComponents: Object.fromEntries(facts.components.map(component => [component.tag, component])) }; const cases = createMemberMigrationCases(source, facts.renameLedger);
  assert.equal(selectMemberMigrationStage(source, cases), 'exports-and-geojson');
  for (const item of cases) { item.record.state = 'retired'; item.record.removedIn = '23.0.0'; }
  assert.equal(selectMemberMigrationStage(source, cases), 'all-retirements');
  cases[0].record.removedIn = '24.0.0'; assert.throws(() => selectMemberMigrationStage(source, cases));
  cases[0].record.removedIn = '23.0.0';
  records.orphan = { key: { scope: 'member', tag: 'lr-new', kind: 'property', name: 'old' }, policy: { removalNotBefore: '23.0.0' } };
  assert.throws(() => selectMemberMigrationStage(source, cases), /cohort/u);
});

test('member action witness rejects orphan diagnostics, changed source spans and false automatic success', async () => {
  const { assertMemberMigrationReport } = await import('./packed-migration-consumer-cases.mjs');
  const item = { id: 'input', file: 'input.ts', column: 42, automatic: true, reportedTag: 'lr-agent-run',
    key: { scope: 'member', tag: 'lr-agent-run', kind: 'property', name: 'old' }, rule: { to: 'canonical' } };
  const baseline = { schemaVersion: 1, origin: 'lyra-v21', filesChanged: 1,
    summary: { rewrites: 1, warnings: 0, acknowledged: 0 }, warnings: [], changes: [{ file: item.file,
      line: 1, column: 42, origin: 'lyra-v21', upstreamTag: 'lr-agent-run', upstreamMember: 'old',
      action: 'rewrite-property', target: 'canonical', warningCode: null }] };
  assertMemberMigrationReport(baseline, [item], 'lyra-v21');
  for (const mutate of [r => r.changes[0].column++, r => r.changes[0].target = 'other',
    r => r.warnings.push({}), r => r.filesChanged = 0, r => r.summary.acknowledged++,
    r => r.changes.push({ ...r.changes[0] }), r => r.changes[0].upstreamTag = 'lr-other']) {
    const next = structuredClone(baseline); mutate(next);
    assert.throws(() => assertMemberMigrationReport(next, [item], 'lyra-v21'));
  }
});

test('browser proof rejects incomplete, duplicate or unknown stages', async () => {
  const { assertBrowserProof } = await import('./packed-migration-consumer.mjs');
  const keys = X_CASES.map(item => item.key);
  assertBrowserProof({ stage: 'exports-and-geojson', coveredKeys: keys });
  assert.throws(() => assertBrowserProof({ stage: 'all-retirements', coveredKeys: keys }));
  assert.throws(() => assertBrowserProof({ stage: 'exports-and-geojson', coveredKeys: [...keys.slice(1), keys[1]] }));
  assert.throws(() => assertBrowserProof({ stage: 'complete', coveredKeys: keys }));
});

test('typed recipes preserve non-boolean data and use dimensionally valid CSS values', async () => {
  const { createMemberMigrationCases } = await import('./packed-migration-consumer-cases.mjs');
  const facts = JSON.parse(await readFile(new URL('../packages/lyra-ui/scripts/fixtures/compatibility-history/22.0.0/facts.json', import.meta.url), 'utf8'));
  const source = { records: Object.fromEntries(facts.records.map(record => [compatibilityKey(record.key), record])),
    sourceComponents: Object.fromEntries(facts.components.map(component => [component.tag, component])) };
  const cases = createMemberMigrationCases(source, facts.renameLedger);
  const get = (tag, name) => cases.find(item => item.key.tag === tag && item.key.name === name);
  assert.equal(get('lr-chat-message', 'actionsPosition').resolved, "document.querySelector('lr-chat-message')!.actionsPlacement = 'outside';\n");
  assert.equal(get('lr-graph', 'links').resolved, "document.querySelector('lr-graph')!.edges = [{ id: 'ab', source: 'a', target: 'b' }];\n");
  assert.match(get('lr-graph', 'selectedLinkIds').resolved, /selectedEdgeIds = \['ab'\]/u);
  assert.match(get('lr-confirm-bar', 'pending').resolved, /pendingAction = 'approve'/u);
  assert.match(get('lr-button', '--lr-button-hover-background').resolved, /rgb\(12, 34, 56\)/u);
  assert.match(get('lr-typing-indicator', '--lr-typing-duration').resolved, /120ms/u);
  assert.match(get('lr-sparkline', '--lr-sparkline-stroke-width').resolved, /3px/u);
  source.sourceComponents['lr-graph'].surface.properties.find(property => property.name === 'links').type = 'UnexpectedGraphShape';
  assert.throws(() => createMemberMigrationCases(source, facts.renameLedger), /No reviewed typed value/u);
});

test('preserves exact packed bytes and inventory before temporary fixtures disappear', async () => {
  const { preservePackedTarball } = await import('./packed-migration-consumer.mjs');
  assert.equal(typeof preservePackedTarball, 'function');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execute = promisify(execFile);
  const root = await mkdtemp(join(tmpdir(), 'packed-evidence-'));
  try {
    const source = join(root, 'source');
    await mkdir(join(source, 'package'), { recursive: true });
    const manifest = JSON.stringify({ name: '@test/fixture', version: '1.0.0' });
    await writeFile(join(source, 'package', 'package.json'), manifest);
    await writeFile(join(source, 'package', 'spaced file.txt'), 'hello');
    const tarball = join(root, 'fixture.tgz');
    await execute('tar', ['-czf', tarball, '-C', source, 'package']);
    const original = await readFile(tarball);
    const artifactsDir = join(root, 'evidence');
    const receipt = await preservePackedTarball({ tarballPath: tarball, artifactsDir });
    assert.equal(receipt.name, '@test/fixture');
    assert.equal(receipt.version, '1.0.0');
    assert.equal(receipt.packedBytes, original.length);
    assert.equal(receipt.unpackedBytes, Buffer.byteLength(manifest) + 5);
    assert.equal(receipt.fileCount, 2);
    assert.deepEqual(receipt.files.map(file => file.path).sort(), ['package/package.json', 'package/spaced file.txt']);
    assert.deepEqual(await preservePackedTarball({ tarballPath: tarball, artifactsDir }), receipt);
    await writeFile(join(source, 'package', 'spaced file.txt'), 'changed');
    await execute('tar', ['-czf', tarball, '-C', source, 'package']);
    await assert.rejects(preservePackedTarball({ tarballPath: tarball, artifactsDir }), /different bytes/u);
    await rm(source, { recursive: true });
    await rm(tarball);
    assert.deepEqual(await readFile(join(artifactsDir, 'fixture.tgz')), original);
    assert.deepEqual(JSON.parse(await readFile(join(artifactsDir, 'fixture.tgz.json'), 'utf8')), receipt);
    assert.doesNotMatch(JSON.stringify(receipt), new RegExp(root.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
