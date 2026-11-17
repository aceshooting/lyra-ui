import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';

const rootRequire = createRequire(new URL('../package.json', import.meta.url));
const packageRequire = createRequire(new URL('../packages/lyra-ui/package.json', import.meta.url));
const analyzerRequire = createRequire(packageRequire.resolve('@custom-elements-manifest/analyzer'));
const globbyRequire = createRequire(analyzerRequire.resolve('globby'));
const fastGlobRequire = createRequire(globbyRequire.resolve('fast-glob'));
const micromatchRequire = createRequire(fastGlobRequire.resolve('micromatch'));
const viteRequire = createRequire(rootRequire.resolve('vite'));
const installations = [
  ['2.3.2', micromatchRequire.resolve('picomatch')],
  ['4.0.7', viteRequire.resolve('picomatch')],
];

// Keep every potentially exponential match in a killable child process.
function repeatedWildcardCases(pm) {
  const patterns = ['+(*)z', '*(*)z', '+(*a)z', '*(*a)z', '+(@(*a))z',
    '+([ab]*a)z', '+([[]*a)z', '+([[:alpha:]]*a)z', '+(*a|b)z',
    '+("literal"*a)z', '+(*(?:a))z', '+(*a\\+)z'];
  const configurations = [{}, { maxExtglobRecursion: false }, { maxExtglobRecursion: 1000000 },
    { fastpaths: false }, { capture: true }, { dot: true }, { bash: true },
    { windows: true }, { posix: false }, { regex: false }];
  for (const [pattern, options, unit] of [
    ['+([*a)z', {}, '[a'],
    ['*([*a)z', { maxExtglobRecursion: false }, '[a'],
    ['+([*]a)z', { nobracket: true }, '[]a'],
    ['*([*]a)z', { nobracket: true, maxExtglobRecursion: false }, '[]a'],
    ['+(a\\*)z', { unescape: true }, 'a'],
    ['*(a\\*)z', { unescape: true, maxExtglobRecursion: false }, 'a'],
    ['+("a\\*")z', { unescape: true }, 'a'],
    ['*("a\\*")z', { unescape: true, capture: true }, 'a'],
  ]) {
    for (const regex of [pm.makeRe(pattern, options), pm.compileRe(pm.parse(pattern, options), options)]) {
      assert.equal(regex.test(unit.repeat(40) + '!'), false, pattern);
      assert.equal(regex.test(pattern), true, pattern);
      assert.equal(regex.test(unit + 'z'), false, pattern);
      if (options.unescape === true) {
        assert.equal(regex.test(pattern.replaceAll('\\', '')), false, pattern);
        assert.equal(regex.test(pattern.replace('\\*', '')), false, pattern);
        assert.equal(regex.test(pattern.replace('\\*', '\\\\*')), false, pattern);
      }
    }
  }
  for (const options of configurations) {
    for (const pattern of patterns) {
      const compiled = [pm.makeRe(pattern, options), pm.compileRe(pm.parse(pattern, options), options)];
      for (const regex of compiled) {
        assert.equal(regex.test('a'.repeat(40) + '!'), false, pattern);
        assert.equal(regex.test('aaaz'), false, pattern);
        // Risky repetitions follow picomatch's existing literalization convention.
        assert.equal(regex.test(pattern), true, pattern);
      }
      assert.equal(pm(pattern, options)('a'.repeat(40) + '!'), false, pattern);
      assert.equal(pm.isMatch('a'.repeat(40) + '!', [pattern], options), false, pattern);
    }
  }
}

for (const [version, modulePath] of installations) {
  test(`picomatch ${version} repeated wildcard bodies stay bounded across compile and match APIs`, () => {
    assert.equal(JSON.parse(readFileSync(join(dirname(modulePath), 'package.json'), 'utf8')).version, version);
    const result = spawnSync(process.execPath, ['--max-old-space-size=64', '-e', `
      const assert = require('node:assert/strict');
      const pm = require(${JSON.stringify(modulePath)});
      (${repeatedWildcardCases.toString()})(pm);
    `], { encoding: 'utf8', timeout: 4000, maxBuffer: 64 * 1024, killSignal: 'SIGKILL' });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.signal, null, result.stderr);
    assert.equal(result.status, 0, result.stderr);
  });

  test(`picomatch ${version} keeps ordinary file and non-repeated extglob semantics`, () => {
    const pm = rootRequire(modulePath);
    for (const [pattern, yes, no] of [
      ['src/**/*.js', 'src/nested/file.js', 'src/nested/file.ts'],
      ['**/*.test.{js,ts}', 'src/file.test.ts', 'src/file.ts'],
      ['!(*.test).js', 'file.js', 'file.test.js'],
      ['**/!(*.d).ts', 'src/file.ts', 'src/file.d.ts'],
      ['@(*.js|*.ts)', 'file.ts', 'file.css'],
      ['?(*.js)', 'file.js', 'file.css'],
      ['+(ab|cd)', 'abcdab', 'abx'],
      ['+(a)', 'aaaa', 'b'],
      ['*(ab)', 'abab', 'aba'],
      ['+(*(a))', 'aaaa', 'b'],
    ]) {
      assert.equal(pm(pattern)(yes), true, pattern);
      assert.equal(pm(pattern)(no), false, pattern);
    }
    assert.equal(pm('*.js')('.hidden.js'), false);
    assert.equal(pm('*.js', { dot: true })('.hidden.js'), true);
    assert.equal(pm('src/*.js')('src/nested/file.js'), false);
  });

  test(`picomatch ${version} distinguishes literal stars in escapes, quotes and classes`, () => {
    const pm = rootRequire(modulePath);
    for (const [pattern, input] of [
      ['+(\\*)', '***'],
      ['+("*")', '***'],
      ['+([*])', '***'],
      ['+([*]a)', '*a*a'],
      ['+([[:alpha:]*])', 'a*b'],
      ['+([[]a)', '[a[a'],
      ['+("[*]")', '[*][*]'],
    ]) {
      assert.equal(pm.makeRe(pattern).test(input), true, pattern);
      assert.equal(pm.makeRe(pattern).test('/'), false, pattern);
    }
    assert.equal(pm.makeRe('+(a\\*)z').test('a*a*z'), true);
    assert.equal(pm.makeRe('+("a\\*")z').test('a*a*z'), true);
    assert.equal(pm.makeRe('+([a\\*])', { unescape: true }).test('*a*'), true);
    assert.equal(pm.makeRe('+([a\\*])', { unescape: true }).test('/'), false);
    assert.equal(pm.makeRe('+([*]a)z').test('*a*az'), true);
    assert.throws(() => pm.makeRe('+([*a)z', { strictBrackets: true }), SyntaxError);
    assert.equal(pm.makeRe('prefix\\*suffix').test('prefix*suffix'), true);
    assert.equal(pm.makeRe('prefix\\*suffix').test('prefixxsuffix'), false);
  });
}
