// Builds `dist/`: the same components as `dist`, with every runtime dependency (lit, tslib,
// @floating-ui/dom, ...) bundled into relative, code-split chunks so one
// `<script type="module" src=".../the CDN output/lyra-ui.loader.js">` works with no build step and no
// import map. Per-component chunks stay lazy (the autoloader's dynamic imports), optional peers
// stay external and fail closed through the components' own localized fallbacks.
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { optionalPeerNames } from '../../lyra-ui/scripts/guard-optional-peer-imports.mjs';
import { isMainModule } from '../../lyra-ui/scripts/is-main-module.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const uiDir = join(dirname(packageDir), 'lyra-ui');
const requireFromPackage = createRequire(join(uiDir, 'package.json'));
const esbuild = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'))('esbuild');

/** CSS a page links directly; mirrors the published `dist` copies. */
export const CDN_STYLESHEETS = Object.freeze([
  ['theme.css', 'theme.css'],
  ['theme-core.css', 'theme-core.css'],
  ['density.css', 'density.css'],
  ['accents.css', 'accents.css'],
  ['styles/native.css', 'native.css'],
  ['styles/utilities.css', 'utilities.css'],
  ['styles/design-tokens.css', 'design-tokens.css'],
]);

async function totalBytes(dir) {
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    bytes += entry.isDirectory() ? await totalBytes(full) : (await stat(full)).size;
  }
  return bytes;
}

async function listFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(full));
    else files.push(full);
  }
  return files;
}

/** Same rule as check:build-artifacts for `dist`: no source maps, no map references. */
async function assertNoSourceMaps(outdir) {
  for (const file of await listFiles(outdir)) {
    if (file.endsWith('.map')) throw new Error(`the CDN output must contain no source maps: ${file}`);
    if (file.endsWith('.js') && /sourceMappingURL=/.test(await readFile(file, 'utf8'))) {
      throw new Error(`the CDN output must not reference a source map: ${file}`);
    }
  }
}

/** A static import of an external specifier would need an import map; only dynamic ones may remain. */
function assertNoStaticBareImports(metafile) {
  for (const [file, output] of Object.entries(metafile.outputs)) {
    const bare = output.imports.find((entry) => entry.external && entry.kind !== 'dynamic-import');
    if (bare) throw new Error(`the CDN output has a static import of "${bare.path}" in ${file}; it would need an import map`);
  }
}

export async function buildCdn(root = packageDir, ui = uiDir) {
  const manifest = JSON.parse(readFileSync(join(ui, 'package.json'), 'utf8'));
  const outdir = join(root, 'dist');
  await rm(outdir, { recursive: true, force: true });
  const peers = optionalPeerNames(manifest);
  const result = await esbuild.build({
    absWorkingDir: ui,
    entryPoints: { 'lyra-ui.loader': join(root, 'scripts', 'lyra-ui.loader.mjs') },
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    sourcemap: false,
    legalComments: 'none',
    chunkNames: 'chunks/[name]-[hash]',
    entryNames: '[name]',
    // Optional peers and the translation catalogs stay bare specifiers: a browser rejects the
    // import and the component's guarded loader takes its existing fail-closed path.
    external: [...peers, ...peers.map((peer) => `${peer}/*`), '@aceshooting/lyra-translations', '@aceshooting/lyra-translations/*'],
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.wasm': 'file' },
    assetNames: 'assets/[name]-[hash]',
    // package.json#sideEffects whitelists only registration modules, so esbuild would drop a class
    // module's bare `import './child.class.js'` (a composed child's registration). This tree is a
    // closed graph where every such import is deliberate, so ignore the whitelist.
    ignoreAnnotations: true,
    metafile: true,
    logLevel: 'warning',
  });
  await Promise.all(CDN_STYLESHEETS.map(async ([from, to]) => {
    await mkdir(dirname(join(outdir, to)), { recursive: true });
    await cp(join(ui, 'dist', from), join(outdir, to));
  }));
  await assertNoSourceMaps(outdir);
  assertNoStaticBareImports(result.metafile);
  const chunks = Object.keys(result.metafile.outputs).length;
  return { outdir, chunks, bytes: await totalBytes(outdir), relative: relative(root, outdir) };
}

if (isMainModule(import.meta.url)) {
  const { chunks, bytes } = await buildCdn();
  console.log(`Single-script CDN build: ${chunks} JavaScript files, ${bytes.toLocaleString('en')} bytes in dist.`);
}
