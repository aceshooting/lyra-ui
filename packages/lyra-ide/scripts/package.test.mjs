import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { IDE_DATA_FILES, syncIdeData } from './sync.mjs';

function fixture(webTypesVersion) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-ide-'));
  const from = join(root, 'ui');
  const to = join(root, 'ide');
  mkdirSync(from);
  mkdirSync(to);
  writeFileSync(join(to, 'package.json'), JSON.stringify({ version: '27.0.0' }));
  for (const file of IDE_DATA_FILES) writeFileSync(join(from, file), JSON.stringify({ file, version: webTypesVersion }));
  return { root, from, to };
}

test('copies every data file when web-types matches the package version', () => {
  const { root, from, to } = fixture('27.0.0');
  try {
    assert.equal(syncIdeData({ from, to }), IDE_DATA_FILES.length);
    for (const file of IDE_DATA_FILES) assert.equal(readFileSync(join(to, file), 'utf8'), readFileSync(join(from, file), 'utf8'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('refuses stale editor data and missing files', () => {
  const { root, from, to } = fixture('26.0.0');
  try {
    assert.throws(() => syncIdeData({ from, to }), /describes lyra-ui 26\.0\.0/u);
    rmSync(join(from, 'vscode-css-data.json'));
    assert.throws(() => syncIdeData({ from, to }), /vscode-css-data\.json is missing/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
