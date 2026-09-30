import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { X_CASES, RETAINED_ROOT } from '../packages/lyra-ui/scripts/fixtures/lyra-renames/consumer/x-cases.mjs';
import { compatibilityKey } from '../packages/lyra-ui/scripts/published-compatibility.mjs';
import { assertInstalledMigrationBanner, assertInstalledRetainedField, createV24SemanticMigrationCases, selectMigrationCases, assertMigrationReport, assertBrowserProof, runMigrationProcess, verifyPackedMigrationConsumers, writeResolvedMigrationEntry } from './packed-migration-consumer.mjs';

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
test('migration CLI banners bind the exact installed version in every later release', () => {
  const banner = version => `Applying entries available in @aceshooting/lyra-ui ${version}.\n`;
  for (const version of ['23.0.0', '24.2.0', '25.0.0', '26.1.2']) {
    assert.doesNotThrow(() => assertInstalledMigrationBanner(banner(version), version));
    assert.doesNotThrow(() => assertInstalledMigrationBanner(`Applying entries available in @aceshooting/lyra-ui ${version}; 1 entry needs a later release.\n`, version));
    assert.doesNotThrow(() => assertInstalledMigrationBanner(`Applying entries available in @aceshooting/lyra-ui ${version}; 2 entries need a later release.\n`, version));
  }
  for (const output of [banner('24.0.0'), banner('25.0.1'), banner('25.0.00'), banner('25.0.0') + banner('25.0.0'),
    'Applying entries available in @aceshooting/lyra-ui 25.0.0garbage.\n',
    'No installed @aceshooting/lyra-ui found under the working directory; applying every entry of the profile.\n', '']) {
    assert.throws(() => assertInstalledMigrationBanner(output, '25.0.0'));
  }
});
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
test('actual v24 module diagnostics require exact removed-in-24 wording', () => {
  const item = { id: 'removed-theme-function', key: { scope: 'export', kind: 'function', module: './theme.js', name: 'setLyraTheme' },
    file: 'migration-v24/p22-input/removed-theme-function.ts', column: 15,
    record: { state: 'retired', removedIn: '24.0.0', policy: { replacement: { usage: 'setLyraStyle with independent choices' } } } };
  const result = { schemaVersion: 1, origin: 'lyra-v22', changes: [], filesChanged: 0,
    summary: { rewrites: 0, warnings: 1, acknowledged: 0 }, warnings: [{
      file: item.file, line: 1, column: item.column, origin: 'lyra-v22', upstreamTag: null,
      upstreamMember: item.key.name, action: 'manual-review', warningCode: 'DEPRECATED_MODULE_REVIEW',
      target: item.record.policy.replacement.usage, message: 'function ./theme.js#setLyraTheme was removed in 24.0.0; review it.',
    }] };
  assertMigrationReport(result, [item], 'lyra-v22');
  result.warnings[0].message = 'function ./theme.js#setLyraTheme was removed in 23.0.0; review it.';
  assert.throws(() => assertMigrationReport(result, [item], 'lyra-v22'));
});
test('v24 retirement cohorts retain exact identities in v24 and later installed releases', async () => {
  const { createV24ExportMigrationCases, createV24MemberMigrationCases } = await import('./packed-migration-consumer-cases.mjs');
  const source = context();
  source.packageVersion = '24.0.0';
  const root = source.records[compatibilityKey(RETAINED_ROOT.key)];
  root.state = 'retired'; root.removedIn = '24.0.0';
  for (let index = 0; index < 609; index += 1) {
    const key = { scope: 'export', kind: 'entry-point', name: `./fixture/${index}.js` };
    source.records[compatibilityKey(key)] = { key, state: 'retired', removedIn: '24.0.0', policy: { removalNotBefore: '24.0.0', replacement: { name: './components/lr-fixture.js', usage: "import '@aceshooting/lyra-ui/components/lr-fixture.js';" } } };
  }
  for (let index = 0; index < 44; index += 1) {
    const tag = `lr-fixture-${index}`;
    const key = { scope: 'member', tag, kind: 'event', name: `lr-old-${index}` };
    source.records[compatibilityKey(key)] = { key, state: 'retired', removedIn: '24.0.0', policy: { removalNotBefore: '24.0.0', replacement: { name: `lr-new-${index}`, usage: `Use ${tag}.${`lr-new-${index}`} after review.` } } };
  }
  assert.equal(selectMigrationCases(source, '24.0.0').length, 9);
  assert.equal(createV24ExportMigrationCases(source).length, 610);
  const syntheticLedger = { profiles: [{ origin: 'lyra-v22', renames: [], reviews: Object.values(source.records)
    .filter(record => record.key.scope === 'member' && record.policy.removalNotBefore === '24.0.0')
    .map(record => ({ tag: record.key.tag, kind: record.key.kind, name: record.key.name })) }] };
  assert.equal(createV24MemberMigrationCases(source, syntheticLedger).length, 44);
  const exports = createV24ExportMigrationCases(source);
  const members = createV24MemberMigrationCases(source, syntheticLedger);
  for (const packageVersion of ['24.0.0', '24.2.0', '25.0.0', '26.1.2', '100.0.0']) {
    const candidate = { ...source, packageVersion };
    assert.equal(selectMigrationCases(candidate, packageVersion).length, 9);
    assert.deepEqual(createV24ExportMigrationCases(candidate), exports, packageVersion);
    assert.deepEqual(createV24MemberMigrationCases(candidate, syntheticLedger), members, packageVersion);
    for (const build of [
      context => createV24ExportMigrationCases(context),
      context => createV24MemberMigrationCases(context, syntheticLedger),
    ]) {
      const changed = structuredClone(candidate);
      const member = Object.values(changed.records).find(record => record.key.scope === 'member' && record.policy.removalNotBefore === '24.0.0');
      member.removedIn = '25.0.0';
      assert.throws(() => build(changed), /Unexpected v24 retirement/u);
      member.removedIn = '24.0.0'; member.state = 'current';
      assert.throws(() => build(changed), /did not retire/u);
      delete changed.records[compatibilityKey(member.key)];
      assert.throws(() => build(changed), /exactly/u);
    }
  }
  for (const packageVersion of ['22.0.0', '23.99.0', '24.0', '25', 'v25.0.0', '025.0.0', '25.00.0', '25.0.0-beta.1', '25.0.0+build', '999999999999999999.0.0', '', null]) {
    const candidate = { ...source, packageVersion };
    assert.throws(() => createV24ExportMigrationCases(candidate));
    assert.throws(() => createV24MemberMigrationCases(candidate, syntheticLedger));
  }
  assert.throws(() => selectMigrationCases(source, '23.0.0'));
  assert.throws(() => createV24ExportMigrationCases({ ...source, packageVersion: '23.0.0' }), /installed v24/u);
  assert.throws(() => createV24ExportMigrationCases({ ...source, records: Object.fromEntries(Object.entries(source.records).filter(([, item]) => item.policy.removalNotBefore !== '24.0.0')) }), /exactly654/u);
});
test('packed releases after v24 still dispatch the complete v24 retirement stage', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'packed-migration-stage-'));
  try {
    const packageDir = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui');
    await mkdir(packageDir, { recursive: true });
    for (const packageVersion of ['24.0.0', '25.0.0', '26.1.2']) {
      const source = context();
      source.packageVersion = packageVersion;
      const retained = source.records[compatibilityKey(RETAINED_ROOT.key)];
      retained.state = 'retired'; retained.removedIn = '24.0.0';
      await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name: '@aceshooting/lyra-ui', version: packageVersion }));
      // A structural-only fixture must fail the complete cohort check before any CLI runs.
      await assert.rejects(verifyPackedMigrationConsumers({ fixtureDir, compatibilityContext: source, tarballPath: join(fixtureDir, 'unused.tgz') }), /exactly654/u);
    }
  } finally { await rm(fixtureDir, { recursive: true, force: true }); }
});
test('the real v24 ledger identifies exactly two automatic member rewrites and checks their report witnesses', async () => {
  const { readCurrentCompatibilityContextSync } = await import('../packages/lyra-ui/scripts/check-published-compatibility.mjs');
  const { createV24ExportMigrationCases, createV24MemberMigrationCases } = await import('./packed-migration-consumer-cases.mjs');
  const context = readCurrentCompatibilityContextSync();
  const ledger = JSON.parse(await readFile(new URL('../packages/lyra-ui/scripts/fixtures/lyra-renames.json', import.meta.url), 'utf8'));
  const cases = createV24MemberMigrationCases(context, ledger);
  const automatic = cases.filter(item => item.automatic);
  assert.equal(cases.length, 44);
  assert.equal(automatic.length, 2);
  assert.deepEqual(cases.filter(item => item.sharedTargetReview).map(item => item.key.tag).sort(), [
    'lr-graph', 'lr-knowledge-graph-explorer', 'lr-markdown', 'lr-markdown-core', 'lr-message-parts',
  ]);
  assert.deepEqual(automatic.map(item => [item.key.tag, item.key.kind, item.key.name]).sort(), [
    ['lr-sequence-strip', 'attribute', 'accessible-label'],
    ['lr-table', 'attribute', 'accessible-label'],
  ].sort());
  const secondaryRoutes = createV24ExportMigrationCases(context).flatMap(item => item.additionalReviews.map(site => site.key.name));
  assert.deepEqual(secondaryRoutes.sort(), [
    './theme/presets.js', './theme/presets.js', './theme/presets.js',
    './theme/presets.js', './theme/presets.js', './theme/presets.js',
    './theme/presets/shadcn.js',
  ].sort());
  for (const item of automatic) assert.equal(item.applied, item.input.replace(item.key.name, item.rule.to));
  const auto = { ...automatic[0], file: 'input/automatic.ts' };
  const manual = { ...cases.find(item => !item.automatic && !item.rule), file: 'input/manual.ts' };
  const change = { file: auto.file, line: 1, column: auto.column, origin: 'lyra-v22', upstreamTag: auto.key.tag,
    upstreamMember: auto.key.name, action: `rewrite-${auto.key.kind}`, target: auto.rule.to, warningCode: null, message: 'canonical rewrite' };
  const warning = { file: manual.file, line: 1, column: manual.column, origin: 'lyra-v22', upstreamTag: manual.key.tag,
    upstreamMember: manual.key.name, action: 'manual-review', target: manual.record.policy.replacement.usage ?? manual.record.policy.replacement.name,
    warningCode: 'DEPRECATED_MEMBER_REVIEW', message: 'This member was removed in 24.0.0; review it.' };
  const report = { schemaVersion: 1, origin: 'lyra-v22', changes: [change], warnings: [warning], filesChanged: 1,
    summary: { rewrites: 1, warnings: 1, acknowledged: 0 } };
  assertMigrationReport(report, [auto, manual], 'lyra-v22');
  assert.throws(() => assertMigrationReport({ ...report, changes: [{ ...change, target: 'wrong' }] }, [auto, manual], 'lyra-v22'), /Expected values to be strictly equal/u);
  assert.throws(() => assertMigrationReport({ ...report, changes: [change, { ...change }] }, [auto, manual], 'lyra-v22'), /Missing or orphan automatic/u);
  assert.throws(() => assertMigrationReport({ ...report, warnings: [{ ...warning, action: 'rewrite-event' }] }, [auto, manual], 'lyra-v22'), /Expected values to be strictly equal/u);
});
test('all654 v24 sites and multiline semantics match the real scanner including acknowledgments', async () => {
  const { readCurrentCompatibilityContextSync } = await import('../packages/lyra-ui/scripts/check-published-compatibility.mjs');
  const { buildMigrationContract, migrateText } = await import('../packages/lyra-ui/scripts/migrate-wa.mjs');
  const { createV24ExportMigrationCases, createV24MemberMigrationCases } = await import('./packed-migration-consumer-cases.mjs');
  const context = readCurrentCompatibilityContextSync();
  const ledger = JSON.parse(await readFile(new URL('../packages/lyra-ui/scripts/fixtures/lyra-renames.json', import.meta.url), 'utf8'));
  const inventory = JSON.parse(await readFile(new URL('../packages/lyra-ui/scripts/fixtures/component-inventory.json', import.meta.url), 'utf8'));
  const metadata = JSON.parse(await readFile(new URL('../packages/lyra-ui/scripts/fixtures/component-metadata.json', import.meta.url), 'utf8'));
  const contract = buildMigrationContract(inventory, { renameLedger: ledger, exportDeprecations: metadata.exportDeprecations,
    lyraVersion: '24.0.0', compatibilityContext: context });
  const cases = [...createV24ExportMigrationCases(context), ...createV24MemberMigrationCases(context, ledger)];
  assert.equal(cases.length, 654);
  let rewrites = 0; let warnings = 0; let acknowledged = 0;
  for (const item of cases) {
    const file = `input/${item.id}.${item.extension}`;
    const bound = { ...item, file };
    const result = migrateText(item.input, contract, { file, origin: 'lyra-v22' });
    const report = { schemaVersion: 1, origin: 'lyra-v22', changes: result.changes, warnings: result.warnings,
      filesChanged: Number(result.content !== item.input), summary: { rewrites: result.changes.length,
        warnings: result.warnings.length, acknowledged: result.acknowledged } };
    assert.equal(result.warnings.length, Number(!item.automatic) + (item.additionalReviews?.length ?? 0), item.id);
    assertMigrationReport(report, [bound], 'lyra-v22');
    assert.equal(result.content, item.applied ?? item.input, item.id);
    rewrites += result.changes.length; warnings += result.warnings.length;
    if (item.automatic) {
      const rerun = migrateText(result.content, contract, { file, origin: 'lyra-v22' });
      assert.deepEqual(rerun.changes, [], item.id);
      assert.deepEqual(rerun.warnings, [], item.id);
      continue;
    }
    const tokens = [item, ...(item.additionalReviews ?? [])].map(site => `${site.sharedTargetReview ? 'RENAME_TARGET_SHARED_REVIEW'
      : site.rule?.polarity === 'inverted' ? 'POLARITY_REVIEW'
        : site.key.scope === 'member' ? 'DEPRECATED_MEMBER_REVIEW' : 'DEPRECATED_MODULE_REVIEW'}:${site.key.name}`).join(' ');
    const comment = item.extension === 'html' ? `<!-- lyra-migrate-reviewed: ${tokens} -->\n`
      : item.extension === 'css' ? `/* lyra-migrate-reviewed: ${tokens} */\n`
        : `// lyra-migrate-reviewed: ${tokens}\n`;
    const reviewed = migrateText(`${comment}${item.input}`, contract, { file, origin: 'lyra-v22' });
    assert.deepEqual(reviewed.changes, [], item.id);
    assert.deepEqual(reviewed.warnings, [], item.id);
    assert.equal(reviewed.acknowledged, 1 + (item.additionalReviews?.length ?? 0), item.id);
    acknowledged += reviewed.acknowledged;
  }
  assert.deepEqual({ rewrites, warnings, acknowledged }, { rewrites: 2, warnings: 659, acknowledged: 659 });
  const source = await readFile(new URL('../packages/lyra-ui/scripts/fixtures/lyra-renames/consumer/v24-semantics.input.ts', import.meta.url), 'utf8');
  const file = 'semantic-input/v24-semantics.input.ts';
  const semanticCases = createV24SemanticMigrationCases(cases, source, file);
  const semantic = migrateText(source, contract, { file, origin: 'lyra-v22' });
  assertMigrationReport({ schemaVersion: 1, origin: 'lyra-v22', changes: semantic.changes, warnings: semantic.warnings,
    filesChanged: Number(semantic.content !== source), summary: { rewrites: semantic.changes.length,
      warnings: semantic.warnings.length, acknowledged: semantic.acknowledged } }, semanticCases, 'lyra-v22');
});
test('resolved v24 stylesheet imports use real canonical package exports', async () => {
  const resolved = await readFile(new URL('../packages/lyra-ui/scripts/fixtures/lyra-renames/consumer/v24-semantics.resolved.ts', import.meta.url), 'utf8');
  const packageJson = JSON.parse(await readFile(new URL('../packages/lyra-ui/package.json', import.meta.url), 'utf8'));
  const stylesheets = [...resolved.matchAll(/^import '@aceshooting\/lyra-ui\/([^']+\.css)';$/gmu)].map(match => `./${match[1]}`);
  assert.deepEqual(stylesheets, ['./theme.css', './looks/shadcn.css']);
  for (const route of stylesheets) assert.ok(Object.hasOwn(packageJson.exports, route), `Canonical stylesheet route is not exported: ${route}`);
});
test('field authority binds verified attachment facts, index pins and cross-release continuity', async () => {
  const { checkPublishedCompatibility } = await import('../packages/lyra-ui/scripts/check-published-compatibility.mjs');
  const { readPublishedFieldAttachmentSync } = await import('../packages/lyra-ui/scripts/published-field-compatibility-io.mjs');
  const { verifyPublishedFieldContinuity, REQUIRED_FIELD_RELEASES } = await import('../packages/lyra-ui/scripts/published-field-compatibility.mjs');
  const { verifyPublishedFieldAuthority } = await import('./packed-migration-consumer.mjs');
  const history = new URL('../packages/lyra-ui/scripts/fixtures/compatibility-history/', import.meta.url);
  const fieldDir = new URL('field-evidence/', history);
  const { captures } = await checkPublishedCompatibility();
  const attachments = REQUIRED_FIELD_RELEASES.map(release => {
    const version = release.slice('lyra-ui@'.length);
    return readPublishedFieldAttachmentSync(new URL(`${version}/`, fieldDir).pathname, new URL(`${version}/`, history).pathname);
  });
  const index = JSON.parse(await readFile(new URL('index.json', fieldDir), 'utf8'));
  const continuity = verifyPublishedFieldContinuity({ captures, attachments });
  const authority = { captures, attachments, index, continuity };
  const facts = verifyPublishedFieldAuthority(authority);
  assert.equal(facts.sourceRelease, 'lyra-ui@23.0.0');
  assert.equal(facts.declarations.length, 10); assert.equal(facts.exposures.length, 20);
  const tampered = structuredClone(authority);
  tampered.attachments.find(item => item.attachment.sourceRelease === 'lyra-ui@23.0.0').facts.declarations[0].notice += ' changed';
  assert.throws(() => verifyPublishedFieldAuthority(tampered), /facts bytes changed/u);
});
test('pre-removal candidate fields preserve the published shape and notice as separate facts', async () => {
  const published = JSON.parse(await readFile(new URL('../packages/lyra-ui/scripts/fixtures/compatibility-history/field-evidence/23.0.0/facts.json', import.meta.url), 'utf8'));
  assert.equal(published.declarations.length, 10);
  const body = (declaration) => {
    const { type, optional, readonly, notice } = declaration.deprecatedField;
    return `\n${notice}\n${readonly ? 'readonly ' : ''}${declaration.key.field}${optional ? '?' : ''}: ${type};\n`;
  };
  for (const declaration of published.declarations) {
    assert.doesNotThrow(() => assertInstalledRetainedField(body(declaration), declaration));
  }
  const sample = published.declarations[0];
  assert.throws(() => assertInstalledRetainedField(body(sample).replace('open:', 'open?:'), sample), /field shape changed/u);
  assert.throws(() => assertInstalledRetainedField(body(sample).replace('@deprecated', '@ordinary'), sample), /notice changed/u);
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
    key: { scope: 'member', tag: 'lr-agent-run', kind: 'property', name: 'old' }, rule: { to: 'canonical' },
    record: { policy: { removalNotBefore: '23.0.0' } } };
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
  const keys = X_CASES.map(item => item.key);
  assertBrowserProof({ stage: 'exports-and-geojson', coveredKeys: keys });
  assert.throws(() => assertBrowserProof({ stage: 'all-retirements', coveredKeys: keys }));
  assert.throws(() => assertBrowserProof({ stage: 'exports-and-geojson', coveredKeys: [...keys.slice(1), keys[1]] }));
  assert.throws(() => assertBrowserProof({ stage: 'complete', coveredKeys: keys }));
  assertBrowserProof({ stage: 'actual24', coveredKeys: Array.from({ length: 1053 }, (_value, index) => ({ scope: 'export', kind: 'type', module: '.', name: `M${index}` })) });
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
