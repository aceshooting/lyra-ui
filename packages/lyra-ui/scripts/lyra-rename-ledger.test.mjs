#!/usr/bin/env node

// The Lyra-to-Lyra rename ledger, its projection, and the `--origin=lyra-v21` profile of the
// migration CLI. The checked-in ledger starts empty, so every rewrite category is proven here
// against synthetic components (scripts/fixtures/lyra-renames/components.json) whose deprecated
// aliases and policy records mirror what a real v22 rename must ship.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { analyzeRenameLedger } from './check-migration-coverage.mjs';
import { buildLyraRenameReference } from './build-llms.mjs';
import {
  LYRA_RENAME_ORIGINS,
  createRenameProfiles,
  emptyRenameLedger,
  emptyRenameProjection,
  mirroredMembers,
  projectRenameLedger,
  validateRenameLedger,
  validateRenameLedgerShape,
} from './lyra-rename-ledger.mjs';
import {
  MIGRATION_ORIGINS,
  buildMigrationContract,
  createMigrationRuntimeInventory,
  migrateFiles,
  migrateText,
  parseArgs,
  readRenameLedger,
  unifiedDiff,
} from './migrate-wa.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.dirname(scriptDir);
const fixtureDir = path.join(scriptDir, 'fixtures', 'lyra-renames');
const migratePath = path.join(scriptDir, 'migrate-wa.mjs');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fixture = (name) => fs.readFileSync(path.join(fixtureDir, name), 'utf8');

function syntheticInventory() {
  const inventory = readJson(path.join(scriptDir, 'fixtures', 'migrate-wa', 'inventory.json'));
  inventory.components.push(...readJson(path.join(fixtureDir, 'components.json')).components);
  return inventory;
}
function syntheticLedger() {
  return readJson(path.join(fixtureDir, 'ledger.json'));
}
const inventory = syntheticInventory();
const ledger = syntheticLedger();
const contract = buildMigrationContract(inventory, { renameLedger: ledger });
const expectedReports = readJson(path.join(fixtureDir, 'expected-reports.json'));
const checkedInventory = readJson(path.join(scriptDir, 'fixtures', 'component-inventory.json'));
const sharedTokens = new Set(Object.keys(readJson(path.join(packageDir, 'tokens', 'canonical-tokens.json')).tokens));

const describeChanges = (entries) => entries.map((entry) =>
  `${entry.line}:${entry.column} ${entry.action} ${entry.upstreamMember} -> ${entry.target}`);
const describeWarnings = (entries) => entries.map((entry) =>
  `${entry.line}:${entry.column} ${entry.warningCode} ${entry.upstreamMember}`);
const warningIdentity = (entries) => entries.map((entry) => `${entry.line} ${entry.warningCode} ${entry.upstreamMember}`);
const codesOf = (entries) => entries.map((entry) => `${entry.line} ${entry.warningCode}`);
const run = (text, file = 'probe.ts', runContract = contract) => migrateText(text, runContract, { file, origin: 'lyra-v21' });
const rename = (profile, kind, from) => profile.renames.find((entry) => entry.kind === kind && entry.from === from);
const panelOf = (target) => target.components.find((component) => component.tag === 'lr-sample-panel');

function mutated(edit, options = {}) {
  const copy = syntheticLedger();
  edit(copy.profiles[0], copy);
  return validateRenameLedger(copy, { inventory, ...options });
}
function assertFinding(findings, pattern) {
  assert.ok(findings.some((finding) => pattern.test(finding)), `${pattern}: ${JSON.stringify(findings)}`);
}

// ---------------------------------------------------------------------------------------------
// Ledger schema and cross-checks
// ---------------------------------------------------------------------------------------------

test('the checked-in ledger is valid and complete against the checked-in inventory', () => {
  const checkedLedger = readRenameLedger();
  assert.deepEqual(
    validateRenameLedger(checkedLedger, { inventory: checkedInventory, requireCoverage: true, sharedTokens }),
    [],
  );
  assert.deepEqual(checkedLedger.profiles.map((profile) => profile.origin), [...LYRA_RENAME_ORIGINS]);
  assert.deepEqual(LYRA_RENAME_ORIGINS, ['lyra-v21']);
  assert.ok(MIGRATION_ORIGINS.includes('lyra-v7') && MIGRATION_ORIGINS.includes('lyra-v21'));
  assert.deepEqual(validateRenameLedger(emptyRenameLedger(), { inventory: checkedInventory }), []);
});

test('the synthetic ledger covers every rename kind, review kind, default, detail change and slot content', () => {
  assert.deepEqual(validateRenameLedger(ledger, { inventory, requireCoverage: true }), []);
  const profile = ledger.profiles[0];
  assert.deepEqual(
    [...new Set(profile.renames.map((entry) => entry.kind))].sort(),
    ['attribute', 'css-property', 'event', 'part', 'property', 'slot'],
  );
  assert.deepEqual(
    [...new Set(profile.reviews.map((entry) => entry.kind))].sort(),
    ['attribute', 'component', 'method', 'property', 'slot'],
  );
  assert.ok(profile.reviews.some((entry) => entry.kind === 'slot' && entry.name === ''), 'a default-slot review');
  assert.equal(profile.defaults.length, 1);
  assert.equal(profile.detailChanges.length, 1);
  assert.equal(profile.slotContent.length, 1);
});

test('the ledger schema fails closed on malformed entries', () => {
  const cases = [
    [(profile) => { profile.renames[0].guess = true; }, /unknown key\(s\) guess/],
    [(profile) => { rename(profile, 'event', 'lr-item-click').kind = 'method'; }, /kind must be one of/],
    [(profile) => { rename(profile, 'event', 'lr-item-click').polarity = 'inverted'; }, /only attribute and property renames can invert polarity/],
    [(profile) => { rename(profile, 'attribute', 'heading-text').to = 'heading-text'; }, /from and to must differ/],
    [(profile) => { rename(profile, 'event', 'lr-item-click').to = 'item-activate'; }, /valid event name/],
    [(profile) => { rename(profile, 'slot', 'title').to = ''; }, /the default slot can be reviewed but not renamed/],
    [(profile) => { profile.renames.reverse(); }, /renames must be sorted/],
    [(profile) => { profile.renames.push(structuredClone(profile.renames.at(-1))); }, /duplicate entry/],
    [(profile) => { profile.detailChanges[0].summary = 'short'; }, /summary must be a single-line description/],
    [(profile) => { profile.defaults[0].value = false; }, /value must be a string, a finite number, or true/],
    [(profile) => { profile.slotContent[0].allow = ['lr-sample-item']; }, /needs exactly one of report/],
    [(profile) => { profile.slotContent[0].report = ['lr-icon', 'img']; }, /must be a sorted, unique list/],
    [(profile) => { delete profile.slotContent; }, /slotContent must be an array/],
    [(profile) => { profile.aliasRemovalMajor = 24; }, /aliasRemovalMajor must be 23/],
    [(profile) => { profile.reviews[0].name = 'lr-other'; }, /a component review must name its own tag/],
    [(_profile, root) => { root.profiles.push({ ...root.profiles[0], origin: 'lyra-v22' }); }, /profiles must be exactly lyra-v21/],
    [(_profile, root) => { root.extra = true; }, /rename ledger has unknown key\(s\) extra/],
  ];
  for (const [edit, pattern] of cases) assertFinding(mutated(edit), pattern);
});

