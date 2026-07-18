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
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const componentsRoot = join(packageDir, 'src', 'components');
const packageJsonPath = join(packageDir, 'package.json');

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(entryPath));
    else files.push(entryPath);
  }
  return files;
}

const classFiles = walk(componentsRoot)
  .filter((file) => file.endsWith('.class.ts'))
  .sort();
assert.ok(classFiles.length >= 80, 'expected pure class modules for the component families');

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
assert.ok(Array.isArray(pkg.sideEffects), 'package.json#sideEffects must be an array');
const sideEffects = new Set(pkg.sideEffects);

const duplicates = pkg.sideEffects.filter((entry, index) => pkg.sideEffects.indexOf(entry) !== index);
assert.deepEqual([...new Set(duplicates)], [], 'package.json#sideEffects must not contain duplicate entries');

const errors = [];

// Every `<name>.class.ts` has a sibling `<name>.ts` that imports the class and calls
// `defineElement()` -- that sibling is the file with the actual registration side effect. (The
// two known exceptions -- `archive-viewer-register.ts` and `ebook-viewer-register.ts`, which
// register a document-viewer renderer rather than a custom element -- don't have a `.class.ts` of
// their own, so the class-file-driven walk below never visits them; both already carry their own
// long-standing sideEffects entries.)
for (const classFile of classFiles) {
  const dir = dirname(classFile);
  const base = basename(classFile, '.class.ts');
  const registrationFile = join(dir, `${base}.ts`);
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

  const relPath = relative(componentsRoot, registrationFile).replaceAll('\\', '/');
  const srcEntry = `./src/components/${relPath}`;
  const distEntry = `./dist/components/${relPath.replace(/\.ts$/, '.js')}`;
  if (!sideEffects.has(srcEntry)) errors.push(`package.json#sideEffects is missing "${srcEntry}"`);
  if (!sideEffects.has(distEntry)) errors.push(`package.json#sideEffects is missing "${distEntry}"`);
}

// The root barrel (`src/lyra.ts` / `dist/lyra.js`) registers every non-optional-peer component via
// its own bare imports; both forms of that all-components barrel must stay declared too.
for (const barrelEntry of ['./src/lyra.ts', './dist/lyra.js']) {
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
      `${pkg.sideEffects.length} declared entries all resolve to real files`,
  );
}
