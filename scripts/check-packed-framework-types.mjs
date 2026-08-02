import { spawn } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const uiPackage = join(root, 'packages', 'lyra-ui');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const binName = (name) => (process.platform === 'win32' ? `${name}.cmd` : name);

function run(command, args, cwd, label, { capture = false } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: 'true' },
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let output = '';
    if (capture) {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr?.on('data', (chunk) => {
        output += chunk;
      });
    }
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun(output);
      } else {
        rejectRun(
          new Error(
            `${label} failed${signal ? ` (${signal})` : ` with exit code ${code}`}` +
              (output ? `\n${output.trim()}` : ''),
          ),
        );
      }
    });
  });
}

async function pack(destination) {
  const before = new Set((await readdir(destination)).filter((entry) => entry.endsWith('.tgz')));
  await run(
    pnpm,
    ['--config.ignore-scripts=true', 'pack', '--json', '--pack-destination', destination],
    uiPackage,
    'framework declaration package pack',
    { capture: true },
  );
  const packed = (await readdir(destination)).filter(
    (entry) => entry.endsWith('.tgz') && !before.has(entry),
  );
  if (packed.length !== 1) {
    throw new Error(
      `Expected one new package tarball, found ${packed.join(', ') || 'none'}`,
    );
  }
  return join(destination, packed[0]);
}

