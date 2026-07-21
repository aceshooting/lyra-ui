import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(scriptsDir, '..');
const data = JSON.parse(readFileSync(join(scriptsDir, 'component-families.json'), 'utf8'));

const familyKeys = new Set(data.families.map((f) => f.key));
assert.equal(familyKeys.size, data.families.length, 'family keys must be unique');
assert.equal(familyKeys.size, 11, 'expected exactly 11 families');

const componentsRoot = join(packageDir, 'src', 'components');
const realFamilies = readdirSync(componentsRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
assert.deepEqual(
  realFamilies,
  [...familyKeys].sort(),
  'component-families.json must map every real src/components/<family>/ directory, and only real families',
);

// The mapping is keyed by component directory name, while the source tree is grouped one level
// deeper under its family directory: src/components/<family>/<component>/. Flatten that second
// level before comparing so a family restructure cannot silently leave the catalog stale.
const realDirs = realFamilies
  .flatMap((family) =>
    readdirSync(join(componentsRoot, family), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  )
  .sort();
const mappedDirs = Object.keys(data.directories).sort();
assert.deepEqual(
  mappedDirs,
  realDirs,
  'component-families.json must map every real src/components/ directory, and only real directories',
);

for (const [dir, family] of Object.entries(data.directories)) {
  assert.ok(familyKeys.has(family), `${dir} is mapped to unknown family "${family}"`);
}

console.log(`component-families.json: ${data.families.length} families, ${mappedDirs.length} directories, all consistent.`);
