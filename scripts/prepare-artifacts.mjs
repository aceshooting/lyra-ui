import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { capturePublishedCompatibility } from '../packages/lyra-ui/scripts/capture-published-compatibility.mjs';
import { capturePolicyWitnesses } from '../packages/lyra-ui/scripts/capture-published-policy-witnesses.mjs';
import { checkPublishedCompatibilitySync } from '../packages/lyra-ui/scripts/check-published-compatibility.mjs';
import { decodeEvidence, encodeEvidence, jsonBytes, readPublishedCaptureSync, sha256, verifyPolicyWitnesses } from '../packages/lyra-ui/scripts/published-compatibility-io.mjs';
import { assertPreparationInputs } from './prepare-artifacts-paths.mjs';
import { bundlePreparedSource } from './prepare-source-bundle.mjs';
import { parseSourceContractRequest } from './source-contract-request.mjs';

// This runner prepares reviewable source only. Qualification and publication retain their
// existing workflows; neither this script nor its workflow writes Git refs.
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Use the hosted generation workflow');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Generation requires main');
const preparationMode = process.env.PREPARATION_MODE ?? 'source';
assertPreparationInputs(preparationMode, process.env.PUBLICATION_JSON ?? '', process.env.SOURCE_CONTRACTS_JSON ?? '', process.env.UPGRADE_DEPENDENCIES ?? 'false', process.env.PREPARATION_CANDIDATE_SHA ?? '');
const root = process.cwd();
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 128 * 1024 * 1024 });
const historyDir = join(root, 'packages/lyra-ui/scripts/fixtures/compatibility-history');
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

async function fetchBytes(url, maxBytes) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
  assert.equal(response.status, 200, `Cannot fetch ${url}`);
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    assert.ok(size <= maxBytes, 'Publication response exceeds the size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchPublication(pin, directory) {
  assert.match(pin.version, /^\d+\.\d+\.\d+$/u);
  assert.match(pin.tagObject, /^[a-f0-9]{40}$/u);
  assert.match(pin.commit, /^[a-f0-9]{40}$/u);
  assert.match(pin.tarballSha256, /^[a-f0-9]{64}$/u);
  assert.match(pin.registryIntegrity, /^sha512-[A-Za-z0-9+/]{86}==$/u);
  const tag = `lyra-ui@${pin.version}`;
  assert.equal(git(['rev-parse', `refs/tags/${tag}`]).toString().trim(), pin.tagObject);
  assert.equal(git(['rev-parse', `refs/tags/${tag}^{commit}`]).toString().trim(), pin.commit);
  const metadata = JSON.parse(await fetchBytes(`https://registry.npmjs.org/@aceshooting%2flyra-ui/${pin.version}`, 2 * 1024 * 1024));
  assert.equal(metadata.name, '@aceshooting/lyra-ui');
  assert.equal(metadata.version, pin.version);
  assert.equal(metadata.dist.integrity, pin.registryIntegrity);
  const url = `https://registry.npmjs.org/@aceshooting/lyra-ui/-/lyra-ui-${pin.version}.tgz`;
  assert.equal(metadata.dist.tarball, url);
  const bytes = await fetchBytes(url, 64 * 1024 * 1024);
  assert.equal(sha256(bytes), pin.tarballSha256);
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, pin.registryIntegrity);
  const tarball = join(directory, `${pin.version}.tgz`);
  writeFileSync(tarball, bytes, { flag: 'wx' });
  execFileSync('gh', ['attestation', 'verify', tarball, '--repo', process.env.GITHUB_REPOSITORY,
    '--signer-workflow', `${process.env.GITHUB_REPOSITORY}/.github/workflows/publish.yml`,
    '--source-digest', pin.commit, '--source-ref', `refs/tags/${tag}`, '--deny-self-hosted-runners'], { stdio: 'inherit' });
  return { tarball, tarballSha256: pin.tarballSha256, registryIntegrity: pin.registryIntegrity };
}

