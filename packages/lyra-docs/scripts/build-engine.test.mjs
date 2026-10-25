import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { stageScripts } from '../../../scripts/lib/coverage/staged-script.mjs';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const committedLock = JSON.parse(readFileSync(join(packageRoot, 'scripts/engine-source.lock.json'), 'utf8'));
const installedVite = JSON.parse(readFileSync(join(packageRoot, 'node_modules/vite/package.json'), 'utf8')).version;

/**
 * The engine builder staged beside a lock the test controls, with the real installed dependencies.
 * The lock's toolchain pins follow the installed toolchain unless an edit changes them, so each
 * refusal below is caused by exactly the edit that names it. Every refusal happens before the
 * upstream source would be downloaded.
 */
function builder(context, edit = () => {}) {
  const fixture = mkdtempSync(join(tmpdir(), 'lyra-docs-engine-'));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  symlinkSync(join(packageRoot, 'node_modules'), join(fixture, 'node_modules'), 'junction');
  const [script] = stageScripts({ from: packageRoot, to: fixture, files: ['scripts/build-engine.mjs', 'scripts/engine/source.mjs'] });
  const lock = structuredClone(committedLock);
  lock.toolchain.node = process.versions.node;
  lock.toolchain.vite = installedVite;
  edit(lock);
  writeFileSync(join(fixture, 'scripts/engine-source.lock.json'), JSON.stringify(lock));
  return () => spawnSync(process.execPath, [script], { encoding: 'utf8' });
}

const escaped = text => text.replaceAll(/[\\^$.*+?()[\]{}|/]/gu, '\\$&');

function refused(run, message) {
  const result = run();
  assert.notEqual(result.status, 0, 'the engine build must refuse');
  assert.equal(result.stdout, '');
  assert.match(result.stderr, message);
}

test('refuses to build under a Node other than the pinned one', context => {
  refused(builder(context, lock => { lock.toolchain.node = '0.0.1'; }), /Use the Node version in \.nvmrc to build the engine/u);
});

test('refuses a Vite other than the pinned one', context => {
  refused(builder(context, lock => { lock.toolchain.vite = '0.0.1'; }), /Engine Vite pin changed/u);
});

test('refuses a build dependency that the lock does not list', context => {
  let removed;
  const run = builder(context, lock => { removed = lock.buildPackages.pop(); });
  refused(run, new RegExp(`Unlocked engine build dependency: ${escaped(`${removed.name}@${removed.version}`)}`, 'u'));
});

test('refuses a build dependency whose manifest differs from the locked digest', context => {
  let changed;
  const run = builder(context, lock => {
    changed = lock.buildPackages[1];
    changed.manifestSha256 = '0'.repeat(64);
  });
  refused(run, new RegExp(`Engine dependency manifest changed: ${escaped(`${changed.name}@${changed.version}`)}`, 'u'));
});

test('refuses a lock that lists a build dependency the engine no longer uses', context => {
  refused(builder(context, lock => {
    lock.buildPackages.push({ name: 'left-pad', version: '1.3.0', manifestSha256: 'a'.repeat(64) });
  }), /Engine build dependency inventory changed/u);
});

test('refuses a locked asset whose length differs from the installed file', context => {
  refused(builder(context, lock => { lock.assets[0].bytes += 1; }),
    /Engine asset length changed: @docx-editor\.dev\/core\/styles\/editor\.css/u);
});

test('refuses a locked asset whose digest differs from the installed file', context => {
  const index = committedLock.assets.findIndex(asset => asset.specifier === 'harfbuzzjs');
  assert.notEqual(index, -1, 'the lock names the text shaper binary');
  refused(builder(context, lock => { lock.assets[index].sha256 = 'f'.repeat(64); }), /Engine asset changed: harfbuzzjs/u);
});

test('refuses an engine package whose own dependency is not installed', context => {
  const fixture = mkdtempSync(join(tmpdir(), 'lyra-docs-engine-'));
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  // A stand-in engine that depends on a package nothing provides; only Vite is the real installation.
  const manifest = `${JSON.stringify({ name: '@docx-editor.dev/core', version: '9.9.9', dependencies: { 'engine-dependency-that-is-not-installed': '1.0.0' } })}\n`;
  mkdirSync(join(fixture, 'node_modules/@docx-editor.dev/core'), { recursive: true });
  writeFileSync(join(fixture, 'node_modules/@docx-editor.dev/core/package.json'), manifest);
  symlinkSync(join(packageRoot, 'node_modules/vite'), join(fixture, 'node_modules/vite'), 'junction');
  const [script] = stageScripts({ from: packageRoot, to: fixture, files: ['scripts/build-engine.mjs', 'scripts/engine/source.mjs'] });
  const lock = {
    toolchain: { node: process.versions.node, vite: installedVite },
    buildPackages: [{ name: '@docx-editor.dev/core', version: '9.9.9', manifestSha256: createHash('sha256').update(manifest).digest('hex') }],
    assets: [],
  };
  writeFileSync(join(fixture, 'scripts/engine-source.lock.json'), JSON.stringify(lock));
  refused(() => spawnSync(process.execPath, [script], { encoding: 'utf8' }),
    /Missing maintainer engine dependency: engine-dependency-that-is-not-installed/u);
});

test('the committed lock pins the toolchain that the workspace installs', () => {
  assert.equal(committedLock.toolchain.vite, installedVite, 'update the Vite pin and re-verify the engine build together');
  assert.equal(committedLock.toolchain.pnpm, JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).packageManager.replace(/^pnpm@/u, ''));
});
