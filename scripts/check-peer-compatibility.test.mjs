import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';

const MANAGED_PEER_RANGES = Object.freeze({
  '@sgratzl/chartjs-chart-boxplot': '^4.0.0',
  'chart.js': '^4.0.1',
  'chartjs-plugin-annotation': '^3.0.0',
  'chartjs-plugin-datalabels': '^2.2.0',
  'chartjs-plugin-zoom': '^2.0.0',
  dompurify: '^3.4.14',
  katex: '^0.18.4',
  mammoth: '^1.12.1',
  marked: '^18.0.11',
  'pdfjs-dist': '^6.3.289',
});

const CURRENT_VERSIONS = Object.freeze({
  '@sgratzl/chartjs-chart-boxplot': '4.4.5',
  'chart.js': '4.5.1',
  'chartjs-plugin-annotation': '3.1.0',
  'chartjs-plugin-datalabels': '2.2.0',
  'chartjs-plugin-zoom': '2.2.0',
  dompurify: '3.4.14',
  katex: '0.18.6',
  mammoth: '1.12.2',
  marked: '18.0.11',
  'pdfjs-dist': '6.3.289',
});

const CURRENT_CHART_PACKAGE_PEER_RANGES = Object.freeze({
  '@sgratzl/chartjs-chart-boxplot': '^4.1.1',
  'chartjs-plugin-annotation': '>=4.0.0',
  'chartjs-plugin-datalabels': '>=3.0.0',
  'chartjs-plugin-zoom': '>=3.2.0',
});

const REVIEWED_CHART_PACKAGE_PEER_RANGES = Object.freeze({
  '@sgratzl/chartjs-chart-boxplot': Object.freeze({
    '4.0.0': '^4.0.1',
    '4.4.5': '^4.1.1',
  }),
  'chartjs-plugin-annotation': Object.freeze({
    '3.0.0': '>=4.0.0',
    '3.1.0': '>=4.0.0',
  }),
  'chartjs-plugin-datalabels': Object.freeze({ '2.2.0': '>=3.0.0' }),
  'chartjs-plugin-zoom': Object.freeze({
    '2.0.0': '>=3.2.0',
    '2.2.0': '>=3.2.0',
  }),
});

const PROFILE_FLOOR_PEERS = Object.freeze({
  'chart-floor': [
    '@sgratzl/chartjs-chart-boxplot',
    'chart.js',
    'chartjs-plugin-annotation',
    'chartjs-plugin-datalabels',
    'chartjs-plugin-zoom',
  ],
  'markdown-math-floor': ['dompurify', 'katex', 'marked'],
  'docx-floor': ['dompurify', 'mammoth', 'pdfjs-dist'],
  'current-all': [],
});

function authorityFixture() {
  return {
    schemaVersion: 1,
    packageName: '@aceshooting/lyra-ui',
    importer: 'packages/lyra-ui',
    managedPeerRanges: { ...MANAGED_PEER_RANGES },
    currentVersions: { ...CURRENT_VERSIONS },
    toolchain: {
      playwright: '1.63.0',
      typescript: '7.0.2',
      vite: '8.2.2',
    },
    packageManagers: {
      npm: '10.9.8',
      pnpm: '12.3.4',
    },
    profiles: Object.entries(PROFILE_FLOOR_PEERS).map(([id, floorPeers]) => ({
      id,
      floorPeers: [...floorPeers],
    })),
  };
}

function packageManifestFixture(currentVersions = CURRENT_VERSIONS) {
  return {
    name: '@aceshooting/lyra-ui',
    peerDependencies: { ...MANAGED_PEER_RANGES },
    peerDependenciesMeta: Object.fromEntries(
      Object.keys(MANAGED_PEER_RANGES).map((name) => [name, { optional: true }]),
    ),
    devDependencies: Object.fromEntries(
      Object.entries(currentVersions).map(([name, version]) => [name, `^${version}`]),
    ),
  };
}

function quoteYamlKey(name) {
  return name.startsWith('@') ? `'${name.replaceAll("'", "''")}'` : name;
}

function peerLockResolution(name, version, versions) {
  return REVIEWED_CHART_PACKAGE_PEER_RANGES[name]
    ? `${version}(chart.js@${versions['chart.js']})`
    : version;
}

function peerIntegrity(name, version) {
  return `sha512-${createHash('sha512').update(`consumer:${name}@${version}`).digest('base64')}`;
}

function npmRegistryTarballUrl(name, version) {
  return `https://registry.npmjs.org/${name}/-/${name.slice(name.lastIndexOf('/') + 1)}-${version}.tgz`;
}

function lockfileFixture(currentVersions = CURRENT_VERSIONS, specifiers = {}) {
  const rows = Object.entries(currentVersions).flatMap(([name, version]) => [
    `      ${quoteYamlKey(name)}:`,
    `        specifier: ${specifiers[name] ?? `^${version}`}`,
    `        version: ${version}${name.startsWith('chartjs-plugin-') || name.startsWith('@sgratzl/') ? `(chart.js@${currentVersions['chart.js']})` : ''}`,
  ]);
  const packageRows = Object.entries(currentVersions).flatMap(([name, version]) => {
    const rows = [
      `  ${quoteYamlKey(`${name}@${version}`)}:`,
      `    resolution: {integrity: sha512-${createHash('sha512').update(`${name}@${version}`).digest('base64')}}`,
    ];
    const chartPeerRange = CURRENT_CHART_PACKAGE_PEER_RANGES[name];
    if (chartPeerRange) {
      rows.push(
        '    peerDependencies:',
        `      chart.js: ${chartPeerRange.startsWith('>=') ? `'${chartPeerRange}'` : chartPeerRange}`,
      );
    }
    return rows;
  });
  const snapshotRows = Object.entries(currentVersions).flatMap(([name, version]) => {
    const context =
      name.startsWith('chartjs-plugin-') || name.startsWith('@sgratzl/')
        ? `(chart.js@${currentVersions['chart.js']})`
        : '';
    const key = `  ${quoteYamlKey(`${name}@${version}${context}`)}:`;
    return context
      ? [key, '    dependencies:', `      chart.js: ${currentVersions['chart.js']}`]
      : [`${key} {}`];
  });
  return [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '',
    '  packages/lyra-ui:',
    '    devDependencies:',
    ...rows,
    '',
    'packages:',
    ...packageRows,
    '',
    'snapshots:',
    ...snapshotRows,
    '',
  ].join('\n');
}

function environmentLockfileFixture() {
  return [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '  .:',
    '    configDependencies: {}',
    '    packageManagerDependencies:',
    '      pnpm:',
    '        specifier: 12.3.4',
    '        version: 12.3.4',
    '',
    'packages:',
    '  pnpm@12.3.4:',
    `    resolution: {integrity: ${peerIntegrity('pnpm', '12.3.4')}}`,
    '',
    'snapshots:',
    '  pnpm@12.3.4: {}',
    '',
  ].join('\n');
}

function splitLockfileFixture(workspaceLock, environmentLock = environmentLockfileFixture()) {
  return `---\n${environmentLock}\n---\n${workspaceLock}`;
}

function writeTarString(header, offset, length, value) {
  const encoded = Buffer.from(value, 'utf8');
  assert.ok(encoded.length <= length, `tar fixture field exceeds ${length} bytes: ${value}`);
  encoded.copy(header, offset);
}

function writeTarOctal(header, offset, length, value) {
  const encoded = value.toString(8).padStart(length - 1, '0');
  writeTarString(header, offset, length, `${encoded}\0`);
}

function tarGzip(entries) {
  const chunks = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '');
    const header = Buffer.alloc(512);
    writeTarString(header, 0, 100, entry.name);
    writeTarOctal(header, 100, 8, entry.mode ?? (entry.type === '5' ? 0o755 : 0o644));
    writeTarOctal(header, 108, 8, 0);
    writeTarOctal(header, 116, 8, 0);
    writeTarOctal(header, 124, 12, entry.declaredSize ?? body.length);
    writeTarOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = (entry.type ?? '0').charCodeAt(0);
    writeTarString(header, 157, 100, entry.linkname ?? '');
    writeTarString(header, 257, 6, 'ustar\0');
    writeTarString(header, 263, 2, '00');
    writeTarString(header, 345, 155, entry.prefix ?? '');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeTarString(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
    chunks.push(header, body);
    if (body.length % 512 !== 0) chunks.push(Buffer.alloc(512 - (body.length % 512)));
  }
  chunks.push(Buffer.alloc(1_024));
  return gzipSync(Buffer.concat(chunks), { mtime: 0 });
}

function refreshTarChecksum(header) {
  header.fill(0x20, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.fill(0, 148, 156);
  writeTarString(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
}

function mutateTarball(bytes, mutate) {
  const archive = gunzipSync(bytes);
  mutate(archive);
  return gzipSync(archive, { mtime: 0 });
}

function lyraTarball({ name = '@aceshooting/lyra-ui', version = '14.0.0', extraEntries = [] } = {}) {
  return tarGzip([
    { name: 'package/', type: '5' },
    {
      name: 'package/package.json',
      body: `${JSON.stringify({ name, version })}\n`,
    },
    { name: 'package/dist/lyra.js', body: 'export {};\n' },
    ...extraEntries,
  ]);
}

function validationFixture() {
  return {
    authority: authorityFixture(),
    packageManifest: packageManifestFixture(),
    lockfileText: lockfileFixture(),
  };
}

async function loadChecker() {
  return import('./check-peer-compatibility.mjs');
}

test('accepts the exact manifest, four-profile authority, dev bases, and current lock', async () => {
  const { validatePeerCompatibilityDocuments, resolvePeerProfiles } = await loadChecker();
  const fixture = validationFixture();

  const validated = validatePeerCompatibilityDocuments(fixture);
  const profiles = resolvePeerProfiles(validated.authority);

  assert.deepEqual(profiles.map(({ id }) => id), [
    'chart-floor',
    'markdown-math-floor',
    'docx-floor',
    'current-all',
  ]);
  assert.equal(profiles[0].versions['chart.js'], '4.0.1');
  assert.equal(profiles[0].versions['chartjs-plugin-zoom'], '2.0.0');
  assert.equal(profiles[1].versions.katex, '0.18.4');
  assert.equal(profiles[2].versions.mammoth, '1.12.1');
  assert.deepEqual(profiles[3].versions, CURRENT_VERSIONS);
  for (const profile of profiles) {
    assert.equal(profile.versions['chartjs-plugin-datalabels'], '2.2.0');
    assert.equal(profile.versions.dompurify, '3.4.14');
    assert.equal(profile.versions.marked, '18.0.11');
    assert.equal(profile.versions['pdfjs-dist'], '6.3.289');
  }
});

test('keeps the checked-in profile authority on the canonical fixture contract', async () => {
  const checkedIn = JSON.parse(
    await readFile(new URL('./peer-compatibility-profiles.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(checkedIn, authorityFixture());
});

test('rejects package-manifest drift and exact four-profile topology drift', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();

  const manifestDrift = validationFixture();
  manifestDrift.packageManifest.peerDependencies['chart.js'] = '^4.5.1';
  assert.throws(
    () => validatePeerCompatibilityDocuments(manifestDrift),
    /manifest peer range drift.*chart\.js.*\^4\.0\.1/u,
  );

  const profileDrift = validationFixture();
  profileDrift.authority.profiles[0].floorPeers = profileDrift.authority.profiles[0].floorPeers.filter(
    (name) => name !== 'chartjs-plugin-zoom',
  );
  assert.throws(
    () => validatePeerCompatibilityDocuments(profileDrift),
    /profile topology drift.*chart-floor/u,
  );

  const extraAuthorityField = validationFixture();
  extraAuthorityField.authority.unreviewed = true;
  assert.throws(
    () => validatePeerCompatibilityDocuments(extraAuthorityField),
    /authority top-level keys drifted/iu,
  );

  const extraProfileField = validationFixture();
  extraProfileField.authority.profiles[0].unreviewed = true;
  assert.throws(
    () => validatePeerCompatibilityDocuments(extraProfileField),
    /profile topology drift.*unexpected fields/iu,
  );
});

test('rejects every resolved profile pin below its managed peer floor', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();
  const fixture = validationFixture();
  fixture.authority.currentVersions.katex = '0.17.9';
  fixture.packageManifest = packageManifestFixture(fixture.authority.currentVersions);
  fixture.lockfileText = lockfileFixture(fixture.authority.currentVersions);

  assert.throws(
    () => validatePeerCompatibilityDocuments(fixture),
    /profile pin below managed floor.*chart-floor.*katex.*0\.18\.4/u,
  );
});

test('rejects a dev-range base that no longer names the current profile pin', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();
  const fixture = validationFixture();
  fixture.packageManifest.devDependencies['chart.js'] = '^4.5.0';
  fixture.lockfileText = lockfileFixture(CURRENT_VERSIONS, { 'chart.js': '^4.5.0' });

  assert.throws(
    () => validatePeerCompatibilityDocuments(fixture),
    /dev-range base mismatch.*chart\.js.*4\.5\.1/u,
  );
});

test('rejects a current-profile pin that does not match the package importer lock resolution', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();
  const fixture = validationFixture();
  fixture.lockfileText = fixture.lockfileText.replace(
    '        version: 1.12.2\n',
    '        version: 1.12.1\n',
  );

  assert.throws(
    () => validatePeerCompatibilityDocuments(fixture),
    /current lock mismatch.*mammoth.*1\.12\.2.*1\.12\.1/u,
  );

  const peerContextDrift = validationFixture();
  peerContextDrift.lockfileText = peerContextDrift.lockfileText.replace(
    '        version: 2.2.0(chart.js@4.5.1)\n',
    '        version: 2.2.0(chart.js@4.4.7)\n',
  );
  assert.throws(
    () => validatePeerCompatibilityDocuments(peerContextDrift),
    /current lock mismatch.*chartjs-plugin-datalabels.*chart\.js@4\.5\.1.*chart\.js@4\.4\.7/u,
  );
});

test('rejects authority-managed peer-floor rewrites while permitting dev-pin updates', async () => {
  const { assertNoManagedPeerRangeRewrites } = await loadChecker();
  const authority = authorityFixture();
  const before = packageManifestFixture();
  const devOnlyUpdate = structuredClone(before);
  devOnlyUpdate.devDependencies['chart.js'] = '^4.6.0';
  assert.doesNotThrow(() =>
    assertNoManagedPeerRangeRewrites({ authority, beforeManifest: before, afterManifest: devOnlyUpdate }),
  );

  const peerRewrite = structuredClone(devOnlyUpdate);
  peerRewrite.peerDependencies['chart.js'] = '^4.6.0';
  assert.throws(
    () =>
      assertNoManagedPeerRangeRewrites({
        authority,
        beforeManifest: before,
        afterManifest: peerRewrite,
      }),
    /authority-managed peer range rewrite.*chart\.js.*\^4\.0\.1.*\^4\.6\.0/u,
  );
});

test('synchronizes reviewed current pins from dev bases and lock without moving peer floors', async () => {
  const { resolvePeerProfiles, synchronizeAuthorityCurrentVersions } = await loadChecker();
  const authority = authorityFixture();
  const updatedVersions = { ...CURRENT_VERSIONS, 'chart.js': '4.6.0' };
  const packageManifest = packageManifestFixture(updatedVersions);
  const lockfileText = lockfileFixture(updatedVersions);

  const synchronized = synchronizeAuthorityCurrentVersions({
    authority,
    packageManifest,
    lockfileText,
  });

  assert.deepEqual(authority, authorityFixture(), 'the input authority remains immutable');
  assert.deepEqual(synchronized.managedPeerRanges, MANAGED_PEER_RANGES);
  assert.equal(synchronized.currentVersions['chart.js'], '4.6.0');
  const profiles = resolvePeerProfiles(synchronized);
  assert.equal(profiles[0].versions['chart.js'], '4.0.1');
  assert.equal(profiles[1].versions['chart.js'], '4.6.0');
  assert.equal(profiles[3].versions['chart.js'], '4.6.0');
});

test('reads workspace peer versions from single-document and split pnpm lockfiles', async () => {
  const { synchronizeAuthorityCurrentVersions, validatePeerCompatibilityDocuments } = await loadChecker();
  const updatedVersions = { ...CURRENT_VERSIONS, 'chart.js': '4.6.0' };
  const workspaceLock = lockfileFixture(updatedVersions);
  const forms = [
    workspaceLock,
    `---\n${workspaceLock}`,
    splitLockfileFixture(workspaceLock),
    `${environmentLockfileFixture()}---\n${workspaceLock}`,
  ];
  for (const form of forms) {
    for (const newline of ['\n', '\r\n']) {
      const lockfileText = `# pnpm lockfile\n\n${form}`.replaceAll('\n', newline);
      const packageManifest = packageManifestFixture(updatedVersions);
      const authority = synchronizeAuthorityCurrentVersions({
        authority: authorityFixture(),
        packageManifest,
        lockfileText,
      });
      assert.deepEqual(authority.currentVersions, updatedVersions);
      assert.doesNotThrow(() =>
        validatePeerCompatibilityDocuments({ authority, packageManifest, lockfileText }),
      );
    }
  }
});

test('rejects ambiguous documents and duplicate sections in split pnpm lockfiles', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();
  const fixture = validationFixture();
  const workspaceLock = fixture.lockfileText;
  const environmentLock = environmentLockfileFixture();
  const hostileLocks = [
    ['two workspace documents', splitLockfileFixture(workspaceLock, workspaceLock)],
    ['reversed documents', splitLockfileFixture(environmentLock, workspaceLock)],
    ['third document', `${splitLockfileFixture(workspaceLock)}---\n${workspaceLock}`],
    ['empty first document', `---\n# empty\n---\n${workspaceLock}`],
    ['empty final document', `${splitLockfileFixture(workspaceLock)}---\n`],
    ['indented marker', `  ---\n${workspaceLock}`],
    ['document end marker', `${splitLockfileFixture(workspaceLock)}...\n`],
    ['duplicate workspace section', splitLockfileFixture(`${workspaceLock}\nimporters:\n`)],
    ['duplicate environment section', splitLockfileFixture(workspaceLock, `${environmentLock}\nimporters:\n`)],
    ['workspace dependencies in environment', splitLockfileFixture(
      workspaceLock,
      environmentLock.replace('packageManagerDependencies:', 'devDependencies:'),
    )],
    ['extra environment importer', splitLockfileFixture(
      workspaceLock,
      environmentLock.replace('packages:\n', '  packages/other: {}\n\npackages:\n'),
    )],
    ['unsupported environment version', splitLockfileFixture(
      workspaceLock,
      environmentLock.replace("lockfileVersion: '9.0'", "lockfileVersion: '10.0'"),
    )],
  ];
  for (const [label, lockfileText] of hostileLocks) {
    assert.throws(
      () => validatePeerCompatibilityDocuments({ ...fixture, lockfileText }),
      /pnpm lockfile/iu,
      label,
    );
  }
});

