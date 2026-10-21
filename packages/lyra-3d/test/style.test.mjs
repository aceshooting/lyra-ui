import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { parseCssColor } from '../dist/core/style.js';

test('parses signed, fractional, exponential and percentage color channels', () => {
  for (const input of [
    'rgb(+255. -0 .5e2 / +.25)',
    'rgba(2.55e2, -0, 5e1, 25%)',
    'color(  srgb 1. -0 .5e0 / 2.5e1%)',
    'COLOR(\tsRGB\n1 -0 50% / .25)',
  ]) {
    const parsed = parseCssColor(input);
    assert.ok(parsed, input);
    assert.equal(parsed.r, 1, input);
    assert.equal(parsed.g, 0, input);
    assert.equal(parsed.b, input.startsWith('rgb') ? 50 / 255 : 0.5, input);
    assert.equal(parsed.a, 0.25, input);
  }
  assert.deepEqual(parseCssColor('color(srgb none none none / none)'), { r: 0, g: 0, b: 0, a: 0 });
  for (const input of [
    'rgb(1e 0 0)', 'rgb(1e+ 0 0)', 'rgb(. 0 0)', 'rgb(+ 0 0)', 'rgb(1.2.3 0 0)',
    'rgb(1e999 0 0)', 'rgb(0x10 0 0)', 'color(srgb1 0 0)', 'color(srgb 1 0 0',
  ]) {
    assert.equal(parseCssColor(input), null, input);
  }
});

const parserProbeScript = `
  import assert from 'node:assert/strict';
  const { parseCssColor } = await import(process.argv[1]);
  const input = process.argv[2] === 'numeric channels'
    ? 'rgb(' + '0'.repeat(200_000) + '! 0 0)'
    : 'color(srgb ' + ' '.repeat(200_000) + '!';
  assert.equal(parseCssColor(input), null);
`;

for (const name of ['numeric channels', 'sRGB whitespace']) {
  test(`rejects long malformed ${name} without blocking`, () => {
    // Isolate the parser so a regression cannot block the entire test runner.
    execFileSync(process.execPath, [
      '--input-type=module', '-e', parserProbeScript,
      new URL('../dist/core/style.js', import.meta.url).href, name,
    ], { timeout: 5000 });
  });
}
