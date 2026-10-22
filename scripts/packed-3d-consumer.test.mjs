import assert from 'node:assert/strict';
import test from 'node:test';
import { packed3dGraphFindings, validatePacked3dPreparation, PACKED_3D_ENTRIES } from './packed-3d-consumer.mjs';

const companionRoot = '/consumer/node_modules/@aceshooting/lyra-3d';
const three = '/consumer/node_modules/three/build/three.core.js';
const options = engine => ({ engine, present: true, companionRoot });
const fixture = (engine, present = true) => {
  const target = present ? `${companionRoot}/dist/${engine}/index.js` : `@aceshooting/lyra-3d/${engine}`;
  return {
    modules: [
      { id: '/entry.js', isEntry: true, importedIds: ['/adapter.js'], dynamicallyImportedIds: [] },
      { id: '/adapter.js', isEntry: false, importedIds: [], dynamicallyImportedIds: [target] },
    ],
    chunks: [
      { fileName: 'index.js', isEntry: true, imports: [], modules: ['/entry.js', '/adapter.js'] },
      ...(present ? [{ fileName: 'engine.js', isEntry: false, imports: [], modules: [target, three] }] : []),
    ],
  };
};

test('packed 3D graph contracts distinguish each real lazy engine from missing or hoisted engines', () => {
  for (const engine of Object.keys(PACKED_3D_ENTRIES)) {
    const good = fixture(engine);
    assert.deepEqual(packed3dGraphFindings(good, options(engine)), []);
    for (const mutate of [
      graph => { graph.modules[1].dynamicallyImportedIds = []; },
      graph => { graph.chunks[1].modules.shift(); },
      graph => { graph.chunks[1].modules.pop(); },
      graph => { graph.modules[0].importedIds.push(`${companionRoot}/dist/${engine}/index.js`); },
      graph => { graph.chunks[0].imports.push('engine.js'); },
      graph => { graph.chunks[1].modules[0] = `/foreign${companionRoot}/dist/${engine}/index.js`; },
      graph => { graph.modules[1].dynamicallyImportedIds[0] = `${companionRoot}/dist/model/index.js`; },
    ]) {
      const graph = structuredClone(good);
      mutate(graph);
      assert.ok(packed3dGraphFindings(graph, options(engine)).length > 0, `${engine}: regression must fail`);
    }
    const absent = fixture(engine, false);
    assert.deepEqual(packed3dGraphFindings(absent, { ...options(engine), present: false }), []);
    absent.modules[1].dynamicallyImportedIds = [];
    assert.ok(packed3dGraphFindings(absent, { ...options(engine), present: false }).includes('missing external deferred engine import'));
    absent.chunks[0].modules.push(three);
    assert.ok(packed3dGraphFindings(absent, { ...options(engine), present: false }).includes('missing-peer build bundled a 3D runtime'));
  }
});

test('packed 3D root-only import permits parsed-unused engines and rejects emitted runtime retention', () => {
  const graph = fixture('graph', false);
  graph.modules[1].dynamicallyImportedIds = [];
  assert.deepEqual(packed3dGraphFindings(graph, options('root')), []);
  graph.modules[1].dynamicallyImportedIds = ['@aceshooting/lyra-3d/graph'];
  assert.deepEqual(packed3dGraphFindings(graph, options('root')), [], 'parsed but tree-shaken dynamic imports are harmless');
  graph.chunks.push({ fileName: 'retained.js', isEntry: false, imports: [], modules: [`${companionRoot}/dist/graph/index.js`] });
  assert.ok(packed3dGraphFindings(graph, options('root')).includes('root-only import retained a 3D runtime'));
  graph.chunks.pop();
  graph.chunks[0].modules.push(three);
  assert.ok(packed3dGraphFindings(graph, options('root')).includes('3D runtime is in an initial chunk'));
  assert.ok(packed3dGraphFindings({ modules: [], chunks: [] }, options('root')).includes('missing entry diagnostics'));
});

