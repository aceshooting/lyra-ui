import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  synchronizePluginVersionDocuments,
  synchronizePluginVersionsAtRoot,
} from './sync-plugin-version.mjs';

const pluginName = 'lyra-ui';

function fixtureDocuments(version = '8.3.0') {
  return {
    packageJson: { name: '@aceshooting/lyra-ui', version },
    claudePluginJson: {
      name: pluginName,
      version: '8.2.2',
      description: 'Shared plugin',
      skills: './skills/',
    },
    codexPluginJson: {
      name: pluginName,
      version: '8.2.2',
      description: 'Shared plugin',
      skills: './skills/',
    },
    claudeMarketplaceJson: {
      name: 'aceshooting',
      plugins: [
        { name: 'another-plugin', version: '1.0.0', source: './plugins/another-plugin' },
        { name: pluginName, version: '8.2.2', source: './plugins/lyra-ui' },
      ],
    },
  };
}

test('synchronizes every version-bearing plugin document without mutating its inputs', () => {
  const documents = fixtureDocuments();
  const before = structuredClone(documents);

  const synchronized = synchronizePluginVersionDocuments(documents);

  assert.deepEqual(documents, before);
  assert.equal(synchronized.claudePluginJson.version, '8.3.0');
  assert.equal(synchronized.codexPluginJson.version, '8.3.0');
  assert.deepEqual(
    synchronized.claudeMarketplaceJson.plugins.map(({ name, version }) => ({ name, version })),
    [
      { name: 'another-plugin', version: '1.0.0' },
      { name: pluginName, version: '8.3.0' },
    ],
  );
});

test('fails closed on invalid package identity, version, plugin identity, or marketplace entries', () => {
  assert.throws(
    () =>
      synchronizePluginVersionDocuments({
        ...fixtureDocuments(),
        packageJson: { name: '@aceshooting/not-lyra-ui', version: '8.3.0' },
      }),
    /expected package name/u,
  );
  assert.throws(
    () => synchronizePluginVersionDocuments(fixtureDocuments('8.3')),
    /stable semantic version/u,
  );
  assert.throws(
    () =>
      synchronizePluginVersionDocuments({
        ...fixtureDocuments(),
        codexPluginJson: { ...fixtureDocuments().codexPluginJson, name: 'wrong-plugin' },
      }),
    /Codex plugin manifest.*expected "lyra-ui"/u,
  );
  assert.throws(
    () =>
      synchronizePluginVersionDocuments({
        ...fixtureDocuments(),
        claudeMarketplaceJson: { name: 'aceshooting', plugins: [] },
      }),
    /exactly one "lyra-ui" entry, found 0/u,
  );
  assert.throws(
    () => {
      const documents = fixtureDocuments();
      return synchronizePluginVersionDocuments({
        ...documents,
        claudeMarketplaceJson: {
          ...documents.claudeMarketplaceJson,
          plugins: [
            ...documents.claudeMarketplaceJson.plugins,
            { name: pluginName, version: '7.0.0', source: './duplicate' },
          ],
        },
      });
    },
    /exactly one "lyra-ui" entry, found 2/u,
  );
});

async function writeJson(root, relativePath, value) {
  const absolutePath = join(root, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(join(root, relativePath), 'utf8'));
}

test('write mode updates the repository documents and check mode detects drift without writing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-plugin-version-test-'));
  const documents = fixtureDocuments();
  try {
    await writeJson(root, 'packages/lyra-ui/package.json', documents.packageJson);
    await writeJson(
      root,
      'plugins/lyra-ui/.claude-plugin/plugin.json',
      documents.claudePluginJson,
    );
    await writeJson(root, 'plugins/lyra-ui/.codex-plugin/plugin.json', documents.codexPluginJson);
    await writeJson(root, '.claude-plugin/marketplace.json', documents.claudeMarketplaceJson);

    await assert.rejects(
      synchronizePluginVersionsAtRoot(root, { check: true }),
      /plugin version artifacts are stale/u,
    );
    assert.equal(
      (await readJson(root, 'plugins/lyra-ui/.codex-plugin/plugin.json')).version,
      '8.2.2',
    );

    const changedPaths = await synchronizePluginVersionsAtRoot(root);
    assert.deepEqual(changedPaths, [
      'plugins/lyra-ui/.claude-plugin/plugin.json',
      'plugins/lyra-ui/.codex-plugin/plugin.json',
      '.claude-plugin/marketplace.json',
    ]);
    await synchronizePluginVersionsAtRoot(root, { check: true });
    assert.equal(
      (await readJson(root, 'plugins/lyra-ui/.claude-plugin/plugin.json')).version,
      '8.3.0',
    );
    assert.equal(
      (await readJson(root, 'plugins/lyra-ui/.codex-plugin/plugin.json')).version,
      '8.3.0',
    );
    assert.equal(
      (await readJson(root, '.claude-plugin/marketplace.json')).plugins[1].version,
      '8.3.0',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
