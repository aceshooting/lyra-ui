import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(packageDir, 'src', 'components');
const manifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'));
const sharedCoverage = JSON.parse(fs.readFileSync(path.join(packageDir, 'scripts', 'component-coverage.json'), 'utf8'));
const errors = [];

function readFamilyFiles(family, suffix) {
  const directory = path.join(sourceRoot, family);
  return fs.readdirSync(directory).filter((file) => file.endsWith(suffix)).map((file) => fs.readFileSync(path.join(directory, file), 'utf8'));
}

/**
 * A tag counts as exercised when a test mounts it literally, or names it as a
 * string a parameterized fixture builds the tag from (`fixture(`<${tag}>`)`).
 */
function exercisesTag(tests, tag) {
  return new RegExp(`<${tag}(?:\\s|>)`).test(tests) || new RegExp(`['"\`]${tag}['"\`]`).test(tests);
}

for (const module of manifest.modules) {
  if (!module.path.startsWith('src/components/')) continue;
  const family = module.path.slice('src/components/'.length).split('/')[0];
  const stories = readFamilyFiles(family, '.stories.ts').join('\n');
  const tests = readFamilyFiles(family, '.test.ts').join('\n');
  for (const declaration of module.declarations ?? []) {
    if (!declaration.customElement || !declaration.tagName) continue;
    const tag = declaration.tagName;
    if (!new RegExp(`<${tag}(?:\\s|>)`).test(stories)) errors.push(`${tag}: no story exercises the public tag`);
    if (!exercisesTag(tests, tag)) {
      const shared = sharedCoverage[tag];
      const sharedTest = shared && path.join(packageDir, shared.test);
      const sharedSource = sharedTest && fs.existsSync(sharedTest) ? fs.readFileSync(sharedTest, 'utf8') : '';
      if (!shared || !sharedSource.includes(shared.marker) || !shared.reason) errors.push(`${tag}: no behavior test or documented shared-family coverage`);
    }
  }
  if (!tests.includes('accessible')) errors.push(`${family}: no accessibility assertion in its test family`);
}

if (errors.length) {
  console.error(`Component coverage contract failed with ${errors.length} finding(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const count = manifest.modules.flatMap((module) => module.declarations ?? []).filter((declaration) => declaration.customElement).length;
  console.log(`Component coverage contract passed for ${count} public tags.`);
}