test('packed 3D preparation validates engine exports and keeps the unpublished accommodation narrow', () => {
  const manifest = { name: '@aceshooting/lyra-3d', version: '0.0.0', dependencies: { three: '^0.186.1' }, exports: Object.fromEntries(Object.keys(PACKED_3D_ENTRIES).map(engine => [`./${engine}`, { default: `./dist/${engine}/index.js` }])) };
  assert.doesNotThrow(() => validatePacked3dPreparation(manifest));
  assert.doesNotThrow(() => validatePacked3dPreparation({ ...manifest, version: '1.0.0' }));
  for (const version of ['0.0.1', '2.0.0', '1.0.0-beta.1']) assert.throws(() => validatePacked3dPreparation({ ...manifest, version }));
  assert.throws(() => validatePacked3dPreparation({ ...manifest, dependencies: { three: 'workspace:*' } }));
  assert.throws(() => validatePacked3dPreparation({ ...manifest, exports: {} }));
});

test('packed 3D coverage is wired into the real packed consumer gate', async () => {
  const { readFile } = await import('node:fs/promises');
  const checker = await readFile(new URL('check-packed-consumer.mjs', import.meta.url), 'utf8');
  assert.match(checker, /await verifyPacked3dConsumer\(\{ coreFixture, optionalFixture, engine3dTarball, optionalPeers, run, pnpm \}\)/u);
  const exemptions = checker.match(/const OPTIONAL_PEER_COVERAGE_EXEMPTIONS = Object\.freeze\(\{([\s\S]*?)\n\}\);/u)?.[1];
  assert.ok(exemptions);
  assert.doesNotMatch(exemptions, /@aceshooting\/lyra-3d/u);
  assert.match(checker, /\.\.\.PACKED_LOCAL_OPTIONAL_PEERS/u);
  assert.match(checker, /suppliedPackedTarball\(PACKED_TARBALL_ENVIRONMENT\.engine3d/u);
});

test('artifact-only CI selects exactly one 3D tarball through the canonical environment key', async () => {
  const { PACKED_TARBALL_ENVIRONMENT } = await import('./packed-tarball-input.mjs');
  const { readFile, mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  assert.equal(PACKED_TARBALL_ENVIRONMENT.engine3d, 'LYRA_PACKED_3D_TARBALL');
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const job = workflow.slice(workflow.indexOf('  packed_consumer_contract:'));
  const selection = job.match(/          shopt -s nullglob\n([\s\S]*?)          \} >> "\$GITHUB_ENV"/u)?.[0];
  assert.ok(selection, 'artifact-only lane must retain an inspectable tarball selection');
  const directory = await mkdtemp(join(tmpdir(), 'lyra-3d-routing-'));
  try {
    await mkdir(join(directory, 'artifacts/packed-attw'), { recursive: true });
    await mkdir(join(directory, 'artifacts/packed-companions'), { recursive: true });
    await writeFile(join(directory, 'artifacts/packed-attw/aceshooting-lyra-ui-1.0.0.tgz'), '');
    for (const name of ['flags', 'docs', 'map', 'translations', 'ide']) {
      await writeFile(join(directory, `artifacts/packed-companions/aceshooting-lyra-${name}-1.0.0.tgz`), '');
    }
    const execute = () => execFileSync('bash', ['-c', `set -euo pipefail\n${selection}`], {
      cwd: directory, env: { ...process.env, GITHUB_ENV: join(directory, 'environment') }, stdio: 'pipe',
    });
    assert.throws(execute, 'an absent 3D artifact must fail instead of triggering a source pack');
    const artifact = join(directory, 'artifacts/packed-companions/aceshooting-lyra-3d-0.0.0.tgz');
    await writeFile(artifact, '');
    execute();
    assert.ok((await readFile(join(directory, 'environment'), 'utf8')).includes(`${PACKED_TARBALL_ENVIRONMENT.engine3d}=${artifact}\n`));
    await writeFile(join(directory, 'artifacts/packed-companions/aceshooting-lyra-3d-1.0.0.tgz'), '');
    assert.throws(execute, 'ambiguous 3D artifacts must fail');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
