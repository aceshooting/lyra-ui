import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { planReleaseTags } from '../../../scripts/release-integrity.mjs';

test('root and session entries resolve without a DOM, engine, fetch or stylesheet side effects', async () => {
  for (const specifier of ['@aceshooting/lyra-docs', '@aceshooting/lyra-docs/docx']) {
    const source = `globalThis.window = undefined; globalThis.document = undefined;
      globalThis.HTMLElement = undefined;
      globalThis.fetch = () => { throw new Error('Unexpected fetch'); };
      const entry = await import(${JSON.stringify(specifier)});
      const expected = ${JSON.stringify(specifier)}.endsWith('/docx') ? ['createDocxSession'] : [];
      if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(expected)) throw new Error('Unexpected runtime export');
      if (entry.createDocxSession) {
        const result = entry.createDocxSession({ mount: {} });
        if (result.ok || result.code !== 'invalid-mount') throw new Error('Expected invalid mount refusal');
      }`;
    execFileSync(process.execPath, ['--input-type=module', '-e', source], { stdio: 'pipe' });
  }
  const { default: manifest } = await import('@aceshooting/lyra-docs/package.json', { with: { type: 'json' } });
  assert.equal(manifest.private, true);
  await assert.rejects(import('@aceshooting/lyra-docs/docx/session'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  await assert.rejects(import('@aceshooting/lyra-docs/docx/engine-port'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
});

test('the class entry does not register the editor or its controls', () => {
  const source = `globalThis.customElements = {
    get: () => undefined,
    define: () => { throw new Error('Unexpected component registration'); }
  };
  globalThis.fetch = () => { throw new Error('Unexpected fetch'); };
  const { LyraDocxEditor } = await import('@aceshooting/lyra-docs/docx/editor.class');
  if (typeof LyraDocxEditor !== 'function') throw new Error('Missing editor class');`;
  execFileSync(process.execPath, ['--input-type=module', '-e', source], { stdio: 'pipe' });
});

test('release tooling skips the private package and refuses accidental enrollment', () => {
  const core = { directory: 'packages/lyra-ui', name: '@aceshooting/lyra-ui', version: '25.4.0' };
  const docs = { directory: 'packages/lyra-docs', name: '@aceshooting/lyra-docs', version: '0.1.0', private: true };
  assert.equal(planReleaseTags({ packages: [core, docs], existingTags: [] }).length, 1);
  assert.throws(() => planReleaseTags({ packages: [core, { ...docs, private: false }], existingTags: [] }), /no release tag mapping/u);
});
