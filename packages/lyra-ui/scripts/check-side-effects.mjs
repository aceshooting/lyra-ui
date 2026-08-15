// Guards against the exact bug class that has hit this package twice: a new component ships with
// a real `import './components/<name>/<name>.js'` registration side effect (its `defineElement()`
// call) but no matching `package.json#sideEffects` entry, so any consumer bundler that respects
// `sideEffects` (production tree-shaking) can silently drop the registration. See
// scripts/check-registration-architecture.mjs for the companion check that every `*.class.ts`
// module stays pure (never calls `defineElement()` itself) -- this script is the other half: it
// verifies the *registration* file for each of those class modules is actually declared as having
// side effects, in both the published `./dist/...` form and the in-repo `./src/...` form.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSideEffects } from './generate-side-effects.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const componentsRoot = join(packageDir, 'src', 'components');
const packageJsonPath = join(packageDir, 'package.json');
const inventoryPath = join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(entryPath));
    else files.push(entryPath);
  }
  return files;
}

const allClassFiles = walk(componentsRoot)
  .filter((file) => file.endsWith('.class.ts'))
  .sort();
// Shared implementation bases (for example Markdown's two-tag runtime base) are deliberately
// class modules without a sibling registration entry. They are not components and must not be
// forced into the inventory or package sideEffects list. Registered class modules retain the
// invariant below: every one has an inventory entry and a side-effectful sibling registration.
const classFiles = allClassFiles.filter((file) => existsSync(file.replace(/\.class\.ts$/, '.ts')));
assert.ok(classFiles.length >= 80, 'expected pure class modules for the component families');

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
assert.ok(Array.isArray(pkg.sideEffects), 'package.json#sideEffects must be an array');
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
assert.equal(inventory.schemaVersion, 1, 'component-inventory.json must use the supported schemaVersion 1');
assert.ok(Array.isArray(inventory.components), 'component-inventory.json must contain components[]');
const inventoryClassFiles = inventory.components.map((component) => component.classModule).sort();
const discoveredClassFiles = classFiles.map((file) => relative(packageDir, file).replaceAll('\\', '/')).sort();
assert.deepEqual(
  inventoryClassFiles,
  discoveredClassFiles,
  'component-inventory.json classModule entries must match the component source tree',
);
const sideEffects = new Set(pkg.sideEffects);

const duplicates = pkg.sideEffects.filter((entry, index) => pkg.sideEffects.indexOf(entry) !== index);
assert.deepEqual([...new Set(duplicates)], [], 'package.json#sideEffects must not contain duplicate entries');

const errors = [];
const derivedEntries = deriveSideEffects(packageDir);
const derivedSideEffects = new Set(derivedEntries);

// The generator and checker intentionally share one derivation. This catches side effects that
// are not component registrations (locale registration modules and bare CSS assets) and prevents
// a successful regeneration from deleting manually retained entries.
for (const entry of derivedEntries) {
  if (!sideEffects.has(entry)) errors.push(`package.json#sideEffects is missing "${entry}"`);
}
for (const entry of pkg.sideEffects) {
  if (!derivedSideEffects.has(entry)) {
    errors.push(`package.json#sideEffects has non-derived entry "${entry}"; update the authoritative derivation`);
  }
}
if (pkg.sideEffects.some((entry, index) => entry !== derivedEntries[index])) {
  errors.push('package.json#sideEffects must match the deterministic generated order');
}

// Every inventory entry names the `<name>.ts` module that imports the class and calls
// `defineElement()` -- that module is the file with the actual registration side effect. (The
// two known exceptions -- `archive-viewer-register.ts` and `ebook-viewer-register.ts`, which
// register a document-viewer renderer rather than a custom element -- don't have inventory
// registrations of their own; both already carry their own long-standing sideEffects entries.)
for (const component of inventory.components) {
  const classFile = join(packageDir, component.classModule);
  const registrationFile = join(packageDir, component.registrationModule);
  let source;
  try {
    source = readFileSync(registrationFile, 'utf8');
  } catch {
    errors.push(
      `${relative(packageDir, classFile)}: expected a sibling registration file at ` +
        `${relative(packageDir, registrationFile)} (none found)`,
    );
    continue;
  }
  if (!source.includes('defineElement(')) {
    errors.push(`${relative(packageDir, registrationFile)}: expected a defineElement() registration call`);
    continue;
  }

  const srcEntry = `./${component.registrationModule.replaceAll('\\', '/')}`;
  const distEntry = srcEntry.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js');
  if (!sideEffects.has(srcEntry)) errors.push(`package.json#sideEffects is missing "${srcEntry}"`);
  if (!sideEffects.has(distEntry)) errors.push(`package.json#sideEffects is missing "${distEntry}"`);
}

