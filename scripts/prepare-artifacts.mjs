import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { capturePublishedCompatibility } from '../packages/lyra-ui/scripts/capture-published-compatibility.mjs';
import { capturePolicyWitnesses } from '../packages/lyra-ui/scripts/capture-published-policy-witnesses.mjs';
import { checkPublishedCompatibilitySync } from '../packages/lyra-ui/scripts/check-published-compatibility.mjs';
import { decodeEvidence, encodeEvidence, jsonBytes, readPublishedCaptureSync, sha256, verifyPolicyWitnesses } from '../packages/lyra-ui/scripts/published-compatibility-io.mjs';

// This runner prepares reviewable source only. Qualification and publication retain their
// existing workflows; neither this script nor its workflow writes Git refs.
assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Use the hosted generation workflow');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Generation requires main');
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

function bundle() {
  const commit = git(['rev-parse', 'HEAD']).toString().trim();
  assert.equal(commit, process.env.GITHUB_SHA);
  const tracked = new Map(git(['ls-tree', '-rz', 'HEAD']).toString().split('\0').filter(Boolean).map(line => {
    const [header, file] = line.split('\t');
    const [mode, kind, oid] = header.split(' ');
    return [file, { mode, kind, oid }];
  }));
  const modified = git(['diff', 'HEAD', '--name-only', '-z']).toString().split('\0').filter(Boolean);
  const added = git(['ls-files', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
  const hiddenGenerated = new Set([
    '.storybook/token-preview.generated.js', '.storybook/sitemap.xml',
    '.claude-plugin/marketplace.json',
    'plugins/lyra-ui/.claude-plugin/plugin.json', 'plugins/lyra-ui/.codex-plugin/plugin.json',
  ]);
  // New generated files are restricted to the library projections and packaged references.
  // All authored source additions must already be committed before running this workflow.
  for (const file of added) assert.ok(hiddenGenerated.has(file) || /^(?:packages\/lyra-ui\/(?:src|llms|scripts\/fixtures)\/|plugins\/lyra-ui\/skills\/(?:lyra-ui|compose-lyra-interfaces)\/|docs\/changelog\/v\d+\.md$|skills\/[^/]+\.skill$)/u.test(file), `Unexpected generated addition ${file}`);
  const output = join(process.env.RUNNER_TEMP, 'lyra-generated-source');
  assert.ok(!existsSync(output));
  mkdirSync(join(output, 'blobs'), { recursive: true });
  const changes = [];
  for (const file of [...new Set([...modified, ...added])].sort()) {
    assert.ok(hiddenGenerated.has(file) || !file.split('/').some(part => part.startsWith('.') || ['node_modules', 'dist'].includes(part)), `Non-source path ${file}`);
    assert.ok(!/(?:^|\/)(?:[^/]*\.log|[^/]*\.pem|[^/]*\.key)$/u.test(file), `Non-source path ${file}`);
    const old = tracked.get(file);
    if (old) assert.equal(old.kind, 'blob');
    if (old) assert.ok(['100644', '100755'].includes(old.mode));
    const before = old ? { sha256: sha256(git(['cat-file', 'blob', old.oid])), gitBlob: old.oid, mode: old.mode } : null;
    const target = resolve(root, file);
    let after = null;
    if (existsSync(target)) {
      const stat = lstatSync(target);
      assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Non-regular source ${file}`);
      const bytes = readFileSync(target);
      const hash = sha256(bytes);
      const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      after = { sha256: hash, gitBlob, mode: stat.mode & 0o111 ? '100755' : '100644', bytes: bytes.length };
      const blob = join(output, 'blobs', hash);
      if (!existsSync(blob)) writeFileSync(blob, bytes, { flag: 'wx' });
    }
    changes.push({ path: file, before, after });
  }
  const manifest = { schemaVersion: 1, repository: process.env.GITHUB_REPOSITORY, baseCommit: commit,
    runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, changes };
  const bytes = jsonBytes(manifest);
  writeFileSync(join(output, 'manifest.json'), bytes);
  writeFileSync(join(output, 'manifest.sha256'), `${sha256(bytes)}  manifest.json\n`);
  writeFileSync(join(output, 'changes.patch'), git(['diff', 'HEAD', '--binary', '--full-index']));
  writeFileSync(join(output, 'README.txt'), 'Review manifest.json and every changed path before applying. Verify the repository/baseCommit and all current before hashes/modes (null means absent), then every blob hash/length before any write. A null after means deletion. Apply regular files with the recorded modes. changes.patch previews tracked changes only; the manifest also includes new files. This artifact is generated source, not release qualification.\n');
  console.log(`Prepared ${changes.length} source changes against ${commit}`);
}

if (process.argv[2] === 'capture') await capture();
else if (process.argv[2] === 'bundle') bundle();
else throw new Error('Expected capture or bundle');
