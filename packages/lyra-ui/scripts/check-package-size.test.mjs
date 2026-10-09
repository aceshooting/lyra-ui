import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import {
  companionBudgetFindings,
  formatPackageSummary,
  metricsFromPackResult,
  parsePackageSizeArguments,
  packageBudgetFindings,
  readTarballMetrics,
  validatePackageBudgets,
} from './check-package-size.mjs';

const budgets = {
  baseline: { packedBytes: 1_000, unpackedBytes: 4_000, fileCount: 40 },
  minimumUnpackedByteReductionPercent: 25,
  packedBudgetPolicy: {
    strategy: 'absolute-download-ceiling',
    exclusiveMaximumBytes: 10_000_000,
  },
  maximum: { packedBytes: 9_999_999, unpackedBytes: 3_000, fileCount: 26 },
  fileCountBudget: {
    baseArtifactCeiling: 15,
    stableTagAliasCount: 4,
    emittedFilesPerAlias: 2,
    measuredEntrypointRemainder: 1,
    nextComponentArtifactHeadroom: 2,
    entrypointHeadroom: 3,
  },
};

const requiredTarballFiles = [
  'llms.txt',
  'llms/index.md',
  'llms/shared.md',
  'llms/tokens.md',
  'llms/peers.md',
  'llms/migration.md',
  'llms/components/lr-table.md',
  'skills/lyra-ui/SKILL.md',
  'skills/compose-lyra-interfaces/SKILL.md',
  'dist/cli/lyra-ui.mjs',
  'dist/cli/init-agents.mjs',
];

const expectedPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function archiveFixture(manifest = expectedPackage, extraFiles = {}) {
  const entries = {
    ...Object.fromEntries(requiredTarballFiles.map((path) => [path, 'public documentation'])),
    'package.json': JSON.stringify(manifest),
    ...extraFiles,
  };
  const blocks = [];
  for (const [path, content] of Object.entries(entries)) {
    if (content === null) continue;
    const bytes = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(`package/${path}`);
    for (const [offset, width, value] of [[100, 8, 0o644], [108, 8, 0], [116, 8, 0], [124, 12, bytes.length], [136, 12, 0]]) {
      header.write(value.toString(8).padStart(width - 1, '0'), offset);
    }
    header.fill(0x20, 148, 156);
    header[156] = 0x30;
    header.write('ustar\0', 257);
    header.write('00', 263);
    const checksum = header.reduce((total, byte) => total + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

function withDownloadSize(archive, size) {
  // A valid gzip comment changes downloaded bytes without changing the contained tar inventory.
  const header = Buffer.from(archive.subarray(0, 10));
  header[3] |= 0x10;
  return Buffer.concat([header, Buffer.alloc(size - archive.length - 1, 0x61), Buffer.from([0]), archive.subarray(10)]);
}

function tarballFiles(...files) {
  return [
    ...requiredTarballFiles.map((path) => ({ path })),
    ...files.map((file) => (typeof file === 'string' ? { path: file } : file)),
  ];
}

test('enforces the absolute packed download limit while retaining unpacked and file-count policies', () => {
  assert.doesNotThrow(() => validatePackageBudgets(budgets));
  assert.throws(
    () => validatePackageBudgets({ ...budgets, minimumUnpackedByteReductionPercent: 24 }),
    /must remain the approved 25%/,
  );
  assert.throws(
    () => validatePackageBudgets({
      ...budgets,
      packedBudgetPolicy: { ...budgets.packedBudgetPolicy, strategy: 'ordinary-ceiling' },
    }),
    /must enforce the absolute compressed download ceiling/,
  );
  assert.throws(
    () => validatePackageBudgets({
      ...budgets,
      packedBudgetPolicy: { ...budgets.packedBudgetPolicy, exclusiveMaximumBytes: 10_000_001 },
    }),
    /must remain strictly below 10,000,000 bytes/,
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, unpackedBytes: 3_001 } }),
    /must enforce at least a 25% reduction/,
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, packedBytes: 10_000_000 } }),
    /must enforce the exclusive download limit/,
  );
  assert.throws(
    () => validatePackageBudgets({ ...budgets, maximum: { ...budgets.maximum, fileCount: 27 } }),
    /must match the reviewed stable-alias derivation/,
  );
  assert.throws(
    () => validatePackageBudgets({
      ...budgets,
      fileCountBudget: { ...budgets.fileCountBudget, entrypointHeadroom: 2 },
    }),
    /must include the measured remainder plus next-component allowance/,
  );
});

