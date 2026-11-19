import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';
import { parseProgram, visitAst } from './lib/ast.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(packageDir, 'src', 'components');
function readFamilyFiles(family, suffix) {
  const directory = path.join(sourceRoot, family);
  return fs.readdirSync(directory).filter((file) => file.endsWith(suffix)).map((file) => fs.readFileSync(path.join(directory, file), 'utf8'));
}

/**
 * A tag counts as exercised when a test mounts it literally, or names it as a
 * string a parameterized fixture builds the tag from (`fixture(`<${tag}>`)`).
 */
export function exercisesTag(tests, tag) {
  return new RegExp(`<${tag}(?:\\s|>)`).test(tests) || new RegExp(`['"\`]${tag}['"\`]`).test(tests);
}

function isAccessibilityAssertion(node) {
  if (node.type !== 'CallExpression') return false;
  const { callee } = node;
  if (callee.type !== 'MemberExpression' || callee.computed || callee.property.name !== 'accessible') return false;
  let chain = callee.object;
  while (chain.type === 'MemberExpression' && !chain.computed && chain.property.name !== 'not') {
    chain = chain.object;
  }
  return chain.type === 'CallExpression' && chain.callee.name === 'expect';
}

/** A tag is axe-checked only by a test file that mounts it and makes a positive axe assertion. */
export function hasAccessibilityAssertion(testFiles, tag) {
  const openingTag = new RegExp(`<${tag}(?:\\s|>)`);
  return testFiles.some((source) => {
    if (!source.includes('accessible') || !exercisesTag(source, tag)) return false;
    let mountsTag = false;
    let checksAccessibility = false;
    visitAst(parseProgram(`${tag}.test.ts`, source), (node) => {
      const text = node.type === 'TemplateElement' ? node.value.raw : node.type === 'Literal' ? node.value : undefined;
      mountsTag ||= typeof text === 'string' && (text === tag || openingTag.test(text));
      checksAccessibility ||= isAccessibilityAssertion(node);
    });
    return mountsTag && checksAccessibility;
  });
}

function main() {
  const inventory = JSON.parse(
    fs.readFileSync(path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8'),
  );
  const sharedCoverage = JSON.parse(fs.readFileSync(path.join(packageDir, 'scripts', 'component-coverage.json'), 'utf8'));
  const errors = [];

  if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.components)) {
    throw new Error('component-inventory.json uses an unsupported schema; expected schemaVersion 1 with components[]');
  }

  for (const component of inventory.components) {
    // Exactly two segments (family, component name) regardless of how deep the class module sits
    // below that -- a component's own fixtures/ subfolder can hold analyzed modules, but its
    // stories/tests still live directly in the component's own directory.
    const relPath = component.classModule.slice('src/components/'.length);
    const pathSegments = relPath.split('/');
    if (pathSegments.length < 3) {
      errors.push(`${component.tag}: invalid classModule ${component.classModule}`);
      continue;
    }
    const family = pathSegments.slice(0, 2).join('/');
    const stories = readFamilyFiles(family, '.stories.ts').join('\n');
    const testFiles = readFamilyFiles(family, '.test.ts');
    const tests = testFiles.join('\n');
    const tag = component.tag;
    if (!new RegExp(`<${tag}(?:\\s|>)`).test(stories)) errors.push(`${tag}: no story exercises the public tag`);
    if (!exercisesTag(tests, tag)) {
      const shared = sharedCoverage[tag];
      const sharedTest = shared && path.join(packageDir, shared.test);
      const sharedSource = sharedTest && fs.existsSync(sharedTest) ? fs.readFileSync(sharedTest, 'utf8') : '';
      if (!shared || !sharedSource.includes(shared.marker) || !shared.reason) errors.push(`${tag}: no behavior test or documented shared-family coverage`);
    }
    if (!hasAccessibilityAssertion(testFiles, tag)) errors.push(`${tag}: no test file that mounts it also calls to.be.accessible`);
  }

  if (errors.length) {
    console.error(`Component coverage contract failed with ${errors.length} finding(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Component coverage contract passed for ${inventory.components.length} public tags.`);
  }
}

if (isMainModule(import.meta.url)) main();
