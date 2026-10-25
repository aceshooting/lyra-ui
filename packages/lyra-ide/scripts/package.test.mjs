import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stageScripts } from '../../../scripts/lib/coverage/staged-script.mjs';
import { IDE_DATA_FILES, syncIdeData } from './sync.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

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

test('names exactly the four editor data files and cannot be edited', () => {
  assert.deepEqual([...IDE_DATA_FILES],
    ['custom-elements.json', 'web-types.json', 'vscode-html-data.json', 'vscode-css-data.json']);
  assert.throws(() => IDE_DATA_FILES.push('stray.json'), TypeError);
});

test('refuses before copying anything when one source file is missing', () => {
  const { root, from, to } = fixture('27.0.0');
  try {
    // A refusal happens before any copy: the destination stays empty when one source file is absent.
    rmSync(join(from, 'web-types.json'));
    assert.throws(() => syncIdeData({ from, to }), /web-types\.json is missing/u);
    for (const file of IDE_DATA_FILES) assert.throws(() => readFileSync(join(to, file)), { code: 'ENOENT' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** The sync script staged inside `packages/lyra-ide`, beside a sibling `packages/lyra-ui`. */
function stagedRepository(context, { uiVersion }) {
  const root = mkdtempSync(join(tmpdir(), 'lyra-ide-cli-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const ide = join(root, 'packages', 'lyra-ide');
  const ui = join(root, 'packages', 'lyra-ui');
  mkdirSync(ui, { recursive: true });
  const [script] = stageScripts({ from: packageDir, to: ide, files: ['scripts/sync.mjs'] });
  writeFileSync(join(ide, 'package.json'), JSON.stringify({ version: '27.0.0' }));
  for (const file of IDE_DATA_FILES) writeFileSync(join(ui, file), JSON.stringify({ file, version: uiVersion }));
  return { ide, ui, script };
}

test('the CLI copies editor data from the sibling lyra-ui using its default package paths', context => {
  const { ide, ui, script } = stagedRepository(context, { uiVersion: '27.0.0' });
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `Editor data copied from lyra-ui: ${IDE_DATA_FILES.length} files.\n`);
  for (const file of IDE_DATA_FILES) assert.equal(readFileSync(join(ide, file), 'utf8'), readFileSync(join(ui, file), 'utf8'));
});

test('the CLI exits non-zero with the reason when the editor data is stale', context => {
  const { ide, script } = stagedRepository(context, { uiVersion: '26.0.0' });
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /web-types\.json describes lyra-ui 26\.0\.0, but this package is 27\.0\.0/u);
  for (const file of IDE_DATA_FILES) assert.throws(() => readFileSync(join(ide, file)), { code: 'ENOENT' });
});
