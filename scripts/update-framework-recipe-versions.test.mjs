import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  frameworkRecipeVersionRange,
  updateFrameworkRecipeVersions,
} from './update-framework-recipe-versions.mjs';

async function createWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'lyra-framework-version-'));
  await mkdir(join(root, 'packages', 'lyra-ui'), { recursive: true });
  await writeFile(
    join(root, 'packages', 'lyra-ui', 'package.json'),
    `${JSON.stringify({ name: '@aceshooting/lyra-ui', version: '22.0.0' }, null, 2)}\n`,
  );
  for (const framework of ['react', 'vue', 'svelte']) {
    const recipe = join(root, 'examples', 'frameworks', framework);
    await mkdir(recipe, { recursive: true });
    await writeFile(
      join(recipe, 'package.json'),
      `${JSON.stringify({
        name: `lyra-framework-recipe-${framework}`,
        private: true,
        dependencies: {
          '@aceshooting/lyra-ui': '^21.4.2',
          react: '19.2.8',
        },
        devDependencies: { vite: '8.2.0' },
      }, null, 2)}\n`,
    );
  }
  return root;
}

test('framework recipe ranges use the current Lyra major floor', () => {
  assert.equal(frameworkRecipeVersionRange('22.0.0'), '^22.0.0');
  assert.equal(frameworkRecipeVersionRange('23.4.5-next.1'), '^23.0.0');
  assert.throws(() => frameworkRecipeVersionRange('v22'), /Invalid Lyra package version/u);
});

test('updates only the Lyra dependency in each supported framework recipe', async () => {
  const root = await createWorkspace();
  try {
    const { versionRange, changed } = await updateFrameworkRecipeVersions(root);
    assert.equal(versionRange, '^22.0.0');
    assert.equal(changed.length, 3);
    for (const framework of ['react', 'vue', 'svelte']) {
      const manifest = JSON.parse(
        await readFile(join(root, 'examples', 'frameworks', framework, 'package.json'), 'utf8'),
      );
      assert.equal(manifest.dependencies['@aceshooting/lyra-ui'], '^22.0.0');
      assert.equal(manifest.dependencies.react, '19.2.8');
      assert.equal(manifest.devDependencies.vite, '8.2.0');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('is idempotent once all framework recipes target the current major', async () => {
  const root = await createWorkspace();
  try {
    await updateFrameworkRecipeVersions(root);
    const { changed } = await updateFrameworkRecipeVersions(root);
    assert.deepEqual(changed, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails when a framework recipe omits the Lyra dependency', async () => {
  const root = await createWorkspace();
  try {
    const path = join(root, 'examples', 'frameworks', 'vue', 'package.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    delete manifest.dependencies['@aceshooting/lyra-ui'];
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(updateFrameworkRecipeVersions(root), /must declare @aceshooting\/lyra-ui/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