test('a rename target that is itself renamed is rejected, because a rerun would rewrite it again', () => {
  assertFinding(mutated((profile) => { rename(profile, 'attribute', 'heading-text').to = 'arrow'; }), /target arrow is itself renamed/);
});

test('every entry must match an implemented, deprecated Lyra-only alias and its policy record', () => {
  const noRecord = syntheticInventory();
  panelOf(noRecord).maturity.deprecations = panelOf(noRecord).maturity.deprecations.filter((record) => record.name !== 'lr-item-click');
  assertFinding(validateRenameLedger(ledger, { inventory: noRecord }), /no deprecation record retires lr-item-click/);

  const notDeprecated = syntheticInventory();
  panelOf(notDeprecated).surface.parts.find((part) => part.name === 'body').deprecated = null;
  assertFinding(validateRenameLedger(ledger, { inventory: notDeprecated }), /alias body is not marked deprecated/);

  const cases = [
    [(profile) => { rename(profile, 'part', 'body').to = 'base'; }, /names a different replacement than base/],
    [(profile) => { rename(profile, 'part', 'body').to = 'missing-part'; }, /canonical name missing-part is not on the public surface/],
    [(profile) => { rename(profile, 'slot', 'title').tag = 'lr-sample-unknown'; }, /component is not in the inventory/],
    [(profile) => { profile.detailChanges[0].event = 'lr-open'; }, /event is not dispatched by lr-sample-panel/],
    [(profile) => { profile.defaults[0].value = 'm'; }, /equals the current default/],
    [(profile) => { profile.defaults[0].value = true; }, /presence insertion requires a boolean attribute/],
    [(profile) => { profile.slotContent[0].slot = 'missing'; }, /the slot is not on the public surface/],
  ];
  for (const [edit, pattern] of cases) assertFinding(mutated(edit), pattern);
});

test('a record must retire the name in the alias-removal major and start no later than the target major', () => {
  const later = syntheticInventory();
  for (const record of panelOf(later).maturity.deprecations) if (record.name === 'close__button') record.removalNotBefore = '24.0.0';
  assertFinding(validateRenameLedger(ledger, { inventory: later }), /close__button: its deprecation record must set removalNotBefore to 23\.0\.0/);

  const lateStart = syntheticInventory();
  for (const record of panelOf(lateStart).maturity.deprecations) if (record.name === 'close__button') record.since = '22.1.0';
  assertFinding(validateRenameLedger(ledger, { inventory: lateStart }), /close__button: its deprecation record must start no later than 22\.0\.0/);
});

test('mirrored Web Awesome or Shoelace names and canonical design tokens never enter the ledger', () => {
  const mirrored = syntheticInventory();
  mirrored.mappings.push({
    upstream: 'webawesome',
    upstreamTag: 'wa-sample-panel',
    targetTag: 'lr-sample-panel',
    classification: 'rewritten',
    rewrites: { attributes: [{ from: 'title-text', to: 'heading-text' }], parts: [{ from: 'x', to: 'close__button' }] },
  });
  assert.equal(mirroredMembers(mirrored).get('lr-sample-panel\u0000attribute\u0000heading-text'), 'wa-sample-panel');
  const findings = validateRenameLedger(ledger, { inventory: mirrored });
  assertFinding(findings, /rename lr-sample-panel attribute heading-text: heading-text mirrors wa-sample-panel/);

  // A mirrored deprecation follows its upstream, so completeness does not demand an entry for it.
  const withoutMirroredEntry = syntheticLedger();
  withoutMirroredEntry.profiles[0].renames = withoutMirroredEntry.profiles[0].renames.filter((entry) => entry.from !== 'close__button');
  const completeness = validateRenameLedger(withoutMirroredEntry, { inventory: mirrored, requireCoverage: true });
  assert.ok(!completeness.some((finding) => /close__button/.test(finding)), JSON.stringify(completeness));

  assertFinding(
    validateRenameLedger(ledger, { inventory, sharedTokens: new Set(['--lr-shared-gap']) }),
    /--lr-shared-gap is a canonical design token/,
  );
});

test('a boolean rename must keep what an absent attribute means', () => {
  // An undeclared inversion: true-defaulting arrow becomes false-defaulting without-arrow.
  assertFinding(
    mutated((profile) => { delete rename(profile, 'attribute', 'arrow').polarity; }),
    /arrow defaults to true and without-arrow to false; declare "polarity": "inverted"/,
  );
  assertFinding(
    mutated((profile) => { rename(profile, 'attribute', 'heading-text').polarity = 'inverted'; }),
    /an inverted rename must retire a boolean for a boolean/,
  );
  // A false-defaulting name inverted onto `without-*` needs the target inserted where both are
  // absent, or unmarked elements would start showing what they used to hide.
  const falseDefault = syntheticInventory();
  for (const section of ['attributes', 'properties']) panelOf(falseDefault).surface[section].find((member) => member.name === 'arrow').default = false;
  assertFinding(validateRenameLedger(ledger, { inventory: falseDefault }), /arrow defaults to false, so the inverted rename needs a defaults entry inserting without-arrow/);
  const withCompanion = syntheticLedger();
  withCompanion.profiles[0].defaults.push({ tag: 'lr-sample-panel', attribute: 'without-arrow', value: true });
  assert.deepEqual(validateRenameLedger(withCompanion, { inventory: falseDefault }), []);
});

test('completeness is required only where asked: lint, never the build or the CLI', () => {
  const removedRename = syntheticLedger();
  removedRename.profiles[0].renames = removedRename.profiles[0].renames.filter((entry) => entry.from !== 'close__button');
  assert.deepEqual(validateRenameLedger(removedRename, { inventory }), []);
  assertFinding(
    validateRenameLedger(removedRename, { inventory, requireCoverage: true }),
    /lr-sample-panel part "close__button" is removed in 23\.0\.0 but has no rename or review entry/,
  );
  // A property record with a paired attribute retires both names; covering one is not enough.
  const halfCovered = syntheticLedger();
  halfCovered.profiles[0].reviews = halfCovered.profiles[0].reviews.filter((entry) => !(entry.kind === 'attribute' && entry.name === 'compact'));
  assertFinding(validateRenameLedger(halfCovered, { inventory, requireCoverage: true }), /attribute "compact" is removed in 23\.0\.0/);
  const noDefaultSlot = syntheticLedger();
  noDefaultSlot.profiles[0].reviews = noDefaultSlot.profiles[0].reviews.filter((entry) => entry.kind !== 'slot');
  assertFinding(validateRenameLedger(noDefaultSlot, { inventory, requireCoverage: true }), /lr-sample-other slot "" is removed in 23\.0\.0/);

  // An incomplete ledger still builds the packaged projection, the contract and the docs.
  assert.doesNotThrow(() => createMigrationRuntimeInventory(inventory, { renameLedger: removedRename }));
  assert.doesNotThrow(() => buildMigrationContract(inventory, { renameLedger: emptyRenameLedger() }));
  assert.doesNotThrow(() => buildLyraRenameReference(emptyRenameLedger(), inventory));
});

