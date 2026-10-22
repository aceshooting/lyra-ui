import assert from 'node:assert/strict';
import test from 'node:test';
import { packed3dGraphFindings, validatePacked3dPreparation, installPacked3dFixture, PACKED_3D_ENTRIES } from './packed-3d-consumer.mjs';

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

test('3D fixture mutation refreshes a stale lockfile in CI with the exact pnpm preparation peer rule', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { execFileSync, spawnSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'lyra-3d-ci-install-'));
  try {
    const consumer = join(directory, 'consumer');
    const core = join(directory, 'core');
    const companion = join(directory, 'companion');
    await mkdir(consumer);
    for (const path of [core, companion]) await mkdir(join(path, 'package'), { recursive: true });
    await writeFile(join(core, 'package/package.json'), JSON.stringify({
      name: '@aceshooting/lyra-ui', version: '1.0.0',
      peerDependencies: { '@aceshooting/lyra-3d': '^1.0.0' },
      peerDependenciesMeta: { '@aceshooting/lyra-3d': { optional: true } },
    }));
    await writeFile(join(companion, 'package/package.json'), JSON.stringify({ name: '@aceshooting/lyra-3d', version: '0.0.0' }));
    for (const path of [core, companion]) execFileSync('tar', ['-czf', `${path}.tgz`, '-C', path, 'package']);
    await writeFile(join(consumer, 'package.json'), JSON.stringify({
      name: 'packed-3d-ci-regression', private: true,
      dependencies: { '@aceshooting/lyra-ui': `file:${core}.tgz` },
    }));
    const execute = args => execFileSync('pnpm', [...args, '--offline', '--strict-peer-dependencies'], {
      cwd: consumer, env: { ...process.env, CI: 'true' }, encoding: 'utf8', stdio: 'pipe',
    });
    execute(['install', '--ignore-scripts', '--config.auto-install-peers=false']);
    const coreExecution = spawnSync('pnpm', ['--config.auto-install-peers=false', 'exec', process.execPath, '-e', "process.stdout.write('core-ready')"], {
      cwd: consumer, env: { ...process.env, CI: 'true' }, encoding: 'utf8', stdio: 'pipe',
    });
    assert.equal(coreExecution.status, 0, coreExecution.stderr);
    assert.equal(coreExecution.stdout.trim(), 'core-ready');
    assert.doesNotMatch(`${coreExecution.stdout}\n${coreExecution.stderr}`, /ERR_PNPM_LOCKFILE_CONFIG_MISMATCH/u);
    const implementation = await readFile(new URL('packed-3d-consumer.mjs', import.meta.url), 'utf8');
    assert.ok(implementation.includes("['--config.auto-install-peers=false', 'exec', 'vite', 'build', '--config', 'packed-3d.config.mjs']"));
    const before = await readFile(join(consumer, 'pnpm-lock.yaml'), 'utf8');
    let installs = 0;
    await installPacked3dFixture({
      optionalFixture: consumer, engine3dTarball: `${companion}.tgz`, version: '0.0.0', pnpm: 'pnpm',
      run: async (_command, args, cwd) => {
        installs++;
        assert.equal(cwd, consumer);
        assert.throws(() => execute(args.filter(arg => arg !== '--no-frozen-lockfile')), error =>
          /ERR_PNPM_(?:OUTDATED_LOCKFILE|LOCKFILE_CONFIG_MISMATCH)/u.test(`${error.stdout}\n${error.stderr}`));
        const output = execute(args);
        assert.doesNotMatch(output, /peerDependencyRules.*ignored/u);
      },
    });
    assert.equal(installs, 1);
    const after = await readFile(join(consumer, 'pnpm-lock.yaml'), 'utf8');
    assert.notEqual(after, before);
    assert.match(after, /@aceshooting\/lyra-3d/u);
    assert.equal(JSON.parse(await readFile(join(consumer, 'node_modules/@aceshooting/lyra-3d/package.json'), 'utf8')).version, '0.0.0');
    assert.equal(JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8')).pnpm, undefined);
    assert.equal(await readFile(join(consumer, 'pnpm-workspace.yaml'), 'utf8'),
      "packages: []\nautoInstallPeers: false\npeerDependencyRules:\n  allowedVersions:\n    '@aceshooting/lyra-ui>@aceshooting/lyra-3d': '0.0.0'\n");
    execute(['install', '--frozen-lockfile', '--ignore-scripts']);
    const executed = spawnSync('pnpm', ['exec', process.execPath, '-e', "process.stdout.write('fixture-ready')"], {
      cwd: consumer, env: { ...process.env, CI: 'true' }, encoding: 'utf8', stdio: 'pipe',
    });
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal(executed.stdout.trim(), 'fixture-ready');
    assert.doesNotMatch(`${executed.stdout}\n${executed.stderr}`, /ERR_PNPM_LOCKFILE_CONFIG_MISMATCH/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('preparation peer allowance excludes other versions and dependents and is absent for published companions', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  for (const scenario of [
    { name: '@aceshooting/lyra-ui', version: '0.0.1', preparation: '0.0.0', range: '^1.0.0', valid: false },
    { name: 'other-consumer', version: '0.0.0', preparation: '0.0.0', range: '^1.0.0', valid: false },
    { name: '@aceshooting/lyra-ui', version: '1.0.0', preparation: '1.0.0', range: '^1.0.0', valid: true },
    { name: '@aceshooting/lyra-ui', version: '1.0.0', preparation: '1.0.0', range: '^2.0.0', valid: false },
  ]) {
    const directory = await mkdtemp(join(tmpdir(), 'lyra-3d-peer-rule-'));
    try {
      const consumer = join(directory, 'consumer');
      const core = join(directory, 'core');
      const companion = join(directory, 'companion');
      await mkdir(consumer);
      for (const path of [core, companion]) await mkdir(join(path, 'package'), { recursive: true });
      await writeFile(join(core, 'package/package.json'), JSON.stringify({
        name: scenario.name, version: '1.0.0', peerDependencies: { '@aceshooting/lyra-3d': scenario.range },
      }));
      await writeFile(join(companion, 'package/package.json'), JSON.stringify({ name: '@aceshooting/lyra-3d', version: scenario.version }));
      for (const path of [core, companion]) execFileSync('tar', ['-czf', `${path}.tgz`, '-C', path, 'package']);
      await writeFile(join(consumer, 'package.json'), JSON.stringify({
        name: 'packed-3d-peer-regression', private: true, dependencies: { [scenario.name]: `file:${core}.tgz` },
      }));
      await installPacked3dFixture({
        optionalFixture: consumer, engine3dTarball: `${companion}.tgz`, version: scenario.preparation, pnpm: 'pnpm',
        run: async (_command, args) => {
          const execute = () => execFileSync('pnpm', [...args, '--offline', '--strict-peer-dependencies'], {
            cwd: consumer, env: { ...process.env, CI: 'true' }, encoding: 'utf8', stdio: 'pipe',
          });
          if (scenario.valid) execute();
          else assert.throws(execute, error => /ERR_PNPM_PEER_DEP_ISSUES/u.test(`${error.stdout}\n${error.stderr}`), JSON.stringify(scenario));
        },
      });
      if (scenario.preparation !== '0.0.0') {
        await assert.rejects(readFile(join(consumer, 'pnpm-workspace.yaml')), { code: 'ENOENT' });
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});
