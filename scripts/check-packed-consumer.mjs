import { gzipSync } from 'node:zlib';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const uiPackage = join(root, 'packages', 'lyra-ui');
const flagsPackage = join(root, 'packages', 'lyra-flags');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const binName = (name) => (process.platform === 'win32' ? `${name}.cmd` : name);

const optionalPeers = [
  '@aceshooting/lyra-flags',
  '@sgratzl/chartjs-chart-boxplot',
  'chart.js',
  'chartjs-plugin-zoom',
  'd3-drag',
  'd3-force',
  'd3-selection',
  'd3-zoom',
  'dompurify',
  'maplibre-gl',
  'marked',
  'shiki',
];

const bundleEntries = {
  core: {
    fixture: 'core',
    // Bumped from 1_000_000, then from 1_100_000: the root barrel's registered-tag count has
    // continued to grow across component hardening passes (156 tags as of this bump), growing the
    // core bundle to ~1082.6 KiB. Budget leaves headroom over that measured size for incremental
    // growth before the next bump is needed.
    maxRawBytes: 1_200_000,
  },
  flag: {
    fixture: 'optional',
    maxRawBytes: 30_000,
  },
  codeBlock: {
    fixture: 'core',
    maxRawBytes: 600_000,
  },
  chart: {
    fixture: 'optional',
    maxRawBytes: 1_000_000,
  },
  map: {
    fixture: 'optional',
    maxRawBytes: 2_500_000,
  },
  graph: {
    fixture: 'optional',
    maxRawBytes: 400_000,
  },
};

function run(command, args, cwd, label) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: 'true' },
      stdio: 'inherit',
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${label} failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
      }
    });
  });
}

async function pack(packageDir, destination) {
  const before = new Set((await readdir(destination)).filter((entry) => entry.endsWith('.tgz')));
  await run(pnpm, ['pack', '--pack-destination', destination], packageDir, `packing ${packageDir}`);
  const packed = (await readdir(destination)).filter(
    (entry) => entry.endsWith('.tgz') && !before.has(entry),
  );
  if (packed.length !== 1) {
    throw new Error(`Expected one new package tarball from ${packageDir}, found ${packed.join(', ') || 'none'}`);
  }
  return join(destination, packed[0]);
}