test('accepts 9,999,999 compressed bytes and rejects exactly 10,000,000 bytes', () => {
  const actualBudgets = JSON.parse(
    readFileSync(new URL('package-budgets.json', import.meta.url), 'utf8'),
  );
  for (const packedBytes of [9_999_999, 10_000_000]) {
    assert.deepEqual(
      packageBudgetFindings({
        packedBytes,
        unpackedBytes: 19_900_000,
        fileCount: requiredTarballFiles.length,
        files: tarballFiles(),
      }, actualBudgets),
      packedBytes === 9_999_999 ? [] : ['packedBytes 10,000,000 exceeds hard budget 9,999,999'],
    );
  }
});

test('gates actual archive bytes even when the dry-run estimate is below the download limit', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-package-size-'));
  const actualBudgets = JSON.parse(readFileSync(new URL('package-budgets.json', import.meta.url), 'utf8'));
  const archive = archiveFixture();
  const tarball = join(directory, 'package.tgz');
  try {
    const estimate = metricsFromPackResult({ size: archive.length, unpackedSize: 1_000, files: tarballFiles() });
    assert.deepEqual(packageBudgetFindings(estimate, actualBudgets), []);
    assert.match(formatPackageSummary(estimate, actualBudgets), /packed estimate/);

    writeFileSync(tarball, withDownloadSize(archive, 9_999_999));
    const actual = await readTarballMetrics(tarball);
    assert.equal(actual.packedBytes, 9_999_999);
    assert.equal(actual.fileCount, requiredTarballFiles.length + 1);
    assert.ok(actual.unpackedBytes > 0);
    assert.match(actual.sha256, /^[a-f0-9]{64}$/u);
    assert.match(formatPackageSummary(actual, actualBudgets), /packed archive/);
    assert.deepEqual(packageBudgetFindings(actual, actualBudgets), []);

    writeFileSync(tarball, withDownloadSize(archive, 10_000_000));
    await assert.rejects(readTarballMetrics(tarball), /packedBytes 10,000,000 exceeds hard budget 9,999,999/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects malformed tarball inputs and mismatched package identity without repacking', async () => {
  assert.deepEqual(parsePackageSizeArguments([]), {});
  assert.deepEqual(parsePackageSizeArguments(['--tarball', 'archive.tgz']), { tarball: 'archive.tgz' });
  for (const args of [['--tarball'], ['--tarball', ''], ['--tarball', '--unknown'], ['--unknown', 'archive.tgz'],
    ['--tarball', 'archive.tgz', 'other.tgz'], ['--tarball', 'bad\0path']]) {
    assert.throws(() => parsePackageSizeArguments(args), /Usage:/u);
  }
  const directory = mkdtempSync(join(tmpdir(), 'lyra-package-size-'));
  const tarball = join(directory, 'package.tgz');
  try {
    await assert.rejects(readTarballMetrics(join(directory, 'missing.tgz')), /ENOENT/u);
    await assert.rejects(readTarballMetrics(directory), /must be a regular file/u);
    writeFileSync(tarball, 'not a gzip archive');
    await assert.rejects(readTarballMetrics(tarball), /Invalid or oversized peer tarball/u);
    writeFileSync(tarball, archiveFixture({ ...expectedPackage, name: '@example/other' }));
    await assert.rejects(readTarballMetrics(tarball), /Tarball package name/u);
    writeFileSync(tarball, archiveFixture({ ...expectedPackage, version: '0.0.0' }));
    await assert.rejects(readTarballMetrics(tarball), /Tarball package version/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('uses the actual archive inventory for required-file and hygiene checks', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-package-size-'));
  const tarball = join(directory, 'package.tgz');
  try {
    const actualBudgets = JSON.parse(readFileSync(new URL('package-budgets.json', import.meta.url), 'utf8'));
    writeFileSync(tarball, archiveFixture(expectedPackage, { 'llms/tokens.md': null, 'dist/input.test.js': 'export {};' }));
    const metrics = await readTarballMetrics(tarball);
    assert.deepEqual(packageBudgetFindings(metrics, actualBudgets), [
      'published tarball is missing required file: llms/tokens.md',
      'published tarball contains 1 test path(s)',
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('accepts only an honest measured unpacked exception with tight headroom', () => {
  const withException = {
    ...budgets,
    unpackedBudgetPolicy: {
      strategy: 'measured-required-artifact-exception',
      exceptionReason: 'required-public-artifacts-exceed-25-percent-target',
      reviewedMeasurementBytes: 3_010,
      headroomBytes: 10,
      targetAt25PercentBytes: 3_000,
    },
    maximum: { ...budgets.maximum, unpackedBytes: 3_020 },
  };
  assert.doesNotThrow(() => validatePackageBudgets(withException));
  const withPolicy = (policy, maximumUnpackedBytes = withException.maximum.unpackedBytes) => ({
    ...withException,
    unpackedBudgetPolicy: { ...withException.unpackedBudgetPolicy, ...policy },
    maximum: { ...withException.maximum, unpackedBytes: maximumUnpackedBytes },
  });
  assert.throws(
    () => validatePackageBudgets(withPolicy({ strategy: 'trust-me' })),
    /unpacked strategy must name the reviewed required-artifact exception/,
  );
  assert.throws(
    () => validatePackageBudgets(withPolicy({ targetAt25PercentBytes: 2_999 })),
    /targetAt25PercentBytes must match the baseline calculation/,
  );
  // An exception is not a license: it exists only while the measurement really exceeds the target.
  assert.throws(
    () => validatePackageBudgets(withPolicy({ reviewedMeasurementBytes: 3_000, headroomBytes: 20 })),
    /only allowed while the reviewed measurement exceeds the 25% target/,
  );
  assert.throws(
    () => validatePackageBudgets(withPolicy({ headroomBytes: 17 }, 3_027)),
    /unpacked headroom must remain at or below 0\.5%/,
  );
  assert.throws(
    () => validatePackageBudgets(withPolicy({}, 3_021)),
    /maximum\.unpackedBytes must equal the reviewed measurement plus tight headroom/,
  );
  assert.throws(
    () => validatePackageBudgets(withPolicy({ reviewedMeasurementBytes: 3_999, headroomBytes: 1 }, 4_000)),
    /maximum\.unpackedBytes at or above the pre-8 baseline requires unpackedBudgetPolicy\.baselineExceptionReview/,
  );
  const review = {
    approvedBy: 'maintainer',
    approvedOn: '2026-09-28',
    reason: 'Deprecated-alias metadata that the next major removes, reviewed at an exact ceiling.',
    approvedMaximumUnpackedBytes: 4_000,
  };
  assert.doesNotThrow(() =>
    validatePackageBudgets(withPolicy({ reviewedMeasurementBytes: 3_999, headroomBytes: 1, baselineExceptionReview: review }, 4_000)),
  );
  assert.throws(
    () =>
      validatePackageBudgets(
        withPolicy(
          { reviewedMeasurementBytes: 3_999, headroomBytes: 1, baselineExceptionReview: { ...review, approvedMaximumUnpackedBytes: 3_999 } },
          4_000,
        ),
      ),
    /maximum\.unpackedBytes must stay at or below the approved baseline-exception ceiling/,
  );
  const summary = formatPackageSummary(
    { packedBytes: 884, unpackedBytes: 3_015, fileCount: 26, files: [] },
    withException,
  );
  assert.match(summary, /unpacked \(24\.6% reduction; reviewed exception to the 25% target\)/);
});

test('reports byte, file-count, and dangling-map regressions', () => {
  assert.deepEqual(
    packageBudgetFindings(
      {
        packedBytes: 10_000_000,
        unpackedBytes: 3_001,
        fileCount: 27,
        files: tarballFiles(
          { path: 'dist/component.js.map' },
          { path: 'dist/component.js' },
          { path: 'src/component.ts' },
        ),
      },
      budgets,
    ),
    [
      'packedBytes 10,000,000 exceeds hard budget 9,999,999',
      'unpackedBytes 3,001 exceeds hard budget 3,000',
      'fileCount 27 exceeds hard budget 26',
      'published tarball contains 1 dangling JavaScript/declaration map(s)',
      'published tarball contains 1 unnecessary TypeScript source file(s)',
    ],
  );
});

test('rejects packed fixture, test, and story paths without changing the ceilings', () => {
  assert.deepEqual(
    packageBudgetFindings(
      {
        packedBytes: 884,
        unpackedBytes: 3_000,
        fileCount: 26,
        files: tarballFiles(
          { path: 'dist/components/viewers/docx-viewer/fixtures/minimal-docx-fixture.d.ts' },
          { path: 'dist/components/viewers/docx-viewer/fixtures/minimal-docx-fixture.js' },
          { path: 'dist/components/viewers/ebook-viewer/fixtures/minimal-epub-fixture.d.ts' },
          { path: 'dist/components/viewers/ebook-viewer/fixtures/minimal-epub-fixture.js' },
          { path: 'dist/components/viewers/spreadsheet-viewer/fixtures/minimal-xlsx-fixture.d.ts' },
          { path: 'dist/components/viewers/spreadsheet-viewer/fixtures/minimal-xlsx-fixture.js' },
          { path: 'dist/components/forms/input/input.test.js' },
          { path: 'dist/components/forms/input/input.stories.d.ts' },
          { path: 'dist/components/forms/input/input.js' },
          { path: 'dist/components/agent-tools/test-results/test-results.js' },
          { path: 'dist/components/utility/storybook-link/storybook-link.js' },
          { path: 'dist/components/viewers/fixtures-browser/fixtures-browser.js' },
        ),
      },
      budgets,
    ),
    [
      'published tarball contains 6 build-only fixture path(s)',
      'published tarball contains 1 test path(s)',
      'published tarball contains 1 story path(s)',
    ],
  );
});

test('normalizes Windows archive paths without matching plural fixture near-misses', () => {
  assert.deepEqual(
    packageBudgetFindings(
      {
        packedBytes: 884,
        unpackedBytes: 3_000,
        fileCount: 26,
        files: tarballFiles(
          {
            path: 'dist\\components\\viewers\\spreadsheet-viewer\\fixtures\\minimal-xlsx-fixture.d.ts',
          },
          {
            path: 'dist\\components\\viewers\\fixtures-browser\\fixtures-browser.d.ts',
          },
        ),
      },
      budgets,
    ),
    ['published tarball contains 1 build-only fixture path(s)'],
  );
});

test('requires focused public docs in the tarball inventory and rejects repository archive', () => {
  const files = tarballFiles('llms-full.txt').filter(({ path }) => path !== 'llms/tokens.md');
  assert.deepEqual(
    packageBudgetFindings(
      { packedBytes: 884, unpackedBytes: 3_000, fileCount: files.length, files },
      budgets,
    ),
    [
      'published tarball is missing required file: llms/tokens.md',
      'published tarball contains repository-only archive: llms-full.txt',
    ],
  );
});

test('reports the download limit and labels historical packed reduction as informational', () => {
  const summary = formatPackageSummary(
    { packedBytes: 884, unpackedBytes: 3_000, fileCount: 26, files: [] },
    budgets,
  );
  assert.match(summary, /packed estimate \(11\.6% reduction from historical baseline; download limit <10 MB decimal\)/);
  assert.match(summary, /unpacked \(25\.0% reduction\)/);
});

test('derives metrics from npm pack JSON without trusting its entryCount alias', () => {
  assert.deepEqual(
    metricsFromPackResult({
      size: 10,
      unpackedSize: 20,
      entryCount: 999,
      files: [{ path: 'dist/a.js' }, { path: 'dist/a.d.ts' }],
    }),
    {
      measurement: 'estimate',
      packedBytes: 10,
      unpackedBytes: 20,
      fileCount: 2,
      files: [{ path: 'dist/a.js' }, { path: 'dist/a.d.ts' }],
    },
  );
});

test('retains seven scaffold files above the reviewed required-artifact inventory', () => {
  const actualBudgets = JSON.parse(
    readFileSync(new URL('package-budgets.json', import.meta.url), 'utf8'),
  );
  const fileBudget = actualBudgets.fileCountBudget;
  assert.equal(
    fileBudget.stableTagAliasCount,
    308,
    'the normal tarball has 308 stable registration aliases',
  );
  assert.equal(
    fileBudget.baseArtifactCeiling +
      fileBudget.stableTagAliasCount * fileBudget.emittedFilesPerAlias +
      fileBudget.measuredEntrypointRemainder,
    3_345,
    'the derivation must bind the reviewed complete package inventory',
  );
  assert.equal(
    fileBudget.nextComponentArtifactHeadroom,
    7,
    'the existing scaffold reserve must remain unchanged',
  );
  assert.equal(
    actualBudgets.maximum.fileCount,
    3_352,
    'the complete inventory retains exactly seven scaffold files',
  );
  assert.deepEqual(
    [actualBudgets.maximum.packedBytes, actualBudgets.maximum.unpackedBytes],
    [9_999_999, 20_400_000],
    'the split package keeps the absolute download ceiling and a tight unpacked ceiling',
  );

  const requiredAdditions = [
    'dist/components/charts/chart/chart-sync.js',
    'dist/components/charts/chart/chart-sync.d.ts',
    'dist/components/charts/chart/chart-sync.styles.js',
    'dist/components/charts/chart/chart-sync.styles.d.ts',
    'dist/internal/opaque-content-border.styles.js',
    'dist/internal/opaque-content-border.styles.d.ts',
  ];
  for (const fileCount of [3_345, 3_352, 3_353]) {
    const extraFiles = Array.from(
      { length: fileCount - requiredTarballFiles.length - requiredAdditions.length },
      (_, index) => `dist/required-entrypoint-${index}.js`,
    );
    const metrics = metricsFromPackResult({
      size: 7_584_288,
      unpackedSize: 19_900_000,
      files: tarballFiles(...requiredAdditions, ...extraFiles),
    });
    const findings = packageBudgetFindings(metrics, actualBudgets);
    assert.deepEqual(
      findings,
      fileCount === 3_353 ? ['fileCount 3,353 exceeds hard budget 3,352'] : [],
      'the measured package and exact reserve pass, while one additional artifact fails',
    );
  }
});

test('keeps editor data and locale catalogs out of the lyra-ui tarball and gates each companion', () => {
  const actualBudgets = JSON.parse(readFileSync(new URL('package-budgets.json', import.meta.url), 'utf8'));
  const file = (path, size = 1) => ({ path, size });
  const uiMetrics = {
    packedBytes: 1, unpackedBytes: 1, fileCount: 3,
    files: [...requiredTarballFiles, 'custom-elements.json', 'dist/translations/fr.js', 'dist/translations/pseudo/en-XA.js'].map((path) => file(path)),
  };
  const findings = packageBudgetFindings(uiMetrics, actualBudgets);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /2 file\(s\) that ship in a companion package: custom-elements\.json, dist\/translations\/fr\.js/u);

  const ide = ['custom-elements.json', 'web-types.json', 'vscode-html-data.json', 'vscode-css-data.json'].map((path) => file(path));
  assert.deepEqual(companionBudgetFindings({ packedBytes: 1, unpackedBytes: 1, fileCount: 4, files: ide }, '@aceshooting/lyra-ide', actualBudgets), []);
  assert.deepEqual(
    companionBudgetFindings({ packedBytes: 1, unpackedBytes: 99_000_000, fileCount: 3, files: ide.slice(1) }, '@aceshooting/lyra-ide', actualBudgets),
    ['published tarball is missing required file: custom-elements.json', 'unpackedBytes 99,000,000 exceeds hard budget 10,350,000'],
  );
  assert.throws(() => companionBudgetFindings({ files: [] }, '@example/other', actualBudgets), /no companion package budget/u);
  assert.deepEqual(parsePackageSizeArguments(['--package', '@aceshooting/lyra-translations', '--tarball', 'a.tgz']), { package: '@aceshooting/lyra-translations', tarball: 'a.tgz' });
  for (const args of [['--package', '@aceshooting/lyra-translations'], ['--package', 'x', '--tarball', 'a.tgz']]) {
    assert.throws(() => parsePackageSizeArguments(args), /Usage:/u);
  }
});
