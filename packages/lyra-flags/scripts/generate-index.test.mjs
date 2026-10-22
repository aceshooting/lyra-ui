import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { packageDir, put, scratchPackage } from './test-support.mjs';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"/>\n';
const PROTOTYPE_NAMES = ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf'];

function addFlags(scratch, { standard = [], detailed = [], compact = [] }) {
  for (const code of standard) put(join(scratch.flags, `${code}.svg`), SVG);
  for (const code of detailed) put(join(scratch.flags, 'detailed', `${code}.svg`), SVG);
  for (const code of compact) put(join(scratch.flags, 'compact', `${code}.webp`), 'RIFF');
}

const listing = (directory, extension = '') => existsSync(directory)
  ? readdirSync(directory).filter(name => name.endsWith(extension)).sort() : [];

/** Every file under `directory` except the asset inputs, keyed by its posix path. */
function generatedFiles(directory) {
  const files = {};
  const walk = current => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (!/\.(?:svg|webp)$/u.test(entry.name)) files[relative(directory, file).split(sep).join('/')] = readFileSync(file, 'utf8');
    }
  };
  walk(directory);
  return files;
}

const importGenerated = (scratch, file) => import(pathToFileURL(join(scratch.flags, file)).href);
const fileUrl = (scratch, ...parts) => pathToFileURL(join(scratch.flags, ...parts)).href;

test('writes one loader per flag, the lazy and eager maps and their declarations in code order', context => {
  const scratch = scratchPackage(context, 'generate-index.mjs');
  addFlags(scratch, { standard: ['fr', 'do', 'ae', 'in'] });
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Generated flags\/generated\.js \+ flags\/eager\.js \(\+ \.d\.ts\) \+ flags\/loaders\/\*\.js for 4 flag\(s\), plus .* for 0 detailed variant\(s\), plus .* for 0 compact variant\(s\)\.\n$/u);

  assert.deepEqual(listing(join(scratch.flags, 'loaders')), ['ae.js', 'do.js', 'fr.js', 'in.js']);
  assert.match(readFileSync(join(scratch.flags, 'loaders', 'fr.js'), 'utf8'),
    /^\/\/ AUTO-GENERATED FILE\. Do not edit by hand\.\n(?:\/\/ .*\n)+\nexport default new URL\('\.\.\/fr\.svg', import\.meta\.url\)\.href;\n$/u);

  const lazy = readFileSync(join(scratch.flags, 'generated.js'), 'utf8');
  assert.deepEqual([...lazy.matchAll(/^ {2}(\w+): \(\) => import\('\.\/loaders\/(\w+)\.js'\)\.then\(\(m\) => m\.default\),$/gmu)]
    .map(([, key, specifier]) => [key, specifier]), [['ae', 'ae'], ['do', 'do'], ['fr', 'fr'], ['in', 'in']]);
  const eager = readFileSync(join(scratch.flags, 'eager.js'), 'utf8');
  assert.deepEqual([...eager.matchAll(/^ {2}(\w+): new URL\('\.\/(\w+)\.svg', import\.meta\.url\)\.href,$/gmu)]
    .map(([, key, asset]) => [key, asset]), [['ae', 'ae'], ['do', 'do'], ['fr', 'fr'], ['in', 'in']]);
  assert.match(readFileSync(join(scratch.flags, 'generated.d.ts'), 'utf8'),
    /export declare const FLAG_LOADERS: Record<string, \(\) => Promise<string>>;\n$/u);
  assert.match(readFileSync(join(scratch.flags, 'eager.d.ts'), 'utf8'), /export declare const FLAG_URLS: Record<string, string>;\n$/u);
  // With no variants the variant maps exist but are empty and no variant loader directory is created.
  assert.equal(existsSync(join(scratch.flags, 'detailed')), false);
  assert.equal(existsSync(join(scratch.flags, 'compact')), false);
});

