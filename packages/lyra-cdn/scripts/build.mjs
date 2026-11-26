// Builds `dist/`: every lyra-ui component plus every optional peer, the locale catalogs and the
// lyra-gen, lyra-docs, lyra-map, lyra-3d and lyra-flags companions, bundled into relative,
// code-split chunks so one `<script type="module" src=".../lyra-ui.loader.js">` works with no
// build step and no import map. Everything stays lazy: a page fetches only the chunks of the
// components it renders. Workers and assets that a library locates through `import.meta.url` are
// emitted beside the chunk that references them; lyra-flags, whose per-flag modules resolve
// adjacent SVG files, is copied verbatim under `dist/vendor/`.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isMainModule } from '../../lyra-ui/scripts/is-main-module.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packagesDir = dirname(packageDir);
const uiDir = join(packagesDir, 'lyra-ui');
const requireFromPackage = createRequire(join(uiDir, 'package.json'));
const esbuild = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'))('esbuild');

/** CSS a page links directly; mirrors the published `dist` copies. */
export const CDN_STYLESHEETS = Object.freeze([
  ['theme.css', 'theme.css'],
  ['theme-core.css', 'theme-core.css'],
  ['density.css', 'density.css'],
  ['accents.css', 'accents.css'],
  ['accent-roles.css', 'accent-roles.css'],
  ['styles/native.css', 'native.css'],
  ['styles/utilities.css', 'utilities.css'],
  ['styles/design-tokens.css', 'design-tokens.css'],
]);

/**
 * Companion packages whose built `dist` the bundle reads. A recursive build orders lyra-gen and
 * lyra-docs first through this package's devDependencies; the root build skips the pinned-source
 * lyra-map and lyra-3d, so a missing companion `dist` is built here.
 */
export const CDN_COMPANIONS = Object.freeze(['lyra-gen', 'lyra-docs', 'lyra-map', 'lyra-3d']);

/** Directory of the code-split chunks, relative to `dist`. Runtime-located assets live here too. */
const CHUNKS = 'chunks';
const VENDOR_FLAGS = 'vendor/lyra-flags';
const TRANSLATIONS_PREFIX = '@aceshooting/lyra-translations/';
const SHIM_NAMESPACE = 'lyra-cdn-shim';

/**
 * Modules wrapped so the bundle points a library at the worker shipped beside it. Each wrapper
 * only fills an unset worker URL, so a page that configured its own first keeps it.
 */
const SHIMS = Object.freeze({
  // PDF.js refuses to run without `workerSrc`, and only the bundled worker matches the bundled
  // API version.
  'pdfjs-dist': [
    "import * as pdfjs from 'pdfjs-dist';",
    "if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;",
    "export * from 'pdfjs-dist';",
  ].join('\n'),
  // lyra-map reports a configuration error unless a bundler plugin or `setWorkerUrl()` names its
  // module worker. It wraps the URL in a same-origin blob, so a cross-origin CDN works.
  '@aceshooting/lyra-map': [
    "import { getWorkerUrl, setWorkerUrl } from '@aceshooting/lyra-map';",
    "if (!getWorkerUrl()) setWorkerUrl(new URL('./lyra-map.worker.js', import.meta.url).href);",
    "export * from '@aceshooting/lyra-map';",
  ].join('\n'),
});

/** lyra-flags subpath exports, mapped to the verbatim copy under `dist/vendor/lyra-flags`. */
function vendoredFlagsPath(specifier) {
  const subpath = specifier.slice('@aceshooting/lyra-flags'.length);
  const file = subpath === '' ? 'index.js'
    : ['/standard', '/compact', '/detailed'].includes(subpath) ? `${subpath.slice(1)}.js`
      : subpath.startsWith('/flags/') ? subpath.slice(1) : undefined;
  if (!file) throw new Error(`the CDN build has no vendored mapping for "${specifier}"`);
  // Only chunks import it (asserted below), so the path is relative to `dist/chunks/`.
  return `../${VENDOR_FLAGS}/${file}`;
}

function cdnResolution(ui, scriptsDir) {
  return {
    name: 'lyra-cdn-resolution',
    setup(build) {
      // This package's own entry modules resolve bare imports as lyra-ui does: its peers are
      // lyra-ui's development dependencies, not this package's.
      build.onResolve({ filter: /^[^./]/ }, (args) => (
        args.pluginData?.fromScripts || dirname(args.importer) !== scriptsDir ? undefined
          : build.resolve(args.path, { kind: args.kind, resolveDir: ui, pluginData: { fromScripts: true } })
      ));
      // Locale catalogs: the workspace lyra-ui build carries the same files lyra-translations ships.
      build.onResolve({ filter: /^@aceshooting\/lyra-translations\// }, (args) => ({
        path: join(ui, 'dist', 'translations', args.path.slice(TRANSLATIONS_PREFIX.length)),
      }));
      build.onResolve({ filter: /^@aceshooting\/lyra-flags(\/.*)?$/ }, (args) => ({
        path: vendoredFlagsPath(args.path),
        external: true,
      }));
      build.onResolve({ filter: /^(pdfjs-dist|@aceshooting\/lyra-map)$/ }, (args) => (
        args.namespace === SHIM_NAMESPACE ? undefined : { path: args.path, namespace: SHIM_NAMESPACE }
      ));
      build.onLoad({ filter: /.*/, namespace: SHIM_NAMESPACE }, (args) => ({
        contents: SHIMS[args.path],
        resolveDir: ui,
        loader: 'js',
      }));
    },
  };
}

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
    if (/\.m?js$/.test(file) && /sourceMappingURL=/.test(await readFile(file, 'utf8'))) {
      throw new Error(`the CDN output must not reference a source map: ${file}`);
    }
  }
}

