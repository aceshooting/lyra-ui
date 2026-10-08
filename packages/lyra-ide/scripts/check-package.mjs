// Manifest contract; the data files are copied by `prepack`, so only the committed shape is checked here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDE_DATA_FILES } from './sync.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)), '../..');
const read = (file) => readFileSync(path.join(repoRoot, file), 'utf8');
const manifest = JSON.parse(read('packages/lyra-ide/package.json'));
const ui = JSON.parse(read('packages/lyra-ui/package.json'));

assert.equal(manifest.name, '@aceshooting/lyra-ide');
assert.equal(manifest.type, 'module');
assert.equal(manifest.license, 'MIT');
assert.equal(manifest.private, undefined, 'The IDE package must be publishable');
assert.equal(manifest.engines.node, '>=22');
assert.equal(manifest.packageManager, JSON.parse(read('package.json')).packageManager);
assert.deepEqual(manifest.publishConfig, { access: 'public' });
assert.equal(manifest.repository.directory, 'packages/lyra-ide');
assert.equal(manifest.sideEffects, false);
assert.equal(manifest.customElements, 'custom-elements.json');
assert.equal(manifest['web-types'], 'web-types.json');
assert.deepEqual(manifest.files, [...IDE_DATA_FILES, 'CHANGELOG.md', 'README.md', 'LICENSE']);
assert.deepEqual(Object.keys(manifest.exports), [...IDE_DATA_FILES.map((file) => `./${file}`), './package.json']);
assert.deepEqual(manifest.peerDependencies, { '@aceshooting/lyra-ui': 'workspace:^' });
assert.equal(manifest.dependencies, undefined);
assert.equal(manifest.version, ui.version, 'Versions move with lyra-ui through the changeset fixed group');
assert.equal(ui.customElements, undefined, 'lyra-ui must not publish editor data');
assert.equal(ui['web-types'], undefined, 'lyra-ui must not publish editor data');
for (const file of IDE_DATA_FILES) {
  assert.equal(ui.files.includes(file), false, `lyra-ui must not publish ${file}`);
}
console.log('lyra-ide package contract passed.');
