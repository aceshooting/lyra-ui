import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { waitForBrowserReadiness } from '../packages/lyra-ui/scripts/fixtures/packed-performance/browser-readiness.mjs';
import {
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
} from './packed-performance.mjs';

test('browser readiness failure preserves the package, phase, page errors and state', async () => {
  const errors = ['pageerror: missing browser dependency', 'HTTP 404: /missing.js'];
  const page = {
    async waitForFunction() { throw new Error('Timeout 30000ms exceeded'); },
    async evaluate() { return { readyState: 'complete', performanceBootPresent: false }; },
  };
  await assert.rejects(
    waitForBrowserReadiness({
      page,
      predicate: () => false,
      packageKey: 'baseline',
      phase: 'performance startup first usable control',
      errors,
    }),
    (error) => {
      assert.match(error.message, /baseline: performance startup first usable control browser readiness failed/);
      assert.match(error.message, /pageerror: missing browser dependency/);
      assert.match(error.message, /HTTP 404: \/missing\.js/);
      assert.match(error.message, /"readyState":"complete"/);
      assert.match(error.message, /"performanceBootPresent":false/);
      assert.match(error.cause.message, /Timeout 30000ms exceeded/);
      return true;
    },
  );
});

test('interaction readiness failure includes the keyed sample and observable control state', async () => {
  let evaluations = 0;
  const page = {
    async waitForFunction(_predicate, argument, options) {
      assert.equal(argument, 4);
      assert.equal(options.timeout, 10000);
      throw new Error('Timeout 10000ms exceeded');
    },
    async evaluate() {
      evaluations++;
      return evaluations === 1
        ? { readyState: 'complete' }
        : { open: false, value: 'first', activeIndex: -1, latestRecord: undefined };
    },
  };
  await assert.rejects(waitForBrowserReadiness({
    page,
    predicate: (count) => count > 0,
    argument: 4,
    packageKey: 'baseline',
    phase: 'interaction select sample 4',
    errors: ['console.error: fixture failure'],
    timeoutMs: 10000,
    snapshot: () => ({ value: 'first' }),
  }), (error) => {
    assert.match(error.message, /baseline: interaction select sample 4 browser readiness failed/);
    assert.match(error.message, /console\.error: fixture failure/);
    assert.match(error.message, /interactionState=\{"open":false,"value":"first","activeIndex":-1\}/);
    return true;
  });
});

test('packed performance accepts only node_modules-relative package paths', () => {
  assert.deepEqual(packageInstallPath('@aceshooting/lyra-ui'), ['@aceshooting', 'lyra-ui']);
  assert.throws(() => packageInstallPath(''), /cannot be empty/);
  assert.throws(() => packageInstallPath('../lyra-ui'), /stay within node_modules/);
  assert.throws(() => packageInstallPath('/tmp/lyra-ui'), /stay within node_modules/);
  assert.throws(() => packageInstallPath('nested\\lyra-ui'), /POSIX separators/);
});

test('production timing remains opt-in and requires an explicit archive plus receipt directory', () => {
  assert.equal(parsePerformanceQualificationOptions({}), undefined);
  assert.throws(
    () => parsePerformanceQualificationOptions({ LYRA_PACKED_PERFORMANCE_ARTIFACTS: '/receipts' }),
    /BASELINE_TARBALL is required/,
  );
  assert.throws(
    () => parsePerformanceQualificationOptions({ LYRA_PACKED_PERFORMANCE_BASELINE_TARBALL: '/v23.tgz' }),
    /set exactly one/,
  );
  const options = parsePerformanceQualificationOptions({
    LYRA_PACKED_PERFORMANCE_BASELINE_TARBALL: '/published/lyra-ui-23.0.0.tgz',
    LYRA_PACKED_PERFORMANCE_ARTIFACTS: '/receipts/v24',
  });
  assert.deepEqual(options, {
    mode: 'qualification',
    baselineTarballPath: resolve('/published/lyra-ui-23.0.0.tgz'),
    artifactsDir: resolve('/receipts/v24'),
  });
  const smokeOptions = parsePerformanceQualificationOptions({
    LYRA_PACKED_PERFORMANCE_BASELINE_TARBALL: '/published/lyra-ui-23.0.0.tgz',
    LYRA_PACKED_HYDRATION_SMOKE_ARTIFACTS: '/receipts/hydration-smoke',
  });
  assert.deepEqual(smokeOptions, {
    mode: 'hydration-smoke',
    baselineTarballPath: resolve('/published/lyra-ui-23.0.0.tgz'),
    artifactsDir: resolve('/receipts/hydration-smoke'),
  });
  assert.throws(() => parsePerformanceQualificationOptions({
    LYRA_PACKED_PERFORMANCE_BASELINE_TARBALL: '/published/lyra-ui-23.0.0.tgz',
    LYRA_PACKED_PERFORMANCE_ARTIFACTS: '/receipts/perf',
    LYRA_PACKED_HYDRATION_SMOKE_ARTIFACTS: '/receipts/smoke',
  }), /set exactly one/);
});

