#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { generate } from './generate-framework-types.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const problems = [];
const expected = generate({ write: false });

for (const [relative, text] of expected) {
  const file = path.join(packageDir, relative);
  if (!existsSync(file)) {
    problems.push(`${relative} is missing — run \`pnpm run framework-types\`.`);
    continue;
  }
  const actual = readFileSync(file, 'utf8');
  if (actual === text) continue;
  const actualLines = actual.split('\n');
  const expectedLines = text.split('\n');
  const different = actualLines.findIndex((line, index) => line !== expectedLines[index]);
  const index = different === -1 ? Math.min(actualLines.length, expectedLines.length) : different;
  problems.push(
    `${relative} is stale — run \`pnpm run framework-types\`. First difference at line ${index + 1}:\n` +
      `      committed: ${JSON.stringify(actualLines[index] ?? '<end of file>')}\n` +
      `      generated: ${JSON.stringify(expectedLines[index] ?? '<end of file>')}`,
  );
}

const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
if (pkg.types !== './dist/lyra.d.ts') {
  problems.push('package.json must expose the root declaration through "types": "./dist/lyra.d.ts".');
}
if (
  !pkg.exports?.['.'] ||
  pkg.exports['.'].types !== './dist/lyra.d.ts' ||
  pkg.exports['.'].default !== './dist/lyra.js'
) {
  problems.push('package.json root export must pair ./dist/lyra.d.ts with the existing ./dist/lyra.js runtime.');
}
if (pkg.exports?.['./custom-elements.json'] !== './custom-elements.json') {
  problems.push('package.json must explicitly export ./custom-elements.json.');
}
if (pkg.customElements !== 'custom-elements.json') {
  problems.push('package.json#customElements must be the published custom-elements.json path.');
}
for (const [subpath, stem] of [
  ['./custom-elements-jsx', 'custom-elements-jsx'],
  ['./vue', 'vue'],
  ['./svelte', 'svelte'],
]) {
  const entry = pkg.exports?.[subpath];
  if (entry?.types !== `./dist/${stem}.d.ts` || entry?.default !== `./dist/${stem}.js`) {
    problems.push(`${subpath} must expose matching generated type and empty-runtime entries.`);
  }
}

for (const [peer, range] of [
  ['react', '>=19 <20'],
  ['svelte', '>=5 <6'],
  ['vue', '>=3.5 <4'],
]) {
  if (pkg.peerDependencies?.[peer] !== range) {
    problems.push(`${peer} must be declared as the supported framework declaration peer (${range}).`);
  }
  if (pkg.peerDependenciesMeta?.[peer]?.optional !== true) {
    problems.push(`${peer} must stay optional for consumers that do not import its declaration entry.`);
  }
  if (!pkg.devDependencies?.[peer]) {
    problems.push(`${peer} must be installed as a dev dependency so generated declarations type-check.`);
  }
}
if (!pkg.devDependencies?.['@types/react']) {
  problems.push('@types/react must be installed so the React declaration entry type-checks.');
}

const sideEffects = new Set(Array.isArray(pkg.sideEffects) ? pkg.sideEffects : []);
for (const stem of ['custom-elements-jsx', 'vue', 'svelte']) {
  for (const file of [`./src/${stem}.ts`, `./dist/${stem}.js`]) {
    if (sideEffects.has(file)) {
      problems.push(`${file} is types-only and must not be listed in package.json#sideEffects.`);
    }
  }
}

if (problems.length > 0) {
  console.error('Generated framework declarations are out of sync:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const react = expected.get('src/custom-elements-jsx.ts');
const tagCount = react?.match(/^  'lr-[^']+':/gm)?.length ?? 0;
console.log(`Framework declarations are in sync for ${tagCount} custom elements.`);
