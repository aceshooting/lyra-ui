import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const regularFile = (file) => {
  if (!lstatSync(file).isFile()) throw new Error(`Expected a regular release asset: ${path.basename(file)}.`);
};

// Pin the emitted SBOM format to CycloneDX 1.6.
const SBOM_SPEC_VERSION = '1.6';
const SBOM_PARTY = 'Aceshooting';
const SBOM_INPUTS = ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'];

/** A UUID with the version 5 layout, derived from `seed` so equal inputs give an equal serial number. */
function stableUuid(seed) {
  const bytes = createHash('sha256').update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

/**
 * Make a `pnpm sbom` document a pure function of the tagged commit: components and dependencies in
 * code-unit order, a serial number derived from the root component and commit, and the commit's own
 * time instead of the clock. The release verifier regenerates the document and compares bytes.
 */
export function normalizeSbom(bom, { sourceSha, timestamp }) {
  const byKey = (key) => (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0);
  const sorted = (dependency) => (dependency.dependsOn
    ? { ...dependency, dependsOn: [...dependency.dependsOn].sort() }
    : dependency);
  return `${JSON.stringify({
    ...bom,
    serialNumber: `urn:uuid:${stableUuid(`${bom.metadata?.component?.['bom-ref']}@${sourceSha}`)}`,
    metadata: { ...bom.metadata, timestamp },
    components: [...(bom.components ?? [])].sort(byKey('bom-ref')),
    dependencies: (bom.dependencies ?? []).map(sorted).sort(byKey('ref')),
  }, null, 2)}\n`;
}

/** `pnpm sbom` of the package's production dependency closure, read from the installed workspace. */
function pnpmSbom({ expected, sourceSha, repositoryRoot, verifyCheckout }) {
  // The document follows the lockfile and manifests, so a release needs the tagged bytes in place.
  for (const file of verifyCheckout ? [...SBOM_INPUTS, `${expected.directory}/package.json`] : []) {
    const committed = execFileSync('git', ['show', `${sourceSha}:${file}`], {
      cwd: repositoryRoot, maxBuffer: 64 * 1024 * 1024,
    });
    if (!readFileSync(path.join(repositoryRoot, file)).equals(committed)) {
      throw new Error(`${file} differs from commit ${sourceSha}; generate the SBOM from the tagged checkout.`);
    }
  }
  const scratch = mkdtempSync(path.join(tmpdir(), 'lyra-sbom-'));
  try {
    const out = path.join(scratch, 'sbom.json');
    execFileSync('pnpm', ['sbom', '--sbom-format', 'cyclonedx', '--sbom-spec-version', SBOM_SPEC_VERSION,
      '--prod', '--filter', expected.packageName, '--fail-if-no-match',
      '--sbom-authors', SBOM_PARTY, '--sbom-supplier', SBOM_PARTY, '--out', out],
    { cwd: repositoryRoot, stdio: ['ignore', 'inherit', 'inherit'] });
    return JSON.parse(readFileSync(out, 'utf8'));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * The package's CycloneDX SBOM as reproducible bytes. `run` is the injection point for tests.
 * A release always verifies that the checkout holds the tagged inputs; scripts/check-sbom.mjs turns
 * that off to exercise the generator on a working tree.
 */
export function generateSbom({ expected, sourceSha, repositoryRoot, run = pnpmSbom, verifyCheckout = true }) {
  const bom = run({ expected, sourceSha, repositoryRoot, verifyCheckout });
  const root = bom.metadata?.component;
  if (bom.bomFormat !== 'CycloneDX' || bom.specVersion !== SBOM_SPEC_VERSION ||
      `${root?.group}/${root?.name}` !== expected.packageName || root?.version !== expected.version) {
    throw new Error('The SBOM does not describe the tagged package.');
  }
  const seconds = Number(execFileSync('git', ['show', '-s', '--format=%ct', sourceSha], {
    cwd: repositoryRoot, encoding: 'utf8',
  }));
  return Buffer.from(normalizeSbom(bom, { sourceSha, timestamp: new Date(seconds * 1000).toISOString() }));
}

/** Read asset policy and bytes from the immutable commit, never the mutable checkout. */
function releaseArtifactSpec({ expected, sourceSha, repositoryRoot }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('Expected a full source commit SHA.');
  const show = (file) => execFileSync('git', ['show', `${sourceSha}:${file}`], {
    cwd: repositoryRoot, maxBuffer: 64 * 1024 * 1024,
  });
  const metadata = JSON.parse(show(`${expected.directory}/package.json`).toString('utf8'));
  if (metadata.name !== expected.packageName || metadata.version !== expected.version) {
    throw new Error('Release assets do not match the tagged package identity.');
  }
  const packageDirectory = path.posix.basename(expected.directory);
  const standalone = ['CHANGELOG.md'];
  if (metadata.scripts?.manifest) standalone.push('custom-elements.json', 'llms.txt', 'llms-full.txt');
  return {
    sourceName: `${packageDirectory}-${expected.version}-source.tar`,
    tarballName: `aceshooting-${packageDirectory}-${expected.version}.tgz`,
    standalone,
    // Reproduced from the tagged commit rather than committed: the CycloneDX SBOM.
    sbomName: `${packageDirectory}-${expected.version}.cdx.json`,
    show,
  };
}

/**
 * Add the canonical source distribution, the committed standalone assets and the package SBOM to
 * the pack directory. `sbom` generates the SBOM bytes (injectable for tests).
 */
export function collectReleaseAssets({ expected, sourceSha, repositoryRoot, directory, sbom = generateSbom }) {
  const spec = releaseArtifactSpec({ expected, sourceSha, repositoryRoot });
  mkdirSync(directory, { recursive: true });
  execFileSync('git', ['-c', 'core.attributesFile=/dev/null', 'archive', '--format=tar',
    `--prefix=lyra-ui-${sourceSha}/`, `--output=${path.resolve(directory, spec.sourceName)}`, sourceSha],
  { cwd: repositoryRoot });
  for (const name of spec.standalone) {
    writeFileSync(path.join(directory, name), spec.show(`${expected.directory}/${name}`));
  }
  writeFileSync(path.join(directory, spec.sbomName), sbom({ expected, sourceSha, repositoryRoot }));
  return spec;
}

/** Check every download before any signing credentials are available. */
export function verifyReleaseAssets({
  expected, sourceSha, repositoryRoot, directory, outputDirectory, sbom = generateSbom,
}) {
  if (path.resolve(directory) === path.resolve(outputDirectory)) {
    throw new Error('Release download and verified asset directories must differ.');
  }
  const spec = releaseArtifactSpec({ expected, sourceSha, repositoryRoot });
  const additionalNames = [spec.sourceName, ...spec.standalone, spec.sbomName].sort();
  const payloadNames = [spec.tarballName, ...additionalNames];
  const allowedNames = new Set(payloadNames.flatMap((name) => [name, `${name}.sigstore.json`, `${name}.intoto.jsonl`]));
  for (const name of readdirSync(directory)) {
    if (!allowedNames.has(name)) throw new Error(`Unexpected release asset: ${name}.`);
    regularFile(path.join(directory, name));
  }
  for (const name of payloadNames) regularFile(path.join(directory, name));
  mkdirSync(outputDirectory, { recursive: true });
  if (readdirSync(outputDirectory).length) throw new Error('Verified asset directory must be empty.');
  collectReleaseAssets({ expected, sourceSha, repositoryRoot, directory: outputDirectory, sbom });
  for (const name of additionalNames) {
    const downloaded = path.join(directory, name);
    const reproduced = path.join(outputDirectory, name);
    if (!readFileSync(downloaded).equals(readFileSync(reproduced))) {
      throw new Error(`Release asset does not byte-match tagged source: ${name}.`);
    }
    copyFileSync(downloaded, reproduced);
  }
  const manifest = path.join(outputDirectory, 'SHA256SUMS');
  writeFileSync(manifest, additionalNames.map((name) => `${digest(path.join(outputDirectory, name))}  ${name}\n`).join(''));
  return { manifestSha256: digest(manifest), payloadNames };
}
