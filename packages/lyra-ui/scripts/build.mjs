import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactBuildJavaScript } from './compact-build-js.mjs';
import { checkLocalizationSlices } from './check-localization-slices.mjs';
import { createMigrationRuntimeInventory } from './migrate-wa.mjs';
import { normalizeMixinDeclarations } from './normalize-mixin-declarations.mjs';
import { stripCssComments } from './strip-css-comments.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const tsc = join(
  packageDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
);

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

const normalizedMixins = await normalizeMixinDeclarations(join(packageDir, 'dist'));
console.log(
  `Published mixin declarations normalized: ${normalizedMixins.replacements} base declaration(s) ` +
    `across ${normalizedMixins.filesChanged} file(s).`,
);

await cp(join(packageDir, 'src', 'theme.css'), join(packageDir, 'dist', 'theme.css'));

const stylesDir = join(packageDir, 'dist', 'styles');
await mkdir(stylesDir, { recursive: true });
await Promise.all(
  ['design-tokens.css', 'native.css', 'reservations.css', 'utilities.css'].map((name) =>
    cp(join(packageDir, 'src', 'styles', name), join(stylesDir, name)),
  ),
);

const compacted = await compactBuildJavaScript(join(packageDir, 'dist'));
console.log(
  `Published JavaScript compacted: ${compacted.beforeBytes.toLocaleString('en')} -> ` +
    `${compacted.afterBytes.toLocaleString('en')} bytes across ${compacted.files} modules.`,
);

// esbuild's minifier treats a template literal's body as opaque -- it must, since the tag can read
// `raw` -- so the CSS comments in every `css` tagged template survive compaction and ship. They
// were 28% of emitted style bytes. Source keeps them; only the published copy loses them.
const strippedCss = await stripCssComments(join(packageDir, 'dist'));
console.log(
  `Published CSS comments stripped: ${strippedCss.removedBytes.toLocaleString('en')} bytes from ` +
    `${strippedCss.filesChanged} of ${strippedCss.files} modules.`,
);

// The public migration executable is deliberately assembled from only its two runtime modules
// and a compact, prevalidated migration projection. Publishing scripts/ wholesale would expose
// contributor-only maintenance helpers, while publishing the 4+ MiB public-surface inventory
// would violate the package budget for data the CLI never reads.
const migrationCliDir = join(packageDir, 'dist', 'cli');
await mkdir(migrationCliDir, { recursive: true });
await Promise.all([
  cp(join(packageDir, 'scripts', 'migrate-wa.mjs'), join(migrationCliDir, 'migrate-wa.mjs')),
  cp(
    join(packageDir, 'scripts', 'component-inventory.mjs'),
    join(migrationCliDir, 'component-inventory.mjs'),
  ),
]);
const componentInventory = JSON.parse(
  await readFile(join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8'),
);
await writeFile(
  join(migrationCliDir, 'migration-contract.json'),
  `${JSON.stringify(createMigrationRuntimeInventory(componentInventory))}\n`,
  'utf8',
);
await chmod(join(migrationCliDir, 'migrate-wa.mjs'), 0o755);

await checkLocalizationSlices(packageDir);
console.log('Unbundled localization slice imports and public fallback catalog verified.');
