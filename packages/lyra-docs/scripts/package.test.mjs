import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

test('the registration entry defines the editor and every rendered Lyra control', () => {
  const editorClass = readFileSync(new URL('../src/docx/docx-editor.class.ts', import.meta.url), 'utf8');
  const controls = [...editorClass.matchAll(/\bunsafeStatic\(tag\('([a-z][a-z0-9-]*)'\)\)/gu)]
    .map((match) => `lr-${match[1]}`);
  assert(controls.length > 0);
  const source = `const definitions = new Map();
    globalThis.customElements = {
      get: name => definitions.get(name),
      define: (name, ctor) => {
        if (definitions.has(name)) throw new Error('Duplicate registration: ' + name);
        definitions.set(name, ctor);
      }
    };
    globalThis.fetch = () => { throw new Error('Unexpected fetch'); };
    await import('@aceshooting/lyra-docs/docx/editor');
    const required = ${JSON.stringify(['lr-docx-editor', ...controls].sort())};
    const missing = required.filter(name => !definitions.has(name));
    if (missing.length) throw new Error('Missing registrations: ' + missing.join(', '));
    const { LyraDocxEditor } = await import('@aceshooting/lyra-docs/docx/editor.class');
    if (definitions.get('lr-docx-editor') !== LyraDocxEditor)
      throw new Error('Editor registration does not use the public class');`;
  execFileSync(process.execPath, ['--input-type=module', '-e', source], { stdio: 'pipe' });
});

test('release tooling skips the private package and refuses accidental enrollment', () => {
  const core = { directory: 'packages/lyra-ui', name: '@aceshooting/lyra-ui', version: '25.4.0' };
  const docs = { directory: 'packages/lyra-docs', name: '@aceshooting/lyra-docs', version: '0.1.0', private: true };
  assert.equal(planReleaseTags({ packages: [core, docs], existingTags: [] }).length, 1);
  assert.throws(() => planReleaseTags({ packages: [core, { ...docs, private: false }], existingTags: [] }), /no release tag mapping/u);
});
