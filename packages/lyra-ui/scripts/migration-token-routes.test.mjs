import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import table from './fixtures/upstream-token-routes.json' with { type: 'json' };
import { buildMigrationContract, migrateText } from './migrate-wa.mjs';
import { lookupUpstreamToken, scanUpstreamTokenRoutes } from './migration-token-routes.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.dirname(scriptDir);
const contract = buildMigrationContract(
  JSON.parse(fs.readFileSync(path.join(scriptDir, 'fixtures', 'migrate-wa', 'inventory.json'), 'utf8')),
);
const migrate = (input, file = 'app.css') => migrateText(input, contract, { file });

test('every route target is declared by the Lyra document token layer', () => {
  // Application CSS outside a component sees only the document layer, so a target that only a
  // component host declares would resolve to nothing in the consumer's own stylesheet.
  const layer = fs.readFileSync(path.join(packageDir, 'src', 'styles', 'tokens-root.css'), 'utf8');
  const declared = new Set([...layer.matchAll(/(--lr-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
  const targets = [...Object.values(table.exact), ...Object.values(table.approximate).map((entry) => entry.target)];
  assert.ok(targets.length > 100, 'the table covers the colour, spacing, type, radius, border, shadow and motion roles');
  for (const target of new Set(targets)) assert.ok(declared.has(target), `${target} is not a document-layer token`);
});

test('the route table never claims a name twice and only routes upstream names', () => {
  const exact = Object.keys(table.exact);
  const approximate = Object.keys(table.approximate);
  const review = Object.keys(table.review);
  for (const name of [...exact, ...approximate, ...review]) assert.match(name, /^--(?:wa|sl)-[a-z0-9-]+$/, name);
  for (const name of approximate) {
    assert.equal(Object.hasOwn(table.exact, name), false, name);
    assert.ok(table.approximate[name].note, `${name} needs a review note`);
  }
  for (const name of review) {
    assert.equal(Object.hasOwn(table.exact, name) || Object.hasOwn(table.approximate, name), false, name);
  }
  // A pattern must never shadow a route: a routed name resolves to its route, not to a review.
  for (const name of [...exact, ...approximate]) assert.notEqual(lookupUpstreamToken(name).kind, 'review', name);
});

test('spacing routes by resolved value, not by name', () => {
  assert.equal(lookupUpstreamToken('--wa-space-m').target, '--lr-space-l');
  assert.equal(lookupUpstreamToken('--wa-space-3xs').target, '--lr-space-2xs');
  assert.equal(lookupUpstreamToken('--sl-spacing-medium').target, '--lr-space-l');
  assert.equal(lookupUpstreamToken('--wa-space-2xl').kind, 'review');
  assert.equal(lookupUpstreamToken('--sl-spacing-large').kind, 'review');
  assert.equal(lookupUpstreamToken('--wa-unknown-thing'), null);
});

test('exact routes rewrite silently; approximate routes rewrite and warn; the rest only warn', () => {
  const input = [
    '.card {',
    '  background: var(--wa-color-surface-default);',
    '  color: var(--wa-color-brand-on-loud);',
    '  padding: var(--sl-spacing-small) var(--wa-space-2xl);',
    '  box-shadow: var(--wa-shadow-m);',
    '  border-color: var(--sl-color-primary-600);',
    '  outline-color: var(--sl-color-primary-300);',
    '}',
    '',
  ].join('\n');
  const result = migrate(input);
  assert.equal(
    result.content,
    [
      '.card {',
      '  background: var(--lr-color-surface);',
      '  color: var(--lr-color-brand-on-loud);',
      '  padding: var(--lr-space-m) var(--wa-space-2xl);',
      '  box-shadow: var(--lr-shadow-m);',
      '  border-color: var(--lr-color-brand-fill-loud);',
      '  outline-color: var(--sl-color-primary-300);',
      '}',
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    result.changes.filter((entry) => entry.action === 'rewrite-token').map((entry) => [entry.upstreamMember, entry.origin]),
    [
      ['--wa-color-surface-default', 'webawesome'],
      ['--wa-color-brand-on-loud', 'webawesome'],
      ['--sl-spacing-small', 'shoelace'],
      ['--wa-shadow-m', 'webawesome'],
      ['--sl-color-primary-600', 'shoelace'],
    ],
  );
  const warnings = result.warnings.map((entry) => [entry.upstreamMember ?? entry.target, entry.warningCode, entry.target]);
  assert.deepEqual(
    result.warnings.map((entry) => entry.warningCode).sort(),
    [
      'UPSTREAM_TOKEN_APPROXIMATE_REVIEW',
      'UPSTREAM_TOKEN_APPROXIMATE_REVIEW',
      'UPSTREAM_TOKEN_REVIEW',
      'UPSTREAM_TOKEN_REVIEW',
    ],
    JSON.stringify(warnings),
  );
  const review = result.warnings.find((entry) => entry.target === '--wa-space-2xl');
  assert.match(review.message, /2\.5rem has no Lyra spacing step/, 'a reviewed token carries its hint');
  const palette = result.warnings.find((entry) => entry.target === '--sl-color-primary-300');
  assert.match(palette.message, /numbered palette/, 'a palette family carries its pattern hint');
});

test('declared names, longer names and comments are never rewritten', () => {
  const input = [
    ':root { --wa-space-m: 2rem; }',
    '.a { gap: var(--wa-space-m); margin: var(--wa-space-m-extra); }',
    '/* var(--wa-space-s) */',
    '.b { gap: var(--wa-space-s); }',
    '',
  ].join('\n');
  const result = migrate(input);
  assert.equal(
    result.content,
    [
      ':root { --wa-space-m: 2rem; }',
      '.a { gap: var(--wa-space-m); margin: var(--wa-space-m-extra); }',
      '/* var(--wa-space-s) */',
      '.b { gap: var(--lr-space-m); }',
      '',
    ].join('\n'),
  );
  const hits = scanUpstreamTokenRoutes(input).map((hit) => hit.token);
  assert.deepEqual(hits, ['--wa-space-s', '--wa-space-s'], 'the scanner itself skips declared and longer names');
});

test('tokens inside a css tagged template are rewritten too', () => {
  const input = "import { css } from 'lit';\nexport const styles = css`:host { border-radius: var(--wa-border-radius-pill); }`;\n";
  const result = migrate(input, 'styles.ts');
  assert.match(result.content, /var\(--lr-radius-pill\)/);
  assert.equal(result.warnings.length, 0);
});
