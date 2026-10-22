import assert from 'node:assert/strict';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { packedManifest } from './packed-tarball-input.mjs';

export const PACKED_3D_ENTRIES = Object.freeze({
  graph: 'components/lr-graph.js',
  points: 'components/lr-embedding-explorer.js',
  panorama: 'components/lr-image-viewer.js',
});

/** Local 0.0.0 preparation is deliberately not evidence for the published ^1 peer range. */
export function validatePacked3dPreparation(manifest) {
  assert.equal(manifest.name, '@aceshooting/lyra-3d');
  assert.match(manifest.version, /^(?:0\.0\.0|1\.\d+\.\d+)$/u);
  for (const engine of Object.keys(PACKED_3D_ENTRIES)) {
    assert.equal(manifest.exports?.[`./${engine}`]?.default, `./dist/${engine}/index.js`);
  }
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const range of Object.values(manifest[section] ?? {})) assert.ok(!range.startsWith('workspace:'));
  }
  assert.ok(manifest.dependencies?.three, 'the companion must own its Three runtime');
}

export function packed3dGraphFindings(graph, { engine, present, companionRoot }) {
  const findings = [];
  const normalize = id => id.replaceAll('\\', '/').split('?')[0];
  const isEngine = id => normalize(id).startsWith(`${normalize(companionRoot)}/`);
  const isThree = id => /\/node_modules\/three\//u.test(normalize(id));
  const modules = new Map(graph.modules.map(module => [module.id, module]));
  const pending = graph.modules.filter(module => module.isEntry).map(module => module.id);
  const reached = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (reached.has(id)) continue;
    reached.add(id);
    if (isEngine(id) || isThree(id) || id.startsWith('@aceshooting/lyra-3d')) findings.push('3D runtime is statically reachable');
    pending.push(...(modules.get(id)?.importedIds ?? []));
  }
  if (!graph.modules.some(module => module.isEntry)) findings.push('missing entry diagnostics');
  const chunks = new Map(graph.chunks.map(chunk => [chunk.fileName, chunk]));
  const initial = graph.chunks.filter(chunk => chunk.isEntry).map(chunk => chunk.fileName);
  const seen = new Set();
  while (initial.length) {
    const name = initial.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const chunk = chunks.get(name);
    if (!chunk) continue;
    if (chunk.modules.some(id => isEngine(id) || isThree(id))) findings.push('3D runtime is in an initial chunk');
    initial.push(...chunk.imports);
  }
  const emitted = graph.chunks.flatMap(chunk => chunk.modules);
  const dynamic = graph.modules.flatMap(module => module.dynamicallyImportedIds);
  if (engine === 'root') {
    if (emitted.some(id => isEngine(id) || isThree(id))) findings.push('root-only import retained a 3D runtime');
  } else if (present) {
    const expected = `${normalize(companionRoot)}/dist/${engine}/index.js`;
    if (!dynamic.some(id => normalize(id) === expected)) findings.push('missing exact deferred engine import');
    if (!emitted.some(id => normalize(id) === expected)) findings.push('missing emitted engine module');
    if (!emitted.some(isThree)) findings.push('missing bundled Three runtime');
  } else {
    if (!dynamic.includes(`@aceshooting/lyra-3d/${engine}`)) findings.push('missing external deferred engine import');
    if (emitted.some(id => isEngine(id) || isThree(id))) findings.push('missing-peer build bundled a 3D runtime');
  }
  return findings;
}