// The other side-effect-only module shapes, which have no `*.class.ts` and so are never reached by
// the walk above: `*-register.ts` (archive-viewer / ebook-viewer register a document-viewer
// renderer rather than a custom element) and `*-peer.ts` (flag-peer installs an optional-peer
// resolver via `setFlagUrlResolver()`). Both are imported for effect only -- a consumer writes a
// bare `import '.../flag-peer.js'` and reads no export -- so an undeclared one is dropped outright
// by any bundler honoring `sideEffects`. That is exactly how `flag-peer.js` shipped undeclared
// through 7.8.0: every `<lr-flag country|language>` in a production build silently lost its
// resolver and rendered the "flag unavailable" alert instead of an image.
// Per-family barrels (`components/<family>/index.ts`) are covered by the same loop: they
// `export *` from every registration module in the family, so importing one registers those tags.
for (const file of walk(componentsRoot)) {
  if (!/-(?:register|peer)\.ts$/.test(file) && basename(file) !== 'index.ts') continue;
  const relPath = relative(componentsRoot, file).replaceAll('\\', '/');
  const srcEntry = `./src/components/${relPath}`;
  const distEntry = `./dist/components/${relPath.replace(/\.ts$/, '.js')}`;
  if (!sideEffects.has(srcEntry)) errors.push(`package.json#sideEffects is missing "${srcEntry}"`);
  if (!sideEffects.has(distEntry)) errors.push(`package.json#sideEffects is missing "${distEntry}"`);
}

// The compatibility entries (`src/all.ts` / `dist/all.js`, and their server-only `ssr/all`
// counterpart) register every component via their own bare imports; all four forms of those
// all-components barrels must stay declared too. The package root (`src/lyra.ts`) is deliberately
// NOT listed: from 8.0.0 it is registration-free, and declaring a pure re-export barrel as
// side-effectful would force bundlers to evaluate every module it re-exports from.
for (const barrelEntry of ['./src/all.ts', './dist/all.js', './src/ssr/all.ts', './dist/ssr/all.js']) {
  if (!sideEffects.has(barrelEntry)) errors.push(`package.json#sideEffects is missing "${barrelEntry}"`);
}

// The reverse direction: every declared entry must still resolve to a real module. A stale entry
// (typically left behind by a component rename or removal) is harmless to bundlers but hides real
// drift -- a rename that forgets to re-add the new path looks "covered" as long as the old path
// still sits in the list. `dist/` is a build artifact that need not exist in a fresh checkout, so
// dist entries are validated against the source file they are compiled from instead.
for (const entry of pkg.sideEffects) {
  let sourcePath;
  if (entry.startsWith('./src/')) {
    sourcePath = join(packageDir, entry.slice('./'.length));
  } else if (entry.startsWith('./dist/')) {
    sourcePath = join(packageDir, 'src', entry.slice('./dist/'.length).replace(/\.js$/, '.ts'));
  } else {
    errors.push(`package.json#sideEffects entry "${entry}" is neither a ./src/ nor a ./dist/ path`);
    continue;
  }
  if (!existsSync(sourcePath)) {
    errors.push(
      `package.json#sideEffects entry "${entry}" is stale: no source file at ` +
        `${relative(packageDir, sourcePath)}`,
    );
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `sideEffects completeness verified: ${classFiles.length} component registration entries + root barrel, ` +
      `${pkg.sideEffects.length} generated entries (including locales and CSS) all resolve to real files`,
  );
}