test('the generated maps resolve each code to its own asset and know no prototype names', async context => {
  const scratch = scratchPackage(context, 'generate-index.mjs');
  addFlags(scratch, { standard: ['fr', 'do', 'in'] });
  assert.equal(scratch.run().status, 0);
  const { FLAG_LOADERS } = await importGenerated(scratch, 'generated.js');
  const { FLAG_URLS } = await importGenerated(scratch, 'eager.js');
  assert.deepEqual(Object.keys(FLAG_LOADERS), ['do', 'fr', 'in']);
  assert.deepEqual(Object.keys(FLAG_URLS), ['do', 'fr', 'in']);
  for (const code of ['do', 'fr', 'in']) {
    assert.equal(await FLAG_LOADERS[code](), fileUrl(scratch, `${code}.svg`));
    assert.equal(FLAG_URLS[code], fileUrl(scratch, `${code}.svg`));
  }
  for (const map of [FLAG_LOADERS, FLAG_URLS]) {
    assert.equal(Object.getPrototypeOf(map), null);
    for (const name of PROTOTYPE_NAMES) assert.equal(map[name], undefined, name);
  }
});

test('pairs each detailed original and compact raster with its own loader', async context => {
  const scratch = scratchPackage(context, 'generate-index.mjs');
  addFlags(scratch, { standard: ['es', 'fr'], detailed: ['es'], compact: ['es'] });
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /for 2 flag\(s\), plus .* for 1 detailed variant\(s\), plus .* for 1 compact variant\(s\)\.\n$/u);
  assert.deepEqual(listing(join(scratch.flags, 'detailed', 'loaders')), ['es.js']);
  assert.deepEqual(listing(join(scratch.flags, 'compact', 'loaders')), ['es.js']);

  const { FLAG_LOADERS_DETAILED } = await importGenerated(scratch, 'generated-detailed.js');
  const { FLAG_LOADERS_COMPACT } = await importGenerated(scratch, 'generated-compact.js');
  assert.deepEqual(Object.keys(FLAG_LOADERS_DETAILED), ['es']);
  assert.deepEqual(Object.keys(FLAG_LOADERS_COMPACT), ['es']);
  assert.equal(await FLAG_LOADERS_DETAILED.es(), fileUrl(scratch, 'detailed', 'es.svg'));
  assert.equal(await FLAG_LOADERS_COMPACT.es(), fileUrl(scratch, 'compact', 'es.webp'));
  for (const map of [FLAG_LOADERS_DETAILED, FLAG_LOADERS_COMPACT]) {
    assert.equal(map.fr, undefined, 'a code without a variant is absent, not aliased to the standard flag');
    assert.equal(Object.getPrototypeOf(map), null);
    for (const name of PROTOTYPE_NAMES) assert.equal(map[name], undefined, name);
  }
  assert.match(readFileSync(join(scratch.flags, 'generated-detailed.d.ts'), 'utf8'), /FLAG_LOADERS_DETAILED: Record<string, \(\) => Promise<string>>;\n$/u);
  assert.match(readFileSync(join(scratch.flags, 'generated-compact.d.ts'), 'utf8'), /FLAG_LOADERS_COMPACT: Record<string, \(\) => Promise<string>>;\n$/u);
});

test('empty variant directories produce empty maps and no variant loaders', async context => {
  const scratch = scratchPackage(context, 'generate-index.mjs');
  addFlags(scratch, { standard: ['fr'] });
  for (const directory of ['detailed', 'compact']) put(join(scratch.flags, directory, '.keep'), '');
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(scratch.flags, 'detailed', 'loaders')), false);
  assert.equal(existsSync(join(scratch.flags, 'compact', 'loaders')), false);
  assert.deepEqual(Object.keys((await importGenerated(scratch, 'generated-detailed.js')).FLAG_LOADERS_DETAILED), []);
  assert.deepEqual(Object.keys((await importGenerated(scratch, 'generated-compact.js')).FLAG_LOADERS_COMPACT), []);
});