test('browser fixture requests remain inside their package or dependency mount', () => {
  const root = '/fixture/node_modules/@aceshooting/lyra-ui';
  assert.equal(assertInside(root, 'dist/components/lr-input.js'), `${root}/dist/components/lr-input.js`);
  assert.throws(() => assertInside(root, '../outside.js'), /escaped its mounted root/);
  assert.throws(() => assertInside(root, '/outside.js'), /escaped its mounted root/);
});

test('browser bare imports resolve from each installed ESM module parent and use import conditions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-packed-import-parent-'));
  const dependencyName = basename(root).toLowerCase();
  try {
    for (const name of ['baseline', 'candidate']) {
      const packageRoot = join(root, name);
      const dependencyRoot = join(packageRoot, 'node_modules', dependencyName);
      await mkdir(dependencyRoot, { recursive: true });
      await writeFile(join(packageRoot, 'entry.js'), '');
      await writeFile(join(dependencyRoot, 'package.json'), JSON.stringify({
        name: dependencyName,
        exports: {
          '.': { import: { node: './node.js', default: './esm.js' } },
          './blocked.js': { browser: null, default: './esm.js' },
          './invalid.js': { browser: ['./esm.js'], default: './esm.js' },
          './feature/*': './features/*.js',
        },
      }));
      await writeFile(join(dependencyRoot, 'esm.js'), 'export const selected = "import";');
      await writeFile(join(dependencyRoot, 'node.js'), 'export const selected = "node";');
      await mkdir(join(dependencyRoot, 'features'));
      await writeFile(join(dependencyRoot, 'features/example.js'), 'export const feature = true;');
      assert.equal(import.meta.resolve(dependencyName, pathToFileURL(join(packageRoot, 'entry.js')).href),
        pathToFileURL(join(dependencyRoot, 'node.js')).href);
      const resolved = await resolveBrowserSpecifier(dependencyName, join(packageRoot, 'entry.js'));
      assert.equal(resolved, pathToFileURL(join(dependencyRoot, 'esm.js')).href);
      await assert.rejects(resolveBrowserSpecifier(`${dependencyName}/blocked.js`, join(packageRoot, 'entry.js')),
        /no safe declared production browser module target/);
      await assert.rejects(resolveBrowserSpecifier(`${dependencyName}/invalid.js`, join(packageRoot, 'entry.js')),
        /unsupported browser export target shape/);
      await assert.rejects(resolveBrowserSpecifier(`${dependencyName}/feature/example`, join(packageRoot, 'entry.js')),
        /no exact declared browser export\/import entry/);
    }
    const baselineSource = await readFile(resolve(root, 'baseline/node_modules', dependencyName, 'esm.js'), 'utf8');
    const candidateSource = await readFile(resolve(root, 'candidate/node_modules', dependencyName, 'esm.js'), 'utf8');
    assert.match(baselineSource, /selected = "import"/);
    assert.match(candidateSource, /selected = "import"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('raw browser fixture selects tslib ESM instead of its Node-only CommonJS bridge', async () => {
  const parent = fileURLToPath(new URL('../packages/lyra-ui/package.json', import.meta.url));
  const browserEntry = await resolveBrowserSpecifier('tslib', parent);
  assert.match(browserEntry, /\/tslib\/tslib\.es6\.mjs$/);
  const tslib = await import(browserEntry);
  assert.equal(typeof tslib.__decorate, 'function');
});

test('package-private browser imports use literal scoped keys and production targets for each installed version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-packed-private-imports-'));
  try {
    for (const role of ['baseline', 'candidate']) {
      const packageRoot = join(root, role);
      await mkdir(join(packageRoot, 'dist', 'components'), { recursive: true });
      await mkdir(join(packageRoot, 'dist', 'internal'), { recursive: true });
      const productionTarget = `./dist/internal/${role}-production.js`;
      await writeFile(join(packageRoot, 'package.json'), JSON.stringify({
        name: '@aceshooting/lyra-ui',
        type: 'module',
        imports: {
          '#lyra-dev-attributes': {
            development: './dist/internal/development.js',
            default: productionTarget,
          },
        },
        exports: {
          './theme.js': './dist/theme.js',
          './hydration.js': './dist/hydration.js',
        },
      }));
      await writeFile(join(packageRoot, productionTarget), 'export const mode = "production";');
      await writeFile(join(packageRoot, 'dist/internal/development.js'), 'export const mode = "development";');
      for (const name of ['input', 'select', 'option', 'dialog', 'data-grid', 'tree', 'button']) {
        await writeFile(join(packageRoot, `dist/components/lr-${name}.js`),
          name === 'input' ? "import '#lyra-dev-attributes';\n" : '');
      }
      await writeFile(join(packageRoot, 'dist/theme.js'), '');
      await writeFile(join(packageRoot, 'dist/hydration.js'), '');
      const map = await buildBrowserImportMap({
        key: role,
        root: packageRoot,
        metadata: JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')),
      }, '');
      const scope = `/packages/${role}/`;
      assert.equal(map.scopes[scope]['#lyra-dev-attributes'],
        `/packages/${role}/dist/internal/${role}-production.js`);
      assert.equal(Object.keys(map.scopes[scope]).length, 1);
      assert.equal(Object.keys(map.imports).some((key) => key.includes('#lyra-dev-attributes')), false);
      assert.equal(JSON.stringify(map.scopes).includes('development.js'), false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('packed fixture requires exactly one dependency lockfile authority', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-packed-lock-authority-'));
  try {
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    const lock = await readFixtureLock(root);
    assert.equal(lock.fileName, 'pnpm-lock.yaml');
    assert.match(lock.sha256, /^[a-f0-9]{64}$/);
    await writeFile(join(root, 'package-lock.json'), '{}\n');
    await assert.rejects(readFixtureLock(root), /exactly one package-manager lockfile/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('receipt preserves the exact fixture lock and package manifest beside raw samples', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-packed-receipt-'));
  try {
    const fixture = join(root, 'fixture');
    const output = join(root, 'evidence', 'packed-performance.json');
    await mkdir(fixture);
    await writeFile(join(fixture, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    await writeFile(join(fixture, 'package.json'), '{"name":"locked-consumer"}\n');
    const lock = await readFixtureLock(fixture);
    const receipt = { environment: { fixtureLockfile: lock }, packages: [{ samples: [1, 2, 3] }] };
    await writeReceiptWithLock(receipt, output, fixture, lock);
    const written = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(written.packages, receipt.packages);
    assert.equal(written.environment.fixtureLockfile.artifact, 'packed-performance.json.pnpm-lock.yaml');
    assert.match(written.environment.fixturePackageManifest.sha256, /^[a-f0-9]{64}$/);
    assert.equal(await readFile(join(root, 'evidence', written.environment.fixtureLockfile.artifact), 'utf8'),
      'lockfileVersion: 9.0\n');
    assert.equal(await readFile(join(root, 'evidence', written.environment.fixturePackageManifest.artifact), 'utf8'),
      '{"name":"locked-consumer"}\n');
    await writeFile(join(fixture, 'pnpm-lock.yaml'), 'changed lock\n');
    await assert.rejects(writeReceiptWithLock(receipt, output, fixture, lock), /lockfile changed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('SSR timing provenance records the actual common renderer and Lit entry bytes', async () => {
  const toolchain = await runtimeToolchainProvenance();
  assert.equal(toolchain.playwright.name, 'playwright');
  assert.equal(toolchain.ssrRenderer.name, '@lit-labs/ssr');
  assert.equal(toolchain.ssrResultCollector.name, '@lit-labs/ssr');
  assert.equal(toolchain.ssrLit.name, 'lit');
  for (const entry of Object.values(toolchain)) {
    assert.match(entry.version, /^\d+\./);
    assert.match(entry.entrySha256, /^[a-f0-9]{64}$/);
  }
});

test('installed package descriptor is bound to the exact tarball bytes and version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-packed-tarball-binding-'));
  try {
    const packageRoot = join(root, 'node_modules', 'baseline-copy');
    const tarballPath = join(root, 'lyra-ui-v23.tgz');
    const tarball = Buffer.from('the exact packed v23 bytes');
    await mkdir(join(packageRoot, 'dist/components'), { recursive: true });
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@aceshooting/lyra-ui', version: '23.4.1' }),
    );
    for (const entry of [
      'lr-input.js',
      'lr-select.js',
      'lr-option.js',
      'lr-dialog.js',
      'lr-data-grid.js',
      'lr-tree.js',
      'lr-button.js',
    ]) {
      await writeFile(join(packageRoot, 'dist/components', entry), '');
    }
    await writeFile(tarballPath, tarball);
    const descriptor = {
      key: 'baseline',
      role: 'baseline',
      installPath: 'baseline-copy',
      expectedVersion: '23.4.1',
      tarballPath: 'lyra-ui-v23.tgz',
      tarballSha256: createHash('sha256').update(tarball).digest('hex'),
    };
    const installed = await resolveInstalledPackage(root, descriptor);
    assert.equal(installed.expectedVersion, '23.4.1');
    assert.equal(installed.tarballSha256, descriptor.tarballSha256);
    await writeFile(tarballPath, 'different bytes');
    await assert.rejects(resolveInstalledPackage(root, descriptor), /tarball hash does not match/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('sample summaries retain raw data and variability without imposing a ceiling', () => {
  const summary = summarizeSamples([1, 2, 9, 4]);
  assert.equal(summary.count, 4);
  assert.equal(summary.minMs, 1);
  assert.equal(summary.p50Ms, 2);
  assert.equal(summary.p95Ms, 9);
  assert.equal(summary.maxMs, 9);
  assert.deepEqual(summary.rawSamplesMs, [1, 2, 9, 4]);
  assert.ok(summary.standardDeviationMs > 0);
  assert.ok(summary.coefficientOfVariation > 0);
  assert.throws(() => summarizeSamples([]), /empty sample distribution/);
  assert.throws(() => summarizeSamples([Number.NaN]), /finite nonnegative/);
});

test('style workload plan covers every look while varying each style axis across measured samples', async () => {
  const workload = JSON.parse(await readFile(new URL('./fixtures/packed-performance/workloads.json', import.meta.url), 'utf8'));
  const plan = buildStyleSwitchPlan(workload.styleSwitch, workload.warmupSamples);
  assert.equal(plan.length, workload.warmupSamples + workload.styleSwitch.sampleCount);
  const measured = plan.slice(workload.warmupSamples);
  for (const axis of ['look', 'mode', 'accent', 'density']) {
    assert.ok(new Set(measured.map((sample) => sample[axis])).size > 1, `${axis} did not vary`);
  }
  assert.deepEqual(new Set(measured.map((sample) => sample.look)), new Set(workload.styleSwitch.looks));
  assert.deepEqual(new Set(measured.slice(0, workload.styleSwitch.nestedGlassSampleCount).map((sample) => sample.look)),
    new Set(workload.styleSwitch.looks));
  assert.throws(() => buildStyleSwitchPlan({ ...workload.styleSwitch, sampleCount: 3 }, 0), /enough measured samples/);
  assert.throws(() => buildStyleSwitchPlan({ ...workload.styleSwitch, nestedGlassSampleCount: 3 }, 0),
    /nested glass qualification needs enough/);
});

test('CDP style metrics retain count and duration deltas or report absent metrics explicitly', () => {
  const complete = styleMetricDelta(
    { RecalcStyleCount: 4, RecalcStyleDuration: 0.25, LayoutCount: 2, LayoutDuration: 0.1 },
    { RecalcStyleCount: 7, RecalcStyleDuration: 0.27, LayoutCount: 3, LayoutDuration: 0.105 },
  );
  assert.equal(complete.status, 'complete');
  assert.deepEqual(complete.missing, []);
  assert.equal(complete.recalcStyleCount, 3);
  assert.equal(complete.layoutCount, 1);
  assert.ok(Math.abs(complete.recalcStyleDurationMs - 20) < 0.001);
  assert.ok(Math.abs(complete.layoutDurationMs - 5) < 0.001);
  const partial = styleMetricDelta({}, { LayoutCount: 1 });
  assert.equal(partial.status, 'missing-metrics');
  assert.deepEqual(partial.missing, ['RecalcStyleCount', 'RecalcStyleDuration', 'LayoutCount', 'LayoutDuration']);
  assert.equal(partial.layoutDurationMs, null);
});

test('post-GC retention deltas distinguish isolate heap from DOM counters', () => {
  const baseline = {
    heap: { usedSizeBytes: 1000, embedderHeapUsedSizeBytes: 300, backingStorageSizeBytes: 40 },
    dom: { nodes: 30, documents: 1, jsEventListeners: 4 },
  };
  const current = {
    heap: { usedSizeBytes: 1100, embedderHeapUsedSizeBytes: 290, backingStorageSizeBytes: 40 },
    dom: { nodes: 31, documents: 1, jsEventListeners: 4 },
  };
  assert.deepEqual(retainedCounterDeltas(baseline, current), {
    usedHeapBytes: 100, embedderHeapBytes: -10, backingStorageBytes: 0,
    domNodes: 1, domDocuments: 0, domEventListeners: 0,
  });
  assert.equal(retainedCounterDeltas({ ...baseline, dom: {} }, current).domNodes, null);
});
