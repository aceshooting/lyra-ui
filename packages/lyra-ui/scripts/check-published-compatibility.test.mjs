import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPublishedCompatibility, checkPublishedCompatibilitySync, readCurrentCompatibilityContext } from './check-published-compatibility.mjs';
import { decodeCaptureEvidence, decodeEvidence, encodeEvidence, sha256, jsonBytes, validatePublishedCapture } from './published-compatibility-io.mjs';

import { commitSourceWritePlan } from './source-fixture-io.mjs';
import { readComponentMetadataSources, assembleComponentMetadata, createComponentMetadataWritePlan, commitComponentMetadataWritePlan } from './component-metadata-source.mjs';

const directory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/compatibility-history');

test('reviewed capture verifies hermetically and preserves exact published profiles', async () => {
  const result = await checkPublishedCompatibility(directory);
  const { capture, facts, publishedMigration } = result.captures.find(entry => entry.capture.sourceVersion === '22.0.0');
  assert.equal(capture.sourceVersion, '22.0.0');
  assert.equal(capture.git.commit, 'cc29151f1c0a4deb2d0dbf03623115e7d56cef9e');
  assert.deepEqual(publishedMigration.lyraRenames.profiles.map(profile => [profile.origin, profile.toMajor]), [['lyra-v21', 22], ['lyra-v22', 23]]);
  assert.ok(facts.records.some(entry => entry.policy.since === '21.1.0'));
});

test('re-extraction rejects changed facts, unrelated input and invalid input/schema identities', async () => {
  const root = join(directory, '22.0.0');
  const capture = JSON.parse(await readFile(join(root, 'capture.json'), 'utf8'));
  const facts = JSON.parse(await readFile(join(root, 'facts.json'), 'utf8'));
  const archive = decodeEvidence(await readFile(join(root, 'evidence.json.gz')));
  const editedFacts = structuredClone(facts);
  editedFacts.records[0].policy.rationale = 'Changed publication';
  assert.throws(() => validatePublishedCapture({ ...capture, factsSha256: sha256(jsonBytes(editedFacts)) }, editedFacts, archive), /facts differ/u);
  for (const mutate of [
    (c, a) => { a.payloads.extra = ''; },
    c => { c.inputs[0].path = '../package.json'; },
    c => { c.extractorVersion = 99; },
    c => { c.sourceVersion = '23.0.0'; },
    c => { c.inputs.push(structuredClone(c.inputs[0])); },
  ]) {
    const c = structuredClone(capture); const a = structuredClone(archive); mutate(c, a);
    assert.throws(() => validatePublishedCapture(c, facts, a));
  }
});

