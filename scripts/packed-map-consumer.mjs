import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { attwCommandArguments } from './packed-attw.mjs';
import { packedManifest } from './packed-tarball-input.mjs';

export function validatePackedMapManifest(manifest) {
  assert.equal(manifest.name, '@aceshooting/lyra-map');
  const ranges = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .flatMap(section => Object.values(manifest[section] ?? {}));
  assert.deepEqual(ranges.filter(range => String(range).startsWith('workspace:')), [], 'lyra-map leaks workspace: ranges');
  assert.ok(!manifest.dependencies?.['maplibre-gl'], 'the companion must own its runtime');
}

/** Verify the installed companion without borrowing workspace sources or a native map engine. */
export async function verifyPackedMapConsumer({ workspace, mapTarball, run, pnpm, root }) {
  const manifest = packedManifest(mapTarball);
  validatePackedMapManifest(manifest);
  await run(pnpm, ['exec', 'publint', 'run', '--strict', '--pack=false', mapTarball], root, 'lyra-map publint package check');
  const typed = Object.keys(manifest.exports).filter(entry => entry !== './package.json' && entry !== './worker' && !entry.endsWith('.css'));
  await run(pnpm, attwCommandArguments(typed, mapTarball), root, 'lyra-map Are The Types Wrong check');
  const fixture = join(workspace, 'map-companion-consumer');
  await mkdir(fixture, { recursive: true });
  await writeFile(join(fixture, 'package.json'), JSON.stringify({
    name: 'lr-packed-map-consumer', private: true, type: 'module',
    dependencies: { '@aceshooting/lyra-map': `file:${relative(fixture, mapTarball)}` },
    devDependencies: { vite: '8.3.4', typescript: '7.0.2', '@types/node': '26.6.5' },
  }));
  await writeFile(join(fixture, 'load.mjs'), `import { Map, prepareStyle } from '@aceshooting/lyra-map';
import { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';
if (typeof Map !== 'function' || typeof prepareStyle !== 'function' || typeof Map.prototype.prepareFeatures !== 'function') throw new Error('Missing asynchronous map API');
if (typeof lyraMapWorkerPlugin !== 'function') throw new Error('Missing map worker plugin');
import.meta.resolve('@aceshooting/lyra-map/worker');
import.meta.resolve('@aceshooting/lyra-map/map.css');
for (const name of ['attribution', 'navigation', 'geolocate', 'scale', 'fullscreen', 'terrain', 'globe', 'logo']) await import('@aceshooting/lyra-map/controls/' + name);
`);
  await writeFile(join(fixture, 'consumer.ts'), `import { Map, prepareStyle } from '@aceshooting/lyra-map';
import { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';
const plugin = lyraMapWorkerPlugin();
declare const map: Map;
const style: Promise<unknown> = prepareStyle({ version: 8, sources: {}, layers: [] });
await map.prepareFeatures({ layers: [{ id: 'background', type: 'background' }] });
const mutation: Map = map.addLayer({ id: 'background', type: 'background' });
void [style, mutation, plugin];
`);
  await writeFile(join(fixture, 'entry.js'), `import { Map, prepareStyle } from '@aceshooting/lyra-map';
import '@aceshooting/lyra-map/map.css';
globalThis.packedMap = { Map, prepareStyle };
`);
  await writeFile(join(fixture, 'vite.config.mjs'), `import { defineConfig } from 'vite';
import { lyraMapWorkerPlugin } from '@aceshooting/lyra-map/vite';
export default defineConfig({ plugins: [lyraMapWorkerPlugin()], build: { rollupOptions: { input: 'entry.js' } } });
`);
  await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], fixture, 'lyra-map packed fixture install');
  await run(process.execPath, ['load.mjs'], fixture, 'lyra-map server-safe public exports');
  await run(pnpm, ['exec', 'tsc', '--noEmit', '--skipLibCheck', 'false', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'consumer.ts'], fixture, 'lyra-map packed declaration check');
  await run(pnpm, ['exec', 'vite', 'build'], fixture, 'lyra-map packed worker bundle');
  const assets = await readdir(join(fixture, 'dist', 'assets'));
  assert.ok(assets.some(file => /worker.*\.js$/u.test(file)), 'the packed Vite plugin must emit its own worker');
  const scripts = await Promise.all(assets.filter(file => file.endsWith('.js')).map(file => readFile(join(fixture, 'dist', 'assets', file), 'utf8')));
  assert.ok(scripts.some(source => source.includes('Worker')), 'the consumer must retain the map worker setup');
}
