import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { compareDuplication, cssTemplateText, duplicationScopes } from './check-duplication.mjs';

test('scope inventory excludes generated files but retains authored component fixtures', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lyra-duplication-scopes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function write(name, contents = 'export {};\n') {
    const file = join(root, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
    return file;
  }
  const logic = write('packages/lyra-ui/src/internal/fixture.ts');
  const sourceFixture = write('packages/lyra-ui/src/internal/fixtures/probe.ts');
  write('packages/lyra-ui/src/internal/generated.ts', '// GENERATED FILE\nexport {};\n');
  const testFile = write('packages/lyra-ui/src/internal/fixture.test.ts');
  const style = write('packages/lyra-ui/src/internal/fixture.styles.ts', 'export const styles = css`color: red`;\n');
  const tooling = write('packages/lyra-ui/scripts/check-example.mjs');
  write('packages/lyra-ui/scripts/fixtures/example.mjs');
  const scopes = duplicationScopes(root);
  assert.deepEqual(scopes.logic.sort(), [logic, sourceFixture].sort());
  assert.deepEqual(scopes.tests, [testFile]);
  assert.deepEqual(scopes.styles, [style]);
  assert.deepEqual(scopes.tooling, [tooling]);
});

test('CSS extraction keeps line positions and excludes interpolation expressions', () => {
  const source = 'const x = css`a { color: red; }\n b { width: ${size}; }`;\n';
  const result = cssTemplateText('sample.styles.ts', source);
  assert.equal(result.count, 1);
  assert.equal(result.text.split('\n').length, source.split('\n').length);
  assert.match(result.text, /color: red/);
  assert.match(result.text, /__I__/);
  assert.doesNotMatch(result.text, /size/);
});

test('duplication comparison fails closed on missing baseline, shrinking coverage, and growth', () => {
  const scopes = ['logic', 'tooling', 'tests', 'css'];
  const measured = Object.fromEntries(scopes.map((scope) => [scope, { sources: 100, percentage: 2 }]));
  assert.match(compareDuplication(measured, undefined).join('\n'), /missing reviewed duplication baseline/);
  const baseline = { version: 1, jscpdVersion: '5.4.0', scopes: Object.fromEntries(
    scopes.map((scope) => [scope, { measuredSources: 100, maxPercentage: 2 }]),
  ) };
  assert.deepEqual(compareDuplication(measured, baseline), []);
  assert.match(compareDuplication({ ...measured, css: { sources: 90, percentage: 3 } }, baseline).join('\n'),
    /source coverage shrank.*exceeds/s);
});

test('CSS extraction preserves multiple template spans and ignores other tagged templates', () => {
  const source = 'const other = html`ignored`;\nconst styles = css`a { width: ${width}px;\n color: ${color}; }`;\nconst more = css`b { display: block; }`;';
  const result = cssTemplateText('sample.styles.ts', source);
  assert.equal(result.count, 2);
  assert.equal(result.text.split('\n').length, source.split('\n').length);
  assert.equal(result.text.match(/__I__/g).length, 2);
  assert.match(result.text, /px;/);
  assert.match(result.text, /display: block/);
  assert.doesNotMatch(result.text, /ignored|width}|color}/);
});
