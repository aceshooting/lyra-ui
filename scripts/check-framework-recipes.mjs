import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import {
  access,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FRAMEWORKS = Object.freeze(['react', 'vue', 'svelte']);
export const FRAMEWORK_PNPM_CONFIG = 'auto-install-peers=false\n';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const packageRoot = join(repositoryRoot, 'packages', 'lyra-ui');
const recipesRoot = join(repositoryRoot, 'examples', 'frameworks');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const CONTRACTS = Object.freeze({
  react: {
    declaration: '@aceshooting/lyra-ui/custom-elements-jsx',
    primary: 'src/main.tsx',
    eventPattern: /onlr-change=/u,
    propertyPattern: /rows=\{rows\}/u,
  },
  vue: {
    declaration: '@aceshooting/lyra-ui/vue',
    primary: 'src/App.vue',
    eventPattern: /@lr-change=/u,
    propertyPattern: /:rows\.prop="rows"/u,
  },
  svelte: {
    declaration: '@aceshooting/lyra-ui/svelte',
    primary: 'src/App.svelte',
    eventPattern: /onlr-change=\{onChange\}/u,
    propertyPattern: /\{rows\}/u,
  },
});

function pathFrom(input) {
  return input instanceof URL ? fileURLToPath(input) : resolve(input);
}

async function sourceText(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      chunks.push(await sourceText(path));
    } else if (/\.(?:[cm]?[jt]sx?|svelte|vue)$/u.test(entry.name)) {
      chunks.push(await readFile(path, 'utf8'));
    }
  }
  return chunks.join('\n');
}

function assertRecipe(condition, framework, message) {
  if (!condition) {
    throw new Error(`${framework} recipe: ${message}`);
  }
}

