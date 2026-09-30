import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpus, arch, platform, release } from 'node:os';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import {
  measureInstalledHydrationInBrowser,
  renderInstalledHydrationFixture,
  runInstalledHydrationSmoke,
  resolvePublicExportTarget,
} from '../packages/lyra-ui/scripts/fixtures/packed-performance/installed-hydration.mjs';
import { describeBrowserError, waitForBrowserReadiness } from '../packages/lyra-ui/scripts/fixtures/packed-performance/browser-readiness.mjs';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const fixtureDirPath = join(scriptDir, 'fixtures', 'packed-performance');
const workloadConfigPath = join(fixtureDirPath, 'workloads.json');
const browserRunnerPath = join(fixtureDirPath, 'runner.js');
const retentionRunnerPath = join(fixtureDirPath, 'retention-runner.js');
const styleMetricNames = ['RecalcStyleCount', 'RecalcStyleDuration', 'LayoutCount', 'LayoutDuration'];
const hydrationFixtureDirPath = join(scriptDir, '..', 'packages', 'lyra-ui', 'scripts', 'fixtures', 'packed-performance');
const hydrationRunnerPath = join(hydrationFixtureDirPath, 'hydration-runner.js');
const ssrWorkerPath = join(hydrationFixtureDirPath, 'ssr-worker.mjs');
const packageRegistrationPaths = [
  'dist/components/lr-input.js',
  'dist/components/lr-select.js',
  'dist/components/lr-option.js',
  'dist/components/lr-dialog.js',
  'dist/components/lr-data-grid.js',
  'dist/components/lr-tree.js',
  'dist/components/lr-button.js',
];
const packageName = '@aceshooting/lyra-ui';
const mimeTypes = new Map([
  ['.css', 'text/css'],
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.json', 'application/json'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
]);

