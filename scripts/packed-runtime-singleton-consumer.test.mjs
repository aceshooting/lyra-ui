import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  persistRuntimeArchive, prepareRuntimeSingletonFixture, runtimeFixtureManifests, verifyRuntimeArchive,
} from './packed-runtime-singleton-consumer.mjs';
import {
  assertBundleRoots, assertCompositionOwnership, assertConsoleContract, assertDevelopmentGraph, assertInstalledTopology, assertRuntimeIdentity,
  classifyConsole, optimizerFacadeImports, optimizerSourceFiles, runtimePeerVersions, UI_PACKAGE, withRuntimePhase,
} from './fixtures/runtime-singleton/contract.mjs';

const profile = {
  managedPeerRanges: { katex: '^0.18.4 || ^0.19.0' }, currentVersions: { katex: '0.19.1' },
  toolchain: { vite: '8.3.8', playwright: '1.65.1' }, packageManagers: { pnpm: '12.21.0' },
};
const manifest = {
  name: UI_PACKAGE, version: '1.0.0', peerDependencies: { katex: profile.managedPeerRanges.katex },
  peerDependenciesMeta: { katex: { optional: true } },
};
const integrity = 'sha512-fixture-integrity';
const topology = () => ['app', 'feature-a', 'feature-b'].map(owner => ({
  owner, name: UI_PACKAGE, version: '1.0.0', integrity,
  packageRoot: owner === 'feature-b' ? '/fixture/context-b' : '/fixture/context-a',
  utilityEntry: `/fixture/${owner}/overlay-manager.js`,
  utilityHash: 'same-packed-bytes', packedUtilityHash: 'same-packed-bytes',
  peerVersion: owner === 'feature-b' ? '0.18.4' : '0.19.1',
}));
const diagnostic = {
  type: 'warning',
  text: '[lr-runtime-duplicate] Multiple runtime copies (versions: 1.0.0, 1.0.0). Resolve public imports from one application context.',
};

test('peer topology uses different pinned compatible contexts and the exact same archive', () => {
  const peers = runtimePeerVersions(profile, manifest);
  const manifests = runtimeFixtureManifests({ archive: '/fixture/archives/ui.tgz', peers, profile });
  assert.equal(manifests.root.dependencies?.[UI_PACKAGE], undefined);
  assert.equal(manifests.shared.dependencies[UI_PACKAGE], undefined);
  assert.deepEqual(manifests.shared.dependencies, { 'feature-a': 'workspace:*', 'feature-b': 'workspace:*' });
  assert.equal(manifests.app.dependencies[UI_PACKAGE], manifests['feature-a'].dependencies[UI_PACKAGE]);
  assert.equal(manifests.app.dependencies[UI_PACKAGE], manifests['feature-b'].dependencies[UI_PACKAGE]);
  assert.equal(manifests.app.dependencies.katex, manifests['feature-a'].dependencies.katex);
  assert.notEqual(manifests['feature-a'].dependencies.katex, manifests['feature-b'].dependencies.katex);
  assert.equal(manifests.root.devDependencies.vite, profile.toolchain.vite);
  assert.throws(() => runtimePeerVersions({ ...profile, currentVersions: { katex: '0.18.4' } }, manifest), /different supported versions/u);
  assert.throws(() => runtimePeerVersions(profile, { ...manifest, peerDependencies: { katex: '^99.0.0' } }), /pinned peer profile/u);
  assert.throws(() => runtimePeerVersions({ ...profile, managedPeerRanges: { katex: '*' } }, manifest), /explicit stable floor/u);
});

test('equal versions alone cannot pass a collapsed or wrong-archive topology', () => {
  assertInstalledTopology(topology(), '1.0.0', integrity, `integrity: ${integrity}`);
  const collapsed = topology();
  collapsed[2].packageRoot = collapsed[1].packageRoot;
  assert.throws(() => assertInstalledTopology(collapsed, '1.0.0', integrity, integrity), /two physical/u);
  const wrongBytes = topology();
  wrongBytes[1].utilityHash = 'different-package-bytes';
  assert.throws(() => assertInstalledTopology(wrongBytes, '1.0.0', integrity, integrity), /installed utility bytes/u);
  const wrongPeer = topology();
  wrongPeer[2].peerVersion = wrongPeer[1].peerVersion;
  assert.throws(() => assertInstalledTopology(wrongPeer, '1.0.0', integrity, integrity));
  assert.throws(() => assertInstalledTopology(topology(), '2.0.0', integrity, integrity), /installed UI version/u);
  assert.throws(() => assertInstalledTopology(topology(), '1.0.0', integrity, 'unrelated archive'), /archive integrity/u);
});