async function writeFixture(fixtureDir, packageTarball, flagsTarball, withOptionalPeers) {
  const dependencies = {
    '@aceshooting/lyra-ui': `file:${relative(fixtureDir, packageTarball)}`,
  };
  if (withOptionalPeers) dependencies['@aceshooting/lyra-flags'] = `file:${relative(fixtureDir, flagsTarball)}`;

  const devDependencies = {
    typescript: '^7.0.2',
    vite: '^8.1.4',
  };
  if (withOptionalPeers) {
    Object.assign(devDependencies, {
      '@sgratzl/chartjs-chart-boxplot': '^4.4.5',
      'chart.js': '^4.5.1',
      'chartjs-plugin-zoom': '^2.2.0',
      'd3-drag': '^3.0.0',
      'd3-force': '^3.0.0',
      'd3-selection': '^3.0.0',
      'd3-zoom': '^3.0.0',
      dompurify: '^3.4.12',
      'maplibre-gl': '^5.24.0',
      marked: '^18.0.6',
      shiki: '^4.3.1',
    });
  }

  await writeFile(
    join(fixtureDir, 'package.json'),
    `${JSON.stringify(
      {
        name: withOptionalPeers ? 'lyra-packed-consumer-with-peers' : 'lyra-packed-consumer-core',
        private: true,
        type: 'module',
        dependencies,
        devDependencies,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(fixtureDir, '.npmrc'), 'auto-install-peers=false\n');

  await writeFile(
    join(fixtureDir, 'src', 'node-imports.mjs'),
    `const root = await import('@aceshooting/lyra-ui');
const granularClass = await import('@aceshooting/lyra-ui/components/empty/empty.class.js');
await import('@aceshooting/lyra-ui/components/code-block/code-loader.js');
await import('@aceshooting/lyra-ui/components/map/map-loader.js');
await import('@aceshooting/lyra-ui/components/markdown/markdown-loader.js');
await import('@aceshooting/lyra-ui/components/graph/graph-loader.js');
await import('@aceshooting/lyra-ui/components/empty/empty.js');
await import('@aceshooting/lyra-ui/components/chart/chart.js');
await import('@aceshooting/lyra-ui/components/code-block/code-block.js');
await import('@aceshooting/lyra-ui/components/graph/graph.js');
await import('@aceshooting/lyra-ui/components/map/map.js');
const prefix = await import('@aceshooting/lyra-ui/internal/prefix.js');

if (typeof root.LyraEmpty !== 'function' || typeof granularClass.LyraEmpty !== 'function') {
  throw new Error('root and granular class imports did not expose LyraEmpty');
}
if (prefix.tag('empty') !== 'lyra-empty' || customElements.get('lyra-empty') !== root.LyraEmpty) {
  throw new Error('registration and prefix helper imports did not expose the expected contract');
}
console.log('Node ESM package imports passed.');
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'typecheck.ts'),
    `import {
  LyraDialog,
  LyraEmpty,
  LyraTable,
  defineElement,
  tag,
} from '@aceshooting/lyra-ui';
import { LyraEmpty as GranularLyraEmpty } from '@aceshooting/lyra-ui/components/empty/empty.class.js';
import { loadChartAndZoom } from '@aceshooting/lyra-ui/components/chart/chart-loader.js';
import { loadMaplibre } from '@aceshooting/lyra-ui/components/map/map-loader.js';
import { loadMarkdownAndSanitizer } from '@aceshooting/lyra-ui/components/markdown/markdown-loader.js';
import { loadShikiHighlighter } from '@aceshooting/lyra-ui/components/code-block/code-loader.js';
import { loadD3 } from '@aceshooting/lyra-ui/components/graph/graph-loader.js';
import type {
  LyraChartEventMap,
  LyraGraphEventMap,
  LyraMapEventMap,
} from '@aceshooting/lyra-ui';

const name: string = tag('empty');
const Empty = GranularLyraEmpty satisfies typeof LyraEmpty;
const dialog = new LyraDialog();
const table = new LyraTable();
const events: [LyraChartEventMap, LyraGraphEventMap, LyraMapEventMap] | undefined = undefined;
defineElement('consumer-empty', Empty);
void [
  name,
  dialog,
  table,
  events,
  loadChartAndZoom,
  loadMaplibre,
  loadMarkdownAndSanitizer,
  loadShikiHighlighter,
  loadD3,
];
`,
  );
  await writeFile(
    join(fixtureDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          lib: ['ES2022', 'DOM'],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        include: ['src/typecheck.ts'],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(fixtureDir, 'vite.config.mjs'),
    `import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const optionalPeers = ${JSON.stringify(optionalPeers)};
const noOptionalPeers = process.env.LYRA_NO_OPTIONAL_PEERS === '1';
const entry = process.env.LYRA_BUNDLE_ENTRY;

export default defineConfig({
  build: {
    outDir: resolve(process.cwd(), 'bundle', entry),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(process.cwd(), 'src', \`bundle-\${entry}.ts\`),
      external: noOptionalPeers
        ? (id) => optionalPeers.some((peer) => id === peer || id.startsWith(\`\${peer}/\`))
        : [],
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
`,
  );

  const bundleSources = {
    core: `import '@aceshooting/lyra-ui';\nexport const loaded = true;\n`,
    flag: `import flagUrl from '@aceshooting/lyra-flags/flags/fr.svg';\nexport { flagUrl };\n`,
    codeBlock: `import '@aceshooting/lyra-ui/components/code-block/code-block.js';\nexport const loaded = true;\n`,
    chart: `import '@aceshooting/lyra-ui/components/chart/chart.js';\nexport const loaded = true;\n`,
    map: `import '@aceshooting/lyra-ui/components/map/map.js';\nexport const loaded = true;\n`,
    graph: `import '@aceshooting/lyra-ui/components/graph/graph.js';\nexport const loaded = true;\n`,
  };
  await Promise.all(
    Object.entries(bundleSources).map(([name, source]) => writeFile(join(fixtureDir, 'src', `bundle-${name}.ts`), source)),
  );
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else files.push(path);
  }
  return files;
}

