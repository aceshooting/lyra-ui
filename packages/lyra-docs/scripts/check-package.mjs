import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectSourcePolicyFindings,
  findDoubleQuotedStringLiterals,
  findNulByteLines,
  findBareGlobalIsNaNCalls,
} from '../../lyra-ui/scripts/check-source-policy.mjs';
import { staticModuleSpecifiers } from '../../lyra-ui/scripts/module-specifiers.mjs';
import { findBuildArtifactFindings } from '../../lyra-ui/scripts/check-build-artifacts.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.resolve(packageRoot, '../..');
const read = (file) => readFileSync(path.join(repoRoot, file), 'utf8');
const manifest = JSON.parse(read('packages/lyra-docs/package.json'));
assert.equal(manifest.name, '@aceshooting/lyra-docs');
assert.match(manifest.version, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u);
assert.equal(manifest.private, undefined, 'The Docs package must be publishable');
assert.equal(manifest.type, 'module');
assert.equal(manifest.engines.node, '>=22');
assert.equal(manifest.packageManager, JSON.parse(read('package.json')).packageManager);
assert.deepEqual(manifest.sideEffects, [
  './dist/docx/editor.js', './src/docx/editor.ts', './dist/docx/editor.css',
]);
assert.deepEqual(manifest.publishConfig, { access: 'public' });
assert.equal(manifest.repository.directory, 'packages/lyra-docs');
assert.equal(manifest.scripts.prepack, 'pnpm --filter @aceshooting/lyra-ui build && pnpm build');
assert.deepEqual(manifest.exports, {
  '.': { types: './dist/index.d.ts', default: './dist/index.js' },
  './docx': { types: './dist/docx/index.d.ts', default: './dist/docx/index.js' },
  './docx/editor': { types: './dist/docx/editor.d.ts', default: './dist/docx/editor.js' },
  './docx/editor.class': { types: './dist/docx/docx-editor.class.d.ts', default: './dist/docx/docx-editor.class.js' },
  './docx/editor.css': './dist/docx/editor.css',
  './package.json': './package.json',
});
assert.deepEqual(manifest.files, ['dist', 'CHANGELOG.md', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES']);
const changelog = read('packages/lyra-docs/CHANGELOG.md');
assert.match(changelog, /^# @aceshooting\/lyra-docs\s/mu);
assert(changelog.split(/\r?\n/u).includes(`## ${manifest.version}`), 'Changelog lacks current version');
// package.json is the single source of versions; the docs and shipped notices must follow it.
assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['fflate', 'lit', 'saxes']);
assert.equal(Object.keys(manifest.optionalDependencies ?? {}).length, 0);
const engine = manifest.peerDependencies['@docx-editor.dev/core'];
assert.match(engine, /^\d+\.\d+\.\d+$/u, 'The document engine peer is one exact version');
assert.deepEqual(manifest.peerDependencies, { '@aceshooting/lyra-ui': 'workspace:^', '@docx-editor.dev/core': engine });
assert.deepEqual(manifest.peerDependenciesMeta, { '@docx-editor.dev/core': { optional: true } });
assert.equal(manifest.devDependencies['@docx-editor.dev/core'], engine);
assert.equal(manifest.devDependencies['@aceshooting/lyra-ui'], 'workspace:*');
assert(read('packages/lyra-docs/README.md').includes(`@docx-editor.dev/core@${engine}`), 'README names the engine version');
const notices = read('packages/lyra-docs/THIRD_PARTY_NOTICES.md');
const installed = name => path.join(packageRoot, 'node_modules', name);
for (const name of ['@docx-editor.dev/core', 'fflate', 'lit', 'saxes']) {
  const { version } = JSON.parse(readFileSync(path.join(installed(name), 'package.json'), 'utf8'));
  assert(notices.includes(`${name}@${version}`), `THIRD_PARTY_NOTICES.md names the installed ${name}@${version}`);
}
for (const [, target] of notices.matchAll(/\]\((THIRD_PARTY_LICENSES\/[^)]+)\)/gu)) assert(existsSync(path.join(packageRoot, target)), `Missing ${target}`);
for (const [shipped, upstream] of [['Apache-2.0.txt', 'LICENSE'], ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md']]) {
  assert.equal(readFileSync(path.join(packageRoot, `THIRD_PARTY_LICENSES/docx-editor-core-${engine}-${shipped}`), 'utf8'),
    readFileSync(path.join(installed('@docx-editor.dev/core'), upstream), 'utf8'), `Engine ${upstream} differs from the shipped copy`);
}
assert(!JSON.parse(read('.changeset/config.json')).ignore.includes(manifest.name));
const forbidden = /@aceshooting\/lyra-docs|@docx-editor\.dev\/|(?:\.\.\/)+lyra-docs\//u;
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const coreManifest = JSON.parse(read('packages/lyra-ui/package.json'));
for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies']) {
  for (const name of Object.keys(coreManifest[field] ?? {})) assert(!forbidden.test(name));
}
for (const file of files(path.join(repoRoot, 'packages/lyra-ui/src'))) {
  assert(!forbidden.test(readFileSync(file, 'utf8')), `Core editor dependency: ${file}`);
}
// lyra-ui's per-file source policies; findings beyond these reviewed counts fail.
const SOURCE_POLICY_BASELINE = new Map([
  ['src/docx/docx-editor.class.ts [intl-outside-cache]', 1], // one NumberFormat per render
  ['src/docx/docx-editor.styles.ts [physical-css]', 9], // geometry-positioned image handles
]);
const docxStringsSource = read('packages/lyra-docs/src/docx/strings.ts');
const docxStringsBody = docxStringsSource.slice(docxStringsSource.indexOf('DOCX_EDITOR_STRINGS'));
const docxStringKeys = new Set(
  [...docxStringsBody.slice(0, docxStringsBody.indexOf('});')).matchAll(/^\s+([A-Za-z_$][\w$]*)\s*:/gmu)]
    .map((match) => match[1]),
);
assert(docxStringKeys.size > 10, 'DOCX_EDITOR_STRINGS keys could not be read for the source policies');
const sourcePolicyCounts = new Map();
const sourcePolicyFindings = [];
for (const file of files(path.join(packageRoot, 'src'))) {
  if (!/\.ts$/u.test(file) || /\.test\.ts$/u.test(file)) continue;
  for (const finding of collectSourcePolicyFindings({
    file,
    source: readFileSync(file, 'utf8'),
    knownKeys: docxStringKeys,
  })) {
    const rule = finding.match(/ \[([a-z0-9-]+)\]/u)?.[1] ?? 'unknown';
    const key = `${path.relative(packageRoot, file).split(path.sep).join('/')} [${rule}]`;
    sourcePolicyCounts.set(key, (sourcePolicyCounts.get(key) ?? 0) + 1);
    sourcePolicyFindings.push(finding);
  }
}
const beyondBaseline = [...sourcePolicyCounts]
  .filter(([key, count]) => count > (SOURCE_POLICY_BASELINE.get(key) ?? 0));
