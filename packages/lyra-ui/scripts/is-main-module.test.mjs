import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { isMainModule } from './is-main-module.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootScriptsDir = path.resolve(scriptsDir, '..', '..', '..', 'scripts');
const rootGuardScripts = Object.freeze([
  'changeset-release-plan.mjs',
  'check-framework-recipes.mjs',
  'generate-release-qualification.mjs',
  'plan-test-browsers.mjs',
  'release-integrity.mjs',
  'sync-plugin-version.mjs',
  'update-readme-status.mjs',
]);

test('recognizes a main module invoked through a symlink', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-main-module-'));
  try {
    const link = path.join(root, 'linked-script.mjs');
    symlinkSync(path.join(scriptsDir, 'check-source-policy.mjs'), link);
    assert.equal(
      isMainModule(new URL('./check-source-policy.mjs', import.meta.url).href, link),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a converted package gate executes through a differently named symlink', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-main-module-gate-'));
  try {
    const link = path.join(root, 'package-gate-bin');
    symlinkSync(path.join(scriptsDir, 'check-script-paths.mjs'), link);
    const result = spawnSync(process.execPath, [link], {
      cwd: path.dirname(scriptsDir),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /package script\/specifier check passed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a converted repository gate executes through a differently named symlink', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-main-module-root-gate-'));
  try {
    const link = path.join(root, 'release-qualification-bin');
    symlinkSync(path.join(rootScriptsDir, 'generate-release-qualification.mjs'), link);
    const result = spawnSync(process.execPath, [link, '--check'], {
      cwd: path.dirname(rootScriptsDir),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Release qualification manifest is fresh/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('package scripts do not compare the raw argv path with import.meta.url', () => {
  const offenders = [];
  const fragilePatterns = [
    /pathToFileURL\([^\n]*process\.argv\[1\][^\n]*\)\.href[^\n]*import\.meta\.url/,
    /import\.meta\.url[^\n]*pathToFileURL\([^\n]*process\.argv\[1\]/,
    /(?:path\.)?resolve\(process\.argv\[1\][^\n]*===\s*fileURLToPath\(import\.meta\.url\)/,
    /process\.argv\[1\][^\n]*===\s*fileURLToPath\(import\.meta\.url\)/,
  ];
  for (const name of readdirSync(scriptsDir).filter((file) => file.endsWith('.mjs')).sort()) {
    if (
      name === 'is-main-module.mjs'
      || name === 'is-main-module.test.mjs'
      || name === 'migrate-wa.mjs'
    ) continue;
    const source = readFileSync(path.join(scriptsDir, name), 'utf8');
    if (
      source.includes('process.argv[1]')
      || fragilePatterns.some((pattern) => pattern.test(source))
    ) {
      offenders.push(name);
    }
  }
  assert.deepEqual(offenders, []);

  const migrateSource = readFileSync(path.join(scriptsDir, 'migrate-wa.mjs'), 'utf8');
  assert.match(
    migrateSource,
    /realpathSync\(invoked\) === fs\.realpathSync\(here\)/,
    'the standalone packaged CLI keeps its equivalent symlink-aware realpath guard',
  );
});

test('repository entry points use the shared symlink-aware main-module guard', () => {
  const offenders = rootGuardScripts.filter((name) => {
    const source = readFileSync(path.join(rootScriptsDir, name), 'utf8');
    return !source.includes("isMainModule(import.meta.url)");
  });
  assert.deepEqual(offenders, []);
});