async function bundleSize(directory) {
  const files = await collectFiles(directory);
  const rawBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce(
    (total, size) => total + size,
    0,
  );
  const gzipBytes = (await Promise.all(files.map(async (file) => gzipSync(await readFile(file)).byteLength))).reduce(
    (total, size) => total + size,
    0,
  );
  return { rawBytes, gzipBytes, files };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function runBundle(fixtureDir, entry, maxRawBytes, noOptionalPeers) {
  const env = {
    ...process.env,
    CI: 'true',
    LYRA_BUNDLE_ENTRY: entry,
    LYRA_NO_OPTIONAL_PEERS: noOptionalPeers ? '1' : '0',
  };
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(join(fixtureDir, 'node_modules', '.bin', binName('vite')), ['build', '--config', 'vite.config.mjs'], {
      cwd: fixtureDir,
      env,
      stdio: 'inherit',
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Vite ${entry} bundle failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
    });
  });
  const output = await bundleSize(join(fixtureDir, 'bundle', entry));
  if (output.rawBytes > maxRawBytes) {
    throw new Error(
      `${entry} bundle is ${formatBytes(output.rawBytes)} across ${output.files.length} files; ` +
        `budget is ${formatBytes(maxRawBytes)}`,
    );
  }
  console.log(
    `${entry} bundle: ${formatBytes(output.rawBytes)} raw, ${formatBytes(output.gzipBytes)} gzip ` +
      `(${output.files.length} files)`,
  );
}

async function main() {
  const workspace = await mkdtemp(join(tmpdir(), 'lyra-packed-consumer-'));
  try {
    const tarballDir = join(workspace, 'packages');
    const coreFixture = join(workspace, 'core');
    const optionalFixture = join(workspace, 'optional');
    await Promise.all([
      writeFile(join(workspace, '.keep'), ''),
      mkdir(tarballDir, { recursive: true }),
      mkdir(join(coreFixture, 'src'), { recursive: true }),
      mkdir(join(optionalFixture, 'src'), { recursive: true }),
    ]);

    const uiTarball = await pack(uiPackage, tarballDir);
    const flagsTarball = await pack(flagsPackage, tarballDir);

    await run(
      pnpm,
      ['exec', 'publint', 'run', '--strict', '--pack=false', uiTarball],
      root,
      'publint package check',
    );
    await run(
      pnpm,
      ['exec', 'attw', '--profile', 'esm-only', '--exclude-entrypoints', './theme.css', '--format', 'table', '--summary', uiTarball],
      root,
      'Are The Types Wrong package check',
    );

    await writeFixture(coreFixture, uiTarball, flagsTarball, false);
    await writeFixture(optionalFixture, uiTarball, flagsTarball, true);
    await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], coreFixture, 'core fixture install');
    await run(
      pnpm,
      ['install', '--ignore-scripts', '--config.auto-install-peers=false'],
      optionalFixture,
      'optional-peer fixture install',
    );

    await run(process.execPath, ['src/node-imports.mjs'], coreFixture, 'Node ESM import check');
    await run(
      join(coreFixture, 'node_modules', '.bin', binName('tsc')),
      ['--noEmit', '--skipLibCheck', 'false', '-p', 'tsconfig.json'],
      coreFixture,
      'consumer declaration check',
    );

    for (const [entry, config] of Object.entries(bundleEntries)) {
      await runBundle(
        config.fixture === 'core' ? coreFixture : optionalFixture,
        entry,
        config.maxRawBytes,
        config.fixture === 'core',
      );
    }

    console.log('Packed-consumer checks passed.');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