test('the migration-coverage gate adds completeness and the prefix polarity rule', () => {
  assert.deepEqual(analyzeRenameLedger(ledger, inventory).errors, []);
  assert.deepEqual(analyzeRenameLedger(ledger, inventory).summary, {
    'lyra-v21': { renames: 12, defaults: 1, detailChanges: 1, reviews: 5, slotContent: 1 },
  });
  assertFinding(analyzeRenameLedger(emptyRenameLedger(), inventory).errors, /has no rename or review entry/);
  const undeclared = syntheticLedger();
  delete rename(undeclared.profiles[0], 'attribute', 'arrow').polarity;
  assertFinding(analyzeRenameLedger(undeclared, inventory).errors, /arrow -> without-arrow inverts its meaning; declare "polarity": "inverted"/);
  const wrong = syntheticLedger();
  Object.assign(rename(wrong.profiles[0], 'attribute', 'heading-text'), { from: 'with-title', to: 'with-heading', polarity: 'inverted' });
  assertFinding(analyzeRenameLedger(wrong, inventory).errors, /declared inverted but both names carry the same polarity/);
});

// ---------------------------------------------------------------------------------------------
// Projection and packaged runtime
// ---------------------------------------------------------------------------------------------

test('the projection records who exposes each old and new name, start versions and reflection', () => {
  const projection = projectRenameLedger(ledger, inventory);
  const profile = projection.profiles[0];
  assert.deepEqual(profile.exposure.event['lr-item-click'], ['lr-sample-other', 'lr-sample-panel']);
  assert.deepEqual(profile.exposure.event['lr-close'], ['lr-sample-other', 'lr-sample-panel']);
  assert.deepEqual(profile.exposure.event['lr-open-change'], ['lr-sample-panel']);
  assert.deepEqual(profile.exposure.part.body, ['lr-sample-other', 'lr-sample-panel']);
  assert.deepEqual(profile.exposure.part['panel-body'], ['lr-sample-panel']);
  assert.deepEqual(profile.exposure['css-property']['--lr-panel-bg'], ['lr-sample-panel']);
  assert.equal(rename(profile, 'attribute', 'heading-text').reflects, true);
  assert.equal(rename(profile, 'attribute', 'arrow').reflects, false);
  assert.ok(profile.renames.every((entry) => entry.since === '21.1.0'));
  assert.ok([...profile.defaults, ...profile.detailChanges, ...profile.slotContent].every((entry) => entry.since === '22.0.0'));
  assert.deepEqual(
    profile.reviews.map((entry) => [entry.name, entry.replacement, entry.removalNotBefore]),
    [
      ['lr-sample-legacy', '<lr-sample-panel>', '23.0.0'],
      ['', 'slot="content"', '23.0.0'],
      ['compact', 'size="s"', '23.0.0'],
      ['refresh', 'reload()', '23.0.0'],
      ['compact', 'size="s"', '23.0.0'],
    ],
  );
  const lookup = createRenameProfiles(projection).get('lyra-v21');
  assert.equal(lookup.isGlobal('event', 'lr-panel-open-change'), true, 'no one else dispatches either name');
  assert.equal(lookup.isGlobal('event', 'lr-panel-close'), false, 'lr-sample-other already dispatches lr-close');
  assert.deepEqual(lookup.targetKeepers('event', 'lr-panel-close', 'lr-close'), ['lr-sample-other']);
  assert.equal(lookup.isGlobal('event', 'lr-item-click'), false, 'lr-sample-other still dispatches it');
  assert.deepEqual(lookup.sourceKeepers('event', 'lr-item-click', 'lr-item-activate'), ['lr-sample-other']);
  assert.deepEqual(lookup.gainedOwners('event', 'lr-close'), ['lr-sample-panel']);
  assert.deepEqual(lookup.gainedOwners('event', 'lr-open-change'), [], 'a fresh name gains no one from anyone');
  assert.equal(lookup.isGlobal('css-property', '--lr-panel-bg'), true);
  assert.equal(lookup.isGlobal('css-property', '--lr-shared-gap'), false);
  assert.equal(lookup.isGlobal('attribute', 'arrow'), false, 'attributes are always owner-scoped');
  assert.deepEqual(validateRenameLedgerShape(emptyRenameProjection(), { projected: true }), []);
});

test('entries newer than the installed release are withheld', () => {
  const projection = projectRenameLedger(ledger, inventory);
  const total = ['renames', 'defaults', 'detailChanges', 'reviews', 'slotContent']
    .reduce((sum, list) => sum + projection.profiles[0][list].length, 0);
  assert.equal(createRenameProfiles(projection, { lyraVersion: '21.0.0' }).get('lyra-v21').skipped.length, total);
  assert.equal(createRenameProfiles(projection, { lyraVersion: '21.0.0' }).get('lyra-v21').isEmpty, true);
  const early = createRenameProfiles(projection, { lyraVersion: '21.1.0' }).get('lyra-v21');
  assert.deepEqual(early.skipped.map((entry) => entry.list).sort(), ['defaults', 'detailChanges', 'slotContent']);
  assert.equal(createRenameProfiles(projection, { lyraVersion: '22.0.0' }).get('lyra-v21').skipped.length, 0);
  assert.throws(() => createRenameProfiles(projection, { lyraVersion: 'latest' }), /Invalid Lyra version/);

  const earlyContract = buildMigrationContract(inventory, { renameLedger: ledger, lyraVersion: '21.1.0' });
  const result = run('<lr-sample-panel heading-text="x"></lr-sample-panel>\n<div @lr-close=${a}></div>\n', 'early.html', earlyContract);
  assert.equal(result.content, '<lr-sample-panel heading="x"></lr-sample-panel>\n<div @lr-close=${a}></div>\n', 'no default inserted');
  assert.ok(!result.warnings.some((entry) => entry.warningCode === 'DETAIL_SHAPE_REVIEW'), 'no detail change before 22.0.0');
});