assert.deepEqual(
  beyondBaseline,
  [],
  `Shared source policy findings beyond the reviewed baseline:\n${sourcePolicyFindings.join('\n')}`,
);
for (const [key, allowed] of SOURCE_POLICY_BASELINE) {
  const actual = sourcePolicyCounts.get(key) ?? 0;
  if (actual < allowed) console.warn(`Source policy baseline can be lowered: ${key} ${allowed} -> ${actual}`);
}
// The companion shares source policies while retaining an independent component inventory.
for (const file of files(path.join(packageRoot, 'src'))) {
  const source = readFileSync(file, 'utf8');
  assert.deepEqual(findDoubleQuotedStringLiterals(source), [], `String literal policy: ${file}`);
  assert.deepEqual(findNulByteLines(source), [], `NUL byte: ${file}`);
  assert.deepEqual(findBareGlobalIsNaNCalls(source, file), [], `Finite number policy: ${file}`);
  assert(!/(?:\.\.\/)+lyra-ui\//u.test(source), `Private core import: ${file}`);
  assert(!/@docx-editor\.dev\/(?!core(?:['"/]))/u.test(source), `Unqualified engine package: ${file}`);
  assert(!/@docx-editor\.dev\/core\/src\//u.test(source), `Private engine import: ${file}`);
  for (const match of source.matchAll(/import\s+(?!type\b)[^;\n]*from\s+['"](@docx-editor\.dev\/[^'"]+)['"]/gu)) {
    assert.fail(`Eager document engine import: ${file}: ${match[1]}`);
  }
}
const editorClassSource = read('packages/lyra-docs/src/docx/docx-editor.class.ts');
const editorEntrySource = read('packages/lyra-docs/src/docx/editor.ts');
const controlTags = [...editorClassSource.matchAll(/\bunsafeStatic\(tag\('([a-z][a-z0-9-]*)'\)\)/gu)]
  .map((match) => match[1]);
const registrationTags = [...editorEntrySource.matchAll(/\bimport\s*\(?'@aceshooting\/lyra-ui\/components\/lr-([a-z][a-z0-9-]*)\.js'/gu)]
  .map((match) => match[1]);
assert(controlTags.length > 0, 'Editor class has no Lyra control tag inventory');
assert.equal(new Set(controlTags).size, controlTags.length, 'Duplicate editor control tag');
assert.equal(new Set(registrationTags).size, registrationTags.length, 'Duplicate editor control registration');
assert.deepEqual(registrationTags.sort(), controlTags.sort(),
  'Editor entry must register exactly its rendered Lyra controls through granular tag imports');
// Only documented subpaths are public; implementations remain behind the export map.
const dist = path.join(packageRoot, 'dist');
if (!existsSync(dist)) {
  assert(!process.env.CI, 'dist/ is missing: build @aceshooting/lyra-docs before its package checks');
  console.warn('WARNING: dist/ is missing; the emitted-package checks did not run.');
}
if (existsSync(dist)) {
  // The engine stays a lazy import(): no emitted module may load it statically.
  for (const file of files(dist).filter((candidate) => candidate.endsWith('.js'))) {
    const eager = staticModuleSpecifiers(file, readFileSync(file, 'utf8'))
      .filter((specifier) => specifier.startsWith('@docx-editor.dev/'));
    assert.deepEqual(eager, [], `Eager document engine import in emitted ${path.relative(packageRoot, file)}`);
  }
  assert.deepEqual(findBuildArtifactFindings(files(dist), file => readFileSync(file, 'utf8'),
    { packageDirectory: packageRoot, exports: manifest.exports }), []);
  for (const file of files(dist)) {
    assert(/\.(?:js|d\.ts|css)$/u.test(file), `Unexpected build artifact: ${file}`);
    assert(!/\.test\./u.test(file), `Test build artifact: ${file}`);
    const source = readFileSync(file, 'utf8');
    if (/(?:index|types|create-session|docx-editor(?:\.class)?)\.d\.ts$/u.test(file)) {
      assert(!/@docx-editor\.dev\//u.test(source), `Public engine type leaked: ${file}`);
    }
  }
  for (const route of Object.values(manifest.exports)) {
    const targets = typeof route === 'string' ? [route] : Object.values(route);
    for (const target of targets) {
      assert(existsSync(path.join(packageRoot, target)), `Missing package export target: ${target}`);
    }
  }
  for (const key of ['.', './docx']) {
    const publicEntry = path.join(packageRoot, manifest.exports[key].default);
    assert(!/@docx-editor\.dev|docx-editor\.class/u.test(readFileSync(publicEntry, 'utf8')), `Eager public entry: ${key}`);
  }
  assert(existsSync(path.join(dist, 'docx/editor.css')));
}
console.log('Document companion public/export/dependency checks passed');
