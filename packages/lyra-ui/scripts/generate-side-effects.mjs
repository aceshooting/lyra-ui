// Regenerates package.json#sideEffects from the same required-entries derivation
// scripts/check-side-effects.mjs verifies against, so the array is a generated artifact instead
// of 500+ hand-maintained lines. Run after any component add/move/remove, then commit the diff.
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

// Public entries whose documented behavior happens at import time. Keep this list deliberately
// small: ordinary exported functions and classes are tree-shakeable and do not belong here.
export const CURATED_PUBLIC_SIDE_EFFECT_ENTRIES = Object.freeze([
  { source: 'src/autoloader-cdn.ts', exportPath: './autoloader-cdn.js' },
  { source: 'src/hydration.ts', exportPath: './hydration.js' },
  { source: 'src/ssr-loader.ts', exportPath: './ssr-loader.js' },
]);

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(entryPath));
    else files.push(entryPath);
  }
  return files;
}

export function deriveSideEffects(packageDir = defaultPackageDir) {
  const sourceRoot = join(packageDir, 'src');
  const componentsRoot = join(sourceRoot, 'components');
  const translationsRoot = join(sourceRoot, 'translations');
  const inventoryPath = join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');
  const packageJsonPath = join(packageDir, 'package.json');
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.components)) {
    throw new Error('component-inventory.json uses an unsupported schema; expected schemaVersion 1 with components[]');
  }
  const registrationModules = inventory.components.map((component) => component.registrationModule);
  if (registrationModules.some((module) => typeof module !== 'string' || !module.startsWith('src/components/') || !module.endsWith('.ts'))) {
    throw new Error('component-inventory.json contains an invalid registrationModule');
  }
  if (new Set(registrationModules).size !== registrationModules.length) {
    throw new Error('component-inventory.json contains duplicate registrationModule entries');
  }

  // The two compatibility entries are the modules whose documented behavior *is* an import-time
  // side effect (they register every component). The package root (`src/lyra.ts`) is deliberately
  // absent: it is registration-free from 8.0.0 onward, and declaring a pure re-export barrel as
  // side-effectful would force bundlers to evaluate it — and therefore every module it re-exports
  // from — defeating the tree-shaking the registration-free root exists to enable.
  const required = new Set(['./src/all.ts', './dist/all.js', './src/ssr/all.ts', './dist/ssr/all.js']);

  for (const entry of CURATED_PUBLIC_SIDE_EFFECT_ENTRIES) {
    const sourcePath = join(packageDir, entry.source);
    if (!existsSync(sourcePath)) {
      throw new Error(`curated public side-effect source is missing: ${entry.source}`);
    }
    const distTarget = `./dist/${entry.source.slice('src/'.length).replace(/\.ts$/, '.js')}`;
    const declarationTarget = distTarget.replace(/\.js$/, '.d.ts');
    const packageExport = pkg.exports?.[entry.exportPath];
    const actualDefault =
      typeof packageExport === 'string' ? packageExport : packageExport?.default;
    const actualTypes = typeof packageExport === 'object' ? packageExport?.types : undefined;
    if (actualDefault !== distTarget || actualTypes !== declarationTarget) {
      throw new Error(
        `${entry.exportPath} must export types ${declarationTarget} and default ${distTarget}`,
      );
    }
    required.add(`./${entry.source}`);
    required.add(distTarget);
  }

  for (const registrationModule of registrationModules) {
    const sourceEntry = `./${registrationModule.replaceAll('\\', '/')}`;
    required.add(sourceEntry);
    required.add(sourceEntry.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js'));
  }

// Side-effect-only modules with no inventory registration of their own have to be derived from
// the file tree directly:
//   *-register.ts  archive-viewer / ebook-viewer -- register a document-viewer renderer rather
//                  than a custom element.
//   *-peer.ts      flag-peer -- installs an optional-peer resolver (`setFlagUrlResolver()`) for a
//                  component whose own class module deliberately keeps the optional peer out of
//                  its import graph.
// Both categories exist purely for their import-time side effect: a consumer writes a bare
// `import '.../flag-peer.js'` and never reads an export, so a bundler honoring `sideEffects`
// drops the module outright unless it is declared here. Derived from the walk (not carried over
// from the previous package.json) so a rename or family move can't silently strand an entry.
// Per-family barrels (`components/<family>/index.ts`) and the stable one-tag alias entries
// (`components/lr-*.ts`) belong here for the same reason: their documented contract is an import-
// time registration, so a bare consumer import must survive production tree shaking.
  for (const file of walk(componentsRoot)) {
    const relPath = relative(componentsRoot, file).replaceAll('\\', '/');
    const topLevelAlias = !relPath.includes('/') && /^lr-[a-z0-9-]+\.ts$/.test(relPath);
    if (!/-(?:register|peer)\.ts$/.test(file) && basename(file) !== 'index.ts' && !topLevelAlias) continue;
    required.add(`./src/components/${relPath}`);
    required.add(`./dist/components/${relPath.replace(/\.ts$/, '.js')}`);
  }

  // Locale modules register themselves with the global locale registry at import time. Both the
  // source paths used by repository-local bundlers and the compiled paths shipped to consumers
  // therefore need explicit retention.
  for (const file of walk(translationsRoot)) {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts') || file.endsWith('.test.ts')) continue;
    const relPath = relative(sourceRoot, file).replaceAll('\\', '/');
    required.add(`./src/${relPath}`);
    required.add(`./dist/${relPath.replace(/\.ts$/, '.js')}`);
  }

  // A bare CSS import exists solely for its style side effect. Derive every shipped source CSS
  // asset instead of naming theme.css specially so future opt-in bundles cannot be added to the
  // exports map without also becoming tree-shaking-safe.
  for (const file of walk(sourceRoot)) {
    if (!file.endsWith('.css')) continue;
    const relPath = relative(sourceRoot, file).replaceAll('\\', '/');
    required.add(`./src/${relPath}`);
    required.add(`./dist/${relPath}`);
  }

  return [...required].sort();
}

export function generateSideEffects(packageDir = defaultPackageDir) {
  const packageJsonPath = join(packageDir, 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  pkg.sideEffects = deriveSideEffects(packageDir);
  writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  return pkg.sideEffects;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = generateSideEffects();
  console.log(`package.json#sideEffects regenerated: ${entries.length} entries.`);
}