/** Reuse isolated consumer installations; mutate only the pnpm fixture after its existing checks. */
export async function verifyPacked3dConsumer({ coreFixture, optionalFixture, engine3dTarball, optionalPeers, run, pnpm }) {
  const manifest = packedManifest(engine3dTarball);
  validatePacked3dPreparation(manifest);
  const file = join(optionalFixture, 'package.json');
  const consumer = JSON.parse(await readFile(file, 'utf8'));
  consumer.dependencies['@aceshooting/lyra-3d'] = `file:${engine3dTarball}`;
  // Narrow preparation-only accommodation. The npm strict-peer fixture is never modified.
  if (manifest.version === '0.0.0') {
    consumer.pnpm ??= {};
    consumer.pnpm.peerDependencyRules ??= {};
    consumer.pnpm.peerDependencyRules.allowedVersions ??= {};
    consumer.pnpm.peerDependencyRules.allowedVersions['@aceshooting/lyra-ui>@aceshooting/lyra-3d'] = '0.0.0';
  }
  await writeFile(file, `${JSON.stringify(consumer, null, 2)}\n`);
  await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], optionalFixture, 'packed 3D preparation fixture install');
  const companionRoot = await realpath(join(optionalFixture, 'node_modules', '@aceshooting', 'lyra-3d'));
  const installed = JSON.parse(await readFile(join(companionRoot, 'package.json'), 'utf8'));
  assert.deepEqual(installed.exports, manifest.exports);
  assert.equal(installed.version, manifest.version);
  await assert.rejects(realpath(join(coreFixture, 'node_modules', '@aceshooting', 'lyra-3d')), { code: 'ENOENT' }, 'the absent-peer fixture must really omit the companion');
  for (const [fixture, present] of [[coreFixture, false], [optionalFixture, true]]) {
    for (const engine of Object.keys(PACKED_3D_ENTRIES)) {
      const specifier = JSON.stringify(`@aceshooting/lyra-3d/${engine}`);
      const source = present
        ? `import assert from 'node:assert/strict'; const engine = await import(${specifier}); assert.equal(typeof engine.createEngine, 'function');`
        : `import assert from 'node:assert/strict'; await assert.rejects(import(${specifier}), { code: 'ERR_MODULE_NOT_FOUND' });`;
      await run(process.execPath, ['--input-type=module', '-e', source], fixture, `packed 3D ${engine} ${present ? 'present' : 'absent'} runtime import`);
    }
    for (const [route, engine, entry] of [
      ['root', 'root', ''],
      ...Object.entries(PACKED_3D_ENTRIES).map(([engine, entry]) => [engine, engine, entry]),
      ['video', 'panorama', 'components/lr-video.js'],
      ['knowledgeGraph', 'graph', 'components/lr-knowledge-graph-explorer.js'],
    ]) {
      await writeFile(join(fixture, 'src', 'packed-3d.ts'), `import '@aceshooting/lyra-ui${entry ? `/${entry}` : ''}';\nexport const loaded = true;\n`);
      await writeFile(join(fixture, 'packed-3d.config.mjs'), `
import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
export default defineConfig({
  plugins: [{ name: 'packed-3d-graph', writeBundle(_options, bundle) {
    const modules = [...this.getModuleIds()].map(id => { const info = this.getModuleInfo(id); return { id, isEntry: info.isEntry, importedIds: info.importedIds, dynamicallyImportedIds: info.dynamicallyImportedIds }; });
    const chunks = Object.values(bundle).filter(value => value.type === 'chunk').map(value => ({ fileName: value.fileName, isEntry: value.isEntry, imports: value.imports, modules: Object.keys(value.modules) }));
    writeFileSync('packed-3d-graph.json', JSON.stringify({ modules, chunks }));
  }}],
  build: { outDir: 'bundle/packed-3d-${route}', rollupOptions: {
    input: 'src/packed-3d.ts',
    external: id => ${JSON.stringify(optionalPeers.filter(peer => !present || peer !== '@aceshooting/lyra-3d'))}.some(peer => id === peer || id.startsWith(peer + '/')),
  }},
});\n`);
      await run(pnpm, ['exec', 'vite', 'build', '--config', 'packed-3d.config.mjs'], fixture, `packed 3D ${route} ${present ? 'present' : 'absent'} graph`);
      const graph = JSON.parse(await readFile(join(fixture, 'packed-3d-graph.json'), 'utf8'));
      assert.deepEqual(packed3dGraphFindings(graph, { engine, present, companionRoot }), [], `${route} ${present ? 'present' : 'absent'} packed 3D contract`);
    }
  }
}
