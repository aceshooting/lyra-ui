#!/usr/bin/env node
// Standalone test for scripts/generate-registration-graph.mjs -- plain `node:assert`, not wired
// into the wtr suite (this generator reads source text and JSON, it does not render components).
// Run directly: `node scripts/generate-registration-graph.test.mjs`.
//
// Operates against the real repository inventory/source rather than a synthetic fixture, the same
// way scripts/design-tokens.test.mjs reads the real canonical tokens: the concrete cases this
// generator exists for (`lr-table.js` also registers `lr-empty`/`lr-pagination`/`lr-skeleton`/
// `lr-spinner`; a published integration-bridge specifier like `flag-peer.js` registers tags without
// being any single component's own alias; `lr-attachment-trigger` reaches its message keys through
// an indirect `{ triggerKey: '...' }`-shaped lookup table, not a literal `localize()` call) only
// exist in the real component tree, and both `check-component-dependencies.mjs`'s import-closure
// analysis and `generate-default-string-slices.mjs`'s reachability walk -- which this generator
// reuses rather than reimplementing -- are exercised against real source everywhere else they are
// tested.

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkRegistrationGraph,
  deriveRegistrationGraph,
  generateRegistrationGraph,
  renderRegistrationGraph,
} from './generate-registration-graph.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const inventory = JSON.parse(
  readFileSync(join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8'),
);

/** The real `LyraMessageKey` string-literal union, read the same way this file reads any other
 *  real repository source -- so `localeKeys` is checked against the actual public type, not a
 *  hand-copied guess of its members. */
