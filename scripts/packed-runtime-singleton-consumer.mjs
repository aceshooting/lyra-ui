import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packedManifest } from './packed-tarball-input.mjs';
import { runtimePeerVersions, UI_PACKAGE } from './fixtures/runtime-singleton/contract.mjs';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureSource = join(here, 'fixtures/runtime-singleton');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

export function runtimeFixtureManifests({ archive, peers, profile }) {
  const ui = { [UI_PACKAGE]: `file:${archive}` };
  return {
    root: {
      name: 'runtime-singleton-fixture', private: true, type: 'module',
      packageManager: `pnpm@${profile.packageManagers.pnpm}`,
      devDependencies: { vite: profile.toolchain.vite, playwright: profile.toolchain.playwright },
    },
    app: {
      name: 'runtime-app', private: true, type: 'module',
      dependencies: { ...ui, katex: peers.current, 'feature-a': 'workspace:*', 'feature-b': 'workspace:*' },
    },
    shared: {
      name: 'runtime-shared-root', private: true, type: 'module',
      dependencies: { 'feature-a': 'workspace:*', 'feature-b': 'workspace:*' },
    },
    'feature-a': {
      name: 'feature-a', private: true, type: 'module', exports: './index.js',
      dependencies: { ...ui, katex: peers.current },
    },
    'feature-b': {
      name: 'feature-b', private: true, type: 'module', exports: './index.js',
      dependencies: { ...ui, katex: peers.floor },
    },
  };
}

/** Verify the task-owned archive before any command is allowed to consume it. */
export async function verifyRuntimeArchive(archive, expectedSha256) {
  assert.equal((await lstat(archive)).isFile(), true, 'The captured archive must remain a regular file');
  const bytes = await readFile(archive);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedSha256, 'Captured UI archive changed');
  return bytes;
}

/** Persist a private snapshot; never reopen the caller's source after its bytes were validated. */
export async function persistRuntimeArchive({ archive, bytes, expectedSha256, profile }) {
  const captured = Buffer.from(bytes);
  assert.equal(createHash('sha256').update(captured).digest('hex'), expectedSha256, 'Supplied UI archive SHA-256');
  await writeFile(archive, captured, { flag: 'wx', mode: 0o444 });
  await verifyRuntimeArchive(archive, expectedSha256);
  const manifest = packedManifest(archive);
  assert.equal(manifest.name, UI_PACKAGE);
  const peers = runtimePeerVersions(profile, manifest);
  await verifyRuntimeArchive(archive, expectedSha256);
  return { manifest, peers };
}

/** Creates a new task-owned fixture. It never packs, builds, or rewrites the source checkout. */
export async function prepareRuntimeSingletonFixture({ workspace, uiTarball, expectedSha256, profile }) {
  assert.match(expectedSha256 ?? '', /^[a-f\d]{64}$/u, 'Supply the frozen UI archive SHA-256');
  const bytes = await readFile(uiTarball);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedSha256, 'Supplied UI archive SHA-256');
  const fixture = join(resolve(workspace), 'runtime-singleton-consumer');
  await mkdir(fixture, { mode: 0o700 }); // Existing work/evidence must not be overwritten.
  await mkdir(join(fixture, 'archives'));
  const archive = join(fixture, 'archives', 'ui.tgz');
  const { manifest, peers } = await persistRuntimeArchive({ archive, bytes, expectedSha256, profile });
  const manifests = runtimeFixtureManifests({ archive, peers, profile });
  await writeFile(join(fixture, 'package.json'), json(manifests.root));
  await writeFile(join(fixture, 'pnpm-workspace.yaml'),
    "packages:\n  - app\n  - feature-a\n  - feature-b\n  - shared\nautoInstallPeers: false\nresolvePeersFromWorkspaceRoot: false\ndedupePeerDependents: false\n");
  for (const name of ['app', 'feature-a', 'feature-b', 'shared']) {
    await mkdir(join(fixture, name));
    await writeFile(join(fixture, name, 'package.json'), json(manifests[name]));
  }
  for (const name of ['feature-a', 'feature-b']) {
    await copyFile(join(fixtureSource, `${name}.js`), join(fixture, name, 'index.js'));
  }
  // The shared build root owns its feature dependencies but deliberately has no UI dependency.
  for (const name of ['app', 'shared']) {
    for (const entry of ['index.html', 'main.js']) await copyFile(join(fixtureSource, entry), join(fixture, name, entry));
  }
  for (const name of ['driver.mjs', 'contract.mjs']) await copyFile(join(fixtureSource, name), join(fixture, name));
  await writeFile(join(fixture, 'input.json'), json({
    archive: relative(fixture, archive), sha256: expectedSha256,
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    name: manifest.name, version: manifest.version, peers,
  }));
  return fixture;
}

export async function verifyPackedRuntimeSingletonConsumer({
  workspace, uiTarball, expectedSha256, run, pnpm, modes = 'all', browsers = 'chromium',
}) {
  assert.ok(['all', 'raw', 'canonical'].includes(modes), 'Unknown runtime fixture mode');
  assert.ok(browsers.split(',').every(name => ['chromium', 'firefox', 'webkit'].includes(name)), 'Unknown browser engine');
  const profile = JSON.parse(await readFile(join(here, 'peer-compatibility-profiles.json'), 'utf8'));
  const fixture = await prepareRuntimeSingletonFixture({ workspace, uiTarball, expectedSha256, profile });
  await verifyRuntimeArchive(join(fixture, 'archives', 'ui.tgz'), expectedSha256);
  await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], fixture, 'packed runtime fixture install');
  await verifyRuntimeArchive(join(fixture, 'archives', 'ui.tgz'), expectedSha256);
  await run(process.execPath, ['driver.mjs', modes, browsers], fixture, 'packed runtime ownership regression');
  return fixture;
}

async function commandRun(command, args, cwd, label) {
  await new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`${label}: exit ${code}, signal ${signal}`)));
  });
}

if (isMainModule(import.meta.url)) {
  const [workspace, uiTarball, expectedSha256, modes = 'all', browsers = 'chromium'] = process.argv.slice(2);
  if (!workspace || !uiTarball || !expectedSha256) {
    throw new Error('Usage: node scripts/packed-runtime-singleton-consumer.mjs <existing-scratch-directory> <ui.tgz> <sha256> [all|raw|canonical] [chromium,firefox,webkit]');
  }
  await verifyPackedRuntimeSingletonConsumer({ workspace, uiTarball: resolve(uiTarball), expectedSha256, modes, browsers, run: commandRun, pnpm: 'pnpm' });
}
