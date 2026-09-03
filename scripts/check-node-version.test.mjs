import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertExactNodeVersion,
  checkNodeVersionAtRoot,
  parseNvmrcVersion,
} from './check-node-version.mjs';

test('accepts only one canonical exact Node patch in .nvmrc', () => {
  assert.equal(parseNvmrcVersion('22.23.2\n'), '22.23.2');
  assert.equal(parseNvmrcVersion('22.23.2\r\n'), '22.23.2');

  for (const malformed of [
    '',
    '22\n',
    '22.23\n',
    'v22.23.2\n',
    '22.23.2',
    '22.23.2\n\n',
    '22.23.2\n20.19.6\n',
    ' 22.23.2\n',
    '22.23.2 # hosted\n',
    '22.23.2\r',
    '22.23.2\r\n\r\n',
  ]) {
    assert.throws(
      () => parseNvmrcVersion(malformed),
      /\.nvmrc must contain exactly one canonical Node patch/u,
      JSON.stringify(malformed),
    );
  }
});

test('fails closed on a same-major or same-minor Node patch mismatch', () => {
  assert.equal(
    assertExactNodeVersion({ expected: '22.23.2', actual: '22.23.2' }),
    '22.23.2',
  );
  assert.throws(
    () => assertExactNodeVersion({ expected: '22.23.2', actual: '22.23.1' }),
    /requires exact Node 22\.23\.2; active Node is 22\.23\.1/u,
  );
  assert.throws(
    () => assertExactNodeVersion({ expected: '22.23.2', actual: '22.22.2' }),
    /requires exact Node 22\.23\.2/u,
  );
  assert.throws(
    () => assertExactNodeVersion({ expected: '22.23.2', actual: '20.19.6' }),
    /requires exact Node 22\.23\.2/u,
  );
  assert.throws(
    () => assertExactNodeVersion({ expected: '22.23.2', actual: 'v22.23.2' }),
    /active Node version is not a canonical exact patch/u,
  );
});

test('reads the checked-in authority from the requested repository root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-node-version-test-'));
  try {
    await writeFile(join(root, '.nvmrc'), '22.23.2\n');
    assert.equal(await checkNodeVersionAtRoot(root, '22.23.2'), '22.23.2');
    await writeFile(join(root, '.nvmrc'), '22.23.2\r\n');
    assert.equal(await checkNodeVersionAtRoot(root, '22.23.2'), '22.23.2');
    await assert.rejects(
      checkNodeVersionAtRoot(root, '22.23.3'),
      /requires exact Node 22\.23\.2/u,
    );

    const missingRoot = join(root, 'missing');
    await mkdir(missingRoot);
    await assert.rejects(checkNodeVersionAtRoot(missingRoot, '22.23.2'), /\.nvmrc/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
