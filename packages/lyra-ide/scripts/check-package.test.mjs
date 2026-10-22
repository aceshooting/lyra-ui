import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stageScripts } from '../../lyra-docs/scripts/lib/staged-script.mjs';
import { IDE_DATA_FILES } from './sync.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const realManifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Run the contract script against a repository tree built around the committed manifest, with the
 * lyra-ui and root manifests it compares against supplied by the test. Each edit mutates a clone.
 */
function check(context, edit = () => {}) {
  const repository = mkdtempSync(join(tmpdir(), 'lyra-ide-contract-'));
  context.after(() => rmSync(repository, { recursive: true, force: true }));
  const manifest = structuredClone(realManifest);
  const ui = { version: manifest.version, files: ['dist', 'README.md'] };
  const root = { packageManager: manifest.packageManager };
  edit(manifest, ui, root);
  const ide = join(repository, 'packages/lyra-ide');
  const [script] = stageScripts({ from: packageDir, to: ide, files: ['scripts/check-package.mjs', 'scripts/sync.mjs'] });
  writeJson(join(ide, 'package.json'), manifest);
  writeJson(join(repository, 'packages/lyra-ui/package.json'), ui);
  writeJson(join(repository, 'package.json'), root);
  return spawnSync(process.execPath, [script], { encoding: 'utf8' });
}

test('the committed manifest satisfies the publishable package contract', context => {
  const result = check(context);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'lyra-ide package contract passed.\n');
});

// Each edit breaks exactly one rule; the failure must name the offending value or rule.
const violations = [
  ['a different package name', manifest => { manifest.name = 'not-the-ide'; }, /not-the-ide/u],
  ['a CommonJS package type', manifest => { manifest.type = 'commonjs'; }, /commonjs/u],
  ['a non-MIT license', manifest => { manifest.license = 'GPL-3.0'; }, /GPL-3\.0/u],
  ['a private package', manifest => { manifest.private = true; }, /must be publishable/u],
  ['an older Node floor', manifest => { manifest.engines.node = '>=18'; }, />=18/u],
  ['a package manager that differs from the workspace', manifest => { manifest.packageManager = 'pnpm@1.0.0'; }, /pnpm@1\.0\.0/u],
  ['restricted publishing', manifest => { manifest.publishConfig = { access: 'restricted' }; }, /restricted/u],
  ['another repository directory', manifest => { manifest.repository.directory = 'packages/other'; }, /packages\/other/u],
  ['side effects', manifest => { manifest.sideEffects = true; }, /actual: true,\s+expected: false,|\+ true\s+- false|true !== false/u],
  ['a custom elements pointer to another file', manifest => { manifest.customElements = 'elsewhere.json'; }, /elsewhere\.json/u],
  ['a web-types pointer to another file', manifest => { manifest['web-types'] = 'elsewhere.json'; }, /elsewhere\.json/u],
  ['an extra published file', manifest => { manifest.files.push('stray.json'); }, /stray\.json/u],
  ['an extra export', manifest => { manifest.exports['./stray.json'] = './stray.json'; }, /stray\.json/u],
  ['a peer range other than the workspace caret', manifest => { manifest.peerDependencies['@aceshooting/lyra-ui'] = '1.0.0'; }, /1\.0\.0/u],
  ['a runtime dependency', manifest => { manifest.dependencies = { 'left-pad': '1.0.0' }; }, /left-pad/u],
  ['a version that no longer follows lyra-ui', manifest => { manifest.version = '0.0.1'; }, /changeset fixed group/u],
  ['lyra-ui publishing a customElements pointer', (_manifest, ui) => { ui.customElements = 'custom-elements.json'; }, /lyra-ui must not publish editor data/u],
  ['lyra-ui publishing a web-types pointer', (_manifest, ui) => { ui['web-types'] = 'web-types.json'; }, /lyra-ui must not publish editor data/u],
  ...IDE_DATA_FILES.map(file => [`lyra-ui publishing ${file}`,
    (_manifest, ui) => { ui.files.push(file); }, new RegExp(`lyra-ui must not publish ${file.replaceAll('.', '\\.')}`, 'u')]),
  ['a workspace package manager that differs', (_manifest, _ui, root) => { root.packageManager = 'pnpm@2.0.0'; }, /pnpm@2\.0\.0/u],
];

for (const [name, edit, message] of violations) {
  test(`refuses ${name}`, context => {
    const result = check(context, edit);
    assert.notEqual(result.status, 0, 'the contract script must fail');
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
  });
}
