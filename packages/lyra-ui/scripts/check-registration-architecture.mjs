import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const components = fileURLToPath(new URL('../src/components/', import.meta.url));
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findFiles(path)));
    else if (entry.name.endsWith('.class.ts')) files.push(path);
  }
  return files;
}

const classFiles = await findFiles(components);
assert.ok(classFiles.length >= 80, 'expected pure class modules for the component families');
for (const file of classFiles) {
  const source = await readFile(file, 'utf8');
  assert.equal(source.includes('defineElement('), false, `${file} must not register a custom element`);
}

console.log(`registration architecture verified: ${classFiles.length} pure class modules`);

const rootBarrel = await readFile(join(sourceRoot, 'lyra.ts'), 'utf8');
const allowlist = await readFile(join(sourceRoot, 'internal', 'root-registration-allowlist.ts'), 'utf8');
const rootBlock = allowlist.match(/ROOT_BARREL_TAGS\s*=\s*\[([\s\S]*?)\]\s*as const/);
assert.ok(rootBlock, 'root registration allowlist must define ROOT_BARREL_TAGS');
const expectedRootTags = [...rootBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
const optionalBlock = allowlist.match(/ROOT_BARREL_OPTIONAL_PEER_TAGS\s*=\s*\[([\s\S]*?)\]\s*as const/);
assert.ok(optionalBlock, 'root registration allowlist must define ROOT_BARREL_OPTIONAL_PEER_TAGS');
const expectedOptionalTags = [...optionalBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
const importedRootTags = [
  ...rootBarrel.matchAll(/^import '\.\/components\/(?:[^/\n]+\/)*([^']+)\.js';$/gm),
]
  .map((match) => match[1])
  .filter((moduleName) => !moduleName.endsWith('-register'))
  .map((moduleName) => `lr-${moduleName}`);
if (rootBarrel.includes("export { LyraFlag } from './components/media/flag/flag.js';")) {
  importedRootTags.push('lr-flag');
}
assert.deepEqual(
  [...new Set(importedRootTags)].sort(),
  expectedRootTags,
  'root barrel imports must match ROOT_BARREL_TAGS',
);

const manifest = JSON.parse(readFileSync(join(sourceRoot, '..', 'custom-elements.json'), 'utf8'));
const manifestTags = manifest.modules
  .flatMap((module) => module.declarations ?? [])
  .filter((declaration) => declaration.customElement && declaration.tagName)
  .map((declaration) => declaration.tagName)
  .filter((tag, index, tags) => tags.indexOf(tag) === index)
  .sort();
assert.deepEqual(
  [...expectedRootTags, ...expectedOptionalTags].sort(),
  manifestTags,
  'root registration allowlist must cover every manifest custom element exactly once',
);

console.log(`root registration allowlist verified: ${expectedRootTags.length} tags`);
