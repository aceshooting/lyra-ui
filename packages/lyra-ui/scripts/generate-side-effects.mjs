// Regenerates package.json#sideEffects from the same required-entries derivation
// scripts/check-side-effects.mjs verifies against, so the array is a generated artifact instead
// of 500+ hand-maintained lines. Run after any component add/move/remove, then commit the diff.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
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

const required = new Set(['./src/lyra.ts', './dist/lyra.js']);

for (const classFile of classFiles) {
  const dir = dirname(classFile);
  const base = basename(classFile, '.class.ts');
  const registrationFile = join(dir, `${base}.ts`);
  const relPath = relative(componentsRoot, registrationFile).replaceAll('\\', '/');
  required.add(`./src/components/${relPath}`);
  required.add(`./dist/components/${relPath.replace(/\.ts$/, '.js')}`);
}

// Side-effect-only modules with no `*.class.ts` of their own, which the class-file-driven walk
// above therefore never visits, so they have to be derived from the file tree directly:
//   *-register.ts  archive-viewer / ebook-viewer -- register a document-viewer renderer rather
//                  than a custom element.
//   *-peer.ts      flag-peer -- installs an optional-peer resolver (`setFlagUrlResolver()`) for a
//                  component whose own class module deliberately keeps the optional peer out of
//                  its import graph.
// Both categories exist purely for their import-time side effect: a consumer writes a bare
// `import '.../flag-peer.js'` and never reads an export, so a bundler honoring `sideEffects`
// drops the module outright unless it is declared here. Derived from the walk (not carried over
// from the previous package.json) so a rename or family move can't silently strand an entry.
// Per-family barrels (`components/<family>/index.ts`) belong here for the same reason the root
// barrel does: they `export *` from every registration module in the family, so importing one
// registers those tags.
for (const file of walk(componentsRoot)) {
  if (!/-(?:register|peer)\.ts$/.test(file) && basename(file) !== 'index.ts') continue;
  const relPath = relative(componentsRoot, file).replaceAll('\\', '/');
  required.add(`./src/components/${relPath}`);
  required.add(`./dist/components/${relPath.replace(/\.ts$/, '.js')}`);
}

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

pkg.sideEffects = [...required].sort();
writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json#sideEffects regenerated: ${pkg.sideEffects.length} entries.`);
