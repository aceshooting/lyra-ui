import { isMainModule } from './is-main-module.mjs';

// Regenerates package.json#sideEffects from the same required-entries derivation
// scripts/check-side-effects.mjs verifies against, so the array is a generated artifact instead
// of 500+ hand-maintained lines. Run after any component add/move/remove, then commit the diff.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

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

/** Unwraps `void x()` / `await x()` down to the call it wraps, the two shapes a bare top-level
 * side-effecting statement is written in across this package (`void registerLyraFlagPeer();`,
 * `await someAsyncInstall();`). */
function unwrapVoidAndAwait(expression) {
  let current = expression;
  while (current && (current.type === 'UnaryExpression' || current.type === 'AwaitExpression')) {
    current = current.argument;
  }
  return current;
}

/** A bare top-level `foo();` (or `void foo();` / `await foo();`) -- a statement whose entire
 * reason to exist is the call's own effect, not a value anything reads. */
function isBareTopLevelCallStatement(statement) {
  if (statement.type !== 'ExpressionStatement') return false;
  const expression = unwrapVoidAndAwait(statement.expression);
  return expression?.type === 'CallExpression' || expression?.type === 'NewExpression';
}

/** A same-package relative `export * from '<specifier>'` / `export { x } from '<specifier>'`
 * (never a type-only one), resolved from `<file>.js` back to the `<file>.ts` source path it
 * forwards to -- so a barrel that only re-exports a side-effecting sibling is still discovered as
 * side-effecting itself, without hand-naming that barrel shape (`index.ts` and the stable
 * `lr-*.ts` tag aliases both work this way). */
function reexportSourceTargets(program, file) {
  const targets = [];
  for (const statement of program.body) {
    if (
      (statement.type !== 'ExportAllDeclaration' && statement.type !== 'ExportNamedDeclaration') ||
      typeof statement.source?.value !== 'string' ||
      statement.exportKind === 'type'
    ) continue;
    const specifier = statement.source.value;
    if (!specifier.startsWith('.')) continue;
    const resolved = join(file, '..', specifier);
    targets.push(resolved.endsWith('.js') ? `${resolved.slice(0, -3)}.ts` : resolved);
  }
  return targets;
}

/**
 * Behavior-based replacement for the three filename shapes (`*-register.ts`, `*-peer(-*).ts`,
 * `index.ts`, a top-level `lr-*.ts` alias) this used to hand-match: a component-tree `.ts` module
 * requires a `package.json#sideEffects` entry when either (a) it has its own top-level
 * side-effecting call -- `flag-peer.ts`'s `setFlagUrlResolver(...)`, an `-register.ts`'s
 * `registerDocumentRenderer(...)` -- or (b) it re-exports (`export ... from`) another module that
 * does, directly or transitively (an `index.ts` barrel, a stable `lr-*.ts` alias). Neither
 * condition names a file; a future side-effect-only module survives discovery under any name.
 *
 * `.class.ts` (and `-core.class.ts`) modules are the one deliberate exception: their whole
 * contract is a plain class export, always referenced (and so always evaluated) by their sibling
 * registration entry's `defineElement()` call, and the codebase leans on exactly that property to
 * keep them independently tree-shakeable (see `installFormControlLabelSupport`'s doc comment in
 * `src/internal/form-control-labels.ts`) -- a handful legitimately also make a top-level call of
 * their own (a shared-hook installer) that must not, by itself, force the file into this array.
 *
 * @param {string} componentsRoot
 * @returns {string[]} `.ts` files, relative to `componentsRoot`, POSIX-separated
 */
export function discoverComponentSideEffectModules(componentsRoot) {
  const files = walk(componentsRoot).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.endsWith('.test.ts') && !file.endsWith('.stories.ts'),
  );
  const directlySideEffecting = new Set();
  const reexportTargets = new Map();

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const result = parseSync(file, source);
    if (result.errors.length > 0) {
      const detail = result.errors.slice(0, 3).map((error) => error.message).join('; ');
      throw new Error(`${relative(componentsRoot, file)}: sideEffects discovery parser failed: ${detail}`);
    }
    const eligibleForDirectCall = !file.endsWith('.class.ts');
    let direct = false;
    for (const statement of result.program.body) {
      if (eligibleForDirectCall && isBareTopLevelCallStatement(statement)) direct = true;
    }
    if (direct) directlySideEffecting.add(file);
    reexportTargets.set(file, reexportSourceTargets(result.program, file));
  }

  // Fixed-point closure: a re-export barrel picks up requiredness from whatever it forwards to,
  // which may itself only be required because IT forwards further (a family `index.ts` re-
  // exporting a component's `lr-*.ts`-shaped registration entry one level down).
  let changed = true;
  while (changed) {
    changed = false;
    for (const [file, targets] of reexportTargets) {
      if (directlySideEffecting.has(file)) continue;
      if (targets.some((target) => directlySideEffecting.has(target))) {
        directlySideEffecting.add(file);
        changed = true;
      }
    }
  }

  return [...directlySideEffecting]
    .map((file) => relative(componentsRoot, file).replaceAll('\\', '/'))
    .sort();
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
// the file tree directly. This used to hand-match three filename shapes (a `*-register.ts` --
// archive-viewer / ebook-viewer register a document-viewer renderer rather than a custom element;
// a `*-peer(-*).ts` -- flag-peer installs an optional-peer resolver via `setFlagUrlResolver()`,
// and a QUALIFIED variant like `flag-peer-bulk.ts` is the same kind of module; a per-family
// `index.ts` barrel; a stable one-tag `lr-*.ts` alias). A name is not a behavior, though: 11.2.0
// shipped `flag-peer-bulk.js` as its headline <lr-flag> entry point and the bare-suffix pattern
// here could not see it, so a bundler honouring `sideEffects` dropped the module outright --
// quieter than the missing export route it shipped alongside, since the import still compiled and
// then simply did nothing at runtime. `discoverComponentSideEffectModules` replaces the name match
// with the actual behavior every one of those shapes shares: a top-level side-effecting call, or a
// re-export chain that reaches one, so a future side-effect-only module survives discovery under
// any name.
  for (const relPath of discoverComponentSideEffectModules(componentsRoot)) {
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

if (isMainModule(import.meta.url)) {
  const entries = generateSideEffects();
  console.log(`package.json#sideEffects regenerated: ${entries.length} entries.`);
}
