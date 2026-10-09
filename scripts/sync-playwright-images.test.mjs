import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { pinnedPlaywright, syncPlaywrightImages } from './sync-playwright-images.mjs';

const WORKFLOWS = ['ci.yml', 'full-engine.yml', 'test-all-browsers.yml'];
const image = (version) => `container:\n  image: mcr.microsoft.com/playwright:v${version}-noble\n`;

function fixtureRoot({ pinned = '1.64.0', images = '1.63.0', versionFile = '1.63.0' } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-playwright-images-'));
  mkdirSync(path.join(root, '.github/workflows'), { recursive: true });
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ devDependencies: { playwright: `^${pinned}` } }),
  );
  for (const name of WORKFLOWS) writeFileSync(path.join(root, '.github/workflows', name), image(images));
  writeFileSync(path.join(root, '.github/playwright-version.txt'), `${versionFile}\n`);
  return root;
}

test('reads the concrete pinned playwright version and rejects a missing pin', () => {
  const root = fixtureRoot();
  try {
    assert.equal(pinnedPlaywright(root), '1.64.0');
    writeFileSync(path.join(root, 'package.json'), '{}');
    assert.throws(() => pinnedPlaywright(root), /concrete playwright version/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check mode reports stale images without writing; write mode updates every file', () => {
  const root = fixtureRoot();
  try {
    const checked = syncPlaywrightImages({ write: false, repoRoot: root });
    assert.equal(checked.version, '1.64.0');
    assert.deepEqual(checked.stale, [
      ...WORKFLOWS.map((name) => path.join('.github/workflows', name)),
      path.join('.github', 'playwright-version.txt'),
    ]);
    assert.equal(readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'), image('1.63.0'));

    syncPlaywrightImages({ write: true, repoRoot: root });
    for (const name of WORKFLOWS) {
      assert.equal(readFileSync(path.join(root, '.github/workflows', name), 'utf8'), image('1.64.0'));
    }
    assert.equal(readFileSync(path.join(root, '.github/playwright-version.txt'), 'utf8'), '1.64.0\n');
    assert.deepEqual(syncPlaywrightImages({ write: false, repoRoot: root }).stale, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
