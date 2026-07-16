#!/usr/bin/env node
// Standalone test for scripts/migrate-wa.mjs -- plain `node:assert`, not wired into the wtr
// suite (this codemod runs against arbitrary consumer source trees, not lyra-ui's own component
// sources, so it doesn't fit that harness). Run directly: `node scripts/migrate-wa.test.mjs`.
//
// Covers: (1) the README-derived mirror map contains the expected mappings and deliberately omits
// the documented non-1:1 rows; (2) rewriteFile() rewrites real tag/import usage while leaving
// false-positive-shaped text (comments, prose, an unrelated same-prefixed package name, an
// undocumented wa- tag) untouched; (3) an end-to-end CLI run over a scratch fixture directory,
// proving --dry-run reports without writing and a real run writes the rewritten content.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMirrorMap, rewriteFile } from './migrate-wa.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const migratePath = path.join(scriptDir, 'migrate-wa.mjs');
const readmeText = fs.readFileSync(path.join(packageDir, 'README.md'), 'utf8');

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(err instanceof Error ? err.stack : err);
  }
}

// --- 1. Mirror-map derivation -------------------------------------------------------------

test('buildMirrorMap finds direct 1:1 mirrored tags', () => {
  const { map, conflicts } = buildMirrorMap(readmeText);
  assert.equal(conflicts.length, 0, `unexpected conflicts: ${conflicts.join('; ')}`);
  assert.equal(map.get('wa-button'), 'lyra-button');
  assert.equal(map.get('wa-combobox'), 'lyra-combobox');
  assert.equal(map.get('wa-date-input'), 'lyra-date-input');
  assert.equal(map.get('wa-progress-bar'), 'lyra-progress-bar');
  assert.equal(map.get('wa-progress-ring'), 'lyra-progress-ring');
});

test('buildMirrorMap resolves the wa-format-* wildcard row per-tag', () => {
  const { map } = buildMirrorMap(readmeText);
  assert.equal(map.get('wa-format-number'), 'lyra-format-number');
  assert.equal(map.get('wa-format-date'), 'lyra-format-date');
  assert.equal(map.get('wa-format-bytes'), 'lyra-format-bytes');
  assert.equal(map.get('wa-relative-time'), 'lyra-relative-time');
});

test('buildMirrorMap does not invent a mapping for a mismatched-count row', () => {
  const { map } = buildMirrorMap(readmeText);
  // The typed chart subclasses (<lyra-bar-chart> etc.) all list `wa-chart` in their Mirrors cell,
  // but none of them has its own literal `wa-bar-chart` tag documented -- only the base
  // `<lyra-chart>` row does.
  assert.equal(map.get('wa-chart'), 'lyra-chart');
  assert.equal(map.has('wa-bar-chart'), false);
  assert.equal(map.has('wa-line-chart'), false);
  // <lyra-option> shares no documented `wa-option` mirror anywhere in the table (only
  // `wa-combobox`/`wa-select` are listed for the rows it appears in).
  assert.equal(map.has('wa-option'), false);
  // <lyra-accordion-item> has no documented `wa-accordion-item` mirror.
  assert.equal(map.has('wa-accordion-item'), false);
});

test('buildMirrorMap parses the Shoelace table by suffix', () => {
  const { map } = buildMirrorMap(readmeText);
  assert.equal(map.get('sl-button'), 'lyra-button');
  assert.equal(map.get('sl-progress-bar'), 'lyra-progress-bar');
  assert.equal(map.get('sl-option'), 'lyra-option');
});

// --- 2. rewriteFile() text rewriting ----------------------------------------------------------

const SAMPLE = `
<!-- migrating wa-panel-legacy soon, not a real tag -->
import '@shoelace-style/shoelace';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import { registerStuff } from '@shoelace-style/shoelace-icons';
import '@awesome.me/webawesome';

const html = \`
  <wa-combobox value="x" multiple with-clear>
    <wa-option value="a">Apple</wa-option>
  </wa-combobox>
  <wa-button variant="brand">Save</wa-button>
\`;

// See wa-button docs for details.
customElements.get('wa-button');
const knownTags = ['wa-button', 'sl-input'];
const notice = "wa-button is great";
`;

const { map: sampleMap } = buildMirrorMap(readmeText);