function realMessageKeys() {
  const source = readFileSync(join(packageDir, 'src', 'internal', 'localization-types.ts'), 'utf8');
  const start = source.indexOf('export type LyraMessageKey =');
  assert.ok(start >= 0, 'src/internal/localization-types.ts must declare LyraMessageKey');
  const end = source.indexOf('\nexport type', start + 1);
  assert.ok(end > start, 'could not find the end of the LyraMessageKey union');
  const block = source.slice(start, end);
  const keys = new Set([...block.matchAll(/\|\s*'([^']+)'/g)].map((match) => match[1]));
  assert.ok(keys.size > 100, 'sanity: LyraMessageKey should have far more than 100 members');
  return keys;
}

const { entries, integrations, findings } = await deriveRegistrationGraph(inventory, { packageDir });

assert.equal(findings.length, 0, 'the real component-dependency graph must have no findings for this to be trustworthy');

// `entries` stays exactly what a reader of the first shape expects: every row carries a `tag`.
// Integration bridges live in their own array, so no tag-less row is ever mixed in.
const perTagEntries = entries;
assert.equal(
  entries.every((entry) => typeof entry.tag === 'string'),
  true,
  'every entries row carries a tag, as it always has',
);
const bridgeEntries = integrations;
const allRows = [...entries, ...integrations];

assert.equal(perTagEntries.length, inventory.components.length, 'one per-tag entry per inventory component');
assert.deepEqual(
  perTagEntries.map((entry) => entry.tag),
  [...perTagEntries.map((entry) => entry.tag)].sort((left, right) => left.localeCompare(right)),
  'per-tag entries must be sorted by tag',
);

// The concrete case this artifact exists for: importing lr-table's stable entry
// also registers its composed children, because table.ts imports their registration entries
// (empty.js, pagination.js, spinner.js, skeleton.js) before calling defineElement('table', ...).
const table = entries.find((entry) => entry.tag === 'lr-table');
assert.ok(table, 'lr-table must have a registration-graph entry');
assert.equal(table.entry, './components/lr-table.js');
assert.equal(table.registrationModule, 'src/components/data/table/table.ts');
assert.equal(table.distModule, './components/data/table/table.js');
assert.deepEqual(table.registers, ['lr-empty', 'lr-pagination', 'lr-skeleton', 'lr-spinner', 'lr-table']);

// Every entry registers at least its own tag (per-tag entries only -- a bridge entry has no own
// tag to require).
for (const entry of perTagEntries) {
  assert.ok(entry.registers.includes(entry.tag), `${entry.tag}: registers must include its own tag`);
}
for (const entry of entries) {
  const label = entry.tag ?? entry.entry;
  assert.deepEqual(
    entry.registers,
    [...entry.registers].sort((left, right) => left.localeCompare(right)),
    `${label}: registers must be sorted`,
  );
  assert.deepEqual(entry.registers, [...new Set(entry.registers)], `${label}: registers must not repeat a tag`);
  assert.ok(Array.isArray(entry.localeKeys), `${label}: localeKeys must be an array`);
  assert.deepEqual(
    entry.localeKeys,
    [...entry.localeKeys].sort((left, right) => left.localeCompare(right)),
    `${label}: localeKeys must be sorted`,
  );
  assert.deepEqual(entry.localeKeys, [...new Set(entry.localeKeys)], `${label}: localeKeys must not repeat a key`);
}

// A component with no composed children registers exactly itself -- not the whole family.
const badge = entries.find((entry) => entry.tag === 'lr-badge');
assert.ok(badge, 'lr-badge must have a registration-graph entry');
assert.deepEqual(badge.registers, ['lr-badge']);
// Spot check 1: lr-badge never calls this.localize() at all, so its reachable set is empty --
// proving `localeKeys` is not just "everything the class file happens to import".
assert.deepEqual(badge.localeKeys, []);

// Spot check 2: lr-attachment-trigger reaches most of its own message keys through an indirect
// `ATTACHMENT_KIND_META = { files: { triggerKey: 'attachmentTriggerFiles', menuKey:
// 'attachmentMenuFiles' }, ... }` lookup table -- `this.localize(meta.triggerKey)`, never a
// literal `this.localize('attachmentTriggerFiles')` call site. A localize()-only literal scan
// would miss every one of these; generate-default-string-slices.mjs's dynamic-key fallback
// (hasDynamicLocalizeKey() + the broad literal walk in reachableCatalogKeys()) resolves them
// because the object literal holding them sits in the same reachable graph as the non-literal
// call, and this generator reuses that walk rather than a second one.
const attachmentTrigger = entries.find((entry) => entry.tag === 'lr-attachment-trigger');
assert.ok(attachmentTrigger, 'lr-attachment-trigger must have a registration-graph entry');
for (const key of [
  'attachmentAdd',
  'attachmentMenuAudio',
  'attachmentMenuCamera',
  'attachmentMenuFiles',
  'attachmentMenuImage',
  'attachmentTriggerAudio',
  'attachmentTriggerCamera',
  'attachmentTriggerFiles',
  'attachmentTriggerImage',
]) {
  assert.ok(
    attachmentTrigger.localeKeys.includes(key),
    `lr-attachment-trigger.localeKeys must include ${key} (reached only via its triggerKey/menuKey lookup table)`,
  );
}
// Negative control: a key that belongs to an unrelated family must not leak in.
assert.ok(!attachmentTrigger.localeKeys.includes('archiveViewerEmpty'));

// Every localeKeys member is a real, currently-declared LyraMessageKey -- never a stale key, a
// typo, or an incidental literal that happens to collide with something else.
const messageKeys = realMessageKeys();
for (const entry of allRows) {
  const label = entry.tag ?? entry.entry;
  for (const key of entry.localeKeys) {
    assert.ok(messageKeys.has(key), `${label}: localeKeys contains ${key}, which is not a LyraMessageKey member`);
  }
}

// The three published, non-per-tag registration specifiers a consumer previously had to walk dist
// to resolve. Each is validated against the real transitive import closure of its own module, not
// inferred from its file name.
assert.equal(bridgeEntries.length, 3, 'exactly the three known published integration-bridge specifiers');
assert.deepEqual(
  bridgeEntries.map((entry) => entry.entry),
  [...bridgeEntries.map((entry) => entry.entry)].sort((left, right) => left.localeCompare(right)),
  'bridge entries must be sorted by entry (they have no tag to sort by)',
);

const flagPeer = integrations.find((entry) => entry.entry === './components/media/flag/flag-peer.js');
assert.ok(flagPeer, 'flag-peer.js must have a registration-graph entry');
assert.equal(flagPeer.registrationModule, 'src/components/media/flag/flag-peer.ts');
assert.equal(flagPeer.distModule, flagPeer.entry);
assert.equal('tag' in flagPeer, false, 'an integration-bridge entry has no single owning tag');
// flag-peer.ts imports flag.js (registers lr-flag, which itself imports skeleton.js) -- it never
// calls defineElement() itself, but transitively registers both.
assert.deepEqual(flagPeer.registers, ['lr-flag', 'lr-skeleton']);

const archiveViewerRegister = integrations.find(
  (entry) => entry.entry === './components/viewers/archive-viewer/archive-viewer-register.js',
);
assert.ok(archiveViewerRegister, 'archive-viewer-register.js must have a registration-graph entry');
assert.equal(archiveViewerRegister.registrationModule, 'src/components/viewers/archive-viewer/archive-viewer-register.ts');
// archive-viewer-register.ts only ever reaches lr-archive-viewer through a lazy `import()`
// (triggered once a matching zip file appears), which itself eagerly imports virtual-list.js.
assert.deepEqual(archiveViewerRegister.registers, ['lr-archive-viewer', 'lr-virtual-list']);

const ebookViewerRegister = integrations.find(
  (entry) => entry.entry === './components/viewers/ebook-viewer/ebook-viewer-register.js',
);
assert.ok(ebookViewerRegister, 'ebook-viewer-register.js must have a registration-graph entry');
assert.equal(ebookViewerRegister.registrationModule, 'src/components/viewers/ebook-viewer/ebook-viewer-register.ts');
assert.deepEqual(ebookViewerRegister.registers, ['lr-ebook-viewer']);

// Every entry's distModule/entry must be a real, currently-published package.json#exports key --
// a consumer resolving either field against the tarball must never dead-end.
const packageJson = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
for (const entry of allRows) {
  const label = entry.tag ?? entry.entry;
  assert.ok(packageJson.exports[entry.entry], `${label}: entry ${entry.entry} is not a published package.json#exports key`);
  assert.ok(packageJson.exports[entry.distModule], `${label}: distModule ${entry.distModule} is not a published package.json#exports key`);
}

// Rendering is deterministic and JSON-parseable, with a single trailing newline like the other
// generated root artifacts (custom-elements.json, design-tokens.json).
const rendered = renderRegistrationGraph(entries, integrations);
assert.equal(rendered, renderRegistrationGraph(entries, integrations), 'rendering must be deterministic');
assert.equal(rendered.endsWith('\n'), true);
assert.equal(rendered.indexOf('\n'), rendered.length - 1, 'the artifact is single-line, like custom-elements.json');
const parsed = JSON.parse(rendered);
// The additions (integrations, distModule, localeKeys) are all additive, so the schema version a
// reader already checks is unchanged.
assert.equal(parsed.schemaVersion, 1);
assert.deepEqual(parsed.entries, entries);
assert.deepEqual(parsed.integrations, integrations);

// Regenerating the graph from scratch (a fresh reachability walk, not a cached value) must be
// byte-identical to the first derivation -- the whole point of this being a generated artifact
// with a CI freshness gate rather than a hand-maintained one.
const rederived = await deriveRegistrationGraph(inventory, { packageDir });
assert.equal(
  renderRegistrationGraph(rederived.entries, rederived.integrations),
  rendered,
  'a second derivation must be byte-identical',
);

// generateRegistrationGraph()/checkRegistrationGraph() round-trip against a real filesystem: no
// artifact yet -> stale; write it -> fresh; re-run generation -> byte-identical (idempotent).
const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-registration-graph-'));
try {
  const src = join(fixtureRoot, 'src');
  const scriptsFixtures = join(fixtureRoot, 'scripts', 'fixtures');
  mkdirSync(scriptsFixtures, { recursive: true });
  cpSync(join(packageDir, 'src'), src, { recursive: true });
  writeFileSync(join(scriptsFixtures, 'component-inventory.json'), JSON.stringify(inventory));
  writeFileSync(join(fixtureRoot, 'package.json'), readFileSync(join(packageDir, 'package.json'), 'utf8'));

  const before = await checkRegistrationGraph(fixtureRoot);
  assert.equal(before.stale, true, 'no artifact on disk yet must report stale');
  assert.equal(existsSync(before.path), false);

  const generated = await generateRegistrationGraph(fixtureRoot);
  assert.deepEqual(generated.entries, entries);
  assert.deepEqual(generated.integrations, integrations);

  const after = await checkRegistrationGraph(fixtureRoot);
  assert.equal(after.stale, false, 'freshly generated artifact must report fresh');
  assert.equal(readFileSync(before.path, 'utf8'), rendered);

  await generateRegistrationGraph(fixtureRoot);
  assert.equal(readFileSync(before.path, 'utf8'), rendered, 'regeneration must be idempotent');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(
  `registration graph generation tests passed (${entries.length} entries, ${integrations.length} integrations).`,
);
