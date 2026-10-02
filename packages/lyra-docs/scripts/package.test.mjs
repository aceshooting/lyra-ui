import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { planReleaseTags } from '../../../scripts/release-integrity.mjs';

test('both public entries resolve with no DOM, engine or runtime exports', async () => {
  for (const specifier of ['@aceshooting/lyra-docs', '@aceshooting/lyra-docs/docx']) {
    const source = `globalThis.window = undefined; globalThis.document = undefined;
      globalThis.HTMLElement = undefined;
      globalThis.fetch = () => { throw new Error('Unexpected fetch'); };
      const entry = await import(${JSON.stringify(specifier)});
      if (Object.keys(entry).length !== 0) throw new Error('Unexpected runtime export');`;
    execFileSync(process.execPath, ['--input-type=module', '-e', source], { stdio: 'pipe' });
  }
  const { default: manifest } = await import('@aceshooting/lyra-docs/package.json', { with: { type: 'json' } });
  assert.equal(manifest.private, true);
  await assert.rejects(import('@aceshooting/lyra-docs/docx/session'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
  await assert.rejects(import('@aceshooting/lyra-docs/docx/engine-port'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
});

test('release tooling skips the private package and refuses accidental enrollment', () => {
  const core = { directory: 'packages/lyra-ui', name: '@aceshooting/lyra-ui', version: '25.4.0' };
  const docs = { directory: 'packages/lyra-docs', name: '@aceshooting/lyra-docs', version: '0.1.0', private: true };
  assert.equal(planReleaseTags({ packages: [core, docs], existingTags: [] }).length, 1);
  assert.throws(() => planReleaseTags({ packages: [core, { ...docs, private: false }], existingTags: [] }), /no release tag mapping/u);
});