test('never borrows workspace package or snapshot records from the pnpm environment document', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();
  const fixture = validationFixture();
  const workspaceLock = fixture.lockfileText;
  const chartPackage = `  chart.js@4.5.1:\n    resolution: {integrity: sha512-${createHash('sha512').update('chart.js@4.5.1').digest('base64')}}\n`;
  const chartSnapshot = '  chart.js@4.5.1: {}\n';
  const environmentLock = environmentLockfileFixture()
    .replace('packages:\n', `packages:\n${chartPackage}`)
    .replace('snapshots:\n', `snapshots:\n${chartSnapshot}`);
  assert.doesNotThrow(() => validatePeerCompatibilityDocuments({
    ...fixture,
    lockfileText: splitLockfileFixture(workspaceLock, environmentLock),
  }));
  for (const record of [chartPackage, chartSnapshot]) {
    const incomplete = workspaceLock.replace(record, '');
    assert.notEqual(incomplete, workspaceLock);
    assert.throws(
      () => validatePeerCompatibilityDocuments({
        ...fixture,
        lockfileText: splitLockfileFixture(incomplete, environmentLock),
      }),
      /package|snapshot/iu,
    );
  }
});

test('rejects authority current-version downgrades even when the managed floor still permits them', async () => {
  const { synchronizeAuthorityCurrentVersions } = await loadChecker();
  const downgraded = { ...CURRENT_VERSIONS, 'chart.js': '4.4.9' };
  assert.throws(
    () => synchronizeAuthorityCurrentVersions({
      authority: authorityFixture(),
      packageManifest: packageManifestFixture(downgraded),
      lockfileText: lockfileFixture(downgraded),
    }),
    /current-version downgrade.*chart\.js.*4\.5\.1.*4\.4\.9/iu,
  );
});

test('strict lock parsing rejects duplicate authorities and requires referenced snapshots and integrity', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();

  const duplicateImporter = validationFixture();
  duplicateImporter.lockfileText = duplicateImporter.lockfileText.replace(
    '\npackages:\n',
    '\n  packages/lyra-ui:\n    devDependencies: {}\n\npackages:\n',
  );
  assert.throws(
    () => validatePeerCompatibilityDocuments(duplicateImporter),
    /duplicate.*packages\/lyra-ui importer/iu,
  );

  const duplicateDependency = validationFixture();
  duplicateDependency.lockfileText = duplicateDependency.lockfileText.replace(
    '      chart.js:\n',
    "      chart.js:\n        specifier: ^4.5.1\n        version: 4.5.1\n      'chart.js':\n",
  );
  assert.throws(
    () => validatePeerCompatibilityDocuments(duplicateDependency),
    /duplicate.*chart\.js.*devDependencies/iu,
  );

  const missingSnapshot = validationFixture();
  missingSnapshot.lockfileText = missingSnapshot.lockfileText.replace(
    '  chart.js@4.5.1: {}\n',
    '',
  );
  assert.throws(
    () => validatePeerCompatibilityDocuments(missingSnapshot),
    /snapshot.*chart\.js@4\.5\.1.*missing/iu,
  );

  const contextMismatch = validationFixture();
  contextMismatch.lockfileText = contextMismatch.lockfileText.replace(
    '  chartjs-plugin-zoom@2.2.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n',
    '  chartjs-plugin-zoom@2.2.0(chart.js@4.4.7):\n    dependencies:\n      chart.js: 4.4.7\n',
  );
  assert.throws(
    () => validatePeerCompatibilityDocuments(contextMismatch),
    /snapshot.*chartjs-plugin-zoom.*chart\.js@4\.5\.1.*missing/iu,
  );

  const missingIntegrity = validationFixture();
  missingIntegrity.lockfileText = missingIntegrity.lockfileText.replace(
    /    resolution: \{integrity: sha512-[^}]+\}\n/u,
    '    resolution: {}\n',
  );
  assert.throws(
    () => validatePeerCompatibilityDocuments(missingIntegrity),
    /package resolution.*integrity/iu,
  );
});

test('strict lock v9 parsing rejects hidden structure and binds exact snapshot peer context', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();
  const fixture = validationFixture();
  const chartIntegrity = createHash('sha512').update('chart.js@4.5.1').digest('base64');
  const mutations = [
    [
      'quoted top-level lock version authority',
      fixture.lockfileText.replace("lockfileVersion: '9.0'", "'lockfileVersion': '9.0'"),
    ],
    [
      'noncanonical unquoted top-level lock version',
      fixture.lockfileText.replace("lockfileVersion: '9.0'", 'lockfileVersion: 9.0'),
    ],
    [
      'sequence node hidden in the selected importer',
      fixture.lockfileText.replace(
        '      chart.js:\n',
        '      - hidden-authority\n      chart.js:\n',
      ),
    ],
    [
      'noncanonical quoted unscoped dependency',
      fixture.lockfileText.replace('      chart.js:\n', "      'chart.js':\n"),
    ],
    [
      'unexpected nested importer authority',
      fixture.lockfileText.replace(
        '        version: 4.5.1\n',
        '        version: 4.5.1\n        hidden:\n          version: 99.0.0\n',
      ),
    ],
    [
      'quoted fake nested integrity',
      fixture.lockfileText.replace(
        `    resolution: {integrity: sha512-${chartIntegrity}}\n`,
        `    resolution:\n      metadata:\n        'integrity': sha512-${chartIntegrity}\n`,
      ),
    ],
    [
      'duplicate snapshot dependency authority',
      fixture.lockfileText.replace(
        '  chartjs-plugin-zoom@2.2.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n',
        '  chartjs-plugin-zoom@2.2.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n      chart.js: 4.5.1\n',
      ),
    ],
    [
      'empty snapshot peer dependency',
      fixture.lockfileText.replace(
        '  chartjs-plugin-annotation@3.1.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n',
        '  chartjs-plugin-annotation@3.1.0(chart.js@4.5.1):\n    dependencies:\n      chart.js:\n',
      ),
    ],
    [
      'wrong snapshot peer dependency',
      fixture.lockfileText.replace(
        '  chartjs-plugin-datalabels@2.2.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n',
        '  chartjs-plugin-datalabels@2.2.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.4.7\n',
      ),
    ],
    [
      'quoted structural key',
      fixture.lockfileText.replace('    devDependencies:\n', "    'devDependencies':\n"),
    ],
    [
      'quoted and unquoted duplicate dependency aliases',
      fixture.lockfileText.replace(
        '      chart.js:\n',
        "      chart.js:\n        specifier: ^4.5.1\n        version: 4.5.1\n      'chart.js':\n",
      ),
    ],
    [
      'nested rather than direct resolution integrity',
      fixture.lockfileText.replace(
        `    resolution: {integrity: sha512-${chartIntegrity}}\n`,
        `    resolution:\n      integrity: sha512-${chartIntegrity}\n`,
      ),
    ],
    [
      'extra flow resolution authority',
      fixture.lockfileText.replace(
        `    resolution: {integrity: sha512-${chartIntegrity}}\n`,
        `    resolution: {integrity: sha512-${chartIntegrity}, tarball: https://example.invalid/chart.tgz}\n`,
      ),
    ],
    [
      'quoted integrity scalar authority',
      fixture.lockfileText.replace(
        `    resolution: {integrity: sha512-${chartIntegrity}}\n`,
        `    resolution: {integrity: 'sha512-${chartIntegrity}'}\n`,
      ),
    ],
    [
      'missing exact snapshot peer edge',
      fixture.lockfileText.replace(
        '  chartjs-plugin-annotation@3.1.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n',
        '  chartjs-plugin-annotation@3.1.0(chart.js@4.5.1): {}\n',
      ),
    ],
    [
      'snapshot peer edge hidden under another map',
      fixture.lockfileText.replace(
        '  chartjs-plugin-datalabels@2.2.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n',
        '  chartjs-plugin-datalabels@2.2.0(chart.js@4.5.1):\n    optionalDependencies:\n      chart.js: 4.5.1\n',
      ),
    ],
  ];
  for (const [label, lockfileText] of mutations) {
    assert.throws(
      () => validatePeerCompatibilityDocuments({ ...fixture, lockfileText }),
      /pnpm lockfile|snapshot|integrity|structure|canonical/iu,
      label,
    );
  }
});

test('strict lock v9 validation binds exact package-level chart peer metadata', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();
  const fixture = validationFixture();
  for (const [name, expectedRange] of Object.entries(CURRENT_CHART_PACKAGE_PEER_RANGES)) {
    const renderedRange = expectedRange.startsWith('>=') ? `'${expectedRange}'` : expectedRange;
    const packageKey = quoteYamlKey(`${name}@${CURRENT_VERSIONS[name]}`);
    const packageStart = `  ${packageKey}:\n`;
    const start = fixture.lockfileText.indexOf(packageStart);
    assert.ok(start >= 0, `fixture is missing package metadata for ${name}`);
    const followingPackage = /\n  (?=\S)/gu;
    followingPackage.lastIndex = start + packageStart.length;
    const end = followingPackage.exec(fixture.lockfileText)?.index ?? fixture.lockfileText.indexOf('\nsnapshots:', start);
    const packageBlock = fixture.lockfileText.slice(start, end);
    const mutatedBlock = packageBlock.replace(
      `      chart.js: ${renderedRange}`,
      '      chart.js: nope',
    );
    assert.notEqual(mutatedBlock, packageBlock, `fixture mutation must reach ${name}`);
    assert.throws(
      () => validatePeerCompatibilityDocuments({
        ...fixture,
        lockfileText: `${fixture.lockfileText.slice(0, start)}${mutatedBlock}${fixture.lockfileText.slice(end)}`,
      }),
      /package.*peerDependencies.*chart\.js|package.*chart\.js.*peer/iu,
      `${name} package-level chart.js range must be exact`,
    );
  }

  const duplicatePeer = fixture.lockfileText.replace(
    "      chart.js: '>=3.0.0'\n",
    "      chart.js: '>=3.0.0'\n      'chart.js': '>=3.0.0'\n",
  );
  assert.throws(
    () => validatePeerCompatibilityDocuments({ ...fixture, lockfileText: duplicatePeer }),
    /duplicate.*chart\.js.*peerDependencies|package.*peerDependencies/iu,
  );
});

