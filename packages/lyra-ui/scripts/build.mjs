import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactBuildCss } from './compact-build-css.mjs';
import { consolidateBuildDeclarations } from './consolidate-build-declarations.mjs';
import { compactBuildDeclarations } from './compact-build-declarations.mjs';
import { pruneUnreachableBuildDeclarations } from './prune-build-declarations.mjs';
import { stripTestOnlyBuildExports } from './strip-test-only-build-exports.mjs';
import { compactBuildJavaScript, pruneEmptyBuildJavaScript } from './compact-build-js.mjs';
import { checkLocalizationSlices, checkTranslationSlices } from './check-localization-slices.mjs';
import { copyMigrationRuntimeModules } from './copy-migration-runtime.mjs';
import {
  assertNormalizedMixinCount,
  normalizeMixinDeclarations,
} from './normalize-mixin-declarations.mjs';
import { stripCssComments } from './strip-css-comments.mjs';
import { generateThemeBootstrapAsset } from './generate-theme-bootstrap.mjs';
import { retargetLocaleLoaders } from './translations-companion.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const tsc = join(
  packageDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

// Reads only committed sources, so it runs in its own process alongside tsc and compaction.
const migrationContract = promisify(execFile)(process.execPath,
  [join(packageDir, 'scripts', 'migration-contract-projection.mjs')],
  { cwd: packageDir, maxBuffer: 64 * 1024 * 1024 }).then(({ stdout }) => stdout);
migrationContract.catch(() => {}); // reported where it is awaited

await rm(join(packageDir, 'dist'), { recursive: true, force: true });

