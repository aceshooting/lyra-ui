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

// Two components (archive-viewer, ebook-viewer) register a document-viewer renderer through a
// dedicated *-register.ts file with no matching *.class.ts of its own -- the class-file-driven
// walk above never visits them, so they're carried over unchanged (just re-pathed to their new
// family location) from whatever the current package.json already declares.
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const { directories: dirToFamily } = JSON.parse(
  readFileSync(join(packageDir, 'scripts', 'component-families.json'), 'utf8'),
);
function rehome(entry) {
  const m = entry.match(/^(\.\/(?:src|dist)\/components\/)([^/]+)\/(.*)$/);
  if (!m) return entry;
  const [, prefix, dir, rest] = m;
  const family = dirToFamily[dir];
  return family ? `${prefix}${family}/${dir}/${rest}` : entry;
}
for (const entry of pkg.sideEffects) {
  if (entry.includes('-register.')) required.add(rehome(entry));
}

pkg.sideEffects = [...required].sort();
writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`package.json#sideEffects regenerated: ${pkg.sideEffects.length} entries.`);
