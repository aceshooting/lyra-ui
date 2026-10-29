import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { completePlugin, src, virtual, changed } from './complete-transform.mjs';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const outputRoot = resolve(packageRoot, 'dist');
const upstreamRoot = dirname(src);
const expected = JSON.parse(await readFile(resolve(packageRoot, 'UPSTREAM.json'), 'utf8'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const upstreamManifest = await readFile(resolve(upstreamRoot, 'package.json'));
if (
  JSON.parse(upstreamManifest).version !== expected.version ||
  sha256(upstreamManifest) !== expected.packageJsonSha256
) {
  throw new Error('MapLibre package differs from the reviewed source pin.');
}
const sourceManifest = [];
for (const path of (await filesIn(src)).sort()) {
  const data = await readFile(path);
  sourceManifest.push({
    file: relative(upstreamRoot, path).replaceAll('\\', '/'),
    bytes: data.length,
    sha256: sha256(data)
  });
}
if (sha256(JSON.stringify(sourceManifest)) !== expected.sourceTreeSha256) {
  throw new Error('MapLibre source tree differs from the reviewed source pin.');
}
if (sha256(await readFile(resolve(upstreamRoot, 'LICENSE.txt'))) !== expected.license.sha256) {
  throw new Error('MapLibre license differs from the reviewed source pin.');
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(resolve(outputRoot, 'controls'), { recursive: true });
const entry = '\0lyra-map-entry';
const workerEntry = resolve(src, 'source/worker.ts');
const sceneEntry = resolve(packageRoot, 'src/scene/index.mjs');
const controls = {
  attribution: 'AttributionControl',
  navigation: 'NavigationControl',
  geolocate: 'GeolocateControl',
  scale: 'ScaleControl',
  fullscreen: 'FullscreenControl',
  terrain: 'TerrainControl',
  globe: 'GlobeControl',
  logo: 'LogoControl'
};
const inputs = { index: entry, worker: workerEntry, scene: sceneEntry };
for (const name of Object.keys(controls)) inputs[`control-${name}`] = resolve(src, `ui/control/${name}_control.ts`);
const build = await rolldown({
  input: inputs,
  platform: 'browser',
  transform: { assumptions: { setPublicClassFields: true }, typescript: { removeClassFieldsWithoutInitializer: true } },
  treeshake: true,
  onwarn(warning) {
    throw new Error(`Engine build warning ${warning.code}: ${warning.message}`);
  },
  plugins: [
    {
      name: 'lyra-map-entries',
      resolveId(id) {
        if (id === entry) return id;
      },
      load(id) {
        if (id === entry)
          return `export * from ${JSON.stringify(resolve(src, 'index.ts'))};export {prepareStyle} from ${JSON.stringify(
            resolve(src, 'modular/prepare.ts')
          )};`;
      },
      transform(code, id) {
        if (id !== resolve(src, 'util/web_worker.ts')) return;
        const expression = /function defaultWorkerUrl\(\): string \{[\s\S]*?\n\}/g;
        if ([...code.matchAll(expression)].length !== 1) throw new Error('Worker URL source anchor changed.');
        return {
          code: code.replace(
            expression,
            `function defaultWorkerUrl(): string {
        return requireConfiguredModularWorkerUrl('__LYRA_MODULAR_WORKER_BRIDGE__');
      }
      function requireConfiguredModularWorkerUrl(url: string): string {
        if (url.startsWith('__LYRA_MODULAR_WORKER_')) throw new Error('Configure lyraMapWorkerPlugin() in the application build, or call setWorkerUrl() before creating a map.');
        return url;
      }`
          )
        };
      }
    },
    completePlugin
  ]
});
const result = await build.generate({
  format: 'es',
  preserveModules: true,
  sourcemap: false,
  // A flat owned directory avoids npm's exclusion of nested node_modules directories.
  entryFileNames: (chunk) => `modules/${basename(chunk.name).replaceAll(/[^\w.-]/g, '-')}-[hash].mjs`,
  chunkFileNames: 'modules/[name]-[hash].mjs'
});
await build.close();
const chunks = result.output.filter((item) => item.type === 'chunk');
if (chunks.length !== result.output.length) throw new Error('Unexpected engine asset output.');
for (const chunk of chunks) {
  if (chunk.fileName.includes('node_modules') || chunk.fileName.includes('..'))
    throw new Error('Unsafe generated module path.');
  await mkdir(dirname(resolve(outputRoot, chunk.fileName)), { recursive: true });
  await writeFile(resolve(outputRoot, chunk.fileName), chunk.code);
}
const facade = (id) => {
  const chunk = chunks.find((item) => item.facadeModuleId === id);
  if (!chunk) throw new Error(`Missing generated entry ${basename(id)}`);
  return chunk.fileName;
};
await writeFile(resolve(outputRoot, 'index.mjs'), `export * from './${facade(entry)}';\n`);
await writeFile(resolve(outputRoot, 'worker.mjs'), `import './${facade(workerEntry)}';\n`);
await writeFile(resolve(outputRoot, 'scene.mjs'), `export {createSceneBridge} from './${facade(sceneEntry)}';\n`);
for (const [name, exported] of Object.entries(controls)) {
  const target = facade(resolve(src, `ui/control/${name}_control.ts`));
  await writeFile(resolve(outputRoot, `controls/${name}.mjs`), `export {${exported}} from '../${target}';\n`);
  await writeFile(resolve(outputRoot, `controls/${name}.d.ts`), `export {${exported}} from '../index.js';\n`);
}
await copyFile(resolve(upstreamRoot, 'dist/maplibre-gl.css'), resolve(outputRoot, 'map.css'));
for (const file of ['vite.mjs', 'vite.d.ts'])
  await copyFile(resolve(packageRoot, 'src', file), resolve(outputRoot, file));

// Upstream declarations reference GeoJSON globally; consumers need no ambient tsconfig setup.
let declarations =
  '/// <reference types="geojson" />\n' + (await readFile(resolve(upstreamRoot, 'dist/maplibre-gl.d.ts'), 'utf8'));
// These two upstream type entry points contain extensionless relative imports.
// Retain their exact public type definitions locally so NodeNext consumers need no skipLibCheck.
const upstreamRequire = createRequire(resolve(upstreamRoot, 'package.json'));
await mkdir(resolve(outputRoot, 'types'), { recursive: true });
for (const file of ['scene.d.ts', 'scene-entry.d.ts'])
  await copyFile(resolve(packageRoot, 'types', file), resolve(outputRoot, 'types', file));
await writeFile(resolve(outputRoot, 'scene.d.ts'),
  "export { createSceneBridge } from './types/scene-entry.js';\n" +
  "export type { SceneBridge, SceneBridgeHost, SceneBridgeNativeMap, SceneRenderInput, SceneMarker, SceneBridgeStatus } from './types/scene-entry.js';\n");
for (const source of expected.declarationSources) {
  const packageEntry = upstreamRequire.resolve(source.package);
  const packageRoot = resolve(dirname(packageEntry), '..');
  const content = await readFile(resolve(packageRoot, source.file));
  if (sha256(content) !== source.sha256) throw new Error(`Declaration source changed: ${source.package}`);
  const name = source.package.split('/').at(-1);
  await writeFile(
    resolve(outputRoot, `types/${name}.d.ts`),
    content.toString().replace(/^\/\/# sourceMappingURL=.*$/gm, '')
  );
  declarations = declarations.replaceAll(`from "${source.package}"`, `from "./types/${name}.js"`);
}
function replaceDeclaration(before, after) {
  if (declarations.split(before).length !== 2) throw new Error(`Declaration anchor changed: ${before}`);
  declarations = declarations.replace(before, after);
}
replaceDeclaration(
  'setState(nextState: StyleSpecification, options?: StyleSwapOptions & StyleSetterOptions): boolean;',
  'setState(nextState: StyleSpecification, options?: StyleSwapOptions & StyleSetterOptions): Promise<boolean>;'
);
replaceDeclaration(
  '_load(json: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions, previousStyle?: StyleSpecification): void;',
  '_load(json: StyleSpecification, options: StyleSwapOptions & StyleSetterOptions, previousStyle?: StyleSpecification): Promise<void>;'
);
replaceDeclaration(
  '_updateDiff(style: StyleSpecification, options?: StyleSwapOptions & StyleOptions): void;',
  '_updateDiff(style: StyleSpecification, options?: StyleSwapOptions & StyleOptions): Promise<void>;'
);
replaceDeclaration(
  '  _lazyInitEmptyStyle(): void;',
  `  /** Prepares main and worker features before synchronous imperative mutations. */
  prepareFeatures(requirements: MapFeatureRequirements, options?: MapFeaturePreparationOptions): Promise<void>;
  /** Prepares and adds a bounded source/layer batch; native mutations remain synchronous. */
  addPreparedFeatures(descriptors: MapPreparedFeatures, options?: MapFeaturePreparationOptions): Promise<this>;
  _lazyInitEmptyStyle(): void;`
);
declarations += await readFile(resolve(packageRoot, 'types/features.d.ts'), 'utf8');
await writeFile(resolve(outputRoot, 'index.d.ts'), declarations);
await writeFile(
  resolve(outputRoot, 'provenance.json'),
  JSON.stringify(
    {
      upstream: expected.upstream,
      version: expected.version,
      sourceTreeSha256: expected.sourceTreeSha256,
      changedSourceFiles: [...changed.keys()].sort(),
      generatedFeatureModules: virtual.size,
      modules: chunks.map((chunk) => ({
        file: chunk.fileName,
        bytes: Buffer.byteLength(chunk.code),
        sha256: sha256(chunk.code),
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports
      }))
    },
    null,
    2
  ) + '\n'
);
console.log(`Built ${chunks.length} engine modules from MapLibre ${expected.version}.`);
