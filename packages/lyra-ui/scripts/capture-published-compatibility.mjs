import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isMainModule } from './is-main-module.mjs';
import { compatibilityExportCandidates, extractPublishedCompatibility, publishedExportSurface } from './published-compatibility.mjs';
import { inspectExportContract } from './component-metadata.mjs';
import { SOURCE_INPUTS, PACKED_INPUTS, sha256, jsonBytes, encodeEvidence, parseGitTree, validatePublishedCapture } from './published-compatibility-io.mjs';

/** Explicit read-only capture of already verified immutable publication inputs. Never fetches. */
export function capturePublishedCompatibility({ repository, tag, tagObject, commit, tarball, tarballSha256, registryIntegrity, output }) {
  if (existsSync(output)) throw new Error('Capture output already exists; published evidence is immutable');
  const git = args => execFileSync('git', ['-C', repository, ...args], { maxBuffer: 32 * 1024 * 1024 });
  if (!/^[a-f0-9]{40}$/u.test(commit) || !/^[a-f0-9]{40}$/u.test(tagObject) || !/^lyra-ui@\d+\.\d+\.\d+$/u.test(tag)) throw new Error('Invalid immutable Git identities');
  const tarBytes = readFileSync(tarball);
  if (sha256(tarBytes) !== tarballSha256 || `sha512-${createHash('sha512').update(tarBytes).digest('base64')}` !== registryIntegrity) throw new Error('Published tarball integrity mismatch');
  const members = execFileSync('tar', ['-tzf', resolve(tarball)], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim().split('\n');
  const objects = new Map(); const payloads = Object.create(null); const inputs = []; const parsed = {};
  const object = (oid, type) => {
    if (!objects.has(oid)) { const data = git(['cat-file', type, oid]); objects.set(oid, { oid, type, data: data.toString('base64') }); }
    return Buffer.from(objects.get(oid).data, 'base64');
  };
  object(tagObject, 'tag');
  const root = /^tree ([a-f0-9]{40})$/mu.exec(object(commit, 'commit').toString('utf8'))?.[1];
  if (!root) throw new Error('Pinned commit has no tree');
  const save = (origin, role, path, bytes, gitBlob = null) => {
    const hash = sha256(bytes); payloads[hash] = bytes.toString('base64');
    inputs.push({ origin, role, path, sha256: hash, bytes: bytes.length, gitBlob });
    if (origin === 'source') parsed[role] = JSON.parse(bytes.toString('utf8'));
  };
  const sourceBlob = path => {
    let tree = root; let entry;
    for (const part of path.split('/')) {
      entry = parseGitTree(object(tree, 'tree')).get(part);
      if (!entry) throw new Error(`Missing source path ${path}`);
      tree = entry.oid;
    }
    return { bytes: git(['cat-file', 'blob', entry.oid]), oid: entry.oid };
  };
  for (const [role, relative] of Object.entries(SOURCE_INPUTS)) {
    const path = `packages/lyra-ui/${relative}`; const blob = sourceBlob(path);
    save('source', role, path, blob.bytes, blob.oid);
  }
  for (const [role, path] of Object.entries(PACKED_INPUTS)) {
    if (members.filter(member => member === path).length !== 1) throw new Error(`Missing or duplicate packed input ${path}`);
    save('packed', role, path, execFileSync('tar', ['-xOzf', resolve(tarball), '--', path], { maxBuffer: 32 * 1024 * 1024 }));
  }
  const historyFacts = [];
  if (Number(parsed.packageJson.version.split('.')[0]) >= 23) {
    const historyPrefix = 'packages/lyra-ui/scripts/fixtures/compatibility-history/';
    const indexPath = historyPrefix + 'index.json'; const indexBlob = sourceBlob(indexPath);
    const historyIndex = JSON.parse(indexBlob.bytes.toString('utf8'));
    save('source-history', 'history', indexPath, indexBlob.bytes, indexBlob.oid);
    if (!Array.isArray(historyIndex.captures) || historyIndex.captures.length === 0) throw new Error('Published compatibility history is empty');
    for (const entry of historyIndex.captures) {
      if (!/^\d+\.\d+\.\d+$/u.test(entry.directory) || !/^[a-f0-9]{64}$/u.test(entry.captureSha256)) throw new Error('Invalid source compatibility capture pin');
      for (const name of ['capture.json', 'facts.json', 'evidence.json.gz']) {
        const path = historyPrefix + entry.directory + '/' + name; const blob = sourceBlob(path);
        save('source-history', 'history', path, blob.bytes, blob.oid);
        if (name === 'facts.json') historyFacts.push(JSON.parse(blob.bytes.toString('utf8')));
      }
    }
  }
  parsed.exportSources = Object.create(null);
  const readExportSource = path => {
    if (!Object.hasOwn(parsed.exportSources, path)) {
      const sourcePath = `packages/lyra-ui/${path}`; const blob = sourceBlob(sourcePath);
      save('source-export', 'text', sourcePath, blob.bytes, blob.oid);
      parsed.exportSources[path] = blob.bytes.toString('utf8');
    }
    return parsed.exportSources[path];
  };
  publishedExportSurface({ metadata: parsed.metadata, packageJson: parsed.packageJson, readSource: readExportSource });
  for (const entry of compatibilityExportCandidates(parsed.metadata, historyFacts)) {
    const fact = inspectExportContract(entry, { packageJson: parsed.packageJson, readSource: readExportSource,
      exportDeprecations: parsed.metadata.exportDeprecations });
    if (fact.status === 'invalid') throw new Error(`Cannot inspect historical export ${entry.name}: ${fact.findings.join('; ')}`);
  }
  const facts = extractPublishedCompatibility(parsed);
  const evidence = { schemaVersion: 1, payloads, gitObjects: [...objects.values()] };
  const archive = encodeEvidence(evidence);
  const capture = { schemaVersion: 1, sourceRelease: tag, sourceVersion: parsed.packageJson.version,
    git: { tagObject, commit }, package: { name: parsed.packageJson.name, version: parsed.packageJson.version, tarballSha256, registryIntegrity },
    extractorVersion: 1, inputs, evidenceArchiveSha256: sha256(archive), factsSha256: sha256(jsonBytes(facts)), retirements: [] };
  validatePublishedCapture(capture, facts, evidence);
  mkdirSync(dirname(output), { recursive: true });
  const staging = `${output}.pending-${process.pid}`;
  mkdirSync(staging);
  try {
    writeFileSync(join(staging, 'capture.json'), jsonBytes(capture));
    writeFileSync(join(staging, 'facts.json'), jsonBytes(facts));
    writeFileSync(join(staging, 'evidence.json.gz'), archive);
    if (existsSync(output)) throw new Error('Capture output appeared during validation');
    renameSync(staging, output);
  } finally { rmSync(staging, { recursive: true, force: true }); }
  return { sourceRelease: tag, records: facts.records.length, archiveBytes: archive.length,
    factsBytes: jsonBytes(facts).length, evidenceArchiveSha256: capture.evidenceArchiveSha256 };
}

if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({ options: Object.fromEntries(['repository', 'tag', 'tag-object', 'commit', 'tarball', 'tarball-sha256', 'registry-integrity', 'output'].map(name => [name, { type: 'string' }])) });
  if (Object.keys(values).length !== 8) throw new Error('All immutable capture arguments are required');
  console.log(JSON.stringify(capturePublishedCompatibility({ ...values, tagObject: values['tag-object'], tarballSha256: values['tarball-sha256'], registryIntegrity: values['registry-integrity'] }), null, 2));
}