/**
 * The bundle is closed: the only external imports left are the relative ones into the vendored
 * lyra-flags copy, and those come from chunks, which is what their `../` prefix assumes.
 */
function assertSelfContained(metafile, outputPath) {
  for (const [file, output] of Object.entries(metafile.outputs)) {
    for (const entry of output.imports) {
      if (!entry.external) continue;
      if (!entry.path.startsWith(`../${VENDOR_FLAGS}/`) || !outputPath(file).startsWith(`${CHUNKS}/`)) {
        throw new Error(`the CDN output imports "${entry.path}" from ${file}; every dependency must be bundled`);
      }
    }
  }
}

/** Runtime-located assets must sit beside the chunk that resolves them. */
function assertAssetsBesideReferences(metafile, outputPath) {
  for (const [file, output] of Object.entries(metafile.outputs)) {
    const shimmed = Object.keys(output.inputs).some((input) => input.startsWith(`${SHIM_NAMESPACE}:`));
    if (shimmed && !outputPath(file).startsWith(`${CHUNKS}/`)) {
      throw new Error(`a worker shim landed outside ${CHUNKS}/ (${file}); its relative worker URL would break`);
    }
  }
}

/** Every asset a bundled library fetches by a URL relative to its own module. */
function runtimeAssets(ui) {
  const resolve = (specifier) => requireFromPackage.resolve(specifier);
  return [
    [resolve('pdfjs-dist/build/pdf.worker.min.mjs'), join(CHUNKS, 'pdf.worker.min.mjs')],
    [join(dirname(resolve('maplibre-gl/package.json')), 'dist', 'maplibre-gl-worker.mjs'), join(CHUNKS, 'maplibre-gl-worker.mjs')],
    [join(ui, '..', 'lyra-docs', 'dist', 'docx', 'editor.css'), 'docx-editor.css'],
  ].map(([from, to]) => {
    if (!existsSync(from)) throw new Error(`the CDN build needs ${from} beside its chunks; build or install it first`);
    return [from, to];
  });
}

async function vendorFlags(outdir) {
  const flagsDir = join(packagesDir, 'lyra-flags');
  const manifest = JSON.parse(readFileSync(join(flagsDir, 'package.json'), 'utf8'));
  const target = join(outdir, VENDOR_FLAGS);
  for (const entry of manifest.files) {
    if (entry.endsWith('.d.ts') || entry === 'CHANGELOG.md') continue;
    await cp(join(flagsDir, entry), join(target, entry), { recursive: true });
  }
  await writeFile(join(target, 'package.json'), `${JSON.stringify({ name: manifest.name, version: manifest.version, type: 'module', license: manifest.license }, null, 2)}\n`);
}

/** The npm package directory that owns a bundled input path, or undefined for workspace code. */
function owningPackage(absolutePath) {
  const marker = `${sep}node_modules${sep}`;
  const at = absolutePath.lastIndexOf(marker);
  if (at < 0) return undefined;
  const rest = absolutePath.slice(at + marker.length).split(sep);
  const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
  return join(absolutePath.slice(0, at + marker.length), ...name.split('/'));
}

const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i;

function licenseTexts(directory) {
  return readdirSync(directory)
    .filter((name) => LICENSE_FILE.test(name))
    .sort()
    .map((name) => readFileSync(join(directory, name), 'utf8').trim());
}