/** Keep the historical v23 baseline while qualifying each later candidate release. */
export function assertPerformancePackageVersions(baselineVersion, candidateVersion) {
  assert.match(baselineVersion, /^23\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u,
    'baseline must have an exact published v23 semantic version');
  const candidate = typeof candidateVersion === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.exec(candidateVersion);
  assert.ok(candidate && candidate.slice(1, 4).every(part => Number.isSafeInteger(Number(part))) && Number(candidate[1]) >= 24,
    'candidate must have an exact v24 or later semantic version');
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parsePerformanceQualificationOptions(environment) {
  const baselineTarballPath = environment.LYRA_PACKED_PERFORMANCE_BASELINE_TARBALL;
  const performanceArtifacts = environment.LYRA_PACKED_PERFORMANCE_ARTIFACTS;
  const hydrationSmokeArtifacts = environment.LYRA_PACKED_HYDRATION_SMOKE_ARTIFACTS;
  if (baselineTarballPath === undefined && performanceArtifacts === undefined && hydrationSmokeArtifacts === undefined) {
    return undefined;
  }
  assert.ok(
    typeof baselineTarballPath === 'string' && baselineTarballPath.trim().length > 0,
    'LYRA_PACKED_PERFORMANCE_BASELINE_TARBALL is required when production performance qualification is enabled',
  );
  assert.ok(
    (typeof performanceArtifacts === 'string' && performanceArtifacts.trim().length > 0) !==
      (typeof hydrationSmokeArtifacts === 'string' && hydrationSmokeArtifacts.trim().length > 0),
    'set exactly one of LYRA_PACKED_PERFORMANCE_ARTIFACTS or LYRA_PACKED_HYDRATION_SMOKE_ARTIFACTS',
  );
  return {
    mode: hydrationSmokeArtifacts === undefined ? 'qualification' : 'hydration-smoke',
    baselineTarballPath: resolve(baselineTarballPath),
    artifactsDir: resolve(performanceArtifacts ?? hydrationSmokeArtifacts),
  };
}

function packageInstallPath(nodeModulesRelativePath) {
  assert.equal(typeof nodeModulesRelativePath, 'string', 'installPath must be a relative node_modules path');
  assert.ok(nodeModulesRelativePath.length > 0, 'installPath cannot be empty');
  assert.ok(!nodeModulesRelativePath.includes('\\'), 'installPath must use POSIX separators');
  const segments = nodeModulesRelativePath.split('/');
  assert.ok(
    segments.every((part) => part !== '' && part !== '.' && part !== '..'),
    'installPath must stay within node_modules',
  );
  return segments;
}

async function resolveInstalledPackage(fixtureDir, descriptor) {
  assert.match(descriptor.key, /^(?:baseline|candidate)$/, 'package key must identify its baseline/candidate role');
  assert.equal(descriptor.key, descriptor.role, 'package key must match its baseline/candidate role');
  const installPath = packageInstallPath(descriptor.installPath);
  const fixtureRoot = await realpath(fixtureDir);
  const nodeModulesRoot = await realpath(join(fixtureRoot, 'node_modules'));
  const installedPath = resolve(nodeModulesRoot, ...installPath);
  assert.ok(installedPath.startsWith(`${nodeModulesRoot}${sep}`), 'installed package path escaped node_modules');
  const root = await realpath(installedPath);
  assert.ok(root.startsWith(`${nodeModulesRoot}${sep}`), 'installed package symlink escaped node_modules');
  const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(metadata.name, packageName, `${descriptor.key}: installed package has an unexpected name`);
  assert.equal(metadata.version, descriptor.expectedVersion, `${descriptor.key}: installed package version differs`);
  assert.match(
    descriptor.tarballSha256,
    /^[a-f0-9]{64}$/i,
    `${descriptor.key}: tarballSha256 must be SHA-256 hex`,
  );
  assert.equal(
    typeof descriptor.tarballPath,
    'string',
    `${descriptor.key}: tarballPath must identify the installed tarball`,
  );
  const tarballPath = resolve(fixtureRoot, descriptor.tarballPath);
  assert.ok((await stat(tarballPath)).isFile(), `${descriptor.key}: packed tarball was not found`);
  assert.equal(
    digest(await readFile(tarballPath)),
    descriptor.tarballSha256.toLowerCase(),
    `${descriptor.key}: tarball hash does not match the exact archive installed by the caller`,
  );
  for (const entry of packageRegistrationPaths) {
    const entryPath = join(root, entry);
    const entryStat = await stat(entryPath).catch(() => undefined);
    assert.ok(entryStat?.isFile(), `${descriptor.key}: normal package install is missing ${entry}`);
  }
  return {
    key: descriptor.key,
    role: descriptor.role,
    installPath: descriptor.installPath,
    expectedVersion: descriptor.expectedVersion,
    tarballSha256: descriptor.tarballSha256.toLowerCase(),
    root,
    metadata,
  };
}

async function readFixtureLock(fixtureDir) {
  const candidates = ['pnpm-lock.yaml', 'package-lock.json', 'npm-shrinkwrap.json'];
  const found = [];
  for (const fileName of candidates) {
    const path = join(fixtureDir, fileName);
    try {
      const bytes = await readFile(path);
      found.push({ fileName, sha256: digest(bytes) });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  assert.equal(
    found.length,
    1,
    'Packed performance fixture must have exactly one package-manager lockfile as its dependency authority',
  );
  return found[0];
}

async function writeReceiptWithLock(receipt, outputPath, fixtureDir, lock) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const destination = resolve(outputPath);
  const lockBytes = await readFile(join(fixtureDir, lock.fileName));
  assert.equal(digest(lockBytes), lock.sha256, 'packed fixture lockfile changed during qualification');
  const manifestBytes = await readFile(join(fixtureDir, 'package.json'));
  const lockArtifact = `${basename(destination)}.${lock.fileName}`;
  const manifestArtifact = `${basename(destination)}.fixture-package.json`;
  receipt.environment.fixtureLockfile.artifact = lockArtifact;
  receipt.environment.fixturePackageManifest = {
    sha256: digest(manifestBytes),
    artifact: manifestArtifact,
  };
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(join(dirname(destination), lockArtifact), lockBytes);
  await writeFile(join(dirname(destination), manifestArtifact), manifestBytes);
  await writeFile(destination, `${JSON.stringify(receipt, null, 2)}\n`);
}

function importSpecifiers(source) {
  const found = new Set();
  const pattern = /\b(?:from\s*|import\s*(?:\(\s*)?)(['"])([^'"]+)\1/g;
  for (const match of source.matchAll(pattern)) found.add(match[2]);
  return [...found];
}

function resolveNodeSpecifier(specifier, parentPath) {
  assert.ok(
    process.execArgv.includes('--experimental-import-meta-resolve'),
    'packed performance must enable parent-aware import.meta.resolve for installed module dependencies',
  );
  return import.meta.resolve(specifier, pathToFileURL(parentPath).href);
}

function browserConditionTarget(entry) {
  if (typeof entry === 'string') return entry;
  if (entry === null) return null;
  assert.ok(entry && typeof entry === 'object' && !Array.isArray(entry),
    'unsupported browser export target shape');
  // Preserve the package's declared condition order, as export resolution does. This fixture
  // runs production browser ESM, not Node's `node` branch or a development implementation.
  const conditions = new Set(['browser', 'import', 'module', 'default']);
  for (const [condition, target] of Object.entries(entry)) {
    if (!conditions.has(condition)) continue;
    const selected = browserConditionTarget(target);
    assert.notEqual(selected, undefined, `unsupported browser export target under ${condition}`);
    return selected;
  }
  return undefined;
}

async function resolveBrowserSpecifier(specifier, parentPath) {
  const nodeUrl = resolveNodeSpecifier(specifier, parentPath);
  assert.ok(nodeUrl.startsWith('file:'), `${specifier}: browser dependency did not resolve to an installed file`);
  const ownerPath = specifier.startsWith('#') ? parentPath : fileURLToPath(nodeUrl);
  const owner = await packageRootForModule(ownerPath);
  const metadata = JSON.parse(await readFile(join(owner.root, 'package.json'), 'utf8'));
  let entry;
  if (specifier.startsWith('#')) {
    entry = metadata.imports?.[specifier];
  } else if (specifier === owner.name || specifier.startsWith(`${owner.name}/`)) {
    const exportName = specifier === owner.name ? '.' : `./${specifier.slice(owner.name.length + 1)}`;
    entry = metadata.exports?.[exportName];
    if (entry === undefined && metadata.exports === undefined && exportName === '.' &&
        typeof metadata.module === 'string') {
      entry = metadata.module;
    }
  } else {
    throw new Error(`${specifier}: browser import owner ${owner.name} does not match the requested package`);
  }
  assert.ok(entry !== undefined, `${specifier}: no exact declared browser export/import entry`);
  const browserTarget = browserConditionTarget(entry);
  assert.ok(typeof browserTarget === 'string' && browserTarget.startsWith('./'),
    `${specifier}: no safe declared production browser module target`);
  const browserPath = resolve(owner.root, browserTarget);
  assert.ok(browserPath.startsWith(`${owner.root}${sep}`), `${specifier}: browser condition escaped package root`);
  assert.ok((await stat(browserPath)).isFile(), `${specifier}: declared browser module is missing`);
  return pathToFileURL(browserPath).href;
}

async function packageRootForModule(modulePath) {
  let current = resolve(modulePath);
  while (true) {
    const parent = resolve(current, '..');
    try {
      const metadata = JSON.parse(await readFile(join(current, 'package.json'), 'utf8'));
      if (metadata.name) return { root: current, name: metadata.name, version: metadata.version };
    } catch {
      // Continue toward the nearest package manifest.
    }
    if (parent === current) throw new Error(`External browser module has no package manifest: ${modulePath}`);
    current = parent;
  }
}

async function runtimeModuleProvenance(specifier, parentPath) {
  const moduleUrl = resolveNodeSpecifier(specifier, parentPath);
  assert.ok(moduleUrl.startsWith('file:'), `runtime toolchain module ${specifier} did not resolve to a file`);
  const modulePath = fileURLToPath(moduleUrl);
  const owner = await packageRootForModule(modulePath);
  return {
    name: owner.name,
    version: owner.version,
    entrySha256: digest(await readFile(modulePath)),
  };
}

async function runtimeToolchainProvenance() {
  return {
    playwright: await runtimeModuleProvenance('playwright', fileURLToPath(import.meta.url)),
    ssrRenderer: await runtimeModuleProvenance('@lit-labs/ssr', ssrWorkerPath),
    ssrResultCollector: await runtimeModuleProvenance('@lit-labs/ssr/lib/render-result.js', ssrWorkerPath),
    ssrLit: await runtimeModuleProvenance('lit', ssrWorkerPath),
  };
}

async function buildBrowserImportMap(packageInfo, origin) {
  const packageMount = `/packages/${packageInfo.key}/`;
  const importMap = {};
  const scopes = {};
  const moduleMounts = new Map();
  const visited = new Set();
  const allowedRoots = new Set([packageInfo.root]);
  const publicRoots = [
    ...packageRegistrationPaths,
    resolvePublicExportTarget(packageInfo.metadata, './theme.js'),
    resolvePublicExportTarget(packageInfo.metadata, './hydration.js'),
  ];
  const queue = publicRoots.map((entry) => join(packageInfo.root, entry));

  while (queue.length > 0) {
    const modulePath = resolve(queue.pop());
    if (visited.has(modulePath)) continue;
    visited.add(modulePath);
    const source = await readFile(modulePath, 'utf8');
    for (const specifier of importSpecifiers(source)) {
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const child = resolve(dirname(modulePath), specifier);
        if ([...allowedRoots].some((root) => child.startsWith(`${root}${sep}`))) queue.push(child);
        continue;
      }
      const resolvedUrl = await resolveBrowserSpecifier(specifier, modulePath);
      if (!resolvedUrl.startsWith('file:')) continue;
      const resolvedPath = fileURLToPath(resolvedUrl);
      let mappings = importMap;
      if (specifier.startsWith('#')) {
        let scopePrefix;
        if (modulePath.startsWith(`${packageInfo.root}${sep}`)) {
          scopePrefix = `${origin}${packageMount}`;
        } else {
          const parentMount = [...moduleMounts.values()].find((mount) =>
            modulePath.startsWith(`${mount.root}${sep}`),
          );
          assert.ok(parentMount, `no browser mount found for private import parent ${modulePath}`);
          scopePrefix = `${origin}/external/${packageInfo.key}/${parentMount.id}/`;
        }
        mappings = scopes[scopePrefix] ??= {};
      }
      if (resolvedPath.startsWith(`${packageInfo.root}${sep}`)) {
        const target =
          `${origin}${packageMount}${relative(packageInfo.root, resolvedPath).split(sep).join('/')}`;
        assert.ok(
          !mappings[specifier] || mappings[specifier] === target,
          `ambiguous browser import-map entry for ${specifier}`,
        );
        mappings[specifier] = target;
        queue.push(resolvedPath);
        continue;
      }
      const externalPackage = await packageRootForModule(resolvedPath);
      let mount = moduleMounts.get(externalPackage.root);
      if (!mount) {
        mount = {
          id: `m${moduleMounts.size}`,
          root: externalPackage.root,
          name: externalPackage.name,
          version: externalPackage.version,
        };
        moduleMounts.set(externalPackage.root, mount);
      }
      allowedRoots.add(externalPackage.root);
      const subpath = relative(externalPackage.root, resolvedPath).split(sep).join('/');
      const target = `${origin}/external/${packageInfo.key}/${mount.id}/${subpath}`;
      assert.ok(
        !mappings[specifier] || mappings[specifier] === target,
        `ambiguous browser import-map entry for ${specifier}`,
      );
      mappings[specifier] = target;
      queue.push(resolvedPath);
    }
  }
  return {
    imports: importMap,
    scopes,
    mounts: [...moduleMounts.values()],
  };
}

function summarizeSamples(samples) {
  assert.ok(Array.isArray(samples) && samples.length > 0, 'cannot summarize an empty sample distribution');
  const values = samples.map((sample) => typeof sample === 'number' ? sample : sample.durationMs);
  assert.ok(
    values.every((value) => Number.isFinite(value) && value >= 0),
    'timing samples must be finite nonnegative milliseconds',
  );
  const sorted = [...values].sort((left, right) => left - right);
  const meanMs = values.reduce((sum, value) => sum + value, 0) / values.length;
  const varianceMs2 = values.reduce((sum, value) => sum + ((value - meanMs) ** 2), 0) / values.length;
  const percentile = (fraction) => sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
  return {
    count: values.length,
    minMs: sorted[0],
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: sorted.at(-1),
    meanMs,
    standardDeviationMs: Math.sqrt(varianceMs2),
    coefficientOfVariation: meanMs === 0 ? 0 : Math.sqrt(varianceMs2) / meanMs,
    rawSamplesMs: values,
  };
}

function styleMetricDelta(before, after) {
  const missing = styleMetricNames.filter((name) =>
    !Number.isFinite(before?.[name]) || !Number.isFinite(after?.[name]) || after[name] < before[name]);
  const delta = (name, scale = 1) => missing.includes(name) ? null : (after[name] - before[name]) * scale;
  return {
    status: missing.length === 0 ? 'complete' : 'missing-metrics',
    missing,
    recalcStyleCount: delta('RecalcStyleCount'),
    recalcStyleDurationMs: delta('RecalcStyleDuration', 1000),
    layoutCount: delta('LayoutCount'),
    layoutDurationMs: delta('LayoutDuration', 1000),
  };
}

async function readStyleMetrics(session) {
  try {
    const { metrics } = await session.send('Performance.getMetrics');
    return Object.fromEntries(metrics.map(({ name, value }) => [name, value]));
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function measureStyleSwitches(page, context, config) {
  const session = await context.newCDPSession(page);
  let supportError;
  try {
    await session.send('Performance.enable', { timeDomain: 'timeTicks' });
  } catch (error) {
    supportError = error instanceof Error ? error.message : String(error);
  }
  const runScenario = async (scenario, count) => {
    const all = [];
    for (let index = 0; index < config.warmupSamples + count; index++) {
      const before = supportError ? undefined : await readStyleMetrics(session);
      const sample = await page.evaluate(({ scenario, index }) =>
        window.__lyraPerformance.runStyleSwitch(scenario, index), { scenario, index });
      const after = supportError ? undefined : await readStyleMetrics(session);
      all.push({
        ...sample,
        cdpStyle: {
          ...styleMetricDelta(before, after),
          ...(supportError ? { protocolError: supportError } : {}),
          ...(before?.error || after?.error ? { protocolError: before?.error ?? after?.error } : {}),
        },
      });
    }
    const warmupSamples = all.slice(0, config.warmupSamples);
    const samples = all.slice(config.warmupSamples);
    return {
      warmupSamples,
      samples,
      writeToSettledPaint: summarizeSamples(samples.map((sample) => sample.durationMs)),
      rafIntervals: summarizeSamples(samples.flatMap((sample) => sample.rafIntervalsMs)),
      cdpStyle: {
        status: samples.every((sample) => sample.cdpStyle.status === 'complete') ? 'complete' : 'missing-metrics',
        metrics: Object.fromEntries(
          ['recalcStyleCount', 'recalcStyleDurationMs', 'layoutCount', 'layoutDurationMs'].map((name) => {
            const values = samples.map((sample) => sample.cdpStyle[name]);
            return [name, values.every(Number.isFinite) ? summarizeSamples(values) : null];
          }),
        ),
      },
    };
  };
  try {
    const root = await runScenario('root', config.styleSwitch.sampleCount);
    const nestedGlass = await runScenario('nested-glass', config.styleSwitch.nestedGlassSampleCount);
    return { root, nestedGlass };
  } finally {
    if (!supportError) await session.send('Performance.disable').catch(() => {});
    await session.detach();
  }
}

function buildStyleSwitchPlan(styleSwitch, warmupSamples) {
  assert.ok(Array.isArray(styleSwitch.looks) && styleSwitch.looks.length === 6,
    'style qualification must exercise the six configured public looks');
  assert.ok(styleSwitch.modes.length >= 2 && styleSwitch.accents.length >= 2 && styleSwitch.densities.length >= 2,
    'style qualification must vary mode, accent, and density independently');
  assert.ok(Number.isInteger(styleSwitch.sampleCount) && styleSwitch.sampleCount >= styleSwitch.looks.length,
    'style qualification needs enough measured samples to cover every look');
  assert.ok(Number.isInteger(styleSwitch.nestedGlassSampleCount) &&
    styleSwitch.nestedGlassSampleCount >= styleSwitch.looks.length &&
    styleSwitch.nestedGlassSampleCount <= styleSwitch.sampleCount,
    'nested glass qualification needs enough measured samples to cover every look within the root plan');
  const count = warmupSamples + styleSwitch.sampleCount;
  const plan = Array.from({ length: count }, (_, index) => ({
    look: styleSwitch.looks[index % styleSwitch.looks.length],
    mode: styleSwitch.modes[Math.floor(index / 2) % styleSwitch.modes.length],
    accent: styleSwitch.accents[Math.floor(index / 3) % styleSwitch.accents.length],
    density: styleSwitch.densities[Math.floor(index / 4) % styleSwitch.densities.length],
  }));
  const measured = plan.slice(warmupSamples);
  for (const axis of ['look', 'mode', 'accent', 'density']) {
    assert.ok(new Set(measured.map((entry) => entry[axis])).size > 1,
      `style qualification must vary the ${axis} axis in measured samples`);
  }
  assert.equal(new Set(measured.map((entry) => entry.look)).size, styleSwitch.looks.length,
    'measured style samples must cover every configured look');
  assert.equal(new Set(measured.slice(0, styleSwitch.nestedGlassSampleCount).map((entry) => entry.look)).size,
    styleSwitch.looks.length, 'measured nested glass samples must cover every configured look');
  return plan;
}

function assertInside(root, candidate) {
  const path = resolve(root, candidate);
  assert.ok(path.startsWith(`${root}${sep}`), 'browser fixture request escaped its mounted root');
  return path;
}

async function packagePageHtml(packageInfo, importMap) {
  const runner = await readFile(browserRunnerPath, 'utf8');
  const themeTarget = resolvePublicExportTarget(packageInfo.metadata, './theme.js');
  const tokensRootTarget = resolvePublicExportTarget(packageInfo.metadata, './tokens-root.css');
  const lookStyles = ['shadcn', 'material', 'data', 'terminal', 'high-contrast']
    .map((look) => `<link rel="stylesheet" href="/packages/${packageInfo.key}/dist/looks/${look}.css">`)
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/packages/${packageInfo.key}/dist/theme.css">
<link rel="stylesheet" href="/packages/${packageInfo.key}/${tokensRootTarget.slice(2)}">
${lookStyles}
<link rel="stylesheet" href="/packages/${packageInfo.key}/dist/surfaces/glass.css">
<link rel="stylesheet" href="/packages/${packageInfo.key}/dist/density.css">
<link rel="stylesheet" href="/packages/${packageInfo.key}/dist/accents.css">
<script type="importmap">${JSON.stringify({ imports: importMap.imports, scopes: importMap.scopes })}</script></head>
<body><script>window.__lyraPackage=${JSON.stringify({ key: packageInfo.key })};window.__lyraThemeUrl=${JSON.stringify(`/packages/${packageInfo.key}/${themeTarget.slice(2)}`)};</script>
<script type="module">${runner}</script></body></html>`;
}

async function startStaticServer(packages, importMaps, config) {
  const mounts = new Map();
  for (const packageInfo of packages) {
    mounts.set(`/packages/${packageInfo.key}/`, packageInfo.root);
    const moduleMap = importMaps.get(packageInfo.key);
    for (const mount of moduleMap.mounts) mounts.set(`/external/${packageInfo.key}/${mount.id}/`, mount.root);
  }
  const pages = new Map();
  const workload = Buffer.from(`${JSON.stringify(config)}\n`);
  const runner = await readFile(browserRunnerPath);
  const retentionRunner = await readFile(retentionRunnerPath);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/workloads.json') {
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(workload);
        return;
      }
      if (url.pathname === '/runner.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript' }).end(runner);
        return;
      }
      if (url.pathname === '/retention-runner.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript' }).end(retentionRunner);
        return;
      }
      if (url.pathname.startsWith('/fixture/')) {
        const key = url.pathname.slice('/fixture/'.length).replace(/\/$/, '');
        const page = pages.get(key);
        if (!page) { response.writeHead(404).end('Unknown package fixture'); return; }
        response.writeHead(200, { 'Content-Type': 'text/html' }).end(page);
        return;
      }
      for (const [prefix, root] of mounts) {
        if (!url.pathname.startsWith(prefix)) continue;
        const filePath = assertInside(root, decodeURIComponent(url.pathname.slice(prefix.length)));
        const body = await readFile(filePath);
        response.writeHead(200, {
          'Content-Type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        }).end(body);
        return;
      }
      response.writeHead(404).end('Not found');
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string', 'production timing server did not bind an ephemeral port');
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
    setPage(key, html) { pages.set(key, html); },
  };
}

async function launchPackagePage(browser, origin, packageInfo, config) {
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${describeBrowserError(error)}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
    });
    page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(`${origin}/`)) return route.continue();
      errors.push(`unexpected external request: ${url}`);
      return route.abort();
    });
    await page.goto(`${origin}/fixture/${packageInfo.key}/`, { waitUntil: 'load' });
    await waitForBrowserReadiness({
      page,
      predicate: () => Boolean(window.__lyraPerformance?.boot?.firstUsable),
      packageKey: packageInfo.key,
      phase: 'performance startup first usable control',
      errors,
    });
    return { context, page, errors };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function retentionPageHtml(packageInfo, importMap) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<script type="importmap">${JSON.stringify(importMap)}</script></head><body>
<main id="retention-root"></main>
<script>window.__lyraPackage=${JSON.stringify({ key: packageInfo.key })};</script>
<script type="module" src="/retention-runner.js"></script></body></html>`;
}

async function readListenerCounts(session) {
  const group = `lyra-retention-listeners-${Date.now()}`;
  try {
    const counts = {};
    for (const targetName of ['window', 'document']) {
      const target = await session.send('Runtime.evaluate', {
        expression: targetName,
        objectGroup: group,
      });
      assert.ok(target.result.objectId, `CDP could not observe ${targetName} listeners`);
      const response = await session.send('DOMDebugger.getEventListeners', {
        objectId: target.result.objectId,
      });
      const byType = {};
      for (const listener of response.listeners) {
        const key = `${listener.type}:${listener.useCapture ? 'capture' : 'bubble'}`;
        byType[key] = (byType[key] ?? 0) + 1;
      }
      counts[targetName] = byType;
    }
    return counts;
  } finally {
    await session.send('Runtime.releaseObjectGroup', { objectGroup: group });
  }
}

async function collectPrototypeInstanceCounts(session, tags) {
  const group = `lyra-retention-instances-${Date.now()}`;
  try {
    await session.send('HeapProfiler.collectGarbage');
    const counts = {};
    for (const tag of tags) {
      const prototype = await session.send('Runtime.evaluate', {
        expression: `customElements.get(${JSON.stringify(tag)}).prototype`,
        objectGroup: group,
      });
      assert.ok(prototype.result.objectId, `CDP could not resolve the registered ${tag} prototype`);
      const queried = await session.send('Runtime.queryObjects', {
        prototypeObjectId: prototype.result.objectId,
        objectGroup: group,
      });
      const result = await session.send('Runtime.callFunctionOn', {
        objectId: queried.objects.objectId,
        functionDeclaration: 'function () { return this.length; }',
        returnByValue: true,
      });
      counts[tag] = result.result.value;
    }
    return counts;
  } finally {
    await session.send('Runtime.releaseObjectGroup', { objectGroup: group });
  }
}

async function readPostGcRetentionCounters(session) {
  await session.send('HeapProfiler.collectGarbage');
  const heap = await session.send('Runtime.getHeapUsage');
  let dom;
  try {
    dom = { status: 'supported', ...(await session.send('Memory.getDOMCounters')) };
  } catch (error) {
    dom = { status: 'unsupported', error: error instanceof Error ? error.message : String(error) };
  }
  return {
    heap: {
      usedSizeBytes: heap.usedSize,
      totalSizeBytes: heap.totalSize,
      embedderHeapUsedSizeBytes: heap.embedderHeapUsedSize,
      backingStorageSizeBytes: heap.backingStorageSize,
    },
    dom,
  };
}

function retainedCounterDeltas(baseline, current) {
  const difference = (left, right) =>
    Number.isFinite(left) && Number.isFinite(right) ? right - left : null;
  return {
    usedHeapBytes: difference(baseline.heap.usedSizeBytes, current.heap.usedSizeBytes),
    embedderHeapBytes: difference(baseline.heap.embedderHeapUsedSizeBytes, current.heap.embedderHeapUsedSizeBytes),
    backingStorageBytes: difference(baseline.heap.backingStorageSizeBytes, current.heap.backingStorageSizeBytes),
    domNodes: difference(baseline.dom.nodes, current.dom.nodes),
    domDocuments: difference(baseline.dom.documents, current.dom.documents),
    domEventListeners: difference(baseline.dom.jsEventListeners, current.dom.jsEventListeners),
  };
}

async function measureComponentRetention(browser, server, packageInfo, importMap, config) {
  const fixtureKey = `${packageInfo.key}-retention`;
  server.setPage(fixtureKey, await retentionPageHtml(packageInfo, importMap));
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(`${server.origin}/`)) return route.continue();
    errors.push(`unexpected external request: ${url}`);
    return route.abort();
  });
  try {
    await page.goto(`${server.origin}/fixture/${fixtureKey}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.__lyraRetention), undefined, { timeout: 30000 });
    assert.deepEqual(errors, [], `${packageInfo.key}: component-retention warmup had browser/network errors`);
    const session = await context.newCDPSession(page);
    try {
      const warmupSamples = await page.evaluate(() => window.__lyraRetention.warmupSamples);
      assert.equal(warmupSamples.length, config.componentRetention.warmupCycles);
      const baselineInstances = await collectPrototypeInstanceCounts(session, config.componentRetention.tags);
      assert.ok(Object.values(baselineInstances).every((count) => count === 0),
        `${packageInfo.key}: warmup left detached component instances: ${JSON.stringify(baselineInstances)}`);
      const baselineCdp = await readPostGcRetentionCounters(session);
      const baselineListeners = await readListenerCounts(session);
      const baselineDom = await page.evaluate(() => window.__lyraRetention.countDom());
      const samples = [];
      const checkpoints = {};
      for (let cycle = 1; cycle <= config.componentRetention.measuredCycles; cycle++) {
        samples.push(await page.evaluate((index) => window.__lyraRetention.cycle(index), cycle));
        if (config.componentRetention.checkpoints.includes(cycle)) {
          const instances = await collectPrototypeInstanceCounts(session, config.componentRetention.tags);
          const cdp = await readPostGcRetentionCounters(session);
          const dom = await page.evaluate(() => window.__lyraRetention.countDom());
          const listeners = await readListenerCounts(session);
          assert.ok(Object.values(instances).every((count) => count === 0),
            `${packageInfo.key}: detached component instances remain after cycle ${cycle}: ${JSON.stringify(instances)}`);
          assert.equal(dom.hostCount, 0, `${packageInfo.key}: component hosts remain in DOM after cycle ${cycle}`);
          assert.deepEqual(listeners, baselineListeners,
            `${packageInfo.key}: window/document listener counts changed after cycle ${cycle}`);
          assert.deepEqual(dom, baselineDom,
            `${packageInfo.key}: DOM accounting changed after cycle ${cycle}`);
          checkpoints[cycle] = {
            instances, dom, listeners, cdp,
            retainedDeltasFromWarmedBaseline: retainedCounterDeltas(baselineCdp, cdp),
          };
        }
      }
      assert.deepEqual(errors, [], `${packageInfo.key}: component-retention workload had browser/network errors`);
      return {
        warmupSamples,
        samples,
        cycleDuration: summarizeSamples(samples.map((sample) => sample.durationMs)),
        baseline: { instances: baselineInstances, dom: baselineDom, listeners: baselineListeners, cdp: baselineCdp },
        checkpoints,
        assertions: {
          allFiveComponentsMountedUpdatedActivatedAndDisconnected: true,
          zeroDetachedInstancesAfterForcedGarbageCollection: true,
          hostDomAndElementAccountingReturnedToWarmedBaseline: true,
          windowAndDocumentListenerCountsReturnedToWarmedBaseline: true,
          cdpPostGcHeapAndDomCountersRecordedAtCheckpoints: true,
          noPageErrors: true,
          noUnexpectedRequests: true,
        },
      };
    } finally {
      await session.detach();
    }
  } finally {
    await context.close();
  }
}

async function measurePackage(browser, server, packageInfo, importMap, config) {
  server.setPage(packageInfo.key, await packagePageHtml(packageInfo, importMap));
  const startupAll = [];
  for (let iteration = 0; iteration < config.warmupSamples + config.measuredSamples; iteration++) {
    const { context, page, errors } = await launchPackagePage(browser, server.origin, packageInfo, config);
    try {
      const boot = await page.evaluate(() => window.__lyraPerformance.boot);
      assert.deepEqual(
        boot.registeredTags.sort(),
        ['lr-button', 'lr-data-grid', 'lr-dialog', 'lr-input', 'lr-option', 'lr-select', 'lr-tree'],
      );
      assert.ok(boot.registrationMs >= 0 && boot.firstUsableMs >= boot.registrationMs);
      assert.deepEqual(errors, [], `${packageInfo.key}: startup page had runtime or network errors`);
      startupAll.push({ registrationMs: boot.registrationMs, firstUsableMs: boot.firstUsableMs });
    } finally {
      await context.close();
    }
  }
  const startupWarmups = startupAll.slice(0, config.warmupSamples);
  const startupSamples = startupAll.slice(config.warmupSamples);
  const { context, page, errors } = await launchPackagePage(browser, server.origin, packageInfo, config);
  let mainContextClosed = false;
  try {
    const boot = await page.evaluate(() => window.__lyraPerformance.boot);
    assert.deepEqual(
      boot.registeredTags.sort(),
      ['lr-button', 'lr-data-grid', 'lr-dialog', 'lr-input', 'lr-option', 'lr-select', 'lr-tree'],
    );
    assert.equal(boot.gridRows, config.grid.rowCount);
    assert.equal(boot.treeNodes, config.tree.nodeCount);
    assert.ok(
      boot.gridRenderedRows > 0 && boot.gridRenderedRows < boot.gridRows,
      'initial grid window must be populated and virtualized',
    );
    assert.equal(boot.treeRenderedItems, boot.treeNodes, 'tree must account for every fixed data node');
    const idleFrameIntervalsMs = await page.evaluate(() => window.__lyraPerformance.startFrameSampling());
    assert.equal(idleFrameIntervalsMs.length, config.frameSampling.idleIntervals,
      'idle frame calibration did not return the configured sample count');

    const eventWorkloads = {};
    for (const [name, selector, key, recordProperty] of [
      ['typing', '#input', config.key, 'keydownToEventMs'],
      ['select', '#select', 'Enter', 'keydownToEventMs'],
      ['dialog', '#dialog-opener', undefined, 'clickToAfterShowMs'],
    ]) {
      const nativeSamples = [];
      const total = config.warmupSamples + config.measuredSamples;
      for (let iteration = 0; iteration < total; iteration++) {
        const phase = `interaction ${name} ${iteration < config.warmupSamples ? 'warmup' : 'sample'} ${iteration}`;
        if (name === 'typing') {
          await page.evaluate(() => window.__lyraPerformance.resetInput());
          const before = await page.evaluate(() => window.__lyraPerformance.eventRecords.typing.length);
          await page.keyboard.press(key);
          await waitForBrowserReadiness({
            page,
            predicate: (count) => {
              const records = window.__lyraPerformance.eventRecords.typing;
              return records.length > count && records.at(-1)?.keydownToRenderedFrameMs !== undefined;
            },
            argument: before,
            packageKey: packageInfo.key,
            phase,
            errors,
            timeoutMs: 10000,
            snapshot: () => ({
              inputValue: document.querySelector('#input')?.value,
              nativeValue: document.querySelector('#input')?.shadowRoot?.querySelector('input')?.value,
              latestRecord: window.__lyraPerformance?.eventRecords.typing.at(-1),
              failures: window.__lyraPerformance?.failures,
            }),
          });
        } else if (name === 'select') {
          await page.evaluate(() => window.__lyraPerformance.resetSelect());
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');
          const before = await page.evaluate(() => window.__lyraPerformance.eventRecords.select.length);
          await page.keyboard.press('Enter');
          await waitForBrowserReadiness({
            page,
            predicate: (count) => {
              const records = window.__lyraPerformance.eventRecords.select;
              return records.length > count && records.at(-1).visibleSelection === true;
            },
            argument: before,
            packageKey: packageInfo.key,
            phase,
            errors,
            timeoutMs: 10000,
            snapshot: () => {
              const select = document.querySelector('#select');
              return {
                value: select?.value,
                open: select?.open,
                activeIndex: select?.activeIndex,
                activeRowValue: select?.shadowRoot?.querySelector('[part="option"][data-active]')?.dataset.value,
                triggerText: select?.shadowRoot?.querySelector('button')?.textContent?.trim(),
                latestRecord: window.__lyraPerformance?.eventRecords.select.at(-1),
                failures: window.__lyraPerformance?.failures,
              };
            },
          });
        } else {
          const before = await page.evaluate(() => window.__lyraPerformance.eventRecords.dialog.length);
          await page.locator(selector).click();
          await waitForBrowserReadiness({
            page,
            predicate: (count) => {
              const records = window.__lyraPerformance.eventRecords.dialog;
              return records.length > count && records.at(-1).visibleAndOpen === true;
            },
            argument: before,
            packageKey: packageInfo.key,
            phase,
            errors,
            timeoutMs: 15000,
            snapshot: () => ({
              open: document.querySelector('#dialog')?.open,
              latestRecord: window.__lyraPerformance?.eventRecords.dialog.at(-1),
              failures: window.__lyraPerformance?.failures,
            }),
          });
        }
        const row = await page.evaluate(({ name, recordProperty }) => {
          const records = window.__lyraPerformance.eventRecords[name];
          const latest = records.at(-1);
          if (!latest || !Number.isFinite(latest[recordProperty])) throw new Error(`${name} sample did not complete`);
          return { ...latest };
        }, { name, recordProperty });
        nativeSamples.push(row);
        if (name === 'dialog') await page.evaluate(() => window.__lyraPerformance.finishDialogSample());
      }
      const warmup = nativeSamples.slice(0, config.warmupSamples);
      const measured = nativeSamples.slice(config.warmupSamples);
      assert.equal(measured.length, config.measuredSamples);
      eventWorkloads[name] = {
        warmupSamples: warmup,
        samples: measured,
        metrics: Object.fromEntries(
          [...new Set(measured.flatMap((sample) => Object.keys(sample).filter((keyName) => keyName.endsWith('Ms'))))]
            .map((metric) => [metric, summarizeSamples(measured.map((sample) => sample[metric]))]),
        ),
      };
    }

    const dataWorkloads = {};
    for (const name of ['gridScroll', 'gridUpdate', 'treeScroll', 'treeUpdate']) {
      const all = [];
      for (let iteration = 0; iteration < config.warmupSamples + config.measuredSamples; iteration++) {
        const row = await page.evaluate(async ({ name, iteration }) => {
          switch (name) {
            case 'gridScroll': return window.__lyraPerformance.runGridScroll();
            case 'gridUpdate': return window.__lyraPerformance.runGridUpdate(iteration);
            case 'treeScroll': return window.__lyraPerformance.runTreeScroll();
            case 'treeUpdate': return window.__lyraPerformance.runTreeUpdate(iteration);
          }
        }, { name, iteration });
        all.push(row);
      }
      const warmup = all.slice(0, config.warmupSamples);
      const samples = all.slice(config.warmupSamples);
      assert.equal(samples.length, config.measuredSamples);
      dataWorkloads[name] = {
        warmupSamples: warmup,
        samples,
        duration: summarizeSamples(samples.map((sample) => sample.durationMs)),
      };
    }

    const styleSwitch = await measureStyleSwitches(page, context, config);
    assert.equal(styleSwitch.root.samples.length, config.styleSwitch.sampleCount);
    assert.equal(styleSwitch.nestedGlass.samples.length, config.styleSwitch.nestedGlassSampleCount);
    assert.equal(new Set(styleSwitch.root.samples.map((sample) => sample.look)).size,
      config.styleSwitch.looks.length, 'root style workload did not exercise all six public looks');

    const frameRecording = await page.evaluate(async () => {
      await window.__lyraPerformance.stopFrameSampling();
      if (window.__lyraPerformance.failures.length > 0) {
        throw new Error(window.__lyraPerformance.failures.join('; '));
      }
      return {
        frameIntervalsMs: window.__lyraPerformance.frameIntervalsMs,
        longTaskSupported: window.__lyraPerformance.longTaskSupported,
        longTasks: window.__lyraPerformance.longTasks,
      };
    });
    const { frameIntervalsMs, longTaskSupported, longTasks } = frameRecording;
    assert.ok(frameIntervalsMs.length > 0, 'frame-delay workload produced no animation-frame samples');
    assert.equal(longTaskSupported, true, 'Chromium did not expose long-task observation');
    const idleFramePeriodMs = summarizeSamples(idleFrameIntervalsMs).p50Ms;
    assert.ok(idleFramePeriodMs > 0, 'idle frame period must be positive');
    const estimatedDroppedFrames = frameIntervalsMs.map((interval) =>
      Math.max(0, Math.round(interval / idleFramePeriodMs) - 1));
    assert.deepEqual(errors, [], `${packageInfo.key}: browser fixture had runtime or network errors`);

    const result = {
      package: {
        key: packageInfo.key,
        role: packageInfo.role,
        expectedVersion: packageInfo.expectedVersion,
        installedVersion: packageInfo.metadata.version,
        installPath: packageInfo.installPath,
        tarballSha256: packageInfo.tarballSha256,
        browserDependencies: importMap.mounts.map(({ name, version }) => ({ name, version }))
          .sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version)),
      },
      startup: {
        warmupSamples: startupWarmups,
        samples: startupSamples,
        registration: summarizeSamples(startupSamples.map((sample) => sample.registrationMs)),
        firstUsableControl: summarizeSamples(startupSamples.map((sample) => sample.firstUsableMs)),
        registeredTags: boot.registeredTags,
      },
      interactions: eventWorkloads,
      data: dataWorkloads,
      styleSwitch,
      frameIntervals: {
        ...summarizeSamples(frameIntervalsMs),
        idleCalibration: summarizeSamples(idleFrameIntervalsMs),
        estimatedDroppedFrames: estimatedDroppedFrames.reduce((sum, value) => sum + value, 0),
        delayedIntervals: estimatedDroppedFrames.filter((value) => value > 0).length,
        estimateMethod: 'round(workload interval / idle median frame interval) - 1, floored at zero',
      },
      longTasks: {
        observerSupported: longTaskSupported,
        count: longTasks.length,
        rawSamples: longTasks,
        durations: longTasks.length > 0 ? summarizeSamples(longTasks.map((entry) => entry.durationMs)) : null,
      },
      runtimeAssertions: {
        allScenariosProducedPositiveUsabilityEvidence: true,
        noPageErrors: true,
        noUnexpectedRequests: true,
      },
    };
    // The browser page is closed before either retention or hydration opens a new one, keeping
    // every workload serial and making fixture-held component references collectible.
    await context.close();
    mainContextClosed = true;
    const componentRetention = await measureComponentRetention(browser, server, packageInfo, importMap, config);
    const hydrationSmoke = await runInstalledHydrationSmoke({ browser, server, packageInfo, importMap, config });
    const ssr = await renderInstalledHydrationFixture(packageInfo, config);
    const hydrationTiming = await measureInstalledHydrationInBrowser({
      browser,
      server,
      packageInfo,
      importMap,
      config,
      ssr,
    });
    return { ...result, componentRetention, hydrationSmoke, hydrationTiming };
  } finally {
    if (!mainContextClosed) await context.close();
  }
}

/**
 * Measures two already-installed normal package tarballs in one locked consumer fixture. The
 * caller owns packing/install and must pass only relative package paths under that fixture's
 * `node_modules`, plus the exact tarball path used for each install. This helper verifies each
 * archive hash but does not install packages, bundle them, set performance ceilings, or read
 * browser timing while another fixture page is active.
 */
export async function runPackedPerformanceQualification({ fixtureDir, packages, artifactsDir }) {
  assert.ok(Array.isArray(packages) && packages.length === 2, 'exactly two installed package descriptors are required');
  assert.deepEqual(packages.map((entry) => entry.role).sort(), ['baseline', 'candidate']);
  const config = JSON.parse(await readFile(workloadConfigPath, 'utf8'));
  const installedPackages = await Promise.all(packages.map((entry) => resolveInstalledPackage(fixtureDir, entry)));
  const byRole = Object.fromEntries(installedPackages.map((entry) => [entry.role, entry]));
  assertPerformancePackageVersions(byRole.baseline.expectedVersion, byRole.candidate.expectedVersion);
  const lock = await readFixtureLock(fixtureDir);
  const runtimeToolchain = await runtimeToolchainProvenance();
  const importMaps = new Map();
  // A loop makes package graph preparation deterministic and prevents browser work from overlapping.
  for (const packageInfo of installedPackages) {
    // Root-relative import-map addresses resolve against the active fixture origin after bind.
    importMaps.set(packageInfo.key, await buildBrowserImportMap(packageInfo, ''));
  }
  config.styleSwitch.plan = buildStyleSwitchPlan(config.styleSwitch, config.warmupSamples);
  const server = await startStaticServer(installedPackages, importMaps, config);
  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  const results = [];
  try {
    for (const role of ['baseline', 'candidate']) {
      const packageInfo = byRole[role];
      results.push(await measurePackage(browser, server, packageInfo, importMaps.get(packageInfo.key), config));
    }
  } finally {
    await browser.close();
    await new Promise((accept, reject) => server.server.close((error) => error ? reject(error) : accept()));
  }

  assert.ok(results.every((entry) =>
    entry.hydrationTiming.browser.hydrationToUsable.count === config.measuredSamples),
  'both installed packages must finish the configured hydration timing samples');
  const hydrationTimingMetadata = { ...config.hydrationTiming, status: 'measured' };
  delete hydrationTimingMetadata.reason;

  const receipt = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: platform(),
      release: release(),
      architecture: arch(),
      cpuCount: cpus().length,
      cpuModels: [...new Set(cpus().map((cpu) => cpu.model))],
      browser: 'Chromium',
      browserVersion,
      runtimeToolchain,
      ssrRendererResolution: 'common repository worker dependency graph for both installed packages',
      viewport: config.viewport,
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
      fixtureLockfile: lock,
      workloadConfigSha256: digest(await readFile(workloadConfigPath)),
      fixtureRunnerSha256: digest(await readFile(browserRunnerPath)),
      fixtureRetentionRunnerSha256: digest(await readFile(retentionRunnerPath)),
      fixtureHydrationRunnerSha256: digest(await readFile(hydrationRunnerPath)),
      fixtureSsrWorkerSha256: digest(await readFile(ssrWorkerPath)),
      qualificationHelperSha256: digest(await readFile(fileURLToPath(import.meta.url))),
      concurrency: 1,
    },
    samplePlan: {
      warmupSamples: config.warmupSamples,
      measuredSamples: config.measuredSamples,
      frameSampling: config.frameSampling,
      styleSwitch: {
        warmupSamples: config.warmupSamples,
        measuredSamples: config.styleSwitch.sampleCount,
        nestedGlassMeasuredSamples: config.styleSwitch.nestedGlassSampleCount,
        axes: {
          looks: config.styleSwitch.looks,
          modes: config.styleSwitch.modes,
          accents: config.styleSwitch.accents,
          densities: config.styleSwitch.densities,
        },
      },
      componentRetention: config.componentRetention,
      hydrationTiming: {
        warmupSamples: config.warmupSamples,
        measuredSamples: config.measuredSamples,
      },
      order: ['baseline', 'candidate'],
      noNumericCeilings: true,
      noHeapDeltaClaims: true,
    },
    hydrationTiming: hydrationTimingMetadata,
    packages: results,
  };
  if (artifactsDir) {
    await writeReceiptWithLock(receipt, artifactsDir, fixtureDir, lock);
  }
  return receipt;
}

/**
 * Runs only installed-package SSR/hydration correctness assertions for the same lock-bound
 * baseline/candidate fixture. This path deliberately does not call either timing helper.
 */
export async function runPackedHydrationSmoke({ fixtureDir, packages, artifactsPath }) {
  assert.ok(Array.isArray(packages) && packages.length === 2, 'exactly two installed package descriptors are required');
  assert.deepEqual(packages.map((entry) => entry.role).sort(), ['baseline', 'candidate']);
  const config = JSON.parse(await readFile(workloadConfigPath, 'utf8'));
  const installedPackages = await Promise.all(packages.map((entry) => resolveInstalledPackage(fixtureDir, entry)));
  const byRole = Object.fromEntries(installedPackages.map((entry) => [entry.role, entry]));
  assertPerformancePackageVersions(byRole.baseline.expectedVersion, byRole.candidate.expectedVersion);
  const lock = await readFixtureLock(fixtureDir);
  const runtimeToolchain = await runtimeToolchainProvenance();
  const importMaps = new Map();
  for (const packageInfo of installedPackages) {
    importMaps.set(packageInfo.key, await buildBrowserImportMap(packageInfo, ''));
  }
  const server = await startStaticServer(installedPackages, importMaps, config);
  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  const results = [];
  try {
    for (const role of ['baseline', 'candidate']) {
      const packageInfo = byRole[role];
      const assertions = await runInstalledHydrationSmoke({
        browser,
        server,
        packageInfo,
        importMap: importMaps.get(packageInfo.key),
        config,
      });
      results.push({
        role,
        version: packageInfo.expectedVersion,
        tarballSha256: packageInfo.tarballSha256,
        assertions,
      });
    }
  } finally {
    await browser.close();
    await new Promise((accept, reject) => server.server.close((error) => error ? reject(error) : accept()));
  }
  const receipt = {
    schemaVersion: 1,
    mode: 'correctness-only',
    recordedAt: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: platform(),
      architecture: arch(),
      browser: 'Chromium',
      browserVersion,
      runtimeToolchain,
      ssrRendererResolution: 'common repository worker dependency graph for both installed packages',
      viewport: config.viewport,
      fixtureLockfile: lock,
      workloadConfigSha256: digest(await readFile(workloadConfigPath)),
      fixtureHydrationRunnerSha256: digest(await readFile(hydrationRunnerPath)),
      fixtureSsrWorkerSha256: digest(await readFile(ssrWorkerPath)),
    },
    packages: results,
  };
  if (artifactsPath) {
    await writeReceiptWithLock(receipt, artifactsPath, fixtureDir, lock);
  }
  return receipt;
}

export {
  assertInside,
  buildBrowserImportMap,
  buildStyleSwitchPlan,
  packageInstallPath,
  parsePerformanceQualificationOptions,
  readFixtureLock,
  retainedCounterDeltas,
  resolveBrowserSpecifier,
  resolveInstalledPackage,
  runtimeToolchainProvenance,
  styleMetricDelta,
  summarizeSamples,
  writeReceiptWithLock,
};