test('runtime identity and bundled provenance must each prove the selected mode', () => {
  assertRuntimeIdentity(false, 'raw');
  assert.equal(assertRuntimeIdentity(true, 'raw', 'development'), 'single');
  assert.equal(assertRuntimeIdentity(false, 'raw', 'development'), 'split');
  assert.throws(() => assertRuntimeIdentity(true, 'raw', 'linked-development'));
  assertRuntimeIdentity(true, 'app');
  assertRuntimeIdentity(true, 'shared');
  assertBundleRoots(['context-a', 'context-b'], 'raw', ['context-a', 'context-b']);
  assertBundleRoots(['context-a', 'context-a'], 'app', ['context-a']);
  assert.throws(() => assertRuntimeIdentity(true, 'raw'));
  assert.throws(() => assertRuntimeIdentity(false, 'shared'));
  assert.throws(() => assertBundleRoots(['context-a'], 'raw', ['context-a', 'context-b']));
  assert.throws(() => assertBundleRoots(['context-a', 'context-b'], 'app', ['context-a']));
  assert.throws(() => assertBundleRoots(['context-b'], 'app', ['context-a']), /selected application/u);
  for (const owner of ['a', 'b']) {
    assertCompositionOwnership({ lower: owner, upper: owner === 'a' ? 'b' : 'a', registeredPopoverMatches: true }, owner);
    assert.throws(() => assertCompositionOwnership({ lower: owner, upper: owner, registeredPopoverMatches: true }, owner));
  }
  assert.throws(() => assertCompositionOwnership({ lower: 'a', upper: 'b', registeredPopoverMatches: false }, 'a'));

});

test('the raw baseline fails specifically when the observable duplicate diagnostic is missing', () => {
  assert.throws(() => assertConsoleContract([], { mode: 'raw' }), /one observable diagnostic/u);
  assertConsoleContract([diagnostic], { mode: 'raw' });
  assert.throws(() => assertConsoleContract([diagnostic, diagnostic], { mode: 'raw' }), /one observable diagnostic/u);
  assert.throws(() => assertConsoleContract([diagnostic], { mode: 'app' }));
  assert.throws(() => assertConsoleContract([diagnostic], { mode: 'raw', active: false }));
  assertConsoleContract([], { mode: 'raw', active: false });
  assertConsoleContract([], { mode: 'shared' });
  assertConsoleContract([], { mode: 'raw', development: true, topology: 'single' });
  assert.throws(() => assertConsoleContract([diagnostic], { mode: 'raw', development: true, topology: 'single' }));
});

test('strict console classification does not hide unrelated warnings or logger behavior', () => {
  const dev = { type: 'warning', text: 'Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.' };
  assertConsoleContract([dev], { mode: 'app', development: true });
  assert.throws(() => assertConsoleContract([dev], { mode: 'app' }), /Unexpected browser/u);
  const other = { type: 'warning', text: 'Multiple versions of another dependency are loaded.' };
  assert.deepEqual(classifyConsole([diagnostic, other]), { diagnostics: [diagnostic.text], unexpected: [other] });
  assert.throws(() => assertConsoleContract([diagnostic, { type: 'error', text: 'Failed module import' }], { mode: 'raw' }), /Unexpected browser/u);
  // A swallowed logger exception is not an uncaught error. The warning still needs an observable record.
  assertConsoleContract([diagnostic], { mode: 'raw' });
  assert.throws(() => assertConsoleContract([{ type: 'warning', text: '[lr-runtime-duplicate] Duplicate.' }], { mode: 'raw' }), /supported repair/u);
});

async function archiveFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-runtime-fixture-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'package'));
  await writeFile(join(directory, 'package', 'package.json'), JSON.stringify(manifest));
  const archive = join(directory, 'ui.tgz');
  execFileSync('tar', ['-czf', archive, '-C', directory, 'package']);
  const sha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
  return { directory, archive, sha256 };
}