test('regenerating unchanged assets rewrites every file byte for byte', context => {
  const scratch = scratchPackage(context, 'generate-index.mjs');
  addFlags(scratch, { standard: ['ae', 'es', 'fr'], detailed: ['es'], compact: ['es'] });
  assert.equal(scratch.run().status, 0);
  const first = generatedFiles(scratch.flags);
  assert.equal(scratch.run().status, 0);
  assert.deepEqual(generatedFiles(scratch.flags), first);
});

test('removes the loaders of flags that no longer exist, so the tree always matches the assets', context => {
  const scratch = scratchPackage(context, 'generate-index.mjs');
  addFlags(scratch, { standard: ['aa', 'bb', 'cc'], detailed: ['bb'], compact: ['bb'] });
  assert.equal(scratch.run().status, 0);
  assert.deepEqual(listing(join(scratch.flags, 'loaders')), ['aa.js', 'bb.js', 'cc.js']);
  assert.deepEqual(listing(join(scratch.flags, 'detailed', 'loaders')), ['bb.js']);
  assert.deepEqual(listing(join(scratch.flags, 'compact', 'loaders')), ['bb.js']);

  for (const asset of ['bb.svg', 'detailed/bb.svg', 'compact/bb.webp']) rmSync(join(scratch.flags, asset));
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(listing(join(scratch.flags, 'loaders')), ['aa.js', 'cc.js']);
  assert.deepEqual(listing(join(scratch.flags, 'detailed', 'loaders')), []);
  assert.deepEqual(listing(join(scratch.flags, 'compact', 'loaders')), []);
  assert.doesNotMatch(readFileSync(join(scratch.flags, 'generated.js'), 'utf8'), /\bbb\b/u);
});

test('the committed generated tree is exactly what the generator writes for the shipped assets', context => {
  const shipped = join(packageDir, 'flags');
  const scratch = scratchPackage(context, 'generate-index.mjs');
  const codes = (directory, extension) => listing(directory, extension).map(name => name.slice(0, -extension.length));
  addFlags(scratch, {
    standard: codes(shipped, '.svg'),
    detailed: codes(join(shipped, 'detailed'), '.svg'),
    compact: codes(join(shipped, 'compact'), '.webp'),
  });
  const result = scratch.run();
  assert.equal(result.status, 0, result.stderr);
  const fresh = generatedFiles(scratch.flags);
  const committed = generatedFiles(shipped);
  assert.deepEqual(Object.keys(fresh).sort(), Object.keys(committed).sort(),
    'the committed tree has missing or stale generated files: run `pnpm run generate`');
  for (const [file, content] of Object.entries(fresh)) {
    assert.equal(committed[file], content, `flags/${file} was edited by hand or is stale: run \`pnpm run generate\``);
  }
});

const refusals = [
  ['no flag assets at all', () => {}, /No \.svg files found in .*flags — refusing to generate an empty map\./u],
  ['a code that is not a plain lowercase a-z string', scratch => addFlags(scratch, { standard: ['fr', 'gb-eng'] }),
    /code 'gb-eng' is not a plain lowercase a-z string/u],
  ['an uppercase code', scratch => addFlags(scratch, { standard: ['FR'] }), /code 'FR' is not a plain lowercase a-z string/u],
  ['a detailed original with no standard flag', scratch => addFlags(scratch, { standard: ['fr'], detailed: ['xx'] }),
    /flags\/detailed\/xx\.svg has no matching flags\/xx\.svg/u],
  ['a compact raster with no standard flag', scratch => addFlags(scratch, { standard: ['fr'], compact: ['xx'] }),
    /flags\/compact\/xx\.webp has no matching flags\/xx\.svg/u],
];

for (const [name, setup, message] of refusals) {
  test(`refuses ${name} before writing any file`, context => {
    const scratch = scratchPackage(context, 'generate-index.mjs');
    setup(scratch);
    const result = scratch.run();
    assert.notEqual(result.status, 0, 'the generator must fail');
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
    for (const file of ['generated.js', 'eager.js', 'generated-detailed.js', 'generated-compact.js', 'loaders']) {
      assert.equal(existsSync(join(scratch.flags, file)), false, `${file} must not be written after a refusal`);
    }
  });
}