/** Third-party notices for exactly what `dist` contains, derived from the build graph. */
function renderNotices(metafile, ui, extraPackageDirs) {
  const packages = new Map();
  const consider = (directory) => {
    if (!directory || packages.has(directory)) return;
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    if (manifest.name?.startsWith('@aceshooting/')) return;
    packages.set(directory, manifest);
  };
  for (const input of Object.keys(metafile.inputs)) {
    if (input.startsWith(`${SHIM_NAMESPACE}:`)) continue;
    consider(owningPackage(join(ui, input)));
  }
  for (const directory of extraPackageDirs) consider(directory);
  const sections = [...packages].sort(([, a], [, b]) => a.name.localeCompare(b.name, 'en')).map(([directory, manifest]) => {
    const license = typeof manifest.license === 'string' ? manifest.license : 'see the package';
    const texts = licenseTexts(directory);
    const body = texts.length > 0 ? texts.join('\n\n') : `No license file ships with this package; its declared license is ${license}.`;
    return `## ${manifest.name} ${manifest.version}\n\nLicense: ${license}\n\n\`\`\`text\n${body.replaceAll('```', "'''")}\n\`\`\``;
  });
  const companions = ['lyra-map', 'lyra-3d', 'lyra-flags', 'lyra-docs'].filter((name) => existsSync(join(packagesDir, name, 'THIRD_PARTY_NOTICES.md')));
  return [
    '# Third-party notices',
    '',
    'GENERATED by `scripts/build.mjs` from the bundle graph; do not edit by hand.',
    '',
    '`dist/` bundles the npm packages below. The Aceshooting companions it also bundles',
    `(${companions.map((name) => `\`@aceshooting/${name}\``).join(', ')}) carry notices for the code they`,
    'derive from upstream projects; those files ship unchanged under `dist/licenses/<package>/`.',
    '',
    ...sections.flatMap((section) => [section, '']),
  ].join('\n');
}

async function copyCompanionNotices(outdir) {
  for (const name of ['lyra-map', 'lyra-3d', 'lyra-flags', 'lyra-docs']) {
    const directory = join(packagesDir, name);
    const target = join(outdir, 'licenses', name);
    for (const file of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES']) {
      if (existsSync(join(directory, file))) await cp(join(directory, file), join(target, file), { recursive: true });
    }
  }
}

function buildMissingCompanions() {
  for (const name of CDN_COMPANIONS) {
    if (existsSync(join(packagesDir, name, 'dist'))) continue;
    console.log(`packages/${name}/dist is missing; building @aceshooting/${name} first.`);
    execFileSync('pnpm', ['--filter', `@aceshooting/${name}`, 'build'], { cwd: packagesDir, stdio: 'inherit' });
  }
}

export async function buildCdn(root = packageDir, ui = uiDir, { minify = true } = {}) {
  buildMissingCompanions();
  const outdir = join(root, 'dist');
  await rm(outdir, { recursive: true, force: true });
  const companion = (name, file) => join(packagesDir, name, 'dist', file);
  const result = await esbuild.build({
    absWorkingDir: ui,
    entryPoints: {
      'lyra-ui.loader': join(root, 'scripts', 'lyra-ui.loader.mjs'),
      'lyra-gen': join(root, 'scripts', 'lyra-gen.entry.mjs'),
      'lyra-docs': join(root, 'scripts', 'lyra-docs.entry.mjs'),
      'phone-numbers': join(root, 'scripts', 'phone-numbers.entry.mjs'),
      // Module workers resolved as `new URL('./<name>', import.meta.url)` from a chunk.
      [`${CHUNKS}/lyra-map.worker`]: companion('lyra-map', 'worker.mjs'),
      [`${CHUNKS}/layout.worker`]: companion('lyra-3d', 'graph/layout.worker.js'),
      [`${CHUNKS}/model.worker`]: companion('lyra-3d', 'model/model.worker.js'),
    },
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify,
    sourcemap: false,
    legalComments: 'none',
    chunkNames: `${CHUNKS}/[name]-[hash]`,
    // Object keys are output paths; `[dir]` keeps the worker entries under chunks/.
    entryNames: '[dir]/[name]',
    outbase: root,
    plugins: [cdnResolution(ui, join(root, 'scripts'))],
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
  const assets = runtimeAssets(ui);
  for (const [from, to] of assets) {
    await mkdir(dirname(join(outdir, to)), { recursive: true });
    // Upstream workers end in a `sourceMappingURL` comment for a map this package does not ship.
    const text = await readFile(from, 'utf8');
    await writeFile(join(outdir, to), text.replace(/\n?\/\/# sourceMappingURL=\S+\s*$/u, '\n'));
  }
  await vendorFlags(outdir);
  await copyCompanionNotices(outdir);
  await assertNoSourceMaps(outdir);
  // Metafile output paths are relative to `absWorkingDir`, with forward slashes.
  const outputPath = (file) => relative(outdir, join(ui, file)).split(sep).join('/');
  assertSelfContained(result.metafile, outputPath);
  assertAssetsBesideReferences(result.metafile, outputPath);
  const assetPackages = assets.map(([from]) => owningPackage(from)).filter(Boolean);
  await writeFile(join(root, 'THIRD_PARTY_NOTICES.md'), renderNotices(result.metafile, ui, assetPackages));
  const chunks = Object.keys(result.metafile.outputs).length;
  return { outdir, chunks, bytes: await totalBytes(outdir), relative: relative(root, outdir) };
}

if (isMainModule(import.meta.url)) {
  const { chunks, bytes } = await buildCdn();
  console.log(`Single-script CDN build: ${chunks} JavaScript files, ${bytes.toLocaleString('en')} bytes in dist.`);
}
