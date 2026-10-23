import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { CODECOV_PACKAGES, normalizeLcov, prepareCodecovReport } from './prepare-codecov-lcov.mjs';

function fixture(context) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-codecov-lcov-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name, content = 'export {};\n') => {
    const file = join(root, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    return file;
  };
  for (const name of CODECOV_PACKAGES) {
    write(`packages/${name}/scripts/check-package.mjs`);
    write(`packages/${name}/src/shared.ts`);
  }
  return { root, write };
}

const record = (file) => `TN:\nSF:${file}\nFN:1,run\nFNDA:1,run\nFNF:1\nFNH:1\nDA:1,1\nDA:2,0\nLF:2\nLH:1\nend_of_record\n`;
const withoutPaths = (text) => text.replace(/^SF:[^\r\n]+/gmu, 'SF:<source>');

test('all seven flags route colliding package-local source names to their own package', (context) => {
  const { root } = fixture(context);
  assert.deepEqual([...CODECOV_PACKAGES].sort(), [
    'lyra-3d', 'lyra-docs', 'lyra-flags', 'lyra-ide', 'lyra-map', 'lyra-translations', 'lyra-ui',
  ]);
  for (const packageName of CODECOV_PACKAGES) {
    const input = record('scripts/check-package.mjs');
    const output = normalizeLcov(input, { packageName, repositoryRoot: root });
    assert.match(output, new RegExp(`^SF:packages/${packageName}/scripts/check-package\\.mjs$`, 'mu'));
    assert.equal(withoutPaths(output), withoutPaths(input), 'every coverage counter is byte-preserved');
  }
});

test('absolute, package-relative and repository-relative sources normalize identically', (context) => {
  const { root } = fixture(context);
  const options = { packageName: 'lyra-ui', repositoryRoot: root };
  const canonical = 'packages/lyra-ui/src/shared.ts';
  for (const path of ['src/shared.ts', './src/shared.ts', canonical, join(root, canonical)]) {
    assert.equal(normalizeLcov(record(path), options), record(canonical));
  }
  const alreadyNormalized = record(canonical).replaceAll('\n', '\r\n');
  assert.equal(normalizeLcov(alreadyNormalized, options), alreadyNormalized, 'CRLF counters stay intact');
});

test('outside, missing, directory, traversal and symlink source paths fail closed', (context) => {
  const { root, write } = fixture(context);
  const outside = write('outside.ts');
  symlinkSync(outside, join(root, 'packages/lyra-ui/src/escape.ts'));
  const options = { packageName: 'lyra-ui', repositoryRoot: root };
  for (const path of [
    '', '../lyra-map/src/shared.ts', 'packages/lyra-map/src/shared.ts', outside,
    'src/missing.ts', 'src', 'src/escape.ts', 'src\\shared.ts', 'src/../src/shared.ts',
  ]) {
    assert.throws(() => normalizeLcov(record(path), options), undefined, path || 'empty path');
  }
  assert.throws(() => normalizeLcov(record('src/shared.ts'), { ...options, packageName: '../lyra-ui' }), /Unknown coverage package/u);
});

test('duplicate aliases, incomplete records and invalid line counts cannot become uploads', (context) => {
  const { root } = fixture(context);
  const options = { packageName: 'lyra-ui', repositoryRoot: root };
  const good = record('src/shared.ts');
  for (const input of [
    '', 'TN:\n', good.replace('end_of_record\n', ''),
    good + record('packages/lyra-ui/src/shared.ts'),
    good.replace('LF:2\n', ''), good.replace('LH:1\n', ''),
    good.replace('LH:1', 'LH:3'), good.replace('LF:2', 'LF:NaN'),
    good.replace('LF:2', 'LF:9007199254740992'), good.replace('LF:2', 'LF:2\nLF:2'),
    good.replace('LF:2', 'LF:0').replace('LH:1', 'LH:0'),
  ]) assert.throws(() => normalizeLcov(input, options));
});

test('line records must be complete, unique, positive, integral and agree with summaries', (context) => {
  const { root } = fixture(context);
  const options = { packageName: 'lyra-ui', repositoryRoot: root };
  const good = record('src/shared.ts');
  const invalid = [
    good.replace('DA:1,1\nDA:2,0\n', ''),
    good.replace('DA:2,0\n', ''),
    good.replace('DA:1,1', 'DA:1,1\nDA:1,0'),
    good.replace('DA:1,1', 'DA:0,1'),
    good.replace('DA:1,1', 'DA:-1,1'),
    good.replace('DA:1,1', 'DA:1.5,1'),
    good.replace('DA:1,1', 'DA:9007199254740992,1'),
    good.replace('DA:1,1', 'DA:1,-1'),
    good.replace('DA:1,1', 'DA:1,1.5'),
    good.replace('DA:1,1', 'DA:1,9007199254740992'),
    good.replace('DA:1,1', 'DA:1,NaN'),
    good.replace('DA:1,1', 'DA:1'),
    good.replace('DA:1,1', 'DA:1,1,'),
    good.replace('DA:1,1', 'DA 1,1'),
    good.replace('DA:1,1', 'DA:1,1,checksum,extra'),
    good.replace('LF:2', 'LF:3'),
    good.replace('LH:1', 'LH:0'),
    `DA:1,1\n${good}`,
    `${good}DA:3,1\n`,
  ];
  for (const input of invalid) assert.throws(() => normalizeLcov(input, options), undefined, input);
  assert.equal(normalizeLcov(good.replace('DA:1,1', 'DA:1,1,checksum'), options),
    good.replace('SF:src/shared.ts', 'SF:packages/lyra-ui/src/shared.ts').replace('DA:1,1', 'DA:1,1,checksum'));
});

test('preparation writes only a separate validated upload report', (context) => {
  const { root, write } = fixture(context);
  const input = record('src/shared.ts');
  const source = write('packages/lyra-map/coverage/lcov.info', input);
  const output = prepareCodecovReport('lyra-map', { repositoryRoot: root });
  assert.equal(output, join(root, 'packages/lyra-map/coverage/codecov.lcov'));
  assert.equal(readFileSync(source, 'utf8'), input);
  assert.equal(readFileSync(output, 'utf8'), record('packages/lyra-map/src/shared.ts'));
  assert.throws(() => prepareCodecovReport('lyra-ui', { repositoryRoot: root }), /ENOENT/u);
  assert.equal(existsSync(join(root, 'packages/lyra-ui/coverage/codecov.lcov')), false);
  write('packages/lyra-ui/coverage/lcov.info', record('src/missing.ts'));
  assert.throws(() => prepareCodecovReport('lyra-ui', { repositoryRoot: root }), /ENOENT/u);
  assert.equal(existsSync(join(root, 'packages/lyra-ui/coverage/codecov.lcov')), false);
});
