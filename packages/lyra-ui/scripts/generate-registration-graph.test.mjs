#!/usr/bin/env node
// Standalone test for scripts/generate-registration-graph.mjs -- plain `node:assert`, not wired
// into the wtr suite (this generator reads source text and JSON, it does not render components).
// Run directly: `node scripts/generate-registration-graph.test.mjs`.
//
// Operates against the real repository inventory/source rather than a synthetic fixture, the same
// way scripts/design-tokens.test.mjs reads the real canonical tokens: the concrete case this
// generator exists for (`lr-table.js` also registers `lr-empty`/`lr-pagination`/`lr-skeleton`/
// `lr-spinner`) only exists in the real component tree, and check-component-dependencies.mjs's own
// analysis -- which this generator reuses rather than reimplementing -- is exercised against real
// source everywhere else it is tested.

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

const { entries, findings } = deriveRegistrationGraph(inventory, { packageDir });

assert.equal(findings.length, 0, 'the real component-dependency graph must have no findings for this to be trustworthy');
assert.equal(entries.length, inventory.components.length, 'one entry per inventory component');
assert.deepEqual(
  entries.map((entry) => entry.tag),
  [...entries.map((entry) => entry.tag)].sort((left, right) => left.localeCompare(right)),
  'entries must be sorted by tag',
);

// The audit's own concrete example (fr_IZcp_YakOYwAQKvCSqpWUg): importing lr-table's stable entry
// also registers its composed children, because table.ts imports their registration entries
// (empty.js, pagination.js, spinner.js, skeleton.js) before calling defineElement('table', ...).
const table = entries.find((entry) => entry.tag === 'lr-table');
assert.ok(table, 'lr-table must have a registration-graph entry');
assert.equal(table.entry, './components/lr-table.js');
assert.equal(table.registrationModule, 'src/components/data/table/table.ts');
assert.deepEqual(table.registers, ['lr-empty', 'lr-pagination', 'lr-skeleton', 'lr-spinner', 'lr-table']);

// Every entry registers at least its own tag.
for (const entry of entries) {
  assert.ok(entry.registers.includes(entry.tag), `${entry.tag}: registers must include its own tag`);
  assert.deepEqual(
    entry.registers,
    [...entry.registers].sort((left, right) => left.localeCompare(right)),
    `${entry.tag}: registers must be sorted`,
  );
  assert.deepEqual(entry.registers, [...new Set(entry.registers)], `${entry.tag}: registers must not repeat a tag`);
}

// A component with no composed children registers exactly itself -- not the whole family.
const badge = entries.find((entry) => entry.tag === 'lr-badge');
assert.ok(badge, 'lr-badge must have a registration-graph entry');
assert.deepEqual(badge.registers, ['lr-badge']);

// Rendering is deterministic and JSON-parseable, with a single trailing newline like the other
// generated root artifacts (custom-elements.json, design-tokens.json).
const rendered = renderRegistrationGraph(entries);
assert.equal(rendered, renderRegistrationGraph(entries), 'rendering must be deterministic');
assert.equal(rendered.endsWith('\n'), true);
assert.equal(rendered.indexOf('\n'), rendered.length - 1, 'the artifact is single-line, like custom-elements.json');
const parsed = JSON.parse(rendered);
assert.equal(parsed.schemaVersion, 1);
assert.deepEqual(parsed.entries, entries);

// generateRegistrationGraph()/checkRegistrationGraph() round-trip against a real filesystem: no
// artifact yet -> stale; write it -> fresh; re-run generation -> byte-identical (idempotent).
const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-registration-graph-'));
try {
  const src = join(fixtureRoot, 'src');
  const scriptsFixtures = join(fixtureRoot, 'scripts', 'fixtures');
  mkdirSync(scriptsFixtures, { recursive: true });
  cpSync(join(packageDir, 'src'), src, { recursive: true });
  writeFileSync(join(scriptsFixtures, 'component-inventory.json'), JSON.stringify(inventory));

  const before = checkRegistrationGraph(fixtureRoot);
  assert.equal(before.stale, true, 'no artifact on disk yet must report stale');
  assert.equal(existsSync(before.path), false);

  const generated = generateRegistrationGraph(fixtureRoot);
  assert.deepEqual(generated.entries, entries);

  const after = checkRegistrationGraph(fixtureRoot);
  assert.equal(after.stale, false, 'freshly generated artifact must report fresh');
  assert.equal(readFileSync(before.path, 'utf8'), rendered);

  generateRegistrationGraph(fixtureRoot);
  assert.equal(readFileSync(before.path, 'utf8'), rendered, 'regeneration must be idempotent');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log(`registration graph generation tests passed (${entries.length} entries).`);