test('reviewed descriptor/archive pins fail closed before accepting changed evidence', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lyra-compatibility-'));
  try {
    await cp(directory, temp, { recursive: true });
    const root = join(temp, '22.0.0');
    const archive = decodeEvidence(await readFile(join(root, 'evidence.json.gz')));
    archive.schemaVersion = 99;
    await writeFile(join(root, 'evidence.json.gz'), encodeEvidence(archive));
    await assert.rejects(checkPublishedCompatibility(temp), /archive hash mismatch/u);
    const descriptor = JSON.parse(await readFile(join(root, 'capture.json'), 'utf8'));
    descriptor.evidenceArchiveSha256 = sha256(encodeEvidence(archive));
    await writeFile(join(root, 'capture.json'), jsonBytes(descriptor));
    await assert.rejects(checkPublishedCompatibility(temp), /reviewed index pin/u);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('actual source retirement partition agrees with verified history and preserves protected policies', async () => {
  const { compatibilityKey } = await import('./published-compatibility.mjs');
  const verified = await checkPublishedCompatibility(directory);
  const retired = new Set(verified.retirements.map(entry => compatibilityKey(entry.key)));
  const initialRetirements = [
    ['member', 'lr-geojson-view', 'component', 'lr-geojson-view'],
    ['export', 'entry-point', null, './components/lr-geojson-view.js'],
    ['export', 'entry-point', null, './components/viewers/geojson-view/geojson-view.class.js'],
    ['export', 'entry-point', null, './components/viewers/geojson-view/geojson-view.js'],
    ['export', 'entry-point', null, './utilities/localization.js'],
    ['export', 'type', './components/retrieval/graph/graph.class.js', 'LyraGraphLink'],
    ['export', 'type', './components/viewers/document-viewer/registry.js', 'DocumentFile'],
    ['export', 'type', './components/viewers/document-viewer/registry.js', 'DocumentRendererDefinition'],
    ['export', 'type', './components/viewers/geojson-view/geojson-view.class.js', 'LyraGeojsonViewEventMap'],
  ];
  for (const key of initialRetirements) assert.ok(retired.has(JSON.stringify(key)), `retired ${JSON.stringify(key)}`);
  const facts = verified.captures.find(entry => entry.capture.sourceVersion === '22.0.0').facts;
  const previousCohort = facts.records
    .filter(entry => entry.policy.removalNotBefore === '23.0.0')
    .map(entry => compatibilityKey(entry.key));
  const latestFacts = verified.captures.find(entry => entry.capture.sourceVersion === '23.0.0').facts;
  const currentCohort = latestFacts.records
    .filter(entry => entry.policy.removalNotBefore === '24.0.0')
    .map(entry => compatibilityKey(entry.key));
  assert.equal(previousCohort.length, 399);
  assert.equal(currentCohort.length, 654);
  assert.deepEqual([...retired].sort(), [...previousCohort, ...currentCohort].sort(),
    'The complete published removal cohorts must retire together');
  assert.equal(latestFacts.records.length - currentCohort.length, 8,
    'All published upstream holds must survive');
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const context = await readCurrentCompatibilityContext(packageRoot);
  const historicalKeys = new Set(verified.captures.flatMap(entry => entry.facts.records.map(record => compatibilityKey(record.key))));
  assert.deepEqual(Object.keys(context.records).sort(), [...historicalKeys].sort());
  for (const published of verified.captures.flatMap(entry => entry.facts.records)) {
    const key = compatibilityKey(published.key);
    assert.equal(context.records[key].state, retired.has(key) ? 'retired' : 'current', key);
    assert.deepEqual(context.records[key].policy, published.policy, key);
    if (!retired.has(key)) assert.equal(context.records[key].state, 'current', key);
  }
});

test('immutable 22 source retains every published policy independently of current retirements', async () => {
  const { assembleCompatibilityContext } = await import('./published-compatibility.mjs');
  const { capture, facts } = (await checkPublishedCompatibility(directory)).captures.find(entry => entry.capture.sourceVersion === '22.0.0');
  const archive = decodeEvidence(await readFile(join(directory, '22.0.0/evidence.json.gz')));
  const input = role => JSON.parse(Buffer.from(archive.payloads[capture.inputs.find(entry => entry.origin === 'source' && entry.role === role).sha256], 'base64'));
  const context = assembleCompatibilityContext({ packageVersion: capture.sourceVersion, currentInventory: input('inventory'),
    currentExportDeprecations: input('metadata').exportDeprecations, captures: [facts], retirementIndex: [] });
  assert.ok(Object.values(context.records).every(record => record.state === 'current'));
});

test('published eligible cohort remains migratable after simulated 23 source removals without changing profile actions', async () => {
  const { assembleCompatibilityContext, policyKey, compatibilityKey } = await import('./published-compatibility.mjs');
  const { emptyRenameLedger, projectRenameLedger, validateRenameLedger } = await import('./lyra-rename-ledger.mjs');
  const { buildLyraRenameReference } = await import('./build-llms.mjs');
  const { buildMigrationContract, migrateText } = await import('./migrate-wa.mjs');
  const root = join(directory, '22.0.0');
  const capture = JSON.parse(await readFile(join(root, 'capture.json'), 'utf8'));
  const archive = decodeEvidence(await readFile(join(root, 'evidence.json.gz')));
  const input = role => JSON.parse(Buffer.from(archive.payloads[capture.inputs.find(entry => entry.origin === 'source' && entry.role === role).sha256], 'base64'));
  const metadata = input('metadata'); const original = input('inventory'); const ledger = input('renameLedger');
  ledger.profiles.push(emptyRenameLedger().profiles.find(profile => profile.origin === 'lyra-v25'));
  const facts = (await checkPublishedCompatibility(directory)).captures.find(entry => entry.capture.sourceVersion === '22.0.0').facts;
  const candidate = structuredClone(original);
  const eligible = facts.records.filter(entry => entry.policy.removalNotBefore === '23.0.0');
  const sections = { property: 'properties', attribute: 'attributes', event: 'events', part: 'parts', 'css-property': 'cssProperties', slot: 'slots', method: 'methods', 'css-state': 'cssStates' };
  const retired = new Set(eligible.map(entry => compatibilityKey(entry.key)));
  for (const { key, policy } of eligible) {
    if (key.scope !== 'member') continue;
    const owner = candidate.components.find(component => component.tag === key.tag);
    if (key.kind === 'component') { candidate.components = candidate.components.filter(component => component !== owner); continue; }
    if (!owner) continue;
    owner.maturity.deprecations = owner.maturity.deprecations.filter(record => compatibilityKey(policyKey(record)) !== compatibilityKey(key));
    if (sections[key.kind]) owner.surface[sections[key.kind]] = owner.surface[sections[key.kind]].filter(member => member.name !== key.name);
    if (policy.attribute) owner.surface.attributes = owner.surface.attributes.filter(member => member.name !== policy.attribute);
  }
  const exports = metadata.exportDeprecations.filter(policy => !retired.has(compatibilityKey(policyKey(policy, 'export'))));
  const exportSurface = new Map();
  for (const { key, policy } of facts.records.filter(entry => entry.key.scope === 'export')) {
    if (!retired.has(compatibilityKey(key))) exportSurface.set(compatibilityKey(key), { key, deprecated: true });
    const replacement = { ...policy.replacement, module: policy.replacement.module ?? policy.module };
    const next = policyKey(replacement, 'export');
    exportSurface.set(compatibilityKey(next), { key: next, deprecated: false });
  }
  const context = assembleCompatibilityContext({ packageVersion: '23.0.0', currentInventory: candidate, currentExportDeprecations: exports,
    currentExportSurface: [...exportSurface.values()], captures: [facts], retirementIndex: eligible.map(entry => ({ key: entry.key, removedIn: '23.0.0', sourceRelease: facts.sourceRelease })) });
  assert.deepEqual(validateRenameLedger(ledger, { inventory: candidate, exportDeprecations: exports, compatibilityContext: context, requireCoverage: true }), []);
  const oldProjection = projectRenameLedger(ledger, original, { exportDeprecations: metadata.exportDeprecations });
  const newProjection = projectRenameLedger(ledger, candidate, { exportDeprecations: exports, compatibilityContext: context });
  for (const profile of newProjection.profiles) for (const list of ['reviews', 'moduleReviews']) for (const entry of profile[list]) delete entry.removedIn;
  assert.deepEqual(newProjection, oldProjection);
  assert.equal(Object.values(context.records).filter(entry => entry.state === 'retired').length, eligible.length);
  const docs = buildLyraRenameReference(ledger, candidate, { exportDeprecations: exports, compatibilityContext: context }).join('\n');
  assert.match(docs, /Removed aliases no longer work at runtime/u);
  assert.match(docs, /Removed in 23\.0\.0/u);
  assert.ok(docs.includes('LyraGeoJsonViewerEventMap'));
  const beforeContract = buildMigrationContract(original, { renameLedger: ledger, exportDeprecations: metadata.exportDeprecations });
  const afterContract = buildMigrationContract(candidate, { renameLedger: ledger, exportDeprecations: exports, compatibilityContext: context });
  const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/lyra-renames');
  const sample = await readFile(join(fixtureRoot, 'lyra-v21.input.html'), 'utf8');
  const probe = text => {
    const before = migrateText(text, beforeContract, { file: 'consumer.html', origin: 'lyra-v21' });
    const after = migrateText(text, afterContract, { file: 'consumer.html', origin: 'lyra-v21' });
    assert.equal(after.content, before.content);
    assert.deepEqual(after.changes, before.changes);
    const identities = result => result.warnings.map(({ message, ...warning }) => warning);
    assert.deepEqual(identities(after), identities(before));
  };
  probe(sample);
  probe(`<lr-geojson-view><lr-button></lr-button></lr-geojson-view>
    <lr-graph exportparts="link:edge"></lr-graph>
    <style>:root { --lr-graph-background: red; } lr-graph::part(link) { color: red; }</style>
    <script>document.addEventListener('lr-link-click', listener); document.removeEventListener('lr-link-click', listener);</script>`);

});

test('published notice witnesses use actual minor releases and reject gaps or unreviewed guidance edits', async () => {
  const { verifyPolicyWitnesses } = await import('./published-compatibility-io.mjs');
  const verified = await checkPublishedCompatibility(directory);
  const key = JSON.stringify(['member', 'lr-activity-feed', 'property', 'compact']);
  assert.equal(verified.observedPublication[key], '21.2.0');
  const index = JSON.parse(await readFile(join(directory, 'index.json'), 'utf8'));
  const witnesses = decodeEvidence(await readFile(join(directory, index.policyWitnesses.file)));
  const gap = structuredClone(witnesses); gap.releases.pop();
  assert.throws(() => verifyPolicyWitnesses(gap, verified.captures, index.guidanceTransitions), /Missing immutable policy witness/u);
  assert.throws(() => verifyPolicyWitnesses(witnesses, verified.captures, []), /Unreviewed published guidance transition/u);
  const changed = structuredClone(witnesses); changed.releases[0].input.data = Buffer.from('{}').toString('base64');
  assert.throws(() => verifyPolicyWitnesses(changed, verified.captures, index.guidanceTransitions), /source bytes disagree/u);
});

test('configured repository history cannot silently become an empty compatibility authority', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lyra-empty-history-'));
  try {
    await writeFile(join(temp, 'index.json'), jsonBytes({ schemaVersion: 1, captures: [], retirements: [] }));
    await assert.rejects(checkPublishedCompatibility(temp), /compatibility index/u);
  } finally { await rm(temp, { recursive: true, force: true }); }
});


test('ordinary verification works outside a checkout with no Git executable or fetch capability', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lyra-offline-history-'));
  try {
    const moduleUrl = new URL('./check-published-compatibility.mjs', import.meta.url).href;
    const code = `globalThis.fetch = () => { throw new Error('network forbidden'); }; const { checkPublishedCompatibility } = await import(process.env.LYRA_COMPATIBILITY_MODULE_URL); await checkPublishedCompatibility();`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: temp, env: { ...process.env, PATH: '', LYRA_COMPATIBILITY_MODULE_URL: moduleUrl }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } finally { await rm(temp, { recursive: true, force: true }); }
});