await new Promise((resolve, reject) => {
  // tsconfig.build.json, not tsconfig.json: the published tree ships `dist` only,
  // so the emit config turns source maps off (see that file's comment).
  const child = spawn(tsc, ['-p', join(packageDir, 'tsconfig.build.json')], {
    cwd: packageDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(`tsc failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
  });
});

const testOnlyExports = stripTestOnlyBuildExports(packageDir);
console.log(`Test-only build exports stripped: ${testOnlyExports.exports} symbols across ${testOnlyExports.files} emitted files.`);

const normalizedMixins = await normalizeMixinDeclarations(join(packageDir, 'dist'));
assertNormalizedMixinCount(normalizedMixins, 21);
console.log(
  `Published mixin declarations normalized: ${normalizedMixins.replacements} base declaration(s) ` +
    `across ${normalizedMixins.filesChanged} file(s).`,
);

const compactedDeclarations = await compactBuildDeclarations(join(packageDir, 'dist'));
console.log(
  `Published declarations compacted: ${compactedDeclarations.beforeBytes.toLocaleString('en')} -> ` +
    `${compactedDeclarations.afterBytes.toLocaleString('en')} bytes across ` +
    `${compactedDeclarations.files} modules.`,
);

const consolidatedDeclarations = consolidateBuildDeclarations(packageDir);
console.log(`Published declaration entries consolidated: ${consolidatedDeclarations.removed} redundant files removed.`);

const prunedDeclarations = pruneUnreachableBuildDeclarations(packageDir);
console.log(`Published unreachable declaration modules removed: ${prunedDeclarations.removedPaths.length}.`);

for (const asset of ['theme.css', 'density.css', 'accents.css', 'preferences.css', 'looks', 'surfaces']) {
  await cp(join(packageDir, 'src', asset), join(packageDir, 'dist', asset), { recursive: true });
}

const stylesDir = join(packageDir, 'dist', 'styles');
await mkdir(stylesDir, { recursive: true });
await Promise.all(
  ['design-tokens.css', 'native.css', 'reservations.css', 'tokens-root.css', 'utilities.css'].map((name) =>
    cp(join(packageDir, 'src', 'styles', name), join(stylesDir, name)),
  ),
);

const compacted = await compactBuildJavaScript(join(packageDir, 'dist'));
console.log(
  `Published JavaScript compacted: ${compacted.beforeBytes.toLocaleString('en')} -> ` +
    `${compacted.afterBytes.toLocaleString('en')} bytes across ${compacted.files} modules.`,
);

// Must run after JavaScript compaction: the no-flash theme bootstrap's published bytes are
// `dist/theme/theme.js`'s own `lyraThemeBootstrap` export as esbuild leaves it, and this asset
// exists so a strict-CSP application can serve/hash it as an external file instead of inlining
// (and hand-rolling a nonce/hash pipeline for) that same string. Copied verbatim -- see
// generate-theme-bootstrap.mjs for why this can never be re-derived from source instead.
const themeBootstrap = await generateThemeBootstrapAsset(packageDir);
console.log(`Theme bootstrap asset published: ${themeBootstrap.length.toLocaleString('en')} bytes.`);

// esbuild's minifier treats a template literal's body as opaque -- it must, since the tag can read
// `raw` -- so the CSS comments in every `css` tagged template survive compaction and ship. They
// were 28% of emitted style bytes. Source keeps them; only the published copy loses them.
const strippedCss = await stripCssComments(join(packageDir, 'dist'));
console.log(
  `Published CSS comments stripped: ${strippedCss.removedBytes.toLocaleString('en')} bytes from ` +
    `${strippedCss.filesChanged} of ${strippedCss.files} modules.`,
);

const compactedCss = await compactBuildCss(join(packageDir, 'dist'));
console.log(
  `Published CSS compacted: ${compactedCss.removedBytes.toLocaleString('en')} bytes from ` +
    `${compactedCss.templates.toLocaleString('en')} templates and ` +
    `${compactedCss.stylesheets.toLocaleString('en')} stylesheets.`,
);

// The public migration executable is deliberately assembled from only its runtime module closure
// and a compact, prevalidated migration projection. Publishing scripts/ wholesale would expose
// contributor-only maintenance helpers, while publishing the 4+ MiB public-surface inventory
// would violate the package budget for data the CLI never reads. The projection embeds the
// authored Lyra rename ledger, validated against that inventory, for the `--origin=lyra-v*`
// rename profiles.
const migrationCliDir = join(packageDir, 'dist', 'cli');
copyMigrationRuntimeModules(join(packageDir, 'scripts'), migrationCliDir);
await writeFile(join(migrationCliDir, 'migration-contract.json'), await migrationContract, 'utf8');
await chmod(join(migrationCliDir, 'migrate-wa.mjs'), 0o755);
await chmod(join(migrationCliDir, 'lyra-ui.mjs'), 0o755);

const compactedMigrationCli = await compactBuildJavaScript(migrationCliDir);
console.log(
  `Published migration CLI compacted: ` +
    `${compactedMigrationCli.beforeBytes.toLocaleString('en')} -> ` +
    `${compactedMigrationCli.afterBytes.toLocaleString('en')} bytes across ` +
    `${compactedMigrationCli.files} modules.`,
);

const prunedRuntime = await pruneEmptyBuildJavaScript(join(packageDir, 'dist'),
  JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')));
console.log(`Published empty private runtime modules removed: ${prunedRuntime.removedPaths.length}.`);

await checkLocalizationSlices(packageDir);
console.log('Unbundled localization slice imports and public fallback catalog verified.');

await checkTranslationSlices(packageDir);
console.log('Per-family translation catalog slices and unchanged aggregate imports verified.');

// The real catalogs publish from @aceshooting/lyra-translations (assembled from dist/translations,
// which package.json#files excludes), so the shipped lazy loaders must import them from there.
const localeLoadersFile = join(packageDir, 'dist', 'internal', 'locale-loaders.generated.js');
const localeLoaders = retargetLocaleLoaders(await readFile(localeLoadersFile, 'utf8'));
if (localeLoaders.includes('../translations/')) throw new Error('locale loaders still import catalogs relative to lyra-ui.');
await writeFile(localeLoadersFile, localeLoaders);
console.log('Locale loaders retargeted at @aceshooting/lyra-translations.');
