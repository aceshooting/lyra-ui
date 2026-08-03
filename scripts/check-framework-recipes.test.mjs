import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  FRAMEWORKS,
  FRAMEWORK_PNPM_CONFIG,
  materializePackageManifest,
  validateFrameworkRecipes,
} from './check-framework-recipes.mjs';

const root = new URL('..', import.meta.url);

test('the committed React, Vue, and Svelte recipes satisfy the executable contract', async () => {
  const result = await validateFrameworkRecipes(new URL('examples/frameworks/', root));

  assert.deepEqual(
    result.map(({ framework }) => framework),
    FRAMEWORKS,
  );
  assert.ok(result.every(({ runtimeImports }) => runtimeImports >= 2));
});

test('materialization replaces only the Lyra dependency with the packed artifact', () => {
  const original = {
    name: 'lyra-framework-recipe-react',
    private: true,
    dependencies: {
      '@aceshooting/lyra-ui': '^8.0.0',
      react: '19.2.8',
    },
  };

  assert.deepEqual(materializePackageManifest(original, 'file:../../packages/lyra-ui.tgz'), {
    ...original,
    dependencies: {
      ...original.dependencies,
      '@aceshooting/lyra-ui': 'file:../../packages/lyra-ui.tgz',
    },
  });
  assert.equal(original.dependencies['@aceshooting/lyra-ui'], '^8.0.0');
});

test('the temporary workspace keeps optional-peer installation settings stable across pnpm runs', () => {
  assert.equal(FRAMEWORK_PNPM_CONFIG, 'auto-install-peers=false\n');
});

test('validation rejects a recipe that relies on the unstable family directory', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'lyra-framework-recipe-test-'));
  try {
    for (const framework of FRAMEWORKS) {
      const recipe = join(workspace, framework);
      await mkdir(join(recipe, 'src'), { recursive: true });
      await writeFile(
        join(recipe, 'package.json'),
        `${JSON.stringify({
          name: `lyra-framework-recipe-${framework}`,
          private: true,
          scripts: { dev: 'vite', check: 'tool', build: 'tool && vite build' },
          dependencies: { '@aceshooting/lyra-ui': '^8.0.0' },
        })}\n`,
      );
      await writeFile(join(recipe, 'index.html'), '<main id="app"></main>\n');
      await writeFile(
        join(recipe, 'src', framework === 'react' ? 'main.tsx' : framework === 'vue' ? 'App.vue' : 'App.svelte'),
        `${framework === 'react' ? "import type {} from '@aceshooting/lyra-ui/custom-elements-jsx';" : framework === 'vue' ? "import type {} from '@aceshooting/lyra-ui/vue';" : "import type {} from '@aceshooting/lyra-ui/svelte';"}\n` +
          "import '@aceshooting/lyra-ui/components/forms/input/input.js';\n" +
          "import '@aceshooting/lyra-ui/components/lr-table.js';\n" +
          '<lr-input onlr-change={onChange}></lr-input><lr-table rows={rows}></lr-table>\n',
      );
    }

    await assert.rejects(
      validateFrameworkRecipes(workspace),
      /stable tag-shaped import.*components\/lr-input\.js/u,
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