test('historical class aliases come from the exact verified published policy and declaration identities', async () => {
  const verified = await checkPublishedCompatibility(directory);
  const capture = verified.captures.find(entry => entry.capture.sourceVersion === '22.0.0');
  const alias = verified.classAliases.find(entry => entry.sourceRelease === 'lyra-ui@22.0.0' && entry.source.tag === 'lr-geojson-view');
  assert.deepEqual(alias.source, { module: 'src/components/viewers/geojson-view/geojson-view.class.ts', name: 'LyraGeojsonView', tag: 'lr-geojson-view' });
  assert.deepEqual(alias.replacement, { module: 'src/components/viewers/geojson-view/geojson-viewer.class.ts', name: 'LyraGeoJsonViewer', tag: 'lr-geojson-viewer' });
  assert.deepEqual(alias.policy, capture.facts.records.find(entry => entry.key.scope === 'member' && entry.key.kind === 'component' && entry.key.tag === alias.source.tag).policy);
  const expectedInputs = ['index.json', 'policy-witnesses.json.gz', ...verified.captures.flatMap(entry =>
    ['capture.json', 'facts.json', 'evidence.json.gz'].map(file => `${entry.capture.sourceVersion}/${file}`))];
  assert.deepEqual(verified.snapshots.map(entry => entry.file.slice(directory.length + 1)).sort(), expectedInputs.sort());
  assert.ok(verified.snapshots.every(entry => Buffer.isBuffer(entry.original)));
});

