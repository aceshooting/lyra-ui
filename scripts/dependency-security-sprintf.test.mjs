import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

const packageRequire = createRequire(new URL('../packages/lyra-ui/package.json', import.meta.url));
const mammothRequire = createRequire(packageRequire.resolve('mammoth'));
const argparseRequire = createRequire(mammothRequire.resolve('argparse'));
const sprintfModule = argparseRequire.resolve('sprintf-js');
const { sprintf, vsprintf } = argparseRequire('sprintf-js');

test('sprintf clamps excessive numeric precision without aborting formatting', () => {
  for (const [type, method] of [['f', 'toFixed'], ['e', 'toExponential'], ['g', 'toPrecision']]) {
    for (const precision of ['101', '999999999', '9'.repeat(400)]) {
      const format = `%.${precision}${type}`;
      assert.equal(sprintf(format, 1.25), (1.25)[method](100));
      assert.equal(vsprintf(format, [1.25]), (1.25)[method](100));
      assert.equal(sprintf(format, () => 1.25), (1.25)[method](100));
      // Reusing the format also covers cached parse trees.
      assert.equal(sprintf(format, 1.25), (1.25)[method](100));
    }
  }
  assert.equal(sprintf('%.0g', 1.25), '1');
});

test('sprintf bounds padding before allocating even with overflowing width', () => {
  // Isolate a regression so a missing guard cannot exhaust the test runner.
  const result = spawnSync(process.execPath, ['--max-old-space-size=64', '-e', `
    const assert = require('node:assert/strict');
    const { sprintf } = require(${JSON.stringify(sprintfModule)});
    for (const width of ['10001', '999999999', '9'.repeat(400)]) {
      for (const format of ['%' + width + 's', '%-' + width + 's', "%\'_" + width + 's']) {
        const output = sprintf(format, 'x');
        assert.equal(output.length, 10000);
        assert.equal(output.trim().replaceAll('_', ''), 'x');
      }
      assert.equal(sprintf('%0' + width + 'd', -1).length, 10000);
    }
  `], { encoding: 'utf8', timeout: 5_000, maxBuffer: 64 * 1024 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test('sprintf preserves supported precision, padding, argument and JSON formats', () => {
  for (const [type, method] of [['f', 'toFixed'], ['e', 'toExponential'], ['g', 'toPrecision']]) {
    for (const precision of [1, 20, 100]) {
      assert.equal(sprintf(`%.${precision}${type}`, 1.25), (1.25)[method](precision));
    }
  }
  assert.equal(sprintf('%.0f %.0e', 1.25, 1.25), '1 1e+0');
  assert.equal(sprintf('%f %g %e', 1.25, 1.25, 1.25), '1.25 1.25 1.25e+0');
  assert.equal(sprintf('%+010d', -123), '-000000123');
  assert.equal(sprintf("%'_10d", -123), '______-123');
  assert.equal(sprintf('%-5s', 'x'), 'x    ');
  assert.equal(sprintf('%10000s', 'x').length, 10000);
  assert.equal(sprintf('%.3s', 'abcdef'), 'abc');
  assert.equal(sprintf('%.999999s', 'abcdef'), 'abcdef');
  assert.equal(sprintf('%2$s %1$s', 'world', 'Hello'), 'Hello world');
  assert.equal(sprintf('%(name)s: %(count)03d', { name: 'items', count: 2 }), 'items: 002');
  assert.equal(sprintf('%2j', { value: 2 }), JSON.stringify({ value: 2 }, null, 2));
  assert.equal(sprintf('%% %s', () => 'value'), '% value');
});

test('Mammoth CLI retains argparse help formatting and argument validation', () => {
  const cli = mammothRequire.resolve('mammoth/bin/mammoth');
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(help.error, undefined, help.error?.message);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /usage:/u);
  assert.match(help.stdout, /--output-format.*html.*markdown/u);
  assert.match(help.stdout, /docx-path/u);
  const invalid = spawnSync(process.execPath, [cli, 'example.docx', '--output-format', 'invalid'], {
    encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(invalid.error, undefined, invalid.error?.message);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /invalid choice/iu);
  assert.doesNotMatch(invalid.stderr, /TypeError|RangeError/u);
});
