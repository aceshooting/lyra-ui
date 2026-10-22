import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import fc from 'fast-check';
import { parseJsonc } from './jsonc.mjs';

test('JSONC trailing commas and comments leave quoted content unchanged', () => {
  fc.assert(fc.property(fc.string({ maxLength: 48 }), (value) => {
    const quoted = JSON.stringify(`before,} ${value} after,]`);
    assert.deepEqual(
      parseJsonc(`{/* block */"value":${quoted},// line\n"items":[1,2,],}`),
      { value: `before,} ${value} after,]`, items: [1, 2] },
    );
  }), { seed: 30_031, numRuns: 200 });
});

test('malformed comments and quoted strings fail promptly', () => {
  for (const source of ['{"value":"unterminated}', '{/* unterminated', '{"value":"escaped\\']) {
    const child = spawnSync(process.execPath, [
      '--input-type=module', '-e',
      `import { parseJsonc } from ${JSON.stringify(new URL('./jsonc.mjs', import.meta.url).href)}; parseJsonc(${JSON.stringify(source)});`,
    ], { encoding: 'utf8', timeout: 1000 });
    assert.equal(child.error?.code, undefined, 'the parser must finish before the timeout');
    assert.notEqual(child.status, 0, 'malformed input must fail');
  }
});

test('a comma without a preceding value stays invalid', () => {
  for (const source of ['{,}', '[,]', '{"x":,}', '{"x":/* gap */,}', '[1,,]']) {
    assert.throws(() => parseJsonc(source), SyntaxError, source);
  }
});

test('line comments end at LF, CRLF and CR', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    assert.deepEqual(parseJsonc(`{"x":1,// comment${newline}"y":2,}`), { x: 1, y: 2 });
  }
});