test('fixture preparation preserves the supplied archive and refuses to overwrite retained work', async t => {
  const { directory, archive, sha256 } = await archiveFixture(t);
  const fixture = await prepareRuntimeSingletonFixture({ workspace: directory, uiTarball: archive, expectedSha256: sha256, profile });
  assert.equal(createHash('sha256').update(await readFile(join(fixture, 'archives/ui.tgz'))).digest('hex'), sha256);
  const root = JSON.parse(await readFile(join(fixture, 'package.json'), 'utf8'));
  const app = JSON.parse(await readFile(join(fixture, 'app/package.json'), 'utf8'));
  const shared = JSON.parse(await readFile(join(fixture, 'shared/package.json'), 'utf8'));
  assert.equal(root.dependencies?.[UI_PACKAGE], undefined);
  assert.equal(shared.dependencies?.[UI_PACKAGE], undefined);
  assert.ok(app.dependencies[UI_PACKAGE].startsWith('file:'));
  assert.equal(await readFile(join(fixture, 'app/main.js'), 'utf8'), await readFile(join(fixture, 'shared/main.js'), 'utf8'));
  await assert.rejects(prepareRuntimeSingletonFixture({ workspace: directory, uiTarball: archive, expectedSha256: sha256, profile }), { code: 'EEXIST' });
});

test('archive checksum failure stops before any fixture is created', async t => {
  const { directory, archive } = await archiveFixture(t);
  await assert.rejects(prepareRuntimeSingletonFixture({ workspace: directory, uiTarball: archive, expectedSha256: '0'.repeat(64), profile }), /archive SHA-256/u);
  await assert.rejects(readFile(join(directory, 'runtime-singleton-consumer/package.json')), { code: 'ENOENT' });
});


test('served optimizer and unbundled source graphs reject hidden or wrong singleton roots', () => {
  const mapFile = '/fixture/cache/deps/shared.js.map';
  const sources = optimizerSourceFiles({ version: 3, sources: [
    '../../context-a/overlay.js', '../../context-b/overlay.js', 'rolldown:runtime',
  ] }, mapFile);
  assert.deepEqual(sources, ['/fixture/context-a/overlay.js', '/fixture/context-b/overlay.js', 'rolldown:runtime']);
  assert.deepEqual(optimizerSourceFiles({ version: 3, sections: [{ offset: { line: 0, column: 0 },
    map: { version: 3, sources: ['file:///fixture/context-a/overlay.js'] },
  }] }, mapFile), ['/fixture/context-a/overlay.js']);
  assert.throws(() => optimizerSourceFiles({ version: 3, sources: [] }, mapFile), /source provenance/u);
  const optimized = {
    url: 'http://fixture.test/deps/shared.js?v=served-hash', file: '/fixture/cache/deps/shared.js',
    optimized: true, optimizerId: 'shared', sources,
    uiRoots: ['/fixture/context-a', '/fixture/context-b'],
  };
  const direct = {
    url: 'http://fixture.test/overlay.js', file: '/fixture/context-a/overlay.js',
    optimized: false, sources: ['/fixture/context-a/overlay.js'], uiRoots: ['/fixture/context-a'],
  };
  assertDevelopmentGraph([optimized, direct], { mode: 'raw', expectedRoots: ['/fixture/context-a', '/fixture/context-b'] });
  assertDevelopmentGraph([direct], { mode: 'app', expectedRoots: ['/fixture/context-a'] });
  assert.throws(() => assertDevelopmentGraph([optimized, direct], { mode: 'app', expectedRoots: ['/fixture/context-a'] }), /actual bundled/u);
  assert.throws(() => assertDevelopmentGraph([{ ...direct, uiRoots: ['/fixture/context-b'] }],
    { mode: 'shared', expectedRoots: ['/fixture/context-a'] }), /selected application/u);
  assert.throws(() => assertDevelopmentGraph([{ ...optimized, sources: [] }],
    { mode: 'raw', expectedRoots: ['/fixture/context-a', '/fixture/context-b'] }), /actual source map/u);
  assert.throws(() => assertDevelopmentGraph([{ ...optimized, optimizerId: undefined }],
    { mode: 'raw', expectedRoots: ['/fixture/context-a', '/fixture/context-b'] }), /matching dependency metadata/u);
  assert.throws(() => assertDevelopmentGraph([], { mode: 'app', expectedRoots: ['/fixture/context-a'] }), /actual successful script/u);
});

