// Manifest contract and, when lyra-ui has been built, the assembled tree. `pnpm test` builds first.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.resolve(packageRoot, '../..');
const read = (file) => readFileSync(path.join(repoRoot, file), 'utf8');
const manifest = JSON.parse(read('packages/lyra-translations/package.json'));
const ui = JSON.parse(read('packages/lyra-ui/package.json'));

assert.equal(manifest.name, '@aceshooting/lyra-translations');
assert.equal(manifest.type, 'module');
assert.equal(manifest.license, 'MIT');
assert.equal(manifest.scripts.prepack, 'pnpm --filter @aceshooting/lyra-ui build && pnpm assemble');
assert.equal(manifest.scripts.build, undefined, 'assembly needs lyra-ui built first, so it stays out of recursive builds');
assert.equal(manifest.private, undefined, 'The translations package must be publishable');
assert.equal(manifest.engines.node, '>=22');
assert.equal(manifest.packageManager, JSON.parse(read('package.json')).packageManager);
assert.deepEqual(manifest.publishConfig, { access: 'public' });
assert.equal(manifest.repository.directory, 'packages/lyra-translations');
assert.deepEqual(manifest.sideEffects, ['./dist/**/*.js']);
assert.deepEqual(manifest.files, ['dist', 'CHANGELOG.md', 'README.md', 'LICENSE']);
assert.deepEqual(Object.keys(manifest.exports), ['./*.js', './*.d.ts', './package.json']);
assert.deepEqual(manifest.peerDependencies, { '@aceshooting/lyra-ui': 'workspace:^' });
assert.equal(manifest.dependencies, undefined, 'Catalogs register through the application lyra-ui, never a bundled copy');
assert.equal(manifest.version, ui.version, 'Versions move with lyra-ui through the changeset fixed group');
assert.equal(ui.peerDependencies['@aceshooting/lyra-translations'], 'workspace:^');
assert.equal(ui.peerDependenciesMeta['@aceshooting/lyra-translations']?.optional, true);
assert.equal(ui.devDependencies?.['@aceshooting/lyra-translations'], undefined, 'lyra-ui must not depend on its companion at build time');
assert.ok(read('packages/lyra-translations/README.md').includes('@aceshooting/lyra-translations/'), 'README documents the import path');

const dist = path.join(packageRoot, 'dist');
if (existsSync(dist)) {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(path.relative(dist, full).replaceAll('\\', '/'));
    }
  };
  walk(dist);
  assert.deepEqual(files.filter((file) => file.endsWith('.map')), [], 'No source maps are published');
  assert.ok(files.includes('side-effect-only.d.ts'));
  assert.equal(files.some((file) => file.startsWith('pseudo/')), false, 'Pseudo-locales stay in lyra-ui');
  const locales = JSON.parse(read('packages/lyra-ui/locales.json'));
  const listed = JSON.stringify(locales);
  for (const [, specifier] of listed.matchAll(/@aceshooting\/lyra-translations\/([^"]+\.js)/gu)) {
    assert.ok(files.includes(specifier), `locales.json names ${specifier}, which the build did not emit`);
  }
  for (const file of files.filter((name) => name.endsWith('.js'))) {
    const source = readFileSync(path.join(dist, file), 'utf8');
    assert.equal(/["']\.\.\//u.test(source), false, `${file} must not import outside the package`);
    assert.equal(source.includes('internal/localization-runtime'), false, `${file} must use the public localization entry`);
  }
}
console.log('lyra-translations package contract passed.');