test('strict lock v9 parser accepts the real canonical lock shape and rejects alias collisions', async () => {
  const { validatePeerCompatibilityDocuments } = await loadChecker();
  const authority = authorityFixture();
  const liveManifest = JSON.parse(
    await readFile(new URL('../packages/lyra-ui/package.json', import.meta.url), 'utf8'),
  );
  liveManifest.peerDependencies = { ...MANAGED_PEER_RANGES };
  liveManifest.peerDependenciesMeta = Object.fromEntries(
    Object.keys(MANAGED_PEER_RANGES).map((name) => [name, { optional: true }]),
  );
  const liveLockfileText = await readFile(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
  assert.doesNotThrow(() =>
    validatePeerCompatibilityDocuments({
      authority,
      packageManifest: liveManifest,
      lockfileText: liveLockfileText,
    }),
  );

  const fixture = validationFixture();
  const chartIntegrity = createHash('sha512').update('chart.js@4.5.1').digest('base64');
  const hostileLocks = [
    fixture.lockfileText.replace(
      '        version: 4.5.1\n',
      "        version: 4.5.1\n        'version': 4.5.1\n",
    ),
    fixture.lockfileText.replace(
      `    resolution: {integrity: sha512-${chartIntegrity}}\n`,
      `    resolution: {integrity: sha512-${chartIntegrity}, 'integrity': sha512-${chartIntegrity}}\n`,
    ),
    fixture.lockfileText.replace(
      '  chartjs-plugin-zoom@2.2.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n',
      "  chartjs-plugin-zoom@2.2.0(chart.js@4.5.1):\n    dependencies:\n      chart.js: 4.5.1\n      'chart.js': 4.5.1\n",
    ),
    fixture.lockfileText.replace(
      '  chart.js@4.5.1:\n',
      "  chart.js@4.5.1:\n    resolution: {integrity: sha512-" + chartIntegrity + "}\n  'chart.js@4.5.1':\n",
    ),
  ];
  for (const lockfileText of hostileLocks) {
    assert.throws(
      () => validatePeerCompatibilityDocuments({ ...fixture, lockfileText }),
      /duplicate|collision|canonical|structure/iu,
    );
  }
});

test('validates tar structure and exact package identity before staging immutable bound bytes', async () => {
  const {
    assertStagedTarballIntegrity,
    inspectPeerTarballArchive,
    stagePeerTarball,
  } = await loadChecker();
  const expectedPackage = { name: '@aceshooting/lyra-ui', version: '14.0.0' };
  const safeBytes = lyraTarball();
  const inspected = inspectPeerTarballArchive(safeBytes, { expectedPackage });
  assert.equal(inspected.name, expectedPackage.name);
  assert.equal(inspected.version, expectedPackage.version);

  for (const identity of [
    { name: '@aceshooting/not-lyra-ui', version: '14.0.0' },
    { name: '@aceshooting/lyra-ui', version: '13.0.1' },
  ]) {
    assert.throws(
      () => inspectPeerTarballArchive(lyraTarball(identity), { expectedPackage }),
      /tarball package (?:name|version).*expected/iu,
    );
  }

  for (const unsafe of [
    { name: 'package/../escape.js', body: 'bad' },
    { name: '/absolute.js', body: 'bad' },
    { name: 'package/link', type: '2', linkname: '../../outside' },
    { name: 'package/hard-link', type: '1', linkname: 'package/package.json' },
    { name: 'package/device', type: '3' },
  ]) {
    assert.throws(
      () => inspectPeerTarballArchive(lyraTarball({ extraEntries: [unsafe] }), { expectedPackage }),
      /unsafe tar|archive entry type|link/iu,
      JSON.stringify(unsafe),
    );
  }
  assert.throws(
    () => inspectPeerTarballArchive(
      lyraTarball({ extraEntries: [{ name: 'package/oversized.bin', declaredSize: 129 }] }),
      { expectedPackage, limits: { maxEntryBytes: 128 } },
    ),
    /archive entry.*size limit/iu,
  );

  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-tarball-security-'));
  try {
    const sourcePath = join(root, 'supplied.tgz');
    const workspace = join(root, 'workspace');
    await mkdir(workspace);
    await writeFile(sourcePath, safeBytes);
    const staged = await stagePeerTarball({ sourcePath, workspace, expectedPackage });
    const stagedRelative = relative(workspace, staged.path);
    assert.equal(stagedRelative.startsWith('..') || isAbsolute(stagedRelative), false);
    assert.equal(staged.sha256, createHash('sha256').update(safeBytes).digest('hex'));
    await assertStagedTarballIntegrity(staged);

    await writeFile(sourcePath, lyraTarball({ name: '@aceshooting/replaced' }));
    await assertStagedTarballIntegrity(staged);
    assert.deepEqual(await readFile(staged.path), safeBytes);

    await rm(staged.path);
    await writeFile(staged.path, lyraTarball({ version: '99.0.0' }));
    await assert.rejects(
      assertStagedTarballIntegrity(staged),
      /staged tarball (?:SHA-256 mismatch|changed identity|inode)/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('accepts omitted portable tar ownership while rejecting malformed ownership numbers', async () => {
  const { inspectPeerTarballArchive } = await loadChecker();
  const expectedPackage = { name: '@aceshooting/lyra-ui', version: '14.0.0' };
  const tarball = lyraTarball();
  const expectedContent = inspectPeerTarballArchive(tarball, { expectedPackage }).contentSha256;
  for (const blank of [0, 0x20]) {
    const portable = mutateTarball(tarball, (archive) => {
      archive.fill(blank, 108, 124);
      refreshTarChecksum(archive.subarray(0, 512));
    });
    assert.equal(inspectPeerTarballArchive(portable, { expectedPackage }).contentSha256, expectedContent);
  }
  for (const offset of [108, 116]) {
    for (const invalid of [Buffer.from('0000008\0'), Buffer.from([0x80, 0, 0, 0, 0, 0, 0, 1]), Buffer.from('0\0hidden')]) {
      const malformed = mutateTarball(tarball, (archive) => {
        invalid.copy(archive, offset);
        refreshTarChecksum(archive.subarray(0, 512));
      });
      assert.throws(
        () => inspectPeerTarballArchive(malformed, { expectedPackage }),
        /(?:uid|gid).*tar octal/iu,
      );
    }
  }
});

test('rejects portable tar ambiguities, collisions, malformed boundaries, and header tricks', async () => {
  const { inspectPeerTarballArchive } = await loadChecker();
  const expectedPackage = { name: '@aceshooting/lyra-ui', version: '14.0.0' };
  const safeEntries = [
    { name: 'package/', type: '5' },
    { name: 'package.json', prefix: 'package', body: '{"name":"@aceshooting/lyra-ui","version":"14.0.0"}\n' },
    { name: 'long.js', prefix: 'package/dist', body: 'export {};\n' },
  ];
  assert.equal(inspectPeerTarballArchive(tarGzip(safeEntries), { expectedPackage }).entries, 3);

  const collisionCorpora = [
    [{ name: 'package/dist/a.js', body: 'a' }, { name: 'package/dist/a.js', body: 'b' }],
    [{ name: 'package/dist/A.js', body: 'a' }, { name: 'package/dist/a.js', body: 'b' }],
    [{ name: 'package/dist/caf\u00e9.js', body: 'a' }, { name: 'package/dist/cafe\u0301.js', body: 'b' }],
    [{ name: 'package/dist/file', body: 'a' }, { name: 'package/dist/file/child.js', body: 'b' }],
    [{ name: 'package/dist/file/child.js', body: 'a' }, { name: 'package/dist/file', body: 'b' }],
    [{ name: 'package/dist/name.', body: 'a' }],
    [{ name: 'package/dist/name ', body: 'a' }],
    [{ name: 'package/CON', body: 'a' }],
    [{ name: 'package/PRN.txt', body: 'a' }],
    [{ name: 'package/dist/back\\slash.js', body: 'a' }],
    [{ name: 'package/dist/a:b.js', body: 'a' }],
    [{ name: 'package/dist/control\u0001.js', body: 'a' }],
    [{ name: 'package/dist/setuid.js', body: 'a', mode: 0o4755 }],
  ];
  for (const extraEntries of collisionCorpora) {
    assert.throws(
      () => inspectPeerTarballArchive(lyraTarball({ extraEntries }), { expectedPackage }),
      /tar|archive|unsafe|duplicate|collision|portable/iu,
      JSON.stringify(extraEntries),
    );
  }

  const malformedArchives = [
    mutateTarball(lyraTarball(), (archive) => {
      archive[257] = 'x'.charCodeAt(0);
      refreshTarChecksum(archive.subarray(0, 512));
    }),
    mutateTarball(lyraTarball(), (archive) => {
      archive[263] = '9'.charCodeAt(0);
      refreshTarChecksum(archive.subarray(0, 512));
    }),
    mutateTarball(lyraTarball(), (archive) => {
      archive[1] = 0;
      archive[2] = 'x'.charCodeAt(0);
      refreshTarChecksum(archive.subarray(0, 512));
    }),
    mutateTarball(lyraTarball(), (archive) => {
      archive[106] = 0;
      archive[107] = '7'.charCodeAt(0);
      refreshTarChecksum(archive.subarray(0, 512));
    }),
    mutateTarball(lyraTarball(), (archive) => {
      archive[500] = 1;
      refreshTarChecksum(archive.subarray(0, 512));
    }),
    mutateTarball(lyraTarball(), (archive) => {
      archive[1024 + Buffer.byteLength('{"name":"@aceshooting/lyra-ui","version":"14.0.0"}\n')] = 1;
    }),
    mutateTarball(lyraTarball(), (archive) => {
      archive[148] = archive[148] === 48 ? 49 : 48;
    }),
    gzipSync(gunzipSync(lyraTarball()).subarray(0, -512), { mtime: 0 }),
    gzipSync(Buffer.concat([gunzipSync(lyraTarball()), Buffer.alloc(1)]), { mtime: 0 }),
    mutateTarball(lyraTarball(), (archive) => {
      archive[archive.length - 1] = 1;
    }),
  ];
  for (const bytes of malformedArchives) {
    assert.throws(
      () => inspectPeerTarballArchive(bytes, { expectedPackage }),
      /tar|archive|header|padding|marker|checksum|boundary|ustar/iu,
    );
  }

  assert.throws(
    () => inspectPeerTarballArchive(
      lyraTarball({ extraEntries: [{ name: 'package/truncated.bin', body: '', declaredSize: 100 }] }),
      { expectedPackage, limits: { maxEntryBytes: 100 } },
    ),
    /boundary|padding|entry|marker/iu,
  );
});

test('binds package-manager transport to private tar bytes across path swaps and verifies installed content', async () => {
  const {
    assertStagedTarballIntegrity,
    stagePeerTarball,
    verifyInstalledPeerInstallation,
    withPeerTarballServer,
  } = await loadChecker();
  const expectedPackage = { name: '@aceshooting/lyra-ui', version: '14.0.0' };
  const safeBytes = lyraTarball();
  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-bound-transport-'));
  try {
    const sourcePath = join(root, 'source.tgz');
    const workspace = join(root, 'workspace');
    await mkdir(workspace);
    await writeFile(sourcePath, safeBytes);

    const staged = await stagePeerTarball({ sourcePath, workspace, expectedPackage });
    const displaced = `${staged.path}.displaced`;
    await rename(staged.path, displaced);
    await writeFile(
      sourcePath,
      lyraTarball({ extraEntries: [{ name: 'package/injected.js', body: 'export const injected = true;\n' }] }),
    );
    await symlink(sourcePath, staged.path);
    await assert.rejects(assertStagedTarballIntegrity(staged), /regular file|symbolic link/iu);

    await withPeerTarballServer(staged, async (transport) => {
      const pnpmUrl = transport.specifierFor('chart-floor/pnpm');
      assert.ok(pnpmUrl.includes(staged.sha256));
      assert.throws(
        () => transport.assertConsumed('chart-floor/pnpm'),
        /not consumed by a completed GET/iu,
      );
      const head = await fetch(pnpmUrl, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get('content-length'), String(safeBytes.length));
      assert.equal(
        head.headers.get('digest'),
        `sha-256=${Buffer.from(staged.sha256, 'hex').toString('base64')}`,
      );
      assert.equal(head.headers.get('etag'), `"sha256-${staged.sha256}"`);
      const response = await fetch(pnpmUrl);
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), safeBytes);
      transport.assertConsumed('chart-floor/pnpm');
      assert.equal((await fetch(new URL('/unregistered.tgz', pnpmUrl))).status, 404);
      assert.equal((await fetch(`${pnpmUrl}?untrusted=1`)).status, 404);
      assert.equal((await fetch(pnpmUrl, { headers: { range: 'bytes=0-1' } })).status, 416);
      assert.equal((await fetch(pnpmUrl, { method: 'POST' })).status, 405);
    });

    const installedRoot = join(root, 'installed', '@aceshooting', 'lyra-ui');
    await mkdir(join(installedRoot, 'dist'), { recursive: true });
    await writeFile(
      join(installedRoot, 'package.json'),
      '{"name":"@aceshooting/lyra-ui","version":"14.0.0"}\n',
    );
    await writeFile(join(installedRoot, 'dist', 'lyra.js'), 'export {};\n');
    await verifyInstalledPeerInstallation(installedRoot, staged);
    // pnpm materializes bin shims for the package's own `bin` and its peers inside the installed
    // package directory (`<pkg>/node_modules/.bin/*`). That is package-manager bookkeeping, never
    // published content, so it must not fail the inventory comparison.
    const shimDirectory = join(installedRoot, 'node_modules', '.bin');
    await mkdir(shimDirectory, { recursive: true });
    await writeFile(join(shimDirectory, 'lyra-ui-migrate'), '#!/bin/sh\nexit 0\n');
    await verifyInstalledPeerInstallation(installedRoot, staged);
    await rm(join(installedRoot, 'node_modules'), { recursive: true });
    await writeFile(join(installedRoot, 'dist', 'lyra.js'), 'export const swapped = true;\n');
    await assert.rejects(
      verifyInstalledPeerInstallation(installedRoot, staged),
      /installed.*content.*digest|file inventory/iu,
    );
    await rm(join(installedRoot, 'dist', 'lyra.js'));
    await symlink(join(installedRoot, 'package.json'), join(installedRoot, 'dist', 'lyra.js'));
    await assert.rejects(
      verifyInstalledPeerInstallation(installedRoot, staged),
      /internal symbolic link/iu,
    );

    const raceSource = join(root, 'race.tgz');
    const raceBackup = join(root, 'race-original.tgz');
    await writeFile(raceSource, safeBytes);
    await assert.rejects(
      stagePeerTarball(
        { sourcePath: raceSource, workspace, expectedPackage },
        {
          openImpl: async (...args) => {
            await rename(raceSource, raceBackup);
            await writeFile(raceSource, Buffer.alloc(safeBytes.length));
            return open(...args);
          },
        },
      ),
      /changed|identity|inode/iu,
    );

    const symlinkSource = join(root, 'symlink.tgz');
    await symlink(sourcePath, symlinkSource);
    await assert.rejects(
      stagePeerTarball({ sourcePath: symlinkSource, workspace, expectedPackage }),
      /regular.*tgz|symbolic link/iu,
    );
    assert.equal((await lstat(symlinkSource)).isSymbolicLink(), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('binds npm and pnpm consumer locks to the exact loopback URL and SHA-512 tar bytes', async () => {
  const {
    verifyConsumerTarballLock,
    verifyPnpmConsumerTarballLock,
  } = await loadChecker();
  const bytes = lyraTarball();
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const tarballUrl = `http://127.0.0.1:43123/lyra-00000000-0000-4000-8000-000000000000-${sha256}.tgz`;
  const staged = {
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    version: '14.0.0',
  };
  const packageKey = `@aceshooting/lyra-ui@${tarballUrl}`;
  const pnpmLock = [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '  .:',
    '    dependencies:',
    "      '@aceshooting/lyra-ui':",
    `        specifier: ${tarballUrl}`,
    `        version: ${tarballUrl}`,
    '',
    'packages:',
    `  ${quoteYamlKey(packageKey)}:`,
    `    resolution: {integrity: ${staged.integrity}, tarball: ${tarballUrl}}`,
    `    version: ${staged.version}`,
    '',
    'snapshots:',
    `  ${quoteYamlKey(packageKey)}: {}`,
    '',
  ].join('\n');
  assert.doesNotThrow(() => verifyPnpmConsumerTarballLock(pnpmLock, tarballUrl, staged));
  for (const lockfileText of [`---\n${pnpmLock}`, splitLockfileFixture(pnpmLock)]) {
    assert.doesNotThrow(() => verifyPnpmConsumerTarballLock(lockfileText, tarballUrl, staged));
    assert.throws(
      () => verifyPnpmConsumerTarballLock(
        lockfileText.replace(staged.integrity, peerIntegrity('wrong', '1.0.0')),
        tarballUrl,
        staged,
      ),
      /integrity/iu,
    );
  }
  const profileVersions = { ...CURRENT_VERSIONS };
  const peerResolution = `${tarballUrl}${Object.entries(profileVersions)
    .map(([name, version]) => `(${name}@${peerLockResolution(name, version, profileVersions)})`)
    .join('')}`;
  const contextualSnapshotKey = `@aceshooting/lyra-ui@${peerResolution}`;
  const stagedWithManifest = {
    ...staged,
    packagePeerDependencies: {
      '@aceshooting/lyra-flags': '^2.3.0',
      ...MANAGED_PEER_RANGES,
    },
    packagePeerDependenciesMeta: Object.fromEntries(
      ['@aceshooting/lyra-flags', ...Object.keys(MANAGED_PEER_RANGES)]
        .map((name) => [name, { optional: true }]),
    ),
  };
  const peerImporterRows = Object.entries(profileVersions).flatMap(([name, version]) => [
    `      ${quoteYamlKey(name)}:`,
    `        specifier: ${version}`,
    `        version: ${peerLockResolution(name, version, profileVersions)}`,
  ]);
  const peerPackageRows = Object.entries(profileVersions).flatMap(([name, version]) => {
    const rows = [
      `  ${quoteYamlKey(`${name}@${version}`)}:`,
      `    resolution: {integrity: ${peerIntegrity(name, version)}}`,
    ];
    const chartPeerRange = REVIEWED_CHART_PACKAGE_PEER_RANGES[name]?.[version];
    if (chartPeerRange) {
      rows.push(
        '    peerDependencies:',
        `      chart.js: ${chartPeerRange.startsWith('>=') ? `'${chartPeerRange}'` : chartPeerRange}`,
      );
    }
    rows.push('');
    return rows;
  });
  const peerSnapshotRows = Object.entries(profileVersions).flatMap(([name, version]) => {
    const resolution = peerLockResolution(name, version, profileVersions);
    if (!REVIEWED_CHART_PACKAGE_PEER_RANGES[name]) {
      return [`  ${quoteYamlKey(`${name}@${resolution}`)}: {}`, ''];
    }
    return [
      `  ${quoteYamlKey(`${name}@${resolution}`)}:`,
      '    dependencies:',
      `      chart.js: ${profileVersions['chart.js']}`,
      '',
    ];
  });
  const realisticPnpmLock = [
    "lockfileVersion: '9.0'",
    '',
    'importers:',
    '  .:',
    '    dependencies:',
    "      '@aceshooting/lyra-ui':",
    `        specifier: ${tarballUrl}`,
    `        version: ${peerResolution}`,
    ...peerImporterRows,
    '',
    'packages:',
    `  ${quoteYamlKey(packageKey)}:`,
    `    resolution: {integrity: ${staged.integrity}, tarball: ${tarballUrl}}`,
    `    version: ${staged.version}`,
    "    engines: {node: '>=20'}",
    '    hasBin: true',
    '    peerDependencies:',
    ...Object.entries(stagedWithManifest.packagePeerDependencies).map(([name, range]) =>
      `      ${quoteYamlKey(name)}: ${range.startsWith('>=') ? `'${range}'` : range}`),
    '    peerDependenciesMeta:',
    ...Object.keys(stagedWithManifest.packagePeerDependenciesMeta).flatMap((name) => [
      `      ${quoteYamlKey(name)}:`,
      '        optional: true',
    ]),
    '',
    ...peerPackageRows,
    'snapshots:',
    `  ${quoteYamlKey(contextualSnapshotKey)}:`,
    '    optionalDependencies:',
    ...Object.entries(profileVersions).map(([name, version]) =>
      `      ${quoteYamlKey(name)}: ${peerLockResolution(name, version, profileVersions)}`),
    '',
    ...peerSnapshotRows,
  ].join('\n');
  assert.doesNotThrow(() =>
    verifyPnpmConsumerTarballLock(realisticPnpmLock, tarballUrl, stagedWithManifest, {
      authority: authorityFixture(),
      profile: { versions: profileVersions },
    }),
  );
  const assertPnpmProfileMutationRejected = (mutatedLock, description) => {
    assert.notEqual(mutatedLock, realisticPnpmLock, `${description} fixture must mutate the lock`);
    assert.throws(
      () => verifyPnpmConsumerTarballLock(
        mutatedLock,
        tarballUrl,
        stagedWithManifest,
        { authority: authorityFixture(), profile: { versions: profileVersions } },
      ),
      /Consumer pnpm|snapshot|package resolution|integrity|canonical|profile peer/iu,
      description,
    );
  };
  for (const [name, version] of Object.entries(profileVersions)) {
    const resolution = peerLockResolution(name, version, profileVersions);
    const importerBlock = [
      `      ${quoteYamlKey(name)}:`,
      `        specifier: ${version}`,
      `        version: ${resolution}`,
    ].join('\n');
    assertPnpmProfileMutationRejected(
      realisticPnpmLock.replace(
        importerBlock,
        importerBlock.replace(`specifier: ${version}`, 'specifier: 0.0.0'),
      ),
      `pnpm importer specifier mutation for ${name}`,
    );
    assertPnpmProfileMutationRejected(
      realisticPnpmLock.replace(
        importerBlock,
        importerBlock.replace(`version: ${resolution}`, 'version: 0.0.0'),
      ),
      `pnpm importer resolution mutation for ${name}`,
    );
    const packageHeader = `  ${quoteYamlKey(`${name}@${version}`)}:`;
    assertPnpmProfileMutationRejected(
      realisticPnpmLock.replace(
        packageHeader,
        `  ${quoteYamlKey(`${name}@${version}-missing`)}:`,
      ),
      `pnpm package omission for ${name}`,
    );
    const integrity = peerIntegrity(name, version);
    assertPnpmProfileMutationRejected(
      realisticPnpmLock.replace(
        `    resolution: {integrity: ${integrity}}`,
        `    resolution: {integrity: '${integrity}'}`,
      ),
      `pnpm quoted package integrity for ${name}`,
    );
    assertPnpmProfileMutationRejected(
      realisticPnpmLock.replace(
        `    resolution: {integrity: ${integrity}}`,
        '    resolution: {integrity: sha512-not-base64}',
      ),
      `pnpm malformed package integrity for ${name}`,
    );
    const snapshotHeader = `  ${quoteYamlKey(`${name}@${resolution}`)}:`;
    assertPnpmProfileMutationRejected(
      realisticPnpmLock.replace(
        snapshotHeader,
        `  ${quoteYamlKey(`${name}@${resolution}-missing`)}:`,
      ),
      `pnpm snapshot omission for ${name}`,
    );
    if (REVIEWED_CHART_PACKAGE_PEER_RANGES[name]) {
      const snapshotBlock = [
        snapshotHeader,
        '    dependencies:',
        `      chart.js: ${profileVersions['chart.js']}`,
      ].join('\n');
      assertPnpmProfileMutationRejected(
        realisticPnpmLock.replace(
          snapshotBlock,
          snapshotBlock.replace(`chart.js: ${profileVersions['chart.js']}`, 'chart.js: 0.0.0'),
        ),
        `pnpm chart snapshot peer-edge mutation for ${name}`,
      );
    } else {
      assertPnpmProfileMutationRejected(
        realisticPnpmLock.replace(`${snapshotHeader} {}`, `${snapshotHeader} arbitrary-scalar`),
        `pnpm non-chart snapshot scalar mutation for ${name}`,
      );
    }
  }
  assertPnpmProfileMutationRejected(
    realisticPnpmLock.replace(
      `        version: ${peerResolution}\n`,
      `        version: ${peerResolution}\n      injected-peer:\n        specifier: 1.0.0\n        version: 1.0.0\n`,
    ),
    'pnpm extra importer dependency',
  );
  assert.throws(
    () => verifyPnpmConsumerTarballLock(
      realisticPnpmLock.replace('    hasBin: true\n', '    unreviewed: true\n    hasBin: true\n'),
      tarballUrl,
      stagedWithManifest,
      { authority: authorityFixture(), profile: { versions: profileVersions } },
    ),
    /Consumer pnpm.*unexpected|package field/iu,
  );
  assert.throws(
    () => verifyPnpmConsumerTarballLock(
      pnpmLock.replace(staged.integrity, `sha512-${Buffer.alloc(64).toString('base64')}`),
      tarballUrl,
      staged,
    ),
    /exact tarball URL and SHA-512 integrity/iu,
  );
  assert.throws(
    () => verifyPnpmConsumerTarballLock(
      pnpmLock.replace(`  ${quoteYamlKey(packageKey)}: {}`, ''),
      tarballUrl,
      staged,
    ),
    /snapshots.*exact/iu,
  );
  for (const hostileLock of [
    pnpmLock.replace(
      `    resolution: {integrity: ${staged.integrity}, tarball: ${tarballUrl}}`,
      `    resolution:\n      integrity: ${staged.integrity}\n      tarball: ${tarballUrl}`,
    ),
    pnpmLock.replace(
      `    version: ${staged.version}\n`,
      `    version: ${staged.version}\n      hidden: true\n`,
    ),
    pnpmLock.replace(
      "      '@aceshooting/lyra-ui':\n",
      "      '@aceshooting/lyra-ui': |\n",
    ),
    pnpmLock.replace(
      `    resolution: {integrity: ${staged.integrity}, tarball: ${tarballUrl}}`,
      `    resolution: {'integrity': ${staged.integrity}, tarball: ${tarballUrl}}`,
    ),
    pnpmLock.replace(
      `    resolution: {integrity: ${staged.integrity}, tarball: ${tarballUrl}}`,
      `    resolution: {integrity: '${staged.integrity}', tarball: ${tarballUrl}}`,
    ),
    pnpmLock.replace(
      `    resolution: {integrity: ${staged.integrity}, tarball: ${tarballUrl}}`,
      `    resolution: {integrity: ${staged.integrity}, tarball: '${tarballUrl}'}`,
    ),
  ]) {
    assert.throws(
      () => verifyPnpmConsumerTarballLock(hostileLock, tarballUrl, staged),
      /Consumer pnpm|block map|nested structure|canonical|resolution/iu,
    );
  }

  const npmRoot = await mkdtemp(join(tmpdir(), 'lyra-peer-npm-lock-'));
  try {
    const npmLock = {
      lockfileVersion: 3,
      packages: {
        '': { dependencies: { '@aceshooting/lyra-ui': tarballUrl } },
        'node_modules/@aceshooting/lyra-ui': {
          integrity: staged.integrity,
          resolved: tarballUrl,
          version: staged.version,
        },
      },
    };
    await writeFile(join(npmRoot, 'package-lock.json'), `${JSON.stringify(npmLock)}\n`);
    await verifyConsumerTarballLock(npmRoot, 'npm', tarballUrl, staged);
    const npmRealLoopbackShape = structuredClone(npmLock);
    delete npmRealLoopbackShape.packages['node_modules/@aceshooting/lyra-ui'].integrity;
    await writeFile(
      join(npmRoot, 'package-lock.json'),
      `${JSON.stringify(npmRealLoopbackShape)}\n`,
    );
    await verifyConsumerTarballLock(
      npmRoot,
      'npm',
      tarballUrl,
      staged,
    );

    const npmProfileLock = {
      lockfileVersion: 3,
      packages: {
        '': {
          dependencies: {
            '@aceshooting/lyra-ui': tarballUrl,
            ...profileVersions,
          },
        },
        'node_modules/@aceshooting/lyra-ui': {
          peerDependencies: { ...stagedWithManifest.packagePeerDependencies },
          peerDependenciesMeta: structuredClone(stagedWithManifest.packagePeerDependenciesMeta),
          resolved: tarballUrl,
          version: staged.version,
        },
        ...Object.fromEntries(
          Object.entries(profileVersions).map(([name, version]) => {
            const packageEntry = {
              integrity: peerIntegrity(name, version),
              resolved: npmRegistryTarballUrl(name, version),
              version,
            };
            const chartPeerRange = REVIEWED_CHART_PACKAGE_PEER_RANGES[name]?.[version];
            if (chartPeerRange) packageEntry.peerDependencies = { 'chart.js': chartPeerRange };
            return [`node_modules/${name}`, packageEntry];
          }),
        ),
      },
    };
    const verifyNpmProfileLock = async (lock) => {
      await writeFile(join(npmRoot, 'package-lock.json'), `${JSON.stringify(lock)}\n`);
      await verifyConsumerTarballLock(
        npmRoot,
        'npm',
        tarballUrl,
        stagedWithManifest,
        { authority: authorityFixture(), profile: { versions: profileVersions } },
      );
    };
    await verifyNpmProfileLock(npmProfileLock);
    const assertNpmProfileMutationRejected = async (mutate, description) => {
      const mutated = structuredClone(npmProfileLock);
      mutate(mutated);
      await writeFile(join(npmRoot, 'package-lock.json'), `${JSON.stringify(mutated)}\n`);
      await assert.rejects(
        verifyConsumerTarballLock(
          npmRoot,
          'npm',
          tarballUrl,
          stagedWithManifest,
          { authority: authorityFixture(), profile: { versions: profileVersions } },
        ),
        /Consumer npm|canonical SHA-512|registry\.npmjs|profile peer|peer range/iu,
        description,
      );
    };
    for (const [name, version] of Object.entries(profileVersions)) {
      await assertNpmProfileMutationRejected(
        (lock) => {
          lock.packages[''].dependencies[name] = '0.0.0';
        },
        `npm importer specifier mutation for ${name}`,
      );
      await assertNpmProfileMutationRejected(
        (lock) => {
          lock.packages[`node_modules/${name}`].resolved =
            `https://registry.npmjs.org/${name}/-/unexpected-${version}.tgz`;
        },
        `npm resolved tarball mutation for ${name}`,
      );
      await assertNpmProfileMutationRejected(
        (lock) => {
          lock.packages[`node_modules/${name}`].integrity = 'sha512-not-base64';
        },
        `npm malformed integrity mutation for ${name}`,
      );
      await assertNpmProfileMutationRejected(
        (lock) => {
          delete lock.packages[`node_modules/${name}`];
        },
        `npm package omission for ${name}`,
      );
      if (REVIEWED_CHART_PACKAGE_PEER_RANGES[name]) {
        await assertNpmProfileMutationRejected(
          (lock) => {
            lock.packages[`node_modules/${name}`].peerDependencies['chart.js'] = 'nope';
          },
          `npm chart peer metadata mutation for ${name}`,
        );
      }
    }
    await assertNpmProfileMutationRejected(
      (lock) => {
        lock.packages[''].dependencies['injected-peer'] = '1.0.0';
      },
      'npm extra importer dependency',
    );
    await assertNpmProfileMutationRejected(
      (lock) => {
        delete lock.packages['node_modules/@aceshooting/lyra-ui']
          .peerDependencies['@aceshooting/lyra-flags'];
      },
      'npm packed Lyra peer metadata omission',
    );

    npmLock.packages['node_modules/@aceshooting/lyra-ui'].integrity =
      `sha512-${Buffer.alloc(64).toString('base64')}`;
    await writeFile(join(npmRoot, 'package-lock.json'), `${JSON.stringify(npmLock)}\n`);
    await assert.rejects(
      verifyConsumerTarballLock(npmRoot, 'npm', tarballUrl, staged),
      /exact Lyra tarball URL.*version.*SHA-512 integrity/iu,
    );

    const rootPackage = `{"dependencies":{"@aceshooting/lyra-ui":${JSON.stringify(tarballUrl)}}}`;
    const installedPackage = `{"integrity":${JSON.stringify(staged.integrity)},"resolved":${JSON.stringify(tarballUrl)},"version":${JSON.stringify(staged.version)}}`;
    const duplicateLocks = [
      `{"lockfileVersion":3,"packages":{"":{"dependencies":{"@aceshooting/lyra-ui":"bad","@aceshooting/lyra-ui":${JSON.stringify(tarballUrl)}}},"node_modules/@aceshooting/lyra-ui":${installedPackage}}}`,
      `{"lockfileVersion":3,"packages":{"":${rootPackage},"node_modules/@aceshooting/lyra-ui":{"integrity":"bad","integrity":${JSON.stringify(staged.integrity)},"resolved":${JSON.stringify(tarballUrl)},"version":${JSON.stringify(staged.version)}}}}`,
      `{"lockfileVersion":3,"packages":{"":${rootPackage},"node_modules/@aceshooting/lyra-ui":{"integrity":${JSON.stringify(staged.integrity)},"resolved":"bad","resolved":${JSON.stringify(tarballUrl)},"version":${JSON.stringify(staged.version)}}}}`,
      `{"lockfileVersion":3,"packages":{"":${rootPackage},"node_modules/@aceshooting/lyra-ui":{"integrity":${JSON.stringify(staged.integrity)},"resolved":${JSON.stringify(tarballUrl)},"version":"0.0.0","version":${JSON.stringify(staged.version)}}}}`,
      `{"lockfileVersion":3,"packages":{"":${rootPackage},"node_modules/@aceshooting/lyra-ui":{"version":"0.0.0"},"node_modules/@aceshooting/lyra-ui":${installedPackage}}}`,
    ];
    for (const duplicateLock of duplicateLocks) {
      await writeFile(join(npmRoot, 'package-lock.json'), `${duplicateLock}\n`);
      await assert.rejects(
        verifyConsumerTarballLock(npmRoot, 'npm', tarballUrl, staged),
        /duplicate.*JSON.*key|duplicate.*package-lock/iu,
      );
    }
  } finally {
    await rm(npmRoot, { recursive: true, force: true });
  }
});

test('bounds child time and output, kills a hung process tree, and preserves primary cleanup errors', async () => {
  const {
    createConsumerFileMap,
    resolvePeerProfiles,
    runBoundedCommand,
    withTemporaryPeerWorkspace,
  } = await loadChecker();
  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-process-security-'));
  try {
    const lateMarker = join(root, 'grandchild-survived');
    const grandchild = `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(lateMarker)}, 'late'), 600)`;
    const parent = [
      "const { spawn } = require('node:child_process');",
      `spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' });`,
      'setInterval(() => {}, 1_000);',
    ].join('\n');
    await assert.rejects(
      runBoundedCommand({
        command: process.execPath,
        args: ['-e', parent],
        cwd: root,
        env: process.env,
        label: 'hung fixture',
        timeoutMs: 100,
        maxOutputBytes: 4_096,
      }),
      /hung fixture timed out/iu,
    );
    await new Promise((resolveWait) => setTimeout(resolveWait, 800));
    await assert.rejects(access(lateMarker), /ENOENT/u);

    if (process.platform !== 'win32') {
      const failedPidPath = join(root, 'failed-leader.pid');
      const failedMarker = join(root, 'failed-grandchild-survived');
      const failedGrandchild =
        `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(failedMarker)}, 'late'), 600)`;
      const failedParent = [
        "const { spawn } = require('node:child_process');",
        "const { writeFileSync } = require('node:fs');",
        `writeFileSync(${JSON.stringify(failedPidPath)}, String(process.pid));`,
        `spawn(process.execPath, ['-e', ${JSON.stringify(failedGrandchild)}], { stdio: 'ignore' });`,
        'setTimeout(() => process.exit(7), 20);',
      ].join('\n');
      let failedGroupPid;
      try {
        await assert.rejects(
          runBoundedCommand({
            command: process.execPath,
            args: ['-e', failedParent],
            cwd: root,
            env: process.env,
            label: 'nonzero tree fixture',
            timeoutMs: 2_000,
            maxOutputBytes: 4_096,
          }),
          /nonzero tree fixture failed with exit code 7/iu,
        );
        failedGroupPid = Number(await readFile(failedPidPath, 'utf8'));
        assert.throws(
          () => process.kill(-failedGroupPid, 0),
          (error) => error?.code === 'ESRCH',
        );
        await new Promise((resolveWait) => setTimeout(resolveWait, 800));
        await assert.rejects(access(failedMarker), /ENOENT/u);
      } finally {
        if (Number.isSafeInteger(failedGroupPid) && failedGroupPid > 0) {
          try {
            process.kill(-failedGroupPid, 'SIGKILL');
          } catch (error) {
            if (error?.code !== 'ESRCH') throw error;
          }
        }
      }

      const successfulMarker = join(root, 'successful-grandchild-survived');
      const successfulGrandchild =
        `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(successfulMarker)}, 'late'), 600)`;
      const successfulParent = [
        "const { spawn } = require('node:child_process');",
        `spawn(process.execPath, ['-e', ${JSON.stringify(successfulGrandchild)}], { stdio: 'ignore' }).unref();`,
        "process.stdout.write('success-output');",
      ].join('\n');
      assert.equal(
        await runBoundedCommand({
          capture: true,
          command: process.execPath,
          args: ['-e', successfulParent],
          cwd: root,
          env: process.env,
          label: 'successful tree fixture',
          timeoutMs: 2_000,
          maxOutputBytes: 4_096,
        }),
        'success-output',
      );
      await new Promise((resolveWait) => setTimeout(resolveWait, 800));
      await assert.rejects(access(successfulMarker), /ENOENT/u);
    }

    const browserHarnessRoot = join(root, 'browser-cleanup-harness');
    const browserHarnessModule = join(browserHarnessRoot, 'node_modules', 'playwright');
    await mkdir(join(browserHarnessRoot, 'dist'), { recursive: true });
    await mkdir(join(browserHarnessRoot, 'scripts'), { recursive: true });
    await mkdir(browserHarnessModule, { recursive: true });
    const authority = authorityFixture();
    const profile = resolvePeerProfiles(authority)[0];
    const tarballSpecifier =
      `http://127.0.0.1:43123/lyra-00000000-0000-4000-8000-000000000000-${'a'.repeat(64)}.tgz`;
    const browserRunner = createConsumerFileMap({
      authority,
      packageManager: 'npm',
      profile,
      tarballSpecifier,
    }).get('scripts/run-browser.mjs');
    await writeFile(join(browserHarnessRoot, 'dist', 'index.html'), '<!doctype html><title>fixture</title>');
    await writeFile(join(browserHarnessRoot, 'scripts', 'run-browser.mjs'), browserRunner);
    await writeFile(
      join(browserHarnessModule, 'package.json'),
      `${JSON.stringify({ name: 'playwright', type: 'module', exports: './index.mjs' })}\n`,
    );
    await writeFile(
      join(browserHarnessModule, 'index.mjs'),
      `export const chromium = {
  async launchServer() {
    return {
      async close() {},
      kill() { return new Promise(() => {}); },
      wsEndpoint() { return 'ws://fixture.invalid'; },
    };
  },
  async connect() {
    return {
      async close() { throw new Error('browser close sentinel'); },
      async newPage() { throw new Error('browser primary sentinel'); },
    };
  },
};
`,
    );
    await assert.rejects(
      runBoundedCommand({
        command: process.execPath,
        args: ['scripts/run-browser.mjs'],
        cwd: browserHarnessRoot,
        env: process.env,
        label: 'browser cleanup harness',
        timeoutMs: 500,
        maxOutputBytes: 16_384,
      }),
      (error) => {
        assert.match(error.message, /browser cleanup harness timed out/iu);
        assert.match(error.message, /browser primary sentinel/u);
        assert.match(error.message, /browser close sentinel/u);
        return true;
      },
    );

    await assert.rejects(
      runBoundedCommand({
        command: process.execPath,
        args: ['-e', "process.stdout.write('x'.repeat(8192))"],
        cwd: root,
        env: process.env,
        label: 'output fixture',
        timeoutMs: 2_000,
        maxOutputBytes: 1_024,
      }),
      /output fixture exceeded.*output limit/iu,
    );

    let workspace;
    const primaryError = new Error('primary profile failure');
    const cleanupError = new Error('forced cleanup diagnostic');
    await assert.rejects(
      withTemporaryPeerWorkspace(
        async (createdWorkspace) => {
          workspace = createdWorkspace;
          await writeFile(join(createdWorkspace, 'proof'), 'created');
          throw primaryError;
        },
        {
          removeWorkspace: async (createdWorkspace) => {
            await rm(createdWorkspace, { recursive: true, force: true });
            throw cleanupError;
          },
        },
      ),
      (error) => {
        assert.equal(error, primaryError);
        assert.equal(error.cleanupError, cleanupError);
        return true;
      },
    );
    await assert.rejects(access(workspace), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('drains close, disposes command resources, bounds stuck Windows taskkill, and plans .cmd safely', async () => {
  const {
    createPortableSpawnPlan,
    runBoundedCommand,
    terminateProcessTree,
  } = await loadChecker();

  const windowsPlan = createPortableSpawnPlan(
    'C:\\Tools\\pnpm.CMD',
    ['install', 'C:\\Safe Path\\consumer'],
    {
      comspec: 'C:\\Windows\\System32\\cmd.exe',
      platform: 'win32',
    },
  );
  assert.equal(windowsPlan.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(windowsPlan.args.slice(0, 4), ['/d', '/s', '/v:off', '/c']);
  assert.equal(
    windowsPlan.args[4],
    '""C:\\Tools\\pnpm.CMD" "install" "C:\\Safe Path\\consumer""',
  );
  assert.equal(windowsPlan.windowsVerbatimArguments, true);
  assert.equal(
    createPortableSpawnPlan('/usr/bin/node', ['--version'], { platform: 'linux' }).command,
    '/usr/bin/node',
  );
  for (const unsafe of [
    'bad&arg',
    'bad%PATH%',
    'bad!arg',
    'bad|arg',
    'bad<arg',
    'bad>arg',
    'bad^arg',
    'bad(arg',
    'bad)arg',
    'bad\rarg',
    'bad\narg',
    'bad\0arg',
    'bad"arg',
  ]) {
    assert.throws(
      () => createPortableSpawnPlan('C:\\Tools\\pnpm.cmd', [unsafe], {
        comspec: 'C:\\Windows\\System32\\cmd.exe',
        platform: 'win32',
      }),
      /unsafe.*cmd|metacharacter/iu,
    );
  }
  assert.throws(
    () => createPortableSpawnPlan('relative.cmd', [], {
      comspec: 'C:\\Windows\\System32\\cmd.exe',
      platform: 'win32',
    }),
    /unsafe.*cmd/iu,
  );
  assert.throws(
    () => createPortableSpawnPlan('C:\\Tools\\pnpm.cmd', [], {
      comspec: 'relative-cmd.exe',
      platform: 'win32',
    }),
    /unsafe.*ComSpec/iu,
  );

  const makeChild = (pid) => {
    const child = new EventEmitter();
    child.pid = pid;
    child.exitCode = null;
    child.signalCode = null;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killCalls = [];
    child.unrefCalls = 0;
    child.kill = (signal) => {
      child.killCalls.push(signal);
      child.signalCode = signal;
      queueMicrotask(() => child.emit('close', null, signal));
      return true;
    };
    child.unref = () => {
      child.unrefCalls += 1;
    };
    return child;
  };

  const lateChild = makeChild(7001);
  let successfulTerminations = 0;
  const lateResult = runBoundedCommand(
    {
      capture: true,
      command: '/safe/node',
      args: [],
      cwd: resolve(tmpdir()),
      env: {},
      label: 'late close fixture',
      maxOutputBytes: 1_024,
      timeoutMs: 1_000,
    },
    {
      spawnImpl: () => lateChild,
      terminateTreeImpl: async () => {
        successfulTerminations += 1;
      },
    },
  );
  lateChild.stdout.write('before-');
  lateChild.emit('exit', 0, null);
  lateChild.stdout.write('after');
  lateChild.stdout.end();
  lateChild.stderr.end();
  lateChild.exitCode = 0;
  lateChild.emit('close', 0, null);
  assert.equal(await lateResult, 'before-after');
  assert.equal(successfulTerminations, process.platform === 'win32' ? 0 : 1);
  assert.equal(lateChild.listenerCount('close'), 0);
  assert.equal(lateChild.listenerCount('error'), 0);
  assert.equal(lateChild.stdout.listenerCount('data'), 0);
  assert.equal(lateChild.stderr.listenerCount('data'), 0);

  const timeoutChild = makeChild(7002);
  let terminationFinished = false;
  await assert.rejects(
    runBoundedCommand(
      {
        command: '/safe/node',
        args: [],
        cwd: resolve(tmpdir()),
        env: {},
        label: 'cleanup fixture',
        maxOutputBytes: 1_024,
        timeoutMs: 10,
      },
      {
        spawnImpl: () => timeoutChild,
        terminateTreeImpl: async (child) => {
          await new Promise((resolveWait) => setTimeout(resolveWait, 20));
          terminationFinished = true;
          child.signalCode = 'SIGKILL';
          child.emit('close', null, 'SIGKILL');
        },
      },
    ),
    /cleanup fixture timed out/iu,
  );
  assert.equal(terminationFinished, true);
  assert.equal(timeoutChild.listenerCount('close'), 0);
  assert.equal(timeoutChild.listenerCount('error'), 0);
  assert.equal(timeoutChild.stdout.listenerCount('data'), 0);
  assert.equal(timeoutChild.stderr.listenerCount('data'), 0);
  assert.equal(timeoutChild.stdout.destroyed, true);
  assert.equal(timeoutChild.stderr.destroyed, true);

  const preAborted = new AbortController();
  preAborted.abort(new Error('pre-abort sentinel'));
  let preAbortedSpawned = false;
  await assert.rejects(
    runBoundedCommand(
      {
        command: '/safe/node',
        args: [],
        cwd: resolve(tmpdir()),
        env: {},
        label: 'pre-abort fixture',
        maxOutputBytes: 1_024,
        signal: preAborted.signal,
        timeoutMs: 1_000,
      },
      { spawnImpl: () => { preAbortedSpawned = true; } },
    ),
    /aborted before spawn/iu,
  );
  assert.equal(preAbortedSpawned, false);

  const midAbort = new AbortController();
  const abortChild = makeChild(7005);
  let abortTerminations = 0;
  const abortResult = runBoundedCommand(
    {
      command: '/safe/node',
      args: [],
      cwd: resolve(tmpdir()),
      env: {},
      label: 'mid-abort fixture',
      maxOutputBytes: 1_024,
      signal: midAbort.signal,
      timeoutMs: 1_000,
    },
    {
      spawnImpl: () => abortChild,
      terminateTreeImpl: async (child) => {
        abortTerminations += 1;
        child.signalCode = 'SIGKILL';
        child.emit('close', null, 'SIGKILL');
      },
    },
  );
  midAbort.abort(new Error('mid-abort sentinel'));
  await assert.rejects(abortResult, /mid-abort fixture aborted/iu);
  assert.equal(abortTerminations, 1);

  const aggregateChild = makeChild(7006);
  const aggregateResult = runBoundedCommand(
    {
      command: '/safe/node',
      args: [],
      cwd: resolve(tmpdir()),
      env: {},
      label: 'aggregate output fixture',
      maxOutputBytes: 1_024,
      timeoutMs: 1_000,
    },
    {
      spawnImpl: () => aggregateChild,
      terminateTreeImpl: async (child) => child.emit('close', null, 'SIGKILL'),
    },
  );
  aggregateChild.stdout.write('o'.repeat(700));
  aggregateChild.stderr.write('e'.repeat(700));
  await assert.rejects(aggregateResult, /aggregate output fixture exceeded.*1024/iu);

  const cleanupChild = makeChild(7007);
  const cleanupFailure = new Error('termination cleanup sentinel');
  await assert.rejects(
    runBoundedCommand(
      {
        command: '/safe/node',
        args: [],
        cwd: resolve(tmpdir()),
        env: {},
        label: 'termination-error fixture',
        maxOutputBytes: 1_024,
        timeoutMs: 10,
      },
      {
        spawnImpl: () => cleanupChild,
        terminateTreeImpl: async (child) => {
          child.emit('close', null, 'SIGKILL');
          throw cleanupFailure;
        },
      },
    ),
    (error) => {
      assert.match(error.message, /termination-error fixture timed out/iu);
      assert.equal(error.cleanupError, cleanupFailure);
      return true;
    },
  );

  const posixTarget = makeChild(7008);
  let groupAlive = true;
  const groupSignals = [];
  await terminateProcessTree(posixTarget, 10, {
    killImpl: (pid, signal) => {
      assert.equal(pid, -7008);
      if (signal === 0) {
        if (groupAlive) return;
        const error = new Error('gone');
        error.code = 'ESRCH';
        throw error;
      }
      groupSignals.push(signal);
      if (signal === 'SIGTERM') {
        posixTarget.signalCode = signal;
        posixTarget.emit('close', null, signal);
      } else if (signal === 'SIGKILL') {
        groupAlive = false;
      }
    },
    platform: 'linux',
  });
  assert.deepEqual(groupSignals, ['SIGTERM', 'SIGKILL']);

  const target = makeChild(7003);
  const killer = makeChild(7004);
  let taskkillSpawn;
  killer.kill = (signal) => {
    killer.killCalls.push(signal);
    killer.signalCode = signal;
    queueMicrotask(() => killer.emit('close', null, signal));
    return true;
  };
  await assert.rejects(
    terminateProcessTree(target, 10, {
      platform: 'win32',
      spawnImpl: (command, args, options) => {
        taskkillSpawn = { args, command, options };
        return killer;
      },
      systemRoot: 'C:\\Windows',
    }),
    /taskkill helper did not complete successfully/iu,
  );
  assert.equal(taskkillSpawn.command, 'C:\\Windows\\System32\\taskkill.exe');
  assert.deepEqual(taskkillSpawn.args, ['/pid', '7003', '/t', '/f']);
  assert.deepEqual(taskkillSpawn.options, {
    detached: false,
    stdio: 'ignore',
    windowsHide: true,
  });
  assert.deepEqual(killer.killCalls, ['SIGKILL']);
  assert.deepEqual(target.killCalls, ['SIGKILL']);
  assert.equal(killer.listenerCount('close'), 0);
  assert.equal(killer.listenerCount('error'), 0);

  const successfulTarget = makeChild(7010);
  const successfulKiller = makeChild(7011);
  await terminateProcessTree(successfulTarget, 10, {
    platform: 'win32',
    spawnImpl: () => {
      queueMicrotask(() => successfulKiller.emit('close', 0, null));
      return successfulKiller;
    },
    systemRoot: 'C:\\Windows',
  });
  assert.deepEqual(successfulTarget.killCalls, ['SIGKILL']);

  const failedTarget = makeChild(7012);
  const failedKiller = makeChild(7013);
  await assert.rejects(
    terminateProcessTree(failedTarget, 10, {
      platform: 'win32',
      spawnImpl: () => {
        queueMicrotask(() => failedKiller.emit('close', 1, null));
        return failedKiller;
      },
      systemRoot: 'C:\\Windows',
    }),
    /taskkill helper did not complete successfully/iu,
  );
  assert.deepEqual(failedTarget.killCalls, ['SIGKILL']);

  const alreadyClosedTarget = makeChild(7014);
  const alreadyClosedKiller = makeChild(7015);
  await assert.rejects(
    terminateProcessTree(alreadyClosedTarget, 10, {
      platform: 'win32',
      spawnImpl: () => {
        queueMicrotask(() => {
          alreadyClosedTarget.exitCode = 0;
          alreadyClosedTarget.emit('close', 0, null);
          alreadyClosedKiller.emit('close', 1, null);
        });
        return alreadyClosedKiller;
      },
      systemRoot: 'C:\\Windows',
    }),
    /taskkill helper did not complete successfully/iu,
  );
  assert.deepEqual(alreadyClosedTarget.killCalls, []);

  const refusingTarget = makeChild(7016);
  const refusingKiller = makeChild(7017);
  refusingKiller.kill = (signal) => {
    refusingKiller.killCalls.push(signal);
    return false;
  };
  await assert.rejects(
    terminateProcessTree(refusingTarget, 10, {
      platform: 'win32',
      spawnImpl: () => refusingKiller,
      systemRoot: 'C:\\Windows',
    }),
    /taskkill helper did not complete successfully/iu,
  );
  assert.deepEqual(refusingKiller.killCalls, ['SIGKILL']);
  assert.equal(refusingKiller.unrefCalls, 1);

  const spawnFailureTarget = makeChild(7018);
  spawnFailureTarget.kill = () => {
    throw new Error('target kill throw sentinel');
  };
  await assert.rejects(
    terminateProcessTree(spawnFailureTarget, 10, {
      platform: 'win32',
      spawnImpl: () => {
        throw new Error('taskkill spawn throw sentinel');
      },
      systemRoot: 'C:\\Windows',
    }),
    (error) => {
      assert.match(error.message, /taskkill helper could not start/iu);
      assert.ok(error.cleanupError instanceof AggregateError);
      return true;
    },
  );
  assert.equal(spawnFailureTarget.unrefCalls, 1);

  const stuckTarget = makeChild(7019);
  const closedKiller = makeChild(7020);
  stuckTarget.kill = () => {
    throw new Error('target fallback throw sentinel');
  };
  await assert.rejects(
    terminateProcessTree(stuckTarget, 10, {
      platform: 'win32',
      spawnImpl: () => {
        queueMicrotask(() => closedKiller.emit('close', 0, null));
        return closedKiller;
      },
      systemRoot: 'C:\\Windows',
    }),
    /process tree did not close/iu,
  );
  assert.equal(stuckTarget.unrefCalls, 1);

  const permissionTarget = makeChild(7021);
  await assert.rejects(
    terminateProcessTree(permissionTarget, 10, {
      killImpl: () => {
        const error = new Error('group permission sentinel');
        error.code = 'EPERM';
        throw error;
      },
      platform: 'linux',
    }),
    /group permission sentinel/u,
  );
  assert.equal(permissionTarget.unrefCalls, 1);

  const invalidRootTarget = makeChild(7022);
  await assert.rejects(
    terminateProcessTree(invalidRootTarget, 10, {
      platform: 'win32',
      spawnImpl: () => {
        throw new Error('must not spawn with invalid SystemRoot');
      },
      systemRoot: 'relative-root',
    }),
    /safe absolute SystemRoot/iu,
  );
  assert.equal(invalidRootTarget.unrefCalls, 1);
});

test('exports isolated strict npm/pnpm command plans and validates both exact authorities', async () => {
  const { assertExecutionToolchain, createConsumerCommandPlan } = await loadChecker();
  const authority = authorityFixture();
  const hostileRoot = resolve(tmpdir(), 'lyra-peer-hostile-environment');
  const playwrightBrowsersPath = resolve(tmpdir(), 'ms-playwright');
  const existingXdgCache = resolve(tmpdir(), 'safe-existing-cache');
  const hostileUserConfig = join(hostileRoot, 'user.npmrc');
  const hostileEnvironment = {
    ...process.env,
    BASH_ENV: join(hostileRoot, 'inject.sh'),
    COREPACK_HOME: join(hostileRoot, 'untrusted-corepack'),
    DYLD_INSERT_LIBRARIES: join(hostileRoot, 'inject.dylib'),
    ENV: join(hostileRoot, 'inject.sh'),
    INIT_CWD: join(hostileRoot, 'untrusted-cwd'),
    LD_PRELOAD: join(hostileRoot, 'inject.so'),
    NPM_CONFIG_USERCONFIG: hostileUserConfig,
    NODE_OPTIONS: `--require=${join(hostileRoot, 'inject.cjs')}`,
    NODE_PATH: join(hostileRoot, 'injected-node-path'),
    PLAYWRIGHT_BROWSERS_PATH: playwrightBrowsersPath,
    PNPM_HOME: join(hostileRoot, 'untrusted-pnpm'),
    XDG_CACHE_HOME: existingXdgCache,
    LYRA_UNLISTED_CANARY: 'must-not-pass',
    npm_config_legacy_peer_deps: 'true',
    npm_config_force: 'true',
    npm_config_strict_peer_deps: 'false',
  };
  const workspace = resolve(tmpdir(), 'lyra-peer-plan-fixture');
  const plans = ['pnpm', 'npm'].map((packageManager) =>
    createConsumerCommandPlan({
      authority,
      baseEnvironment: hostileEnvironment,
      consumerRoot: join(workspace, 'consumers', 'chart-floor', packageManager),
      packageManager,
      profileId: 'chart-floor',
      workspace,
    }),
  );
  for (const [index, plan] of plans.entries()) {
    const packageManager = index === 0 ? 'pnpm' : 'npm';
    const install = plan.find(({ id }) => id === 'install');
    assert.ok(install);
    assert.equal(install.packageManager, packageManager);
    assert.ok(install.timeoutMs > 0);
    assert.ok(install.maxOutputBytes > 0);
    assert.notEqual(install.env.NPM_CONFIG_USERCONFIG, hostileUserConfig);
    assert.ok(install.env.NPM_CONFIG_USERCONFIG.startsWith(join(workspace, 'package-manager')));
    assert.ok(install.env.NPM_CONFIG_CACHE.startsWith(join(workspace, 'package-manager')));
    assert.equal(install.env.npm_config_legacy_peer_deps, 'false');
    assert.equal(install.env.npm_config_force, 'false');
    assert.equal(install.env.npm_config_strict_peer_deps, 'true');
    assert.equal(install.env.HOME, hostileEnvironment.HOME);
    assert.equal(install.env.PLAYWRIGHT_BROWSERS_PATH, playwrightBrowsersPath);
    assert.equal(install.env.XDG_CACHE_HOME, existingXdgCache);
    assert.ok(install.env.TMPDIR.startsWith(join(workspace, 'package-manager')));
    assert.ok(install.env.XDG_CONFIG_HOME.startsWith(join(workspace, 'package-manager')));
    for (const name of [
      'BASH_ENV',
      'COREPACK_HOME',
      'DYLD_INSERT_LIBRARIES',
      'ENV',
      'INIT_CWD',
      'LD_PRELOAD',
      'LYRA_UNLISTED_CANARY',
      'NODE_OPTIONS',
      'NODE_PATH',
      'PNPM_HOME',
    ]) {
      assert.equal(name in install.env, false, `${name} must not reach a consumer command`);
    }
    assert.ok(install.args.some((argument) => /strict-peer/u.test(argument)));
    assert.ok(install.args.some((argument) => /(?:legacy-peer-deps|force)=false/u.test(argument)));
    if (packageManager === 'pnpm') {
      assert.ok(install.args.includes('--config.auto-install-peers=false'));
      assert.ok(install.args.includes('--store-dir'));
      // `pnpm list` rejects install-only options outright ("Unknown option: 'store-dir'"), and the
      // tree it prints comes from the consumer's own node_modules, never the store.
      const tree = plan.find(({ id }) => id === 'dependency tree');
      assert.ok(tree, 'pnpm consumer plan must include a dependency tree stage');
      assert.equal(tree.args.includes('--store-dir'), false, 'pnpm list must not receive --store-dir');
    }
  }
  assert.notEqual(
    plans[0].find(({ id }) => id === 'install').env.NPM_CONFIG_CACHE,
    plans[1].find(({ id }) => id === 'install').env.NPM_CONFIG_CACHE,
  );

  const windowsInstall = createConsumerCommandPlan({
    authority,
    baseEnvironment: {
      HOME: 'C:\\Users\\fixture',
      HTTP_PROXY: 'http://proxy.fixture:8080',
      NODE_OPTIONS: '--require=C:\\inject.cjs',
      NO_PROXY: 'internal.fixture',
      Path: 'C:\\Tools',
      SystemRoot: 'C:\\Windows',
    },
    consumerRoot: 'C:\\peer-fixture\\consumers\\chart-floor\\npm',
    packageManagerCommands: {
      npm: 'C:\\Tools\\npm.cmd',
      pnpm: 'C:\\Tools\\pnpm.cmd',
    },
    packageManager: 'npm',
    platform: 'win32',
    profileId: 'chart-floor',
    workspace: 'C:\\peer-fixture',
  }).find(({ id }) => id === 'install');
  const windowsEnvironmentNames = Object.keys(windowsInstall.env).map((name) => name.toLowerCase());
  assert.equal(new Set(windowsEnvironmentNames).size, windowsEnvironmentNames.length);
  assert.equal(windowsInstall.command, 'C:\\Tools\\npm.cmd');
  assert.match(windowsInstall.command, /^[A-Z]:\\.*\.cmd$/iu);
  assert.equal(windowsInstall.env.HTTP_PROXY, 'http://proxy.fixture:8080');
  assert.equal('http_proxy' in windowsInstall.env, false);
  assert.equal(windowsInstall.env.NO_PROXY, 'internal.fixture,127.0.0.1,localhost');
  assert.equal('no_proxy' in windowsInstall.env, false);
  assert.equal('NODE_OPTIONS' in windowsInstall.env, false);
  assert.throws(
    () => createConsumerCommandPlan({
      authority,
      baseEnvironment: {
        HTTP_PROXY: 'http://first.fixture:8080',
        http_proxy: 'http://second.fixture:8080',
      },
      consumerRoot: 'C:\\peer-fixture\\consumers\\chart-floor\\npm',
      packageManagerCommands: {
        npm: 'C:\\Tools\\npm.cmd',
        pnpm: 'C:\\Tools\\pnpm.cmd',
      },
      packageManager: 'npm',
      platform: 'win32',
      profileId: 'chart-floor',
      workspace: 'C:\\peer-fixture',
    }),
    /ambiguous case-insensitive environment aliases/iu,
  );

  const versionByCommand = new Map([
    ['npm', '10.9.8'],
    ['pnpm', '12.3.4'],
  ]);
  await assertExecutionToolchain({
    actualNodeVersion: '22.23.2',
    authority,
    captureVersion: async (command) => versionByCommand.get(command),
    nvmrcText: '22.23.2\n',
    rootManifest: { packageManager: 'pnpm@12.3.4' },
  });
  await assertExecutionToolchain({
    actualNodeVersion: '22.23.2',
    authority,
    captureVersion: async (command) => versionByCommand.get(command),
    nvmrcText: '22.23.2\r\n',
    rootManifest: { packageManager: 'pnpm@12.3.4' },
  });
  await assert.rejects(
    assertExecutionToolchain({
      actualNodeVersion: '22.23.2',
      authority,
      captureVersion: async (command) => command === 'npm' ? '10.9.7' : '12.3.4',
      nvmrcText: '22.23.2\n',
      rootManifest: { packageManager: 'pnpm@12.3.4' },
    }),
    /requires npm 10\.9\.8.*10\.9\.7/iu,
  );
  await assert.rejects(
    assertExecutionToolchain({
      actualNodeVersion: '22.23.2',
      authority,
      captureVersion: async (command) => versionByCommand.get(command),
      nvmrcText: '22.23.2\n',
      rootManifest: { packageManager: 'pnpm@11.24.0' },
    }),
    /root packageManager.*pnpm@12\.3\.4/iu,
  );
});

test('validates synchronized authority completely and replaces it atomically without partial writes', async () => {
  const { writeSynchronizedAuthority } = await loadChecker();
  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-authority-write-'));
  const authorityPath = join(root, 'peer-compatibility-profiles.json');
  const authority = authorityFixture();
  const authorityText = `${JSON.stringify(authority, null, 2)}\n`;
  const updatedVersions = { ...CURRENT_VERSIONS, 'chart.js': '4.6.0' };
  const request = {
    authority,
    authorityPath,
    authorityText,
    lockfileText: lockfileFixture(updatedVersions),
    packageManifest: packageManifestFixture(updatedVersions),
  };
  try {
    await writeFile(authorityPath, authorityText);

    const noOpRequest = {
      authority,
      authorityPath,
      authorityText,
      lockfileText: lockfileFixture(),
      packageManifest: packageManifestFixture(),
    };
    await writeFile(authorityPath, `${authorityText} `);
    await assert.rejects(
      writeSynchronizedAuthority(noOpRequest),
      /authority changed|live authority|stale/iu,
      'even a computed no-op must re-read its live authority before returning',
    );
    await writeFile(authorityPath, authorityText);

    await assert.rejects(
      writeSynchronizedAuthority(request, {
        renameImpl: async () => {
          throw new Error('forced rename failure');
        },
      }),
      /forced rename failure/u,
    );
    assert.equal(await readFile(authorityPath, 'utf8'), authorityText);
    assert.deepEqual(
      (await readdir(root)).filter((entry) => entry.includes('.tmp-')),
      [],
    );

    const invalidRequest = {
      ...request,
      lockfileText: request.lockfileText.replace('        version: 1.12.2\n', '        version: 1.12.1\n'),
    };
    let attemptedWrite = false;
    await assert.rejects(
      writeSynchronizedAuthority(invalidRequest, {
        writeFileImpl: async () => {
          attemptedWrite = true;
          throw new Error('must not write invalid authority');
        },
      }),
      /Updated lock version.*mammoth/iu,
    );
    assert.equal(attemptedWrite, false);
    assert.equal(await readFile(authorityPath, 'utf8'), authorityText);

    const synchronized = await writeSynchronizedAuthority(request);
    assert.equal(synchronized.currentVersions['chart.js'], '4.6.0');
    assert.equal(
      JSON.parse(await readFile(authorityPath, 'utf8')).currentVersions['chart.js'],
      '4.6.0',
    );

    await writeFile(authorityPath, authorityText);
    const durabilityEvents = [];
    const openImpl = async (path, flags, mode) => {
      if (path === dirname(authorityPath)) {
        await access(authorityPath);
      }
      const handle = await open(path, flags, mode);
      return {
        close: async () => {
          durabilityEvents.push(`close:${path}`);
          await handle.close();
        },
        read: (...args) => handle.read(...args),
        readFile: (...args) => handle.readFile(...args),
        stat: (...args) => handle.stat(...args),
        sync: async () => {
          durabilityEvents.push(`sync:${path}`);
          await handle.sync();
        },
        writeFile: (...args) => handle.writeFile(...args),
      };
    };
    await writeSynchronizedAuthority(request, {
      openImpl,
      renameImpl: async (from, to) => {
        durabilityEvents.push(`rename:${from}->${to}`);
        await rename(from, to);
      },
    });
    const temporarySync = durabilityEvents.findIndex((event) =>
      event.startsWith(`sync:${authorityPath}.tmp-`),
    );
    const durableRename = durabilityEvents.findIndex((event) => event.startsWith('rename:'));
    const directorySync = durabilityEvents.findIndex((event) => event === `sync:${dirname(authorityPath)}`);
    assert.ok(temporarySync >= 0, 'temporary authority bytes must be fsynced');
    assert.ok(durableRename > temporarySync, 'rename must follow the temporary-file fsync');
    assert.ok(directorySync > durableRename, 'parent directory must be fsynced after rename');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preserves a noncooperating authority write at the commit CAS boundary', async () => {
  const { writeSynchronizedAuthority } = await loadChecker();
  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-authority-cas-'));
  const authorityPath = join(root, 'peer-compatibility-profiles.json');
  const authority = authorityFixture();
  const authorityText = `${JSON.stringify(authority, null, 2)}\n`;
  const concurrentText = `${authorityText}noncooperating-writer\n`;
  const updatedVersions = { ...CURRENT_VERSIONS, 'chart.js': '4.6.0' };
  const updateRequest = {
    authority,
    authorityPath,
    authorityText,
    lockfileText: lockfileFixture(updatedVersions),
    packageManifest: packageManifestFixture(updatedVersions),
  };
  try {
    await writeFile(authorityPath, authorityText);
    let commitRaceInjected = false;
    let targetOpens = 0;
    await assert.rejects(
      writeSynchronizedAuthority(updateRequest, {
        openImpl: async (path, flags, mode) => {
          const handle = await open(path, flags, mode);
          if (path !== authorityPath || typeof flags !== 'number' || (targetOpens += 1) !== 2) {
            return handle;
          }
          return {
            close: (...args) => handle.close(...args),
            read: async (...args) => {
              const result = await handle.read(...args);
              if (!commitRaceInjected && result.bytesRead > 0) {
                commitRaceInjected = true;
                await writeFile(authorityPath, concurrentText);
              }
              return result;
            },
            stat: (...args) => handle.stat(...args),
          };
        },
      }),
      /authority changed|concurrent|compare-and-swap|stale/iu,
      'a competing write between the final comparison and commit must fail closed',
    );
    assert.equal(commitRaceInjected, true, 'the commit-boundary race fixture must run');
    assert.equal(
      await readFile(authorityPath, 'utf8'),
      concurrentText,
      'a failed precommit comparison must preserve the noncooperating writer bytes',
    );

    assert.deepEqual(
      (await readdir(root)).filter((entry) => entry.includes('.tmp-') || entry.includes('.backup-')),
      [],
      'failed CAS attempts must clean their private transaction artifacts',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preserves a noncooperating authority write at the no-op CAS boundary', async () => {
  const { writeSynchronizedAuthority } = await loadChecker();
  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-authority-noop-cas-'));
  const authorityPath = join(root, 'peer-compatibility-profiles.json');
  const authority = authorityFixture();
  const authorityText = `${JSON.stringify(authority, null, 2)}\n`;
  const concurrentText = `${authorityText}noncooperating-writer\n`;
  const request = {
    authority,
    authorityPath,
    authorityText,
    lockfileText: lockfileFixture(),
    packageManifest: packageManifestFixture(),
  };
  try {
    await writeFile(authorityPath, authorityText);
    let noOpRaceInjected = false;
    await assert.rejects(
      writeSynchronizedAuthority(request, {
        openImpl: async (path, flags, mode) => {
          const handle = await open(path, flags, mode);
          if (path !== authorityPath || typeof flags !== 'number' || noOpRaceInjected) {
            return handle;
          }
          return {
            close: async () => {
              await handle.close();
              noOpRaceInjected = true;
              await writeFile(authorityPath, concurrentText);
            },
            read: (...args) => handle.read(...args),
            stat: (...args) => handle.stat(...args),
          };
        },
      }),
      /authority changed|concurrent|compare-and-swap|stale/iu,
      'a competing write after a no-op comparison must fail closed',
    );
    assert.equal(noOpRaceInjected, true, 'the no-op boundary race fixture must run');
    assert.equal(
      await readFile(authorityPath, 'utf8'),
      concurrentText,
      'a failed no-op CAS must preserve the noncooperating writer bytes',
    );
    assert.deepEqual(
      (await readdir(root)).filter((entry) => entry.includes('.tmp-') || entry.includes('.backup-')),
      [],
      'a failed no-op CAS must clean its private transaction artifacts',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('serializes authority synchronizers across their complete no-op transaction', async () => {
  const { writeSynchronizedAuthority } = await loadChecker();
  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-authority-serialize-'));
  const authorityPath = join(root, 'peer-compatibility-profiles.json');
  const authority = authorityFixture();
  const authorityText = `${JSON.stringify(authority, null, 2)}\n`;
  const request = {
    authority,
    authorityPath,
    authorityText,
    lockfileText: lockfileFixture(),
    packageManifest: packageManifestFixture(),
  };
  let releaseFirstRead;
  const firstReadRelease = new Promise((resolveRelease) => {
    releaseFirstRead = resolveRelease;
  });
  let reportFirstRead;
  const firstReadStarted = new Promise((resolveStarted) => {
    reportFirstRead = resolveStarted;
  });
  try {
    await writeFile(authorityPath, authorityText);
    let firstRead = true;
    const first = writeSynchronizedAuthority(request, {
      openImpl: async (path, flags, mode) => {
        const handle = await open(path, flags, mode);
        if (path !== authorityPath || typeof flags !== 'number' || !firstRead) return handle;
        firstRead = false;
        return {
          close: (...args) => handle.close(...args),
          read: async (...args) => {
            const result = await handle.read(...args);
            if (result.bytesRead > 0) {
              reportFirstRead();
              await firstReadRelease;
            }
            return result;
          },
          stat: (...args) => handle.stat(...args),
        };
      },
    });
    await firstReadStarted;

    let secondEnteredTransaction = false;
    const second = writeSynchronizedAuthority(request, {
      openImpl: async (path, flags, mode) => {
        if (path === authorityPath && typeof flags === 'number') {
          secondEnteredTransaction = true;
        }
        return open(path, flags, mode);
      },
    });
    await new Promise((resolveTurn) => setImmediate(resolveTurn));
    const transactionsOverlapped = secondEnteredTransaction;
    releaseFirstRead();
    await Promise.all([first, second]);
    assert.equal(
      transactionsOverlapped,
      false,
      'a second cooperative synchronizer must not read until the first no-op transaction settles',
    );
  } finally {
    releaseFirstRead?.();
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects symlink authority files and parent paths', async () => {
  const { writeSynchronizedAuthority } = await loadChecker();
  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-authority-symlink-'));
  const authorityPath = join(root, 'peer-compatibility-profiles.json');
  const authority = authorityFixture();
  const authorityText = `${JSON.stringify(authority, null, 2)}\n`;
  const request = {
    authority,
    authorityPath,
    authorityText,
    lockfileText: lockfileFixture(),
    packageManifest: packageManifestFixture(),
  };
  try {
    await writeFile(authorityPath, authorityText);
    const realAuthorityPath = join(root, 'real-authority.json');
    const symlinkAuthorityPath = join(root, 'symlink-authority.json');
    await writeFile(realAuthorityPath, authorityText);
    await symlink(realAuthorityPath, symlinkAuthorityPath);
    await assert.rejects(
      writeSynchronizedAuthority({ ...request, authorityPath: symlinkAuthorityPath }),
      /authority.*regular|symbolic link|symlink/iu,
    );

    const realParent = join(root, 'real-parent');
    const symlinkParent = join(root, 'symlink-parent');
    await mkdir(realParent);
    await writeFile(join(realParent, 'authority.json'), authorityText);
    await symlink(realParent, symlinkParent);
    await assert.rejects(
      writeSynchronizedAuthority({
        ...request,
        authorityPath: join(symlinkParent, 'authority.json'),
      }),
      /authority.*parent|symbolic link|symlink/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('binds authority and staged temp inodes and never cleans through a rebound parent', async () => {
  const { writeSynchronizedAuthority } = await loadChecker();
  const root = await mkdtemp(join(tmpdir(), 'lyra-peer-authority-inodes-'));
  const authority = authorityFixture();
  const authorityText = `${JSON.stringify(authority, null, 2)}\n`;
  const updatedVersions = { ...CURRENT_VERSIONS, 'chart.js': '4.6.0' };
  const requestFor = (authorityPath) => ({
    authority,
    authorityPath,
    authorityText,
    lockfileText: lockfileFixture(updatedVersions),
    packageManifest: packageManifestFixture(updatedVersions),
  });
  try {
    const targetPath = join(root, 'authority.json');
    const targetBackup = join(root, 'authority-original.json');
    const victimPath = join(root, 'victim.json');
    await writeFile(targetPath, authorityText);
    await writeFile(victimPath, 'victim-bytes\n');
    let targetOpenSwapped = false;
    await assert.rejects(
      writeSynchronizedAuthority(
        {
          ...requestFor(targetPath),
          lockfileText: lockfileFixture(),
          packageManifest: packageManifestFixture(),
        },
        {
          openImpl: async (path, flags, mode) => {
            if (path !== targetPath || typeof flags !== 'number') return open(path, flags, mode);
            targetOpenSwapped = true;
            await rename(targetPath, targetBackup);
            await symlink(victimPath, targetPath);
            try {
              return await open(path, flags, mode);
            } finally {
              await rm(targetPath, { force: true });
              await rename(targetBackup, targetPath);
            }
          },
        },
      ),
      /authority.*regular|symbolic link|symlink|ELOOP|identity/iu,
    );
    assert.equal(targetOpenSwapped, true, 'the bound target-open swap fixture must run');
    assert.equal(await readFile(targetPath, 'utf8'), authorityText);

    let tempSwapRan = false;
    await assert.rejects(
      writeSynchronizedAuthority(requestFor(targetPath), {
        openImpl: async (path, flags, mode) => {
          const handle = await open(path, flags, mode);
          if (flags !== 'wx') return handle;
          return {
            close: async () => {
              await handle.close();
              await rename(path, `${path}.original`);
              await symlink(victimPath, path);
              tempSwapRan = true;
            },
            read: (...args) => handle.read(...args),
            stat: (...args) => handle.stat(...args),
            sync: (...args) => handle.sync(...args),
            writeFile: (...args) => handle.writeFile(...args),
          };
        },
      }),
      /temporary|staged|symbolic link|symlink|identity|atomic replacement/iu,
    );
    assert.equal(tempSwapRan, true, 'the staged-temp swap fixture must run');
    assert.equal((await lstat(targetPath)).isSymbolicLink(), false);
    assert.equal(await readFile(targetPath, 'utf8'), authorityText);

    let regularTempSentinelPath;
    await assert.rejects(
      writeSynchronizedAuthority(requestFor(targetPath), {
        openImpl: async (path, flags, mode) => {
          const handle = await open(path, flags, mode);
          if (flags !== 'wx') return handle;
          return {
            close: async () => {
              await handle.close();
              await rename(path, `${path}.owned-original`);
              await writeFile(path, 'attacker-regular-sentinel\n');
              regularTempSentinelPath = path;
            },
            read: (...args) => handle.read(...args),
            stat: (...args) => handle.stat(...args),
            sync: (...args) => handle.sync(...args),
            writeFile: (...args) => handle.writeFile(...args),
          };
        },
      }),
      /staged|identity|atomic replacement/iu,
    );
    assert.equal(
      await readFile(regularTempSentinelPath, 'utf8'),
      'attacker-regular-sentinel\n',
      'cleanup must not delete a regular replacement at the private temp pathname',
    );
    assert.equal(await readFile(targetPath, 'utf8'), authorityText);

    const tempArtifactsBeforePartialWrite = (await readdir(root))
      .filter((entry) => entry.startsWith('authority.json.tmp-'))
      .sort();
    await assert.rejects(
      writeSynchronizedAuthority(requestFor(targetPath), {
        openImpl: async (path, flags, mode) => {
          const handle = await open(path, flags, mode);
          if (flags !== 'wx') return handle;
          return {
            close: (...args) => handle.close(...args),
            read: (...args) => handle.read(...args),
            stat: (...args) => handle.stat(...args),
            sync: (...args) => handle.sync(...args),
            writeFile: async (output, options) => {
              await handle.writeFile(String(output).slice(0, 32), options);
              throw new Error('forced partial stage write');
            },
          };
        },
      }),
      /forced partial stage write/iu,
    );
    assert.deepEqual(
      (await readdir(root)).filter((entry) => entry.startsWith('authority.json.tmp-')).sort(),
      tempArtifactsBeforePartialWrite,
      'a failed partial write must clean its owned temp inode while preserving the attacker sentinel',
    );

    const stagedReadConcurrentText = `${authorityText}staged-read-writer\n`;
    let stagedReadRaceInjected = false;
    await assert.rejects(
      writeSynchronizedAuthority(requestFor(targetPath), {
        openImpl: async (path, flags, mode) => {
          if (
            !stagedReadRaceInjected &&
            typeof flags === 'number' &&
            path.startsWith(`${targetPath}.tmp-`)
          ) {
            stagedReadRaceInjected = true;
            await writeFile(targetPath, stagedReadConcurrentText);
          }
          return open(path, flags, mode);
        },
      }),
      /final precommit|authority changed|atomic replacement.*refused|identity/iu,
    );
    assert.equal(stagedReadRaceInjected, true, 'the staged-read target race fixture must run');
    assert.equal(
      await readFile(targetPath, 'utf8'),
      stagedReadConcurrentText,
      'a target write during staged verification must not be overwritten',
    );
    await writeFile(targetPath, authorityText);

    let lateTempPath;
    let lateTempSwapInjected = false;
    let lateTempTargetOpens = 0;
    await assert.rejects(
      writeSynchronizedAuthority(requestFor(targetPath), {
        openImpl: async (path, flags, mode) => {
          if (flags === 'wx') lateTempPath = path;
          if (
            path === targetPath &&
            typeof flags === 'number' &&
            (lateTempTargetOpens += 1) === 3
          ) {
            await rename(lateTempPath, `${lateTempPath}.late-original`);
            await symlink(victimPath, lateTempPath);
            lateTempSwapInjected = true;
          }
          return open(path, flags, mode);
        },
      }),
      /temporary|staged|symbolic link|symlink|identity/iu,
      'a temp swap during final target verification must fail before rename',
    );
    assert.equal(lateTempSwapInjected, true, 'the final-temp identity race fixture must run');
    assert.equal((await lstat(targetPath)).isSymbolicLink(), false);
    assert.equal(await readFile(targetPath, 'utf8'), authorityText);

    await assert.rejects(
      writeSynchronizedAuthority(requestFor(targetPath), {
        renameImpl: async (from, to) => {
          const stagedBytes = await readFile(from);
          await rename(from, `${from}.captured-staged`);
          const alternatePath = `${from}.alternate`;
          await writeFile(alternatePath, stagedBytes);
          await rename(alternatePath, to);
        },
      }),
      /unexpected staged inode|durability is uncertain/iu,
      'byte-identical replacement from a different inode must not be reported as the staged commit',
    );

    const liveParent = join(root, 'live-parent');
    const displacedParent = join(root, 'displaced-parent');
    const parentTarget = join(liveParent, 'authority.json');
    await mkdir(liveParent);
    await writeFile(parentTarget, authorityText);
    let attackerSentinelPath;
    await assert.rejects(
      writeSynchronizedAuthority(requestFor(parentTarget), {
        openImpl: async (path, flags, mode) => {
          const handle = await open(path, flags, mode);
          if (flags !== 'wx') return handle;
          return {
            close: async () => {
              await handle.close();
              await rename(liveParent, displacedParent);
              await mkdir(liveParent);
              attackerSentinelPath = join(liveParent, basename(path));
              await writeFile(attackerSentinelPath, 'attacker-sentinel\n');
            },
            read: (...args) => handle.read(...args),
            stat: (...args) => handle.stat(...args),
            sync: (...args) => handle.sync(...args),
            writeFile: (...args) => handle.writeFile(...args),
          };
        },
      }),
      /parent changed identity/iu,
    );
    assert.equal(await readFile(attackerSentinelPath, 'utf8'), 'attacker-sentinel\n');
    assert.equal(await readFile(join(displacedParent, 'authority.json'), 'utf8'), authorityText);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('keeps CI and upgrade command modes explicit and fail-closed', async () => {
  const { parsePeerCompatibilityArguments } = await loadChecker();
  const tarballPath = resolve(tmpdir(), 'lyra-ui.tgz');
  const beforeManifestPath = resolve(tmpdir(), 'before.json');
  assert.deepEqual(parsePeerCompatibilityArguments([]), {
    beforeManifest: undefined,
    mode: 'run',
    tarball: undefined,
  });
  assert.deepEqual(parsePeerCompatibilityArguments(['--tarball', tarballPath]), {
    beforeManifest: undefined,
    mode: 'run',
    tarball: tarballPath,
  });
  assert.equal(parsePeerCompatibilityArguments(['--check-authority']).mode, 'check');
  assert.equal(parsePeerCompatibilityArguments(['--write-current-versions']).mode, 'write-current');
  assert.deepEqual(
    parsePeerCompatibilityArguments(['--check-managed-peer-rewrites', beforeManifestPath]),
    {
      beforeManifest: beforeManifestPath,
      mode: 'check-rewrites',
      tarball: undefined,
    },
  );
  assert.throws(
    () => parsePeerCompatibilityArguments(['--check-authority', '--tarball', tarballPath]),
    /tarball.*actual profile run/u,
  );
  assert.throws(() => parsePeerCompatibilityArguments(['--unknown']), /Unknown/u);
});

test('embeds deterministic consumer-owned capability fixtures for both package managers', async () => {
  const { createConsumerFileMap, resolvePeerProfiles } = await loadChecker();
  const authority = authorityFixture();
  const profile = resolvePeerProfiles(authority)[0];

  for (const packageManager of ['pnpm', 'npm']) {
    const options = {
      authority,
      packageManager,
      profile,
      tarballSpecifier: `http://127.0.0.1:43123/lyra-00000000-0000-4000-8000-000000000000-${'a'.repeat(64)}.tgz`,
    };
    const first = createConsumerFileMap(options);
    const second = createConsumerFileMap(options);
    assert.deepEqual(first, second);
    assert.ok(first.has('package.json'));
    assert.ok(first.has('.npmrc'));
    assert.match(first.get('src/type-contract.ts'), /LyraChartPreloadOptions/u);
    assert.doesNotMatch(first.get('src/type-contract.ts'), /annotations: true/u);
    for (const consumerSource of [
      first.get('src/type-contract.ts'),
      first.get('src/node-contract.mjs'),
      first.get('src/browser.ts'),
    ]) {
      assert.doesNotMatch(consumerSource, /loadBoxPlotAndRegister/u);
    }
    assert.match(
      first.get('src/browser.ts'),
      /import \{ BoxPlotController, BoxAndWiskers \} from '@sgratzl\/chartjs-chart-boxplot'/u,
    );
    assert.match(first.get('src/node-contract.mjs'), /preloadCharts\(\{ boxPlot: true \}\)/u);
    assert.match(first.get('src/node-contract.mjs'), /convertToHtml/u);
    assert.match(first.get('src/browser.ts'), /\[part="math"\] math/u);
    assert.ok(first.get('src/browser.ts').includes("hostileSource = '# Safe\\n\\n<script>"));
    assert.match(first.get('src/browser.ts'), /lr-docx-viewer/u);
    assert.match(first.get('src/browser.ts'), /DOMPurify/u);
    assert.match(first.get('src/browser.ts'), /annotation\.plugin\.id === 'annotation'/u);
    assert.match(first.get('src/browser.ts'), /dataLabels\.plugin\.id === 'datalabels'/u);
    assert.match(first.get('src/browser.ts'), /zoom\.plugin\.id === 'zoom'/u);
    assert.match(first.get('src/browser.ts'), /core\.Chart\.registry\.getPlugin\(annotation\.plugin\.id\) === annotation\.plugin/u);
    assert.match(first.get('src/browser.ts'), /core\.Chart\.registry\.getPlugin\(zoom\.plugin\.id\) === zoom\.plugin/u);
    assert.match(first.get('src/browser.ts'), /chart\.config\.plugins\[0\] === dataLabels\.plugin/u);
    assert.match(first.get('src/browser.ts'), /chart\.isPluginEnabled\('datalabels'\)/u);
    assert.match(first.get('src/browser.ts'), /formatterCalls > 0/u);
    assert.match(first.get('src/browser.ts'), /labelDraws > 0/u);
    assert.doesNotMatch(first.get('src/browser.ts'), /annotations: true/u);
    assert.doesNotMatch(first.get('src/browser.ts'), /preload\.annotations/u);
    assert.match(
      first.get('src/browser.ts'),
      /if \(window\.__LYRA_PEER_COMPATIBILITY__\?\.status === 'running'\)[\s\S]*status: 'passed'/u,
      'a prior global error must remain sticky when the main capability run resolves',
    );
    assert.match(first.get('scripts/run-browser.mjs'), /pipeline\(createReadStream\(file\), response\)/u);
    assert.match(first.get('scripts/run-browser.mjs'), /chromium\.launchServer/u);
    assert.match(first.get('scripts/run-browser.mjs'), /chromium\.connect\(browserServer\.wsEndpoint\(\)/u);
    assert.match(first.get('scripts/run-browser.mjs'), /await browserServer\.kill\(\)/u);
    assert.doesNotMatch(first.get('scripts/run-browser.mjs'), /bounded\([^\n]+browserServer\.kill/u);
    assert.match(first.get('scripts/run-browser.mjs'), /server\.closeAllConnections/u);
    assert.match(first.get('scripts/run-browser.mjs'), /cleanupError/u);
    assert.match(first.get('src/browser.ts'), /type: 'boxplot'/u);
    assert.match(first.get('src/browser.ts'), /controller\.constructor === BoxPlotController/u);
    assert.match(first.get('src/browser.ts'), /element\.constructor === BoxAndWiskers/u);
    assert.match(first.get('src/browser.ts'), /element\.inRange\(element\.x, element\.y, true\)/u);
    assert.match(first.get('src/browser.ts'), /boxPlotDrawCalls > 0/u);
    assert.match(first.get('src/fixtures.mjs'), /MINIMAL_DOCX_BASE64/u);
    const encodedDocx = /MINIMAL_DOCX_BASE64 = ([^;]+);/u.exec(
      first.get('src/fixtures.mjs'),
    );
    assert.ok(encodedDocx);
    const docxBytes = Buffer.from(JSON.parse(encodedDocx[1]), 'base64');
    assert.equal(docxBytes.length, 2_643);
    assert.equal(
      createHash('sha256').update(docxBytes).digest('hex'),
      '5bddf727bb151a0b37e650537f3f8363684ef619568f8b3fd5aa48cb7be7858d',
    );
    assert.doesNotMatch(
      [...first.values()].join('\n'),
      /(?:src\/components\/.*\/fixtures|minimal-docx-fixture\.js)/u,
    );
    for (const [name, source] of first) {
      if (!name.endsWith('.mjs')) continue;
      const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], {
        encoding: 'utf8',
        input: source,
      });
      assert.equal(syntax.status, 0, `${name} must parse as an ES module: ${syntax.stderr}`);
    }
  }
});