test('capture evidence archives remain bound to their descriptors during recursive history reads', async () => {
  const root = join(directory, '22.0.0');
  const capture = JSON.parse(await readFile(join(root, 'capture.json'), 'utf8'));
  const evidence = await readFile(join(root, 'evidence.json.gz'));
  assert.throws(() => decodeCaptureEvidence({ ...capture, evidenceArchiveSha256: '0'.repeat(64) }, evidence), /Evidence archive hash mismatch/u);
});

test('published 23 capture verifies pinned source-history context and rejects history omission or substitution', async () => {
  const root = join(directory, '23.0.0');
  const capture = JSON.parse(await readFile(join(root, 'capture.json'), 'utf8'));
  const facts = JSON.parse(await readFile(join(root, 'facts.json'), 'utf8'));
  const archive = decodeEvidence(await readFile(join(root, 'evidence.json.gz')));
  const verified = validatePublishedCapture(capture, facts, archive);
  assert.equal(verified.facts.sourceVersion, '23.0.0');
  assert.equal(verified.facts.records.length, 662);
  assert.equal(verified.publishedMigration.lyraRenames.profiles.length, 2);
  const withoutIndex = structuredClone(capture);
  const indexInput = withoutIndex.inputs.findIndex(input => input.origin === 'source-history' && input.path.endsWith('/index.json'));
  assert.notEqual(indexInput, -1);
  withoutIndex.inputs.splice(indexInput, 1);
  assert.throws(() => validatePublishedCapture(withoutIndex, facts, structuredClone(archive)), /unrelated payload|history|evidence input/u);
  const substituted = structuredClone(capture);
  const historicalCapture = substituted.inputs.find(input => input.origin === 'source-history' && input.path.endsWith('/22.0.0/capture.json'));
  assert.ok(historicalCapture);
  historicalCapture.path = historicalCapture.path.replace('/22.0.0/', '/23.0.0/');
  assert.throws(() => validatePublishedCapture(substituted, facts, structuredClone(archive)), /incomplete|inventory|Git path|history/u);
});