async function validateRecipe(root, framework) {
  const contract = CONTRACTS[framework];
  const recipe = join(root, framework);
  const packagePath = join(recipe, 'package.json');

  await Promise.all([
    access(packagePath),
    access(join(recipe, 'index.html')),
    access(join(recipe, contract.primary)),
  ]);

  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  const source = await sourceText(join(recipe, 'src'));
  const lyraVersion = manifest.dependencies?.['@aceshooting/lyra-ui'];

  assertRecipe(manifest.private === true, framework, 'package.json must set private=true');
  assertRecipe(
    manifest.name === `lyra-framework-recipe-${framework}`,
    framework,
    `package name must be lyra-framework-recipe-${framework}`,
  );
  assertRecipe(
    typeof lyraVersion === 'string' && /^\^8\./u.test(lyraVersion),
    framework,
    'the runnable example must declare a Lyra 8 dependency',
  );
  for (const script of ['dev', 'check', 'build']) {
    assertRecipe(
      typeof manifest.scripts?.[script] === 'string',
      framework,
      `package.json must expose a ${script} script`,
    );
  }
  assertRecipe(
    manifest.scripts.build.includes('vite build'),
    framework,
    'the build script must create a runnable Vite bundle',
  );

  const familyImport = source.match(
    /@aceshooting\/lyra-ui\/components\/(?!lr-)[^'";\s]+\/[^'";\s]+\.js/u,
  );
  assertRecipe(
    !familyImport,
    framework,
    `use the stable tag-shaped import @aceshooting/lyra-ui/components/lr-input.js instead of ${familyImport?.[0]}`,
  );
  assertRecipe(
    source.includes(`'${contract.declaration}'`) || source.includes(`"${contract.declaration}"`),
    framework,
    `import the ${contract.declaration} declaration entry`,
  );

  const runtimeImports = source.match(
    /@aceshooting\/lyra-ui\/components\/lr-[a-z0-9-]+\.js/gu,
  ) ?? [];
  assertRecipe(
    runtimeImports.includes('@aceshooting/lyra-ui/components/lr-input.js'),
    framework,
    'register lr-input through its stable tag-shaped import',
  );
  assertRecipe(
    runtimeImports.includes('@aceshooting/lyra-ui/components/lr-table.js'),
    framework,
    'register lr-table through its stable tag-shaped import',
  );
  assertRecipe(
    contract.eventPattern.test(source),
    framework,
    'demonstrate the framework-native lr-change listener',
  );
  assertRecipe(
    contract.propertyPattern.test(source),
    framework,
    'demonstrate a non-string rows property binding',
  );
  assertRecipe(
    !/import\s+(?:type\s+)?[^;]*?from\s+['"]@aceshooting\/lyra-ui['"]/u.test(source) &&
      !/import\s+['"]@aceshooting\/lyra-ui['"]/u.test(source),
    framework,
    'use granular tag-shaped imports instead of the root barrel',
  );

  return { framework, recipe, runtimeImports: new Set(runtimeImports).size };
}

export async function validateFrameworkRecipes(root = recipesRoot) {
  const absoluteRoot = pathFrom(root);
  const results = [];
  for (const framework of FRAMEWORKS) {
    results.push(await validateRecipe(absoluteRoot, framework));
  }
  return results;
}

export function materializePackageManifest(manifest, packageSpecifier) {
  return {
    ...manifest,
    dependencies: {
      ...manifest.dependencies,
      '@aceshooting/lyra-ui': packageSpecifier,
    },
  };
}

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

async function packPackage(destination) {
  await access(join(packageRoot, 'dist', 'lyra.js')).catch(() => {
    throw new Error(
      'packages/lyra-ui/dist/lyra.js is missing; run `pnpm build` before the executable recipe check',
    );
  });
  await mkdir(destination, { recursive: true });
  const before = new Set((await readdir(destination)).filter((file) => file.endsWith('.tgz')));
  await run(
    pnpm,
    ['--config.ignore-scripts=true', 'pack', '--json', '--pack-destination', destination],
    packageRoot,
    'Lyra package pack',
    { capture: true },
  );
  const created = (await readdir(destination)).filter(
    (file) => file.endsWith('.tgz') && !before.has(file),
  );
  if (created.length !== 1) {
    throw new Error(`Expected one packed Lyra artifact; found ${created.join(', ') || 'none'}`);
  }
  return join(destination, created[0]);
}

async function materializeRecipes(workspace, tarball) {
  const copiedRoot = join(workspace, 'recipes');
  await mkdir(copiedRoot, { recursive: true });
  for (const framework of FRAMEWORKS) {
    const destination = join(copiedRoot, framework);
    await cp(join(recipesRoot, framework), destination, { recursive: true });
    const packagePath = join(destination, 'package.json');
    const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
    const packageSpecifier = `file:${relative(destination, tarball).replaceAll('\\', '/')}`;
    await writeFile(
      packagePath,
      `${JSON.stringify(materializePackageManifest(manifest, packageSpecifier), null, 2)}\n`,
    );
  }
  await writeFile(
    join(workspace, 'pnpm-workspace.yaml'),
    "packages:\n  - 'recipes/*'\n",
  );
  await writeFile(
    join(workspace, 'package.json'),
    `${JSON.stringify({ name: 'lyra-framework-recipe-check', private: true }, null, 2)}\n`,
  );
  // Keep dependency-status checks spawned by later `pnpm run` commands on the same setting used
  // for the initial install. Passing the flag only to `pnpm install` records it in the lockfile,
  // then pnpm's verify-before-run install sees the default setting and rejects that lockfile.
  await writeFile(join(workspace, '.npmrc'), FRAMEWORK_PNPM_CONFIG);
}

export async function buildFrameworkRecipes() {
  const workspace = await mkdtemp(join(tmpdir(), 'lyra-framework-recipes-'));
  try {
    const tarball = await packPackage(join(workspace, 'packages'));
    await materializeRecipes(workspace, tarball);
    await run(
      pnpm,
      ['install', '--ignore-scripts', '--config.auto-install-peers=false'],
      workspace,
      'framework recipe install',
    );
    for (const framework of FRAMEWORKS) {
      await run(
        pnpm,
        [
          '--config.auto-install-peers=false',
          '--filter',
          `lyra-framework-recipe-${framework}`,
          'run',
          'build',
        ],
        workspace,
        `${framework} recipe type/build check`,
      );
    }
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function main() {
  const unknown = process.argv.slice(2).filter((argument) => argument !== '--validate-only');
  if (unknown.length > 0) {
    throw new Error(`Unknown option: ${unknown.join(', ')}`);
  }

  const results = await validateFrameworkRecipes();
  console.log(
    `Validated ${results.length} framework recipes (${results.map(({ framework }) => framework).join(', ')}).`,
  );
  if (!process.argv.includes('--validate-only')) {
    await buildFrameworkRecipes();
    console.log('React, Vue, and Svelte recipe type/build checks passed.');
  }
}

const isMain =
  process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
