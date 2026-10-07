import assert from 'node:assert/strict';
import { copyFileSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = path.join(root, 'packages/lyra-docs');
const manifest = JSON.parse(readFileSync(path.join(docs, 'package.json'), 'utf8'));
const version = manifest.peerDependencies['@docx-editor.dev/core'];
assert.match(version, /^\d+\.\d+\.\d+$/u, 'DOCX engine peer must be one exact version');
assert.equal(manifest.devDependencies['@docx-editor.dev/core'], version);
const installed = path.join(docs, 'node_modules/@docx-editor.dev/core');
assert.equal(JSON.parse(readFileSync(path.join(installed, 'package.json'), 'utf8')).version, version,
  'Install the exact DOCX engine peer before synchronizing its notices');

function update(relative, transform) {
  const file = path.join(root, relative);
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  assert.notEqual(after, '', `${relative} became empty`);
  writeFileSync(file, after);
}

const packageVersion = /@docx-editor\.dev\/core@\d+\.\d+\.\d+/gu;
for (const relative of [
  'packages/lyra-docs/README.md',
  'docs/roadmap/document-editing.md',
  'docs/roadmap/document-editing-feasibility.md',
]) {
  update(relative, source => {
    assert(packageVersion.test(source), `${relative} lacks the current engine version reference`);
    packageVersion.lastIndex = 0;
    let next = source.replace(packageVersion, `@docx-editor.dev/core@${version}`);
    if (relative.endsWith('/README.md')) {
      assert(/exact `\d+\.\d+\.\d+` peer dependency/u.test(next), 'README lacks exact peer prose');
      next = next.replace(/exact `\d+\.\d+\.\d+` peer dependency/u,
        `exact \`${version}\` peer dependency`);
    }
    return next;
  });
}

update('packages/lyra-docs/THIRD_PARTY_NOTICES.md', source => {
  assert(packageVersion.test(source), 'Engine notice lacks package version');
  packageVersion.lastIndex = 0;
  assert(/docx-editor-core-\d+\.\d+\.\d+-/u.test(source), 'Engine notice lacks shipped license links');
  return source
    .replace(packageVersion, `@docx-editor.dev/core@${version}`)
    .replace(/docx-editor-core-\d+\.\d+\.\d+-/gu, `docx-editor-core-${version}-`)
    .replace(/www\.npmjs\.com\/package\/@docx-editor\.dev\/core\/v\/\d+\.\d+\.\d+/gu,
      `www.npmjs.com/package/@docx-editor.dev/core/v/${version}`);
});

const licenses = path.join(docs, 'THIRD_PARTY_LICENSES');
for (const [shipped, upstream] of [
  ['Apache-2.0.txt', 'LICENSE'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
]) {
  copyFileSync(path.join(installed, upstream), path.join(licenses, `docx-editor-core-${version}-${shipped}`));
}
copyFileSync(path.join(installed, 'licenses/HarfBuzz-COPYING.txt'), path.join(licenses, 'HarfBuzz-COPYING.txt'));
for (const file of readdirSync(licenses)) {
  if (/^docx-editor-core-\d+\.\d+\.\d+-(?:Apache-2\.0\.txt|THIRD_PARTY_NOTICES\.md)$/u.test(file) &&
      !file.startsWith(`docx-editor-core-${version}-`)) rmSync(path.join(licenses, file));
}