async function capture() {
  if (!process.env.PUBLICATION_JSON) return;
  const pin = JSON.parse(process.env.PUBLICATION_JSON);
  assert.deepEqual(Object.keys(pin).sort(), ['commit', 'registryIntegrity', 'tagObject', 'tarballSha256', 'version']);
  const original = checkPublishedCompatibilitySync(historyDir);
  const index = readJson(join(historyDir, 'index.json'));
  const witnesses = decodeEvidence(readFileSync(join(historyDir, index.policyWitnesses.file)));
  const scratch = mkdtempSync(join(process.env.RUNNER_TEMP, 'lyra-publication-'));
  try {
    const publication = await fetchPublication(pin, scratch);
    const existing = original.captures.find(entry => entry.capture.sourceVersion === pin.version);
    if (existing) {
      assert.deepEqual(existing.capture.git, { tagObject: pin.tagObject, commit: pin.commit });
      assert.equal(existing.capture.package.tarballSha256, pin.tarballSha256);
      assert.equal(existing.capture.package.registryIntegrity, pin.registryIntegrity);
      return;
    }
    const output = join(scratch, 'capture');
    capturePublishedCompatibility({ repository: root, tag: `lyra-ui@${pin.version}`, ...pin, ...publication, output });
    const captured = readPublishedCaptureSync(output);
    // Only new witnesses are captured. Existing witness values and publication evidence remain
    // byte-for-byte identical within the decoded archive.
    const missing = captured.facts.policyReleaseHistory.filter(release =>
      !witnesses.releases.some(witness => witness.sourceRelease === release.tag));
    for (const release of missing) {
      const authority = original.captures.find(entry => entry.capture.sourceRelease === release.tag)?.capture;
      assert.ok(authority, `No reviewed published capture supplies witness pins for ${release.tag}`);
      assert.equal(authority.git.commit, release.sourceCommit);
      assert.equal(authority.sourceVersion, release.version);
      const previous = await fetchPublication({ version: authority.sourceVersion, ...authority.git, ...authority.package }, scratch);
      const witnessPath = join(scratch, `witness-${release.version}.gz`);
      capturePolicyWitnesses({ repository: root, facts: { policyReleaseHistory: [release] },
        tagObjects: { [release.tag]: authority.git.tagObject }, publications: { [release.tag]: previous }, output: witnessPath });
      witnesses.releases.push(...decodeEvidence(readFileSync(witnessPath)).releases);
    }
    verifyPolicyWitnesses(witnesses, [...original.captures, captured], index.guidanceTransitions);
    const archive = encodeEvidence(witnesses);
    index.captures.push({ directory: pin.version, captureSha256: sha256(readFileSync(join(output, 'capture.json'))) });
    index.policyWitnesses.sha256 = sha256(archive);
    // All authority has been verified before adding the new capture and replacing aggregate pins.
    const destination = join(historyDir, pin.version);
    assert.ok(!existsSync(destination), 'Published capture output must be new');
    mkdirSync(destination);
    for (const name of ['capture.json', 'facts.json', 'evidence.json.gz']) {
      writeFileSync(join(destination, name), readFileSync(join(output, name)), { flag: 'wx' });
    }
    writeFileSync(join(historyDir, index.policyWitnesses.file), archive);
    writeFileSync(join(historyDir, 'index.json'), jsonBytes(index));
    checkPublishedCompatibilitySync(historyDir);
    // Capture readers retain the exact original authority snapshot for preservation checks.
    for (const snapshot of original.snapshots) {
      if ([join(historyDir, 'index.json'), join(historyDir, index.policyWitnesses.file)].includes(snapshot.file)) continue;
      assert.deepEqual(readFileSync(snapshot.file), snapshot.original);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}


if (process.argv[2] === 'capture') await capture();
else if (process.argv[2] === 'source-contracts') {
  const request = parseSourceContractRequest(process.env.SOURCE_CONTRACTS_JSON ?? '', preparationMode);
  if (request) {
    const { writePreparedSourceContracts } = await import('./prepare-source-contracts.mjs');
    writePreparedSourceContracts(root, request);
  }
}
else if (process.argv[2] === 'bundle') bundlePreparedSource(root);
else throw new Error('Expected capture, source-contracts, or bundle');
