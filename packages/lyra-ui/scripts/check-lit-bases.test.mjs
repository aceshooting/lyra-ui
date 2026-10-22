import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const script = new URL('./check-lit-bases.mjs', import.meta.url).pathname;

function runGate(source, declaredLit = [], declaredWc = declaredLit) {
  const dir = mkdtempSync(join(tmpdir(), 'lit-bases-'));
  try {
    const root = join(dir, 'src');
    mkdirSync(root);
    writeFileSync(join(root, 'fixture.ts'), source);
    const config = join(dir, 'oxlintrc.json');
    writeFileSync(config, JSON.stringify({ settings: {
      lit: { elementBaseClasses: declaredLit },
      wc: { elementBaseClasses: declaredWc },
    } }));
    return spawnSync(process.execPath, [script, config, root], { encoding: 'utf8', timeout: 5000 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the Lit base gate fails closed on source parse errors', () => {
  const result = runGate('class Broken extends LitElement {');
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /parse errors in/u);
});

test('the Lit base gate rejects stale declarations as well as missing declarations', () => {
  const source = 'class Base extends LitElement {}\nclass Child extends Base {}\n';
  assert.equal(runGate(source, ['Base']).status, 0);
  assert.notEqual(runGate(source).status, 0);
  const stale = runGate(source, ['Base', 'Unused']);
  assert.notEqual(stale.status, 0);
  assert.deepEqual(JSON.parse(stale.stdout).plugins.lit.stale, ['Unused']);
});

test('the Lit base gate catches drift in the web-component plugin list alone', () => {
  const source = 'class Base extends LitElement {}\nclass Child extends Base {}\n';
  const missing = runGate(source, ['Base'], []);
  assert.notEqual(missing.status, 0);
  assert.deepEqual(JSON.parse(missing.stdout).plugins.wc.missing, ['Base']);
  const stale = runGate(source, ['Base'], ['Base', 'Unused']);
  assert.notEqual(stale.status, 0);
  assert.deepEqual(JSON.parse(stale.stdout).plugins.wc.stale, ['Unused']);
});