test('the packaged projection fails closed when tampered with', () => {
  const projection = projectRenameLedger(ledger, inventory);
  const missingExposer = structuredClone(projection);
  missingExposer.profiles[0].exposure.event['lr-item-click'] = ['lr-sample-other'];
  assert.throws(() => createRenameProfiles(missingExposer), /exposure\.event\.lr-item-click must include lr-sample-panel/);
  const missingTarget = structuredClone(projection);
  delete missingTarget.profiles[0].exposure.event['lr-close'];
  assert.throws(() => createRenameProfiles(missingTarget), /exposure\.event\.lr-close is missing/);
  const extraName = structuredClone(projection);
  extraName.profiles[0].exposure.part.base = ['lr-sample-panel'];
  assert.throws(() => createRenameProfiles(extraName), /records unreferenced name base/);
  const noReplacement = structuredClone(projection);
  delete noReplacement.profiles[0].reviews[0].replacement;
  assert.throws(() => createRenameProfiles(noReplacement), /replacement text missing/);
  const noSince = structuredClone(projection);
  delete noSince.profiles[0].renames[0].since;
  assert.throws(() => createRenameProfiles(noSince), /since must be a version/);

  const runtime = createMigrationRuntimeInventory(inventory, { renameLedger: ledger });
  assert.deepEqual(runtime.lyraRenames, projection);
  assert.equal(buildMigrationContract(runtime).renameProfiles.get('lyra-v21').data.renames.length, 12);
  const missing = structuredClone(runtime);
  delete missing.lyraRenames;
  assert.throws(() => buildMigrationContract(missing), /rename ledger must be an object/);
  assert.throws(() => buildMigrationContract(runtime, { renameLedger: ledger }), /carries its own rename projection/);
  assert.throws(
    () => createMigrationRuntimeInventory(inventory, { renameLedger: { ...ledger, profiles: [] } }),
    /profiles must be exactly lyra-v21/,
  );
});

test('an inventory built without a ledger has empty rename profiles', () => {
  const plain = buildMigrationContract(inventory);
  assert.equal(plain.renameProfiles.get('lyra-v21').isEmpty, true);
  const input = fixture('component.input.html');
  const result = migrateText(input, plain, { file: 'component.html', origin: 'lyra-v21' });
  assert.equal(result.content, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.warnings, []);
});

// ---------------------------------------------------------------------------------------------
// Rewrites, reports and idempotence per syntax
// ---------------------------------------------------------------------------------------------

for (const extension of ['html', 'ts', 'jsx', 'vue', 'svelte', 'css']) {
  test(`${extension}: every rewrite category, report and acknowledgement matches the reviewed snapshot`, () => {
    const input = fixture(`component.input.${extension}`);
    const result = migrateText(input, contract, { file: `component.${extension}`, origin: 'lyra-v21' });
    assert.equal(result.content, fixture(`component.expected.${extension}`));
    assert.deepEqual(describeChanges(result.changes), expectedReports[extension].changes);
    assert.deepEqual(describeWarnings(result.warnings), expectedReports[extension].warnings);
    assert.equal(result.acknowledged, expectedReports[extension].acknowledged);
    assert.ok(result.changes.every((entry) => entry.origin === 'lyra-v21'));
    assert.ok(result.warnings.every((entry) => entry.origin === 'lyra-v21' && entry.action === 'manual-review'));
    assert.ok(result.warnings.every((entry) => entry.warningCode === 'UNUSED_ACKNOWLEDGEMENT' || /lyra-migrate-reviewed: [A-Z_]+:\S+/.test(entry.message)));

    const rerun = migrateText(result.content, contract, { file: `component.${extension}`, origin: 'lyra-v21' });
    assert.equal(rerun.content, result.content, 'a second run must not change the migrated text');
    assert.deepEqual(rerun.changes, []);
    assert.deepEqual(warningIdentity(rerun.warnings), warningIdentity(result.warnings), 'reports are stable across runs');
  });
}

test('the snapshots exercise every rewrite action and every report code', () => {
  const actions = new Set();
  const codes = new Set();
  for (const report of Object.values(expectedReports)) {
    if (typeof report !== 'object') continue;
    for (const change of report.changes) actions.add(change.split(' ')[1]);
    for (const warning of report.warnings) codes.add(warning.split(' ')[1]);
  }
  assert.deepEqual([...actions].sort(), [
    'insert-default',
    'remove-attribute',
    'rewrite-attribute',
    'rewrite-css-property',
    'rewrite-event',
    'rewrite-part',
    'rewrite-property',
    'rewrite-slot',
  ]);
  assert.deepEqual([...codes].sort(), [
    'ALIASED_MEMBER_REVIEW',
    'DEPRECATED_CONTENT_REVIEW',
    'DEPRECATED_MEMBER_REVIEW',
    'DETAIL_SHAPE_REVIEW',
    'DYNAMIC_VALUE_REVIEW',
    'MAPPING_REVIEW_BLOCKED',
    'NAME_GAINED_OWNER_REVIEW',
    'POLARITY_REVIEW',
    'RENAME_CONFLICT_REVIEW',
    'RENAME_REVIEW',
    'RENAME_TARGET_SHARED_REVIEW',
    'UNUSED_ACKNOWLEDGEMENT',
  ]);
});

test('same-named members, strings and selectors of other elements never change or warn', () => {
  const input = fixture('no-false-positives.input.ts');
  const result = migrateText(input, contract, { file: 'unrelated.ts', origin: 'lyra-v21' });
  assert.equal(result.content, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.warnings, []);
});

test('a rename never binds one name twice on an element, in any template syntax', () => {
  const cases = [
    ['lit.ts', 'html`<lr-sample-panel size="m" @lr-panel-open-change=${a} @lr-open-change=${b}></lr-sample-panel>`;\n'],
    ['view.vue', '<template><lr-sample-panel size="m" @lr-panel-open-change="a" @lr-open-change="b"></lr-sample-panel></template>\n'],
    ['view.jsx', 'const v = <lr-sample-panel size="m" onlr-panel-open-change={a} onlr-open-change={b} />;\n'],
    ['view.jsx', 'const v = <div onlr-panel-open-change={a} onlr-open-change={b} />;\n'],
    ['view.html', '<lr-sample-panel size="m" heading-text="a" heading="b"></lr-sample-panel>\n'],
  ];
  for (const [file, input] of cases) {
    const result = run(input, file);
    assert.equal(result.content, input, `${file} must stay unchanged`);
    assert.ok(result.warnings.some((entry) => entry.warningCode === 'RENAME_CONFLICT_REVIEW'), `${file}: ${codesOf(result.warnings)}`);
  }
});