test('every historical authority input remains guarded until a prepared fixture write commits', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lyra-guarded-history-'));
  try {
    await cp(directory, temp, { recursive: true });
    const verified = checkPublishedCompatibilitySync(temp);
    const output = join(temp, 'output.json');
    await writeFile(output, 'original');
    const entries = [...verified.snapshots.map(entry => ({ ...entry, expected: entry.original })),
      { file: output, original: 'original', expected: 'updated' }];
    for (const snapshot of verified.snapshots) {
      const edited = Buffer.from(snapshot.original);
      edited[edited.length - 1] ^= 1;
      await writeFile(snapshot.file, edited);
      assert.throws(() => commitSourceWritePlan({ root: temp, entries }), /changed while/);
      assert.equal(await readFile(output, 'utf8'), 'original');
      await writeFile(snapshot.file, snapshot.original);
    }
    commitSourceWritePlan({ root: temp, entries });
    assert.equal(await readFile(output, 'utf8'), 'updated');
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('the partition metadata write transaction rejects changed historical authority before any writes', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'lyra-metadata-history-'));
  try {
    const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    await cp(join(packageRoot, 'scripts/fixtures'), join(temp, 'scripts/fixtures'), { recursive: true });
    await cp(join(packageRoot, 'scripts/component-families.json'), join(temp, 'scripts/component-families.json'));
    const sources = readComponentMetadataSources(temp);
    const metadata = assembleComponentMetadata(sources);
    const verified = checkPublishedCompatibilitySync(join(temp, 'scripts/fixtures/compatibility-history'));
    // Force a real pending output change; a rejected no-op would not prove transaction ordering.
    metadata.policy.deprecation.minimumFullMajorsAfterDeprecation += 1;
    const plan = createComponentMetadataWritePlan(sources, metadata, { guards: verified.snapshots });
    assert.ok(plan.entries.some(entry => typeof entry.original === 'string' && entry.original !== entry.expected));
    const evidence = verified.snapshots.find(entry => entry.file.endsWith('/22.0.0/evidence.json.gz'));
    const changed = Buffer.from(evidence.original); changed[changed.length - 1] ^= 1;
    await writeFile(evidence.file, changed);
    assert.throws(() => commitComponentMetadataWritePlan(plan), /changed while/);
    for (const snapshot of sources.snapshots) {
      const actual = await readFile(snapshot.file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      assert.equal(actual, snapshot.original, snapshot.file);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});