test('rewriteFile rewrites open/close tags for a mapped wa- tag', () => {
  const { content, tagCounts } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /<lyra-combobox value="x" multiple with-clear>/);
  assert.match(content, /<\/lyra-combobox>/);
  assert.match(content, /<lyra-button variant="brand">Save<\/lyra-button>/);
  const combobox = tagCounts.get('wa-combobox');
  assert.ok(combobox && combobox.count === 2, 'expected wa-combobox open+close = 2 replacements');
});

test('rewriteFile leaves an undocumented wa-option tag untouched', () => {
  const { content } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /<wa-option value="a">Apple<\/wa-option>/);
});

test('rewriteFile leaves a comment mentioning wa-panel-legacy untouched', () => {
  const { content } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /<!-- migrating wa-panel-legacy soon, not a real tag -->/);
});

test('rewriteFile leaves prose containing "wa-button" (not an exact-quoted tag) untouched', () => {
  const { content } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /\/\/ See wa-button docs for details\./);
});

test('rewriteFile rewrites an exact quoted registration-style string', () => {
  const { content } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /customElements\.get\('lyra-button'\)/);
  assert.match(content, /const knownTags = \['lyra-button', 'lyra-input'\]/);
});

test('rewriteFile rewrites a quoted string that is exactly a mapped tag name, even mid-sentence-looking', () => {
  // Known, documented limitation: `"wa-button is great"` is not an exact-content match (the
  // whole string is "wa-button is great", not "wa-button"), so it is correctly left alone --
  // this proves the exact-match guard, not a false positive.
  const { content } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /"wa-button is great"/);
});

test('rewriteFile rewrites the bare Shoelace/Web Awesome package specifiers', () => {
  const { content, importChanges } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /import '@aceshooting\/lyra-ui';\nimport '@shoelace-style\/shoelace\/dist\/components\/button\/button\.js';/);
  assert.match(content, /import '@aceshooting\/lyra-ui';\n\nconst html/);
  assert.equal(importChanges.length, 2);
});

test('rewriteFile leaves a same-prefixed different package name untouched', () => {
  const { content } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /from '@shoelace-style\/shoelace-icons'/);
});

test('rewriteFile leaves a deep subpath import unchanged and reports it as a warning', () => {
  const { content, importWarnings } = rewriteFile(SAMPLE, sampleMap);
  assert.match(content, /import '@shoelace-style\/shoelace\/dist\/components\/button\/button\.js';/);
  assert.deepEqual(importWarnings, ['@shoelace-style/shoelace/dist/components/button/button.js']);
});

// --- 3. End-to-end CLI over a scratch fixture --------------------------------------------------

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-wa-test-'));
try {
  const fixtureFile = path.join(scratchDir, 'page.html');
  const fixtureContent = `<wa-button variant="brand">Go</wa-button>\n<div class="wa-not-a-tag">kept</div>\n`;
  fs.writeFileSync(fixtureFile, fixtureContent, 'utf8');

  test('CLI --dry-run reports the change without writing', () => {
    const out = execFileSync('node', [migratePath, '--dry-run', scratchDir], { encoding: 'utf8' });
    assert.match(out, /<wa-button> -> <lyra-button>/);
    assert.equal(fs.readFileSync(fixtureFile, 'utf8'), fixtureContent, 'dry-run must not write the file');
  });

  test('CLI without --dry-run writes the rewritten file', () => {
    const out = execFileSync('node', [migratePath, scratchDir], { encoding: 'utf8' });
    assert.match(out, /1 changed/);
    const written = fs.readFileSync(fixtureFile, 'utf8');
    assert.match(written, /<lyra-button variant="brand">Go<\/lyra-button>/);
    // The unrelated class name is not a real tag usage (not anchored on `<`/`</`, and not an
    // exact-quoted match either -- it's inside a double-quoted attribute value alongside other
    // content... actually it IS the entire attribute value here, so confirm it is intentionally
    // left alone because `wa-not-a-tag` is not a key in the derived map at all.
    assert.match(written, /class="wa-not-a-tag"/);
  });
} finally {
  fs.rmSync(scratchDir, { recursive: true, force: true });
}

console.log('');
if (failures > 0) {
  console.error(`${failures} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('All migrate-wa tests passed.');
}