test('an event moves only when the listener keeps hearing the same components', () => {
  const input = [
    '<lr-sample-panel size="m" @lr-item-click=${a} @lr-panel-close=${b}></lr-sample-panel>',
    '<lr-sample-other @lr-item-click=${c} @lr-panel-close=${d}></lr-sample-other>',
    '<section @lr-item-click=${e} @lr-panel-open-change=${f} @lr-panel-close=${g}></section>',
    '',
  ].join('\n');
  const result = run(input, 'events.ts');
  const lines = result.content.split('\n');
  // Owner-bound, and no other component dispatches lr-item-activate: moves.
  assert.equal(lines[0], '<lr-sample-panel size="m" @lr-item-activate=${a} @lr-panel-close=${b}></lr-sample-panel>');
  // lr-sample-other dispatches lr-close itself: moving b, d or g would widen the listener.
  assert.equal(lines[1], input.split('\n')[1]);
  assert.equal(lines[2], '<section @lr-item-click=${e} @lr-open-change=${f} @lr-panel-close=${g}></section>');
  assert.deepEqual(codesOf(result.warnings), [
    '1 RENAME_TARGET_SHARED_REVIEW',
    '2 RENAME_TARGET_SHARED_REVIEW',
    '3 RENAME_REVIEW',
    '3 RENAME_TARGET_SHARED_REVIEW',
  ]);
});

test('a detail change is reported on every listener that may receive it, never on another dispatcher', () => {
  const input = [
    '<lr-sample-panel (lr-close)="closed($event)"></lr-sample-panel>',
    '<lr-sample-other @lr-close=${x}></lr-sample-other>',
    '<div onlr-close={y}></div>',
    "const CLOSE = 'lr-close';",
    "document.querySelector('lr-sample-other').addEventListener('lr-close', z);",
    "document.querySelector('lr-sample-panel').addEventListener('lr-close', z);",
    '',
  ].join('\n');
  const result = run(input, 'details.ts');
  assert.equal(result.content, input, 'a detail change is never rewritten');
  assert.deepEqual(
    codesOf(result.warnings.filter((entry) => ['DETAIL_SHAPE_REVIEW', 'NAME_GAINED_OWNER_REVIEW'].includes(entry.warningCode))),
    [
      '1 DETAIL_SHAPE_REVIEW',
      '3 DETAIL_SHAPE_REVIEW',
      '3 NAME_GAINED_OWNER_REVIEW',
      '4 DETAIL_SHAPE_REVIEW',
      '4 NAME_GAINED_OWNER_REVIEW',
      '6 DETAIL_SHAPE_REVIEW',
    ],
  );
});

test('event names in strings: listener calls may move, other strings are reported, tag APIs are skipped', () => {
  const input = [
    "const EVENT = 'lr-panel-open-change';",
    "document.createElement('lr-panel-open-change');",
    "customElements.get('lr-panel-open-change');",
    "el.matches('lr-panel-open-change');",
    "handlers.get('lr-panel-open-change');",
    "host.addEventListener('lr-panel-open-change', handler);",
    "host.addEventListener('lr-panel-close', handler);",
    "@HostListener('window:lr-panel-open-change') onOpen() {}",
    "@HostListener('document:lr-panel-close') onClose() {}",
    '',
  ].join('\n');
  const result = run(input, 'strings.ts');
  const lines = result.content.split('\n');
  assert.deepEqual(lines.slice(0, 5), input.split('\n').slice(0, 5), 'strings outside listener calls never change');
  assert.equal(lines[5], "host.addEventListener('lr-open-change', handler);");
  assert.equal(lines[6], "host.addEventListener('lr-panel-close', handler);");
  assert.equal(lines[7], "@HostListener('window:lr-open-change') onOpen() {}");
  assert.equal(lines[8], "@HostListener('document:lr-panel-close') onClose() {}");
  assert.deepEqual(codesOf(result.warnings), [
    '1 RENAME_REVIEW',
    '5 RENAME_REVIEW',
    '7 RENAME_TARGET_SHARED_REVIEW',
    '9 RENAME_TARGET_SHARED_REVIEW',
  ]);
});

