// Fails when a component re-declares a union the shared styling vocabulary already owns.
//
// Before 8.0.0 the library shipped ten byte-identical copies of
// `'neutral' | 'brand' | 'success' | 'warning' | 'danger'` under ten different names, spelled across
// three different property names (`variant`, `tone`, `kind`). The cost was not the duplication --
// it was that a consumer could not learn the vocabulary once, and that adding a sixth tone meant
// finding ten files. `src/internal/variants.ts` now owns each of these; a local copy is a drift
// vector, so it fails here rather than at review time.
//
// The check is on the MEMBER SET, not the name or the order: renaming the alias or reordering the
// members is exactly how the copies diverged in the first place.
//
// Run: node scripts/check-style-vocabulary.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const componentsRoot = join(packageDir, 'src', 'components');
const vocabularyPath = join(packageDir, 'src', 'internal', 'variants.ts');

/** Every `export type X = 'a' | 'b';` in a source file, as a name -> sorted member list. */
export function readStringUnions(source) {
  const unions = new Map();
  // Deliberately only single-line unions with string-literal members: a multi-line or computed union
  // is not the shape this rule is about, and matching it loosely would produce false positives.
  for (const match of source.matchAll(/export type ([A-Za-z][\w]*)\s*=\s*((?:\s*'[^']*'\s*\|)+\s*'[^']*')\s*;/g)) {
    const members = [...match[2].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    unions.set(match[1], members);
  }
  return unions;
}

export const key = (members) => [...members].sort().join('|');

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(class|types)\.ts$/.test(entry.name) || entry.name.endsWith('-types.ts') ? [file] : [];
  });
}

/**
 * Aliases a component MAY still declare locally, each with the reason. An entry here is a decision,
 * not a suppression: it says the union means something different from the shared one that happens to
 * share its members.
 */
const ALLOWED = new Map([
  // `kind` on these is a media/content classification, not a semantic tone -- the members merely
  // happen to be short lowercase words. Collapsing them into LyraVariant would be wrong.
]);

if (process.argv[1] && process.argv[1].endsWith('check-style-vocabulary.mjs')) {
  const shared = readStringUnions(readFileSync(vocabularyPath, 'utf8'));
  const sharedByKey = new Map([...shared].map(([name, members]) => [key(members), name]));
  if (sharedByKey.size === 0) {
    throw new Error('parsed no shared unions from internal/variants.ts -- the file shape changed');
  }

  const findings = [];
  for (const file of sourceFiles(componentsRoot)) {
    const where = relative(packageDir, file);
    for (const [name, members] of readStringUnions(readFileSync(file, 'utf8'))) {
      const owner = sharedByKey.get(key(members));
      if (owner && !ALLOWED.has(name)) {
        findings.push(`${where}: \`${name}\` duplicates \`${owner}\` -- import it from internal/variants.ts instead`);
      }
    }
  }

  if (findings.length) {
    console.error(`Style-vocabulary contract failed with ${findings.length} finding(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    console.error('\nThe shared unions live in src/internal/variants.ts. Re-export the shared name if the manifest needs the local one.');
    process.exitCode = 1;
  } else {
    console.log(`Style-vocabulary contract passed: ${sharedByKey.size} shared unions, no component-local duplicates.`);
  }
}
