import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertInside,
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
  try {
    for (const name of ['baseline', 'candidate']) {
      const packageRoot = join(root, name);
      const dependencyRoot = join(packageRoot, 'node_modules', 'fixture-dependency');
      await mkdir(dependencyRoot, { recursive: true });
      await writeFile(join(packageRoot, 'entry.js'), '');
      await writeFile(join(dependencyRoot, 'package.json'), JSON.stringify({
        name: 'fixture-dependency',
        exports: { '.': { import: './esm.js', require: './cjs.cjs' } },
      }));
      await writeFile(join(dependencyRoot, 'esm.js'), 'export const selected = "import";');
      await writeFile(join(dependencyRoot, 'cjs.cjs'), 'module.exports = "require";');
      const resolved = resolveBrowserSpecifier('fixture-dependency', join(packageRoot, 'entry.js'));
      assert.equal(resolved, pathToFileURL(join(dependencyRoot, 'esm.js')).href);
    }
    const baselineSource = await readFile(resolve(root, 'baseline/node_modules/fixture-dependency/esm.js'), 'utf8');
    const candidateSource = await readFile(resolve(root, 'candidate/node_modules/fixture-dependency/esm.js'), 'utf8');
    assert.match(baselineSource, /selected = "import"/);
    assert.match(candidateSource, /selected = "import"/);
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