test('an event the scanned code dispatches itself is never moved, in that file or any other', () => {
  const listener = '<lr-sample-panel size="m" @lr-panel-open-change=${a}></lr-sample-panel>\nwindow.addEventListener(\'lr-panel-open-change\', b);\n';
  const dispatch = "panel.dispatchEvent(new CustomEvent('lr-panel-open-change', { bubbles: true }));\n";
  const single = run(listener + dispatch, 'same-file.ts');
  assert.equal(single.content, listener + dispatch);
  assert.deepEqual(codesOf(single.warnings), ['1 RENAME_REVIEW', '2 RENAME_REVIEW', '3 RENAME_REVIEW']);

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-renames-dispatch-'));
  try {
    const files = [path.join(scratch, 'listener.ts'), path.join(scratch, 'dispatch.test.ts')];
    fs.writeFileSync(files[0], listener);
    fs.writeFileSync(files[1], dispatch);
    const report = migrateFiles({ files, inventory, renameLedger: ledger, origin: 'lyra-v21', dryRun: true, cwd: scratch });
    assert.equal(report.filesChanged, 0, 'a dispatch in another scanned file blocks the rename everywhere');
    const alone = migrateFiles({ files: [files[0]], inventory, renameLedger: ledger, origin: 'lyra-v21', dryRun: true, cwd: scratch });
    assert.equal(alone.filesChanged, 1);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('::part() is rewritten only on a selector that names the owner, and exportparts keeps exported names', () => {
  const input = [
    '<lr-sample-panel size="m" exportparts="close__button"></lr-sample-panel>',
    '<style>',
    '  lr-sample-panel::part(close__button) { color: red; }',
    '  my-card::part(close__button) { color: red; }',
    '  .card::part(close__button) { color: red; }',
    '  ::part(close__button) { color: red; }',
    '</style>',
    '',
  ].join('\n');
  const result = run(input, 'parts.html');
  const lines = result.content.split('\n');
  assert.equal(lines[0], '<lr-sample-panel size="m" exportparts="close-button:close__button"></lr-sample-panel>');
  assert.equal(lines[2], '  lr-sample-panel::part(close-button) { color: red; }');
  assert.deepEqual(lines.slice(3, 6), input.split('\n').slice(3, 6), 'forwarded or unowned parts are reported, not renamed');
  assert.deepEqual(codesOf(result.warnings), ['4 RENAME_REVIEW', '5 RENAME_REVIEW', '6 RENAME_REVIEW']);
});

test('a custom property moves only when no nested component can lose or gain the value', () => {
  const input = [
    '<lr-sample-panel size="m" style="--lr-shared-gap: 1px; --lr-panel-bg: red"></lr-sample-panel>',
    '<style>lr-sample-panel { --lr-shared-gap: 4px; } :root { --lr-panel-bg: white; }</style>',
    "el.style.setProperty('--lr-panel-bg', 'blue');",
    '',
  ].join('\n');
  const result = run(input, 'vars.html');
  assert.equal(
    result.content,
    [
      '<lr-sample-panel size="m" style="--lr-shared-gap: 1px; --lr-sample-panel-background: red"></lr-sample-panel>',
      '<style>lr-sample-panel { --lr-shared-gap: 4px; } :root { --lr-sample-panel-background: white; }</style>',
      "el.style.setProperty('--lr-sample-panel-background', 'blue');",
      '',
    ].join('\n'),
  );
  assert.deepEqual(codesOf(result.warnings), ['1 RENAME_REVIEW', '2 RENAME_REVIEW']);
});

test('an inverted boolean is rewritten only where a static value reaches the element as an attribute', () => {
  const tag = '<lr-sample-panel size="m" arrow="false"></lr-sample-panel>';
  for (const file of ['page.html', 'page.md']) assert.match(run(`${tag}\n`, file).content, /<lr-sample-panel size="m" without-arrow>/);
  assert.match(run(`html\`${tag}\`;\n`, 'lit.ts').content, /<lr-sample-panel size="m" without-arrow>/);
  const cases = [
    ['untagged.ts', `const markup = \`${tag}\`;\n`],
    ['view.jsx', `const v = ${tag};\n`],
    ['view.tsx', 'const v = <lr-sample-panel size="m" arrow="" />;\n'],
    ['view.vue', `<template>${tag}</template>\n`],
    ['view.svelte', `${tag}\n`],
    ['view.mdx', `${tag}\n`],
  ];
  for (const [file, input] of cases) {
    const result = run(input, file);
    assert.equal(result.content, input, `${file} must not invert a string that may be assigned as a property`);
    assert.deepEqual(codesOf(result.warnings).map((entry) => entry.split(' ')[1]), ['POLARITY_REVIEW'], file);
  }
});

test('Angular bindings are renamed; opaque object bindings are reported, Lit ref() is not', () => {
  const angular = '<lr-sample-panel size="m" [attr.heading-text]="t" [headingText]="t" (lr-panel-open-change)="o()"></lr-sample-panel>\n';
  assert.equal(
    run(angular, 'panel.component.html').content,
    '<lr-sample-panel size="m" [attr.heading]="t" [heading]="t" (lr-open-change)="o()"></lr-sample-panel>\n',
  );
  const opaque = [
    ['lit.ts', 'html`<lr-sample-panel size="m" ${spread(props)}></lr-sample-panel>`;\n'],
    ['view.vue', '<template><lr-sample-panel size="m" v-on="handlers"></lr-sample-panel></template>\n'],
    ['view.svelte', '<lr-sample-panel size="m" {...rest}></lr-sample-panel>\n'],
  ];
  for (const [file, input] of opaque) assert.deepEqual(codesOf(run(input, file).warnings), ['1 DYNAMIC_VALUE_REVIEW'], file);
  assert.deepEqual(run('html`<lr-sample-panel size="m" ${ref(this.panel)}></lr-sample-panel>`;\n', 'lit.ts').warnings, []);
});

test('an attribute selector follows a rename only when the new attribute reflects', () => {
  const unreflected = syntheticInventory();
  for (const section of ['attributes', 'properties']) panelOf(unreflected).surface[section].find((member) => member.name === 'heading').reflects = false;
  const unreflectedContract = buildMigrationContract(unreflected, { renameLedger: ledger });
  const input = 'lr-sample-panel[heading-text] { font-weight: bold; }\n';
  assert.equal(run(input, 'a.css').content, 'lr-sample-panel[heading] { font-weight: bold; }\n');
  const result = run(input, 'a.css', unreflectedContract);
  assert.equal(result.content, input);
  assert.deepEqual(codesOf(result.warnings), ['1 RENAME_REVIEW']);
});

test('deprecated default-slot use and slot content are reported on direct children only', () => {
  const input = [
    '<lr-sample-other>',
    '  <span>unslotted</span>',
    '  <span slot="content">named</span>',
    '  <div><span>nested</span></div>',
    '</lr-sample-other>',
    '<lr-sample-panel size="m">',
    '  <lr-icon name="a"></lr-icon>',
    '  <div><lr-icon name="nested"></lr-icon></div>',
    '  <lr-icon slot="start" name="b"></lr-icon>',
    '</lr-sample-panel>',
    '',
  ].join('\n');
  const result = run(input, 'slots.html');
  assert.equal(result.content, input);
  assert.deepEqual(describeWarnings(result.warnings), [
    '2:4 DEPRECATED_MEMBER_REVIEW ',
    '4:4 DEPRECATED_MEMBER_REVIEW ',
    '7:4 DEPRECATED_CONTENT_REVIEW lr-icon',
  ]);
  const allowList = syntheticLedger();
  allowList.profiles[0].slotContent[0] = { tag: 'lr-sample-panel', slot: '', allow: ['lr-icon'], summary: 'Only icons belong in the default slot of this panel.' };
  const allowResult = run(input, 'slots.html', buildMigrationContract(inventory, { renameLedger: allowList }));
  assert.deepEqual(codesOf(allowResult.warnings).filter((entry) => entry.endsWith('CONTENT_REVIEW')), ['8 DEPRECATED_CONTENT_REVIEW']);
});

test('acknowledgements name the code, cover a whole opening tag, work in Lit templates and never go stale silently', () => {
  const input = [
    'const view = html`',
    '  <!-- lyra-migrate-reviewed: DETAIL_SHAPE_REVIEW:lr-close -->',
    '  <section',
    '    class="shell"',
    '    @lr-close=${this.onClose}',
    '  ></section>',
    '  <!-- lyra-migrate-reviewed: NAME_GAINED_OWNER_REVIEW:lr-close -->',
    '  <section @lr-close=${this.onClose}></section>',
    '  <section @lr-close=${this.onClose}></section> <!-- lyra-migrate-reviewed: RENAME_REVIEW:lr-close -->',
    '  <!-- lyra-migrate-reviewed: lr-close -->',
    '  <!-- <lr-sample-panel heading-text="x"> inside a comment -->',
    '`;',
    '',
  ].join('\n');
  const result = run(input, 'ack.ts');
  assert.equal(result.content, input, 'names inside HTML comments in a Lit template never change');
  assert.equal(result.acknowledged, 2);
  assert.deepEqual(describeWarnings(result.warnings), [
    '5:6 NAME_GAINED_OWNER_REVIEW lr-close',
    '8:13 DETAIL_SHAPE_REVIEW lr-close',
    '9:13 DETAIL_SHAPE_REVIEW lr-close',
    '9:13 NAME_GAINED_OWNER_REVIEW lr-close',
    '9:54 UNUSED_ACKNOWLEDGEMENT RENAME_REVIEW:lr-close',
    '10:8 UNUSED_ACKNOWLEDGEMENT lr-close',
  ]);
});

test('scanning stays linear in the size of the input', () => {
  const unit = fixture('component.input.html');
  const text = unit.repeat(Math.ceil(400_000 / unit.length));
  const prose = `<p>${'Prose with lr-sample-panel, --lr-shared-gap and no braces at all. '.repeat(6000)}</p>\n`;
  for (const [file, input] of [['large.html', text], ['prose.html', prose], ['large.css', fixture('component.input.css').repeat(400)]]) {
    const started = performance.now();
    run(input, file);
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 3000, `${file} (${input.length} characters) took ${Math.round(elapsed)} ms`);
  }
});

// ---------------------------------------------------------------------------------------------
// Multi-file runs, report schema, diff output and the CLI
// ---------------------------------------------------------------------------------------------

function scratchCopy(names) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-renames-'));
  const files = names.map((name) => {
    const target = path.join(scratch, name.replace('.input', ''));
    fs.copyFileSync(path.join(fixtureDir, name), target);
    return target;
  });
  return { scratch, files };
}

test('a DOM alias anywhere in the scanned set blocks default insertion everywhere, as for Lyra 7', () => {
  const { scratch, files } = scratchCopy(['component.input.html', 'component.input.ts']);
  try {
    const report = migrateFiles({ files, inventory, renameLedger: ledger, origin: 'lyra-v21', dryRun: true, cwd: scratch });
    assert.equal(report.origin, 'lyra-v21');
    assert.ok(!report.changes.some((entry) => entry.action === 'insert-default'), 'defaults must not be inserted anywhere');
    assert.ok(report.warnings.some((entry) => entry.file === 'component.html' && entry.warningCode === 'MAPPING_REVIEW_BLOCKED'));
    assert.ok(report.changes.some((entry) => entry.file === 'component.html' && entry.action === 'rewrite-attribute'), 'renames are never blocked');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('migrateFiles writes a stable report, honors dry-run, and returns a diff only on request', () => {
  const { scratch, files } = scratchCopy(['component.input.css', 'component.input.vue']);
  try {
    const reportPath = path.join(scratch, 'report.json');
    const before = files.map((file) => fs.readFileSync(file, 'utf8'));
    const dry = migrateFiles({
      files,
      inventory,
      renameLedger: ledger,
      origin: 'lyra-v21',
      dryRun: true,
      reportPath,
      cwd: scratch,
      collectDiff: true,
    });
    assert.deepEqual(files.map((file) => fs.readFileSync(file, 'utf8')), before);
    assert.equal(dry.filesChanged, 2);
    assert.equal(dry.summary.acknowledged, 3);
    assert.ok(!Object.hasOwn(dry.summary, 'skipped'), 'skipped is reported only when a version is known');
    assert.equal(dry.summary.rewrites, dry.changes.length);
    const { diff, ...reportWithoutDiff } = dry;
    assert.deepEqual(readJson(reportPath), reportWithoutDiff, 'the JSON report never embeds the diff');
    assert.ok(diff.length > 0);
    assert.match(dry.diff, /^--- a\/component\.css\n\+\+\+ b\/component\.css\n@@ /m);
    assert.match(dry.diff, /^-  --lr-panel-bg: #fafafa;\n\+  --lr-sample-panel-background: #fafafa;$/m);
    assert.throws(
      () => migrateFiles({ files, inventory, renameLedger: ledger, origin: 'lyra-v21', dryRun: true, cwd: path.join(scratch, 'nested'), collectDiff: true }),
      /--diff needs every target inside the working directory/,
    );
    const versioned = migrateFiles({ files, inventory, renameLedger: ledger, origin: 'lyra-v21', dryRun: true, cwd: scratch, lyraVersion: '21.1.0' });
    assert.equal(versioned.summary.skipped, 3);

    const applied = migrateFiles({ files, inventory, renameLedger: ledger, origin: 'lyra-v21', cwd: scratch });
    assert.ok(!Object.hasOwn(applied, 'diff'));
    assert.equal(fs.readFileSync(files[0], 'utf8'), fixture('component.expected.css'));
    assert.equal(fs.readFileSync(files[1], 'utf8'), fixture('component.expected.vue'));
    const rerun = migrateFiles({ files, inventory, renameLedger: ledger, origin: 'lyra-v21', cwd: scratch });
    assert.equal(rerun.filesChanged, 0);
    assert.deepEqual(rerun.changes, []);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('unifiedDiff emits minimal hunks with context and end-of-file markers', () => {
  const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', ''].join('\n');
  const after = ['a', 'B', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'K', 'new', ''].join('\n');
  assert.equal(
    unifiedDiff('x.txt', before, after),
    [
      '--- a/x.txt',
      '+++ b/x.txt',
      '@@ -1,5 +1,5 @@',
      ' a',
      '-b',
      '+B',
      ' c',
      ' d',
      ' e',
      '@@ -8,4 +8,5 @@',
      ' h',
      ' i',
      ' j',
      '-k',
      '+K',
      '+new',
      '',
    ].join('\n'),
  );
  assert.equal(
    unifiedDiff('y.txt', 'one\ntwo', 'one\ntwo\n'),
    ['--- a/y.txt', '+++ b/y.txt', '@@ -1,2 +1,2 @@', ' one', '-two', '\\ No newline at end of file', '+two', ''].join('\n'),
  );
  assert.equal(unifiedDiff('z.txt', 'same\n', 'same\n'), '');
});

/** Applies a single-file unified diff, verifying every context and removed line on the way. */
function applyUnifiedDiff(original, patch) {
  const lines = original.split('\n');
  const terminated = lines.at(-1) === '';
  if (terminated) lines.pop();
  const records = lines.map((text, index) => ({ text, eol: index < lines.length - 1 || terminated }));
  const output = [];
  const patchLines = patch.split('\n').slice(2, -1);
  let cursor = 0;
  let previous = null;
  for (let index = 0; index < patchLines.length; index += 1) {
    const line = patchLines[index];
    const header = /^@@ -(\d+),(\d+) \+\d+,\d+ @@$/.exec(line);
    if (header) {
      const first = Number(header[2]) === 0 ? Number(header[1]) : Number(header[1]) - 1;
      while (cursor < first) output.push(records[cursor++]);
      previous = null;
      continue;
    }
    if (line.startsWith('\\')) {
      if (previous) previous.eol = false;
      continue;
    }
    const type = line[0];
    const text = line.slice(1);
    if (type !== '+') {
      assert.equal(records[cursor]?.text, text, `patch context must match line ${cursor + 1}`);
      cursor += 1;
    }
    previous = type === '-' ? null : { text, eol: true };
    if (previous) output.push(previous);
  }
  while (cursor < records.length) output.push(records[cursor++]);
  return output.map((record) => `${record.text}${record.eol ? '\n' : ''}`).join('');
}

test('unifiedDiff patches round-trip for seeded random edits, including end-of-file newlines', () => {
  let seed = 20260927;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let trial = 0; trial < 300; trial += 1) {
    const before = Array.from({ length: Math.floor(random() * 30) }, () => `line ${Math.floor(random() * 6)}`);
    const after = [];
    for (const line of before) {
      const roll = random();
      if (roll >= 0.15) after.push(roll < 0.3 ? `changed ${Math.floor(random() * 4)}` : line);
      if (random() < 0.1) after.push(`added ${Math.floor(random() * 3)}`);
    }
    const original = before.join('\n') + (before.length && random() < 0.8 ? '\n' : '');
    const content = after.join('\n') + (after.length && random() < 0.8 ? '\n' : '');
    const patch = unifiedDiff('random.txt', original, content);
    assert.equal(patch === '', original === content);
    if (patch) assert.equal(applyUnifiedDiff(original, patch), content, `trial ${trial}:\n${patch}`);
  }
});

function packagedCli(runtimeLedger = ledger, runtimeInventory = inventory) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-renames-cli-'));
  const cliDir = path.join(scratch, 'cli');
  fs.mkdirSync(cliDir);
  for (const module of ['migrate-wa.mjs', 'component-inventory.mjs', 'lyra-rename-ledger.mjs']) {
    fs.copyFileSync(path.join(scriptDir, module), path.join(cliDir, module));
  }
  fs.writeFileSync(
    path.join(cliDir, 'migration-contract.json'),
    `${JSON.stringify(createMigrationRuntimeInventory(runtimeInventory, { renameLedger: runtimeLedger }))}\n`,
  );
  const invoke = (...args) =>
    spawnSync(process.execPath, [path.join(cliDir, 'migrate-wa.mjs'), ...args], { cwd: scratch, encoding: 'utf8' });
  return { scratch, invoke };
}

test('the packaged CLI previews with --diff, gates with --check, applies, and clears acknowledged reports', () => {
  const { scratch, invoke } = packagedCli();
  try {
    const source = path.join(scratch, 'view.html');
    const input = [
      '<lr-sample-panel heading-text="Settings" arrow size="m"></lr-sample-panel>',
      '<div @lr-item-click=${onItem}></div>',
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const preview = invoke('--origin=lyra-v21', '--diff', source);
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(fs.readFileSync(source, 'utf8'), input, '--diff never writes');
    assert.equal(
      preview.stdout,
      [
        '--- a/view.html',
        '+++ b/view.html',
        '@@ -1,2 +1,2 @@',
        '-<lr-sample-panel heading-text="Settings" arrow size="m"></lr-sample-panel>',
        '+<lr-sample-panel heading="Settings" size="m"></lr-sample-panel>',
        ' <div @lr-item-click=${onItem}></div>',
        '',
      ].join('\n'),
      'stdout carries only the patch',
    );
    assert.match(preview.stderr, /No installed @aceshooting\/lyra-ui found under the working directory/);
    assert.match(preview.stderr, /1 file\(s\) scanned, 1 changed, 2 rewrite\(s\), 1 warning\(s\), 0 acknowledged\./);

    const early = invoke('--origin=lyra-v21', '--check', '--lyra-version=21.0.0', source);
    assert.equal(early.status, 0, early.stdout);
    assert.match(early.stdout, /Applying entries available in @aceshooting\/lyra-ui 21\.0\.0; 20 entries need a later release\./);

    const pending = invoke('--origin=lyra-v21', '--check', source);
    assert.equal(pending.status, 1);
    const applied = invoke('--origin=lyra-v21', source);
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(fs.readFileSync(source, 'utf8').split('\n')[0], '<lr-sample-panel heading="Settings" size="m"></lr-sample-panel>');
    const unreviewed = invoke('--origin=lyra-v21', '--check', source);
    assert.equal(unreviewed.status, 1, 'an unreviewed RENAME_REVIEW keeps the gate closed');
    assert.match(unreviewed.stdout, /warning RENAME_REVIEW/);

    fs.writeFileSync(
      source,
      fs.readFileSync(source, 'utf8').replace('<div @lr-item-click', '<!-- lyra-migrate-reviewed: RENAME_REVIEW:lr-item-click -->\n<div @lr-item-click'),
    );
    const reviewed = invoke('--origin=lyra-v21', '--check', source);
    assert.equal(reviewed.status, 0, reviewed.stdout);
    assert.match(reviewed.stdout, /0 warning\(s\), 1 acknowledged\./);
    assert.match(reviewed.stdout, /Migration check passed/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('the repository CLI accepts --origin=lyra-v21 with the checked-in ledger', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-renames-repo-cli-'));
  try {
    const source = path.join(scratch, 'view.html');
    const input = '<lr-popover placement="top"></lr-popover>\n';
    fs.writeFileSync(source, input);
    const result = spawnSync(process.execPath, [migratePath, '--origin=lyra-v21', '--check', source], {
      cwd: scratch,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Migration check passed/);
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    assert.deepEqual(parseArgs(['--diff', '--origin=lyra-v21', '--lyra-version=22.1.0', 'src']), {
      check: false,
      diff: true,
      dryRun: true,
      help: false,
      extensions: parseArgs(['src']).extensions,
      lyraVersion: '22.1.0',
      origin: 'lyra-v21',
      report: null,
      targets: ['src'],
    });
    assert.throws(() => parseArgs(['--origin=lyra-v20', 'src']), /Unknown migration origin: lyra-v20/);
    assert.throws(() => parseArgs(['--lyra-version=latest', 'src']), /--lyra-version needs a version/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------------------------
// Generated consumer reference
// ---------------------------------------------------------------------------------------------

test('the migration reference is generated from the ledger and its deprecation records', () => {
  const reference = buildLyraRenameReference(ledger, inventory).join('\n');
  assert.match(reference, /## Migrating from Lyra 21 to Lyra 22 \(`--origin=lyra-v21`\)/);
  assert.match(reference, /npx lyra-ui-migrate --origin=lyra-v21 --diff src > lyra-v21\.patch/);
  assert.match(reference, /`lyra-migrate-reviewed: CODE:name`/);
  assert.match(reference, /\| `RENAME_TARGET_SHARED_REVIEW` \|/);
  assert.match(reference, /\| `<lr-sample-panel>` \| attribute \| `arrow` \| `without-arrow` \| Inverted boolean: static HTML and Lit attributes rewritten, everything else reported \|/);
  assert.match(reference, /\| `<lr-sample-panel>` \| attribute \| `heading-text` \| `heading` \| Rewritten where the component is proven \|/);
  assert.match(reference, /\| `<lr-sample-panel>` \| event \| `lr-panel-close` \| `lr-close` \| Rewritten where the reach is unchanged, otherwise reported \|/);
  assert.match(reference, /\| `<lr-sample-panel>` \| `size` \| `size="s"` \|/);
  assert.match(reference, /\| `<lr-sample-panel>` \| `lr-close` \| the detail is now an object \{ reason \} instead of the reason string\. \|/);
  assert.match(reference, /\| `<lr-sample-legacy>` \| component \| `lr-sample-legacy` \| `<lr-sample-panel>` \|/);
  assert.match(reference, /\| `<lr-sample-other>` \| slot \| \(default slot\) \| `slot="content"` \|/);
  assert.match(reference, /\| `<lr-sample-panel>` \| default \| `<lr-icon>` \| An icon in the default slot is deprecated; move it to the start slot\. \|/);
  const plainInventory = readJson(path.join(scriptDir, 'fixtures', 'migrate-wa', 'inventory.json'));
  assert.match(buildLyraRenameReference(emptyRenameLedger(), plainInventory).join('\n'), /No Lyra 21 names are scheduled to change yet\./);
});