async function writeFixture(fixtureDir, tarball) {
  await mkdir(join(fixtureDir, 'src'), { recursive: true });
  await writeFile(
    join(fixtureDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'lr-packed-framework-types',
        private: true,
        type: 'module',
        dependencies: {
          '@aceshooting/lyra-ui': `file:${relative(fixtureDir, tarball)}`,
          react: '19.2.8',
          svelte: '5.56.8',
          vue: '3.5.40',
        },
        devDependencies: {
          '@types/react': '19.2.18',
          'svelte-check': '4.7.4',
          // vue-tsc 3.3 resolves TypeScript's public `lib/tsc` compatibility entry. TypeScript 7
          // removed that package export, so this framework-native check stays on Vue's supported
          // TS line; the repository and the general packed consumer separately exercise TS 7.
          typescript: '5.9.3',
          'vue-tsc': '3.3.9',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(fixtureDir, '.npmrc'), 'auto-install-peers=false\n');

  await writeFile(
    join(fixtureDir, 'src', 'react.tsx'),
    `import { createRef } from 'react';
import type { LyraInput, LyraTable } from '@aceshooting/lyra-ui';
import type {} from '@aceshooting/lyra-ui/custom-elements-jsx';

const inputRef = createRef<LyraInput>();
const rows: LyraTable['rows'] = [{ id: 1, label: 'Typed complex property' }];

const input = (
  <lr-input
    ref={inputRef}
    value="ready"
    with-clear
    onlr-change={(event) => {
      const value: string = event.detail.value;
      event.currentTarget.select();
      void value;
    }}
    style={{ '--lr-input-control-height': '3rem' }}
  />
);
const table = <lr-table rows={rows} />;
inputRef.current?.select();

// @ts-expect-error Unknown properties must not leak through the generated intrinsic tag.
const badProperty = <lr-input definitelyNotAProperty="nope" />;
// @ts-expect-error Only the component's documented CSS custom properties are accepted.
const badStyle = <lr-input style={{ '--lr-not-an-input-token': 'red' }} />;
// @ts-expect-error Complex element properties retain their class declaration type.
const badRows = <lr-table rows="not-an-array" />;

void [input, table, badProperty, badStyle, badRows];
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'App.vue'),
    `<script setup lang="ts">
import type {} from '@aceshooting/lyra-ui/vue';
import { useTemplateRef } from 'vue';

const input = useTemplateRef('input');
const rows = [{ id: 1, label: 'Typed complex property' }];

function onChange(event: CustomEvent<{ value: string }>): void {
  const value: string = event.detail.value;
  void value;
}

function selectInput(): void {
  input.value?.select();
}
</script>

<template>
  <lr-input
    ref="input"
    value="ready"
    with-clear
    :style="{ '--lr-input-control-height': '3rem' }"
    @lr-change="onChange"
  />
  <lr-table :rows="rows" />
  <button type="button" @click="selectInput">Select</button>
</template>
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'App.svelte'),
    `<script lang="ts">
  import type { LyraInput } from '@aceshooting/lyra-ui';
  import type {} from '@aceshooting/lyra-ui/svelte';

  let input: LyraInput;
  const rows = [{ id: 1, label: 'Typed complex property' }];

  function onChange(event: CustomEvent<{ value: string }>): void {
    const value: string = event.detail.value;
    void value;
  }

  function selectInput(): void {
    input.select();
  }
</script>

<lr-input
  bind:this={input}
  value="ready"
  with-clear
  onlr-change={onChange}
  style:--lr-input-control-height="3rem"
></lr-input>
<lr-table {rows}></lr-table>
<button type="button" onclick={selectInput}>Select</button>
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'node-imports.mjs'),
    `const typeEntries = [
  '@aceshooting/lyra-ui/custom-elements-jsx',
  '@aceshooting/lyra-ui/vue',
  '@aceshooting/lyra-ui/svelte',
];

for (const entry of typeEntries) {
  const exports = await import(entry);
  if (Object.keys(exports).length !== 0) {
    throw new Error(entry + ' unexpectedly shipped runtime wrapper exports');
  }
}

const manifest = await import('@aceshooting/lyra-ui/custom-elements.json', {
  with: { type: 'json' },
});
if (!Array.isArray(manifest.default?.modules) || manifest.default.modules.length === 0) {
  throw new Error('the exported Custom Elements Manifest has no modules');
}

console.log('Node framework and manifest exports passed.');
`,
  );

  const baseCompilerOptions = {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    strict: true,
    skipLibCheck: false,
    noEmit: true,
  };
  await writeFile(
    join(fixtureDir, 'tsconfig.react.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          ...baseCompilerOptions,
          jsx: 'react-jsx',
          types: ['react'],
        },
        include: ['src/react.tsx'],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(fixtureDir, 'tsconfig.vue.json'),
    `${JSON.stringify(
      {
        compilerOptions: baseCompilerOptions,
        include: ['src/App.vue'],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(fixtureDir, 'tsconfig.svelte.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          ...baseCompilerOptions,
          allowJs: true,
          checkJs: true,
          isolatedModules: true,
        },
        include: ['src/**/*.svelte'],
      },
      null,
      2,
    )}\n`,
  );
}

async function verifyInstalledArtifacts(fixtureDir) {
  const installed = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui');
  for (const relativePath of [
    'custom-elements.json',
    'dist/custom-elements-jsx.d.ts',
    'dist/custom-elements-jsx.js',
    'dist/svelte.d.ts',
    'dist/svelte.js',
    'dist/vue.d.ts',
    'dist/vue.js',
  ]) {
    await access(join(installed, relativePath));
  }

  const packageManifest = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
  if (
    packageManifest.customElements !== 'custom-elements.json' ||
    packageManifest.exports?.['./custom-elements.json'] !== './custom-elements.json'
  ) {
    throw new Error('the packed manifest metadata does not resolve to custom-elements.json');
  }

  for (const runtimeFile of [
    'dist/custom-elements-jsx.js',
    'dist/svelte.js',
    'dist/vue.js',
  ]) {
    const source = await readFile(join(installed, runtimeFile), 'utf8');
    const executable = source.replace(/^\/\/# sourceMappingURL=.*$/gm, '').trim();
    if (executable !== 'export {};') {
      throw new Error(`${runtimeFile} must be an empty type-only runtime module`);
    }
  }
}

async function main() {
  for (const relativePath of [
    'dist/custom-elements-jsx.d.ts',
    'dist/custom-elements-jsx.js',
    'dist/svelte.d.ts',
    'dist/svelte.js',
    'dist/vue.d.ts',
    'dist/vue.js',
  ]) {
    try {
      await access(join(uiPackage, relativePath));
    } catch {
      throw new Error(
        `${relativePath} is missing; run \`pnpm --filter @aceshooting/lyra-ui build\` before this check`,
      );
    }
  }

  const workspace = await mkdtemp(join(tmpdir(), 'lr-packed-framework-types-'));
  try {
    const packagesDir = join(workspace, 'packages');
    const fixtureDir = join(workspace, 'consumer');
    await Promise.all([
      mkdir(packagesDir, { recursive: true }),
      mkdir(fixtureDir, { recursive: true }),
    ]);

    const tarball = await pack(packagesDir);
    await writeFixture(fixtureDir, tarball);
    await run(
      pnpm,
      ['install', '--ignore-scripts', '--config.auto-install-peers=false'],
      fixtureDir,
      'framework fixture install',
    );
    await verifyInstalledArtifacts(fixtureDir);

    await run(
      process.execPath,
      ['src/node-imports.mjs'],
      fixtureDir,
      'Node framework export check',
    );
    await run(
      join(fixtureDir, 'node_modules', '.bin', binName('tsc')),
      ['-p', 'tsconfig.react.json'],
      fixtureDir,
      'React 19 / TypeScript 5.9 packed declaration check',
    );
    await run(
      join(uiPackage, 'node_modules', '.bin', binName('tsc')),
      ['-p', join(fixtureDir, 'tsconfig.react.json')],
      fixtureDir,
      'React 19 / TypeScript 7 packed declaration check',
    );
    await run(
      join(fixtureDir, 'node_modules', '.bin', binName('vue-tsc')),
      ['-p', 'tsconfig.vue.json'],
      fixtureDir,
      'Vue packed declaration check',
    );
    await run(
      join(fixtureDir, 'node_modules', '.bin', binName('svelte-check')),
      ['--tsconfig', 'tsconfig.svelte.json', '--threshold', 'warning', '--fail-on-warnings'],
      fixtureDir,
      'Svelte packed declaration check',
    );

    console.log('Packed React 19, Vue, and Svelte declaration checks passed.');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