test('captured archive bytes survive source replacement and caller mutation; destination changes are refused', async t => {
  const { directory, archive, sha256 } = await archiveFixture(t);
  const captured = await readFile(archive);
  await writeFile(join(directory, 'package', 'package.json'), JSON.stringify({ ...manifest, version: '2.0.0' }));
  execFileSync('tar', ['-czf', archive, '-C', directory, 'package']);
  const destination = join(directory, 'captured.tgz');
  const pending = persistRuntimeArchive({ archive: destination, bytes: captured, expectedSha256: sha256, profile });
  captured.fill(0); // The asynchronous write must already own its immutable snapshot.
  const result = await pending;
  assert.equal(result.manifest.version, '1.0.0', 'Parse the validated snapshot, not the replaced caller source');
  await verifyRuntimeArchive(destination, sha256);
  await assert.rejects(persistRuntimeArchive({ archive: destination, bytes: await readFile(destination), expectedSha256: sha256, profile }),
    { code: 'EEXIST' });
  await rm(destination);
  await copyFile(archive, destination);
  await assert.rejects(verifyRuntimeArchive(destination, sha256), /Captured UI archive changed/u);
});


test('mapless optimizer facades require served mapped dependencies and cannot conceal executable code', () => {
  const facadeBytes = 'export { t as activateOverlay, r as suspendLyraModalsFor } from "./overlay-manager-Cs31TAh-.js";\n';
  assert.equal(Buffer.byteLength(facadeBytes), 97);
  assert.equal(createHash('sha256').update(facadeBytes).digest('hex'), '429b96699768e655c192d09fa3aaa8ec7721b800b0ca2909156e0a12cb301dc5');
  assert.deepEqual(optimizerFacadeImports(facadeBytes), ['./overlay-manager-Cs31TAh-.js']);
  const imports = optimizerFacadeImports(`${facadeBytes}import "./runtime.js";`);
  assert.deepEqual(imports, ['./overlay-manager-Cs31TAh-.js', './runtime.js']);
  assert.throws(() => optimizerFacadeImports('globalThis.sideEffect = true; export { x } from "./overlay.js";'), /executable or unrecognized/u);
  assert.throws(() => optimizerFacadeImports('export const x = 1;'), /executable or unrecognized/u);
  assert.throws(() => optimizerFacadeImports(''), /empty mapless/u);
  const facade = { url: 'http://fixture/entry.js', file: '/fixture/entry.js', optimized: true,
    optimizerId: 'entry', facadeChildren: ['/fixture/overlay.js'], sources: [], uiRoots: [] };
  const executable = { url: 'http://fixture/overlay.js', file: '/fixture/overlay.js', optimized: true,
    optimizerId: 'overlay', sources: ['/fixture/context-a/source.js'], uiRoots: ['/fixture/context-a'] };
  const options = { mode: 'app', expectedRoots: ['/fixture/context-a'] };
  assertDevelopmentGraph([facade, executable], options);
  assert.throws(() => assertDevelopmentGraph([facade], options), /must have been served/u);
  assert.throws(() => assertDevelopmentGraph([facade, { ...executable, sources: [] }], options), /actual source map/u);
  assert.throws(() => assertDevelopmentGraph([facade, { ...executable, facadeChildren: ['/fixture/entry.js'] }], options), /facade cycle/u);
});

test('production conditions are explicit and restored after successful and failed development phases', async () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = 'fixture-caller';
  try {
    await withRuntimePhase('production', async mode => {
      assert.equal(mode, 'production');
      assert.equal(process.env.NODE_ENV, 'production');
    });
    assert.equal(process.env.NODE_ENV, 'fixture-caller');
    await assert.rejects(withRuntimePhase('linked-development', async mode => {
      assert.equal(mode, 'development');
      assert.equal(process.env.NODE_ENV, 'development');
      throw new Error('fixture phase failure');
    }), /fixture phase failure/u);
    assert.equal(process.env.NODE_ENV, 'fixture-caller');
    delete process.env.NODE_ENV;
    await withRuntimePhase('development', async () => assert.equal(process.env.NODE_ENV, 'development'));
    assert.equal(process.env.NODE_ENV, undefined);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
