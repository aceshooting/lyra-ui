import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assembleCompatibilityContext, compatibilityExportCandidates, extractPublishedCompatibility, policyKey } from './published-compatibility.mjs';
import { inspectExportContract } from './component-metadata.mjs';
import { projectRenameLedger } from './lyra-rename-ledger.mjs';

export const SOURCE_INPUTS = Object.freeze({
  packageJson: 'package.json', manifest: 'custom-elements.json',
  metadata: 'scripts/fixtures/component-metadata.json', inventory: 'scripts/fixtures/component-inventory.json',
  renameLedger: 'scripts/fixtures/lyra-renames.json',
});
export const PACKED_INPUTS = Object.freeze({
  packageJson: 'package/package.json', manifest: 'package/custom-elements.json',
  migrationContract: 'package/dist/cli/migration-contract.json',
});
const MAX_EVIDENCE_BYTES = 96 * 1024 * 1024;
const oidPattern = /^[a-f0-9]{40}$/u;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
function ensure(condition, message) { if (!condition) throw new Error(message); }
function base64(value) {
  ensure(typeof value === 'string' && value.length <= MAX_EVIDENCE_BYTES, 'Invalid evidence base64');
  const bytes = Buffer.from(value, 'base64');
  ensure(bytes.toString('base64') === value, 'Noncanonical evidence base64');
  return bytes;
}
export function encodeEvidence(value) { return gzipSync(jsonBytes(value), { level: 9 }); }
export function decodeEvidence(bytes, maxBytes = MAX_EVIDENCE_BYTES) {
  ensure(bytes.length <= MAX_EVIDENCE_BYTES, 'Compressed evidence exceeds size limit');
  return JSON.parse(gunzipSync(bytes, { maxOutputLength: maxBytes }).toString('utf8'));
}

export function decodeCaptureEvidence(capture, bytes) {
  ensure(sha256(bytes) === capture?.evidenceArchiveSha256, 'Evidence archive hash mismatch');
  return decodeEvidence(bytes);
}
export function gitObjectId(type, bytes) {
  ensure(['blob', 'tree', 'commit', 'tag'].includes(type), 'Unsupported Git object type');
  return createHash('sha1').update(`${type} ${bytes.length}\0`).update(bytes).digest('hex');
}
export function parseGitTree(bytes) {
  const entries = new Map(); let offset = 0;
  while (offset < bytes.length) {
    const separator = bytes.indexOf(32, offset); const end = bytes.indexOf(0, separator + 1);
    ensure(separator > offset && end > separator && end + 21 <= bytes.length, 'Malformed Git tree');
    const mode = bytes.subarray(offset, separator).toString('ascii');
    const name = bytes.subarray(separator + 1, end).toString('utf8');
    ensure(!entries.has(name) && name !== '.' && name !== '..' && !name.includes('/'), 'Invalid Git tree entry');
    entries.set(name, { mode, oid: bytes.subarray(end + 1, end + 21).toString('hex') });
    offset = end + 21;
  }
  return entries;
}
/** Verify saved Git objects without invoking Git or trusting mutable local refs. */
export function verifyGitEvidence({ pin, objects, inputs }) {
  ensure(oidPattern.test(pin?.commit) && oidPattern.test(pin?.tagObject), 'Invalid pinned Git identity');
  const indexed = new Map(); const used = new Set();
  for (const object of objects) {
    const bytes = base64(object.data);
    ensure(!indexed.has(object.oid) && gitObjectId(object.type, bytes) === object.oid, 'Duplicate or corrupt Git object');
    indexed.set(object.oid, { type: object.type, bytes });
  }
  const get = (oid, type) => {
    const object = indexed.get(oid);
    ensure(object?.type === type, `Missing ${type} Git object ${oid}`); used.add(oid); return object.bytes;
  };
  const tag = get(pin.tagObject, 'tag').toString('utf8').split('\n\n')[0];
  ensure(tag.split('\n').includes(`object ${pin.commit}`) && tag.split('\n').includes('type commit') && tag.split('\n').includes(`tag ${pin.tag}`), 'Annotated tag does not bind the pinned release');
  const treeId = /^tree ([a-f0-9]{40})$/mu.exec(get(pin.commit, 'commit').toString('utf8').split('\n\n')[0])?.[1];
  ensure(treeId, 'Commit has no tree');
  const paths = new Set();
  for (const input of inputs) {
    ensure(typeof input.path === 'string' && input.path.split('/').every(part => part && part !== '.' && part !== '..') && !input.path.includes('\\') && !paths.has(input.path), 'Invalid or duplicate Git input path');
    paths.add(input.path);
    const parts = input.path.split('/'); let tree = treeId;
    for (const [index, part] of parts.entries()) {
      const entry = parseGitTree(get(tree, 'tree')).get(part);
      ensure(entry, `Git path is absent: ${input.path}`);
      if (index < parts.length - 1) { ensure(entry.mode === '40000', 'Git ancestor is not a tree'); tree = entry.oid; }
      else ensure(['100644', '100755'].includes(entry.mode) && entry.oid === input.gitBlob && gitObjectId('blob', base64(input.data)) === entry.oid, `Git source bytes disagree: ${input.path}`);
    }
  }
  ensure(used.size === indexed.size, 'Evidence contains unrelated Git objects');
  return true;
}

/** Hashes bind reviewed pins, not the authenticity of a newly supplied remote publication. */
export function validatePublishedCapture(capture, facts, archive) {
  ensure(capture?.schemaVersion === 1 && capture.extractorVersion === 1 && archive?.schemaVersion === 1, 'Unsupported capture schema');
  ensure(capture.sourceRelease === `lyra-ui@${capture.sourceVersion}` && capture.package?.name === '@aceshooting/lyra-ui' && capture.package.version === capture.sourceVersion, 'Capture release identity mismatch');
  ensure(/^[a-f0-9]{64}$/u.test(capture.package.tarballSha256) && /^sha512-[A-Za-z0-9+/]{86}==$/u.test(capture.package.registryIntegrity), 'Invalid published tarball pin');
  const expected = [...Object.entries(SOURCE_INPUTS).map(([role, path]) => ({ origin: 'source', role, path: `packages/lyra-ui/${path}` })),
    ...Object.entries(PACKED_INPUTS).map(([role, path]) => ({ origin: 'packed', role, path }))];
  ensure(capture.inputs.length >= expected.length, 'Unexpected evidence input inventory');
  const parsed = { source: {}, packed: {} }; const usedPayloads = new Set(); const gitInputs = [];
  for (const [index, wanted] of expected.entries()) {
    const input = capture.inputs[index];
    ensure(['origin', 'role', 'path'].every(key => input[key] === wanted[key]), 'Evidence input inventory changed');
    const data = archive.payloads[input.sha256]; const bytes = base64(data);
    ensure(sha256(bytes) === input.sha256 && bytes.length === input.bytes, `Evidence bytes disagree: ${input.path}`);
    usedPayloads.add(input.sha256);
    parsed[input.origin][input.role] = JSON.parse(bytes.toString('utf8'));
    if (input.origin === 'source') gitInputs.push({ ...input, data });
    else ensure(input.gitBlob === null, 'Packed input unexpectedly has Git identity');
  }
  parsed.source.exportSources = Object.create(null);
  const sourceHistory = new Map();
  for (const input of capture.inputs.slice(expected.length)) {
    const data = archive.payloads[input.sha256]; const bytes = base64(data);
    ensure(sha256(bytes) === input.sha256 && bytes.length === input.bytes, 'Extra evidence bytes disagree: ' + input.path);
    if (input.origin === 'source-export') {
      ensure(input.role === 'text' && /^packages\/lyra-ui\/src\/[A-Za-z0-9_./-]+\.(?:ts|css)$/u.test(input.path) && !input.path.split('/').includes('..'), 'Invalid extra source input');
      const sourcePath = input.path.slice('packages/lyra-ui/'.length);
      ensure(!Object.hasOwn(parsed.source.exportSources, sourcePath), 'Duplicate export source input');
      parsed.source.exportSources[sourcePath] = bytes.toString('utf8');
    } else if (input.origin === 'source-history') {
      ensure(input.role === 'history' && /^packages\/lyra-ui\/scripts\/fixtures\/compatibility-history\/(?:index\.json|[0-9]+\.[0-9]+\.[0-9]+\/(?:capture|facts)\.json|[0-9]+\.[0-9]+\.[0-9]+\/evidence\.json\.gz)$/u.test(input.path) && !sourceHistory.has(input.path), 'Invalid or duplicate history evidence input');
      sourceHistory.set(input.path, bytes);
    } else throw new Error('Invalid extra evidence origin');
    usedPayloads.add(input.sha256); gitInputs.push({ ...input, data });
  }
  ensure(Object.keys(archive.payloads).length === usedPayloads.size, 'Evidence contains unrelated payloads');
  verifyGitEvidence({ pin: { ...capture.git, tag: capture.sourceRelease }, objects: archive.gitObjects, inputs: gitInputs });
  ensure(parsed.packed.packageJson.name === capture.package.name && parsed.packed.packageJson.version === capture.sourceVersion, 'Packed package identity mismatch');
  ensure(JSON.stringify(parsed.source.manifest) === JSON.stringify(parsed.packed.manifest), 'Published manifest differs from source manifest');
  const usedSources = new Set();
  const sourceValues = parsed.source.exportSources;
  parsed.source.exportSources = new Proxy(sourceValues, { get(target, key) { if (Object.hasOwn(target, key)) usedSources.add(key); return target[key]; } });
  const extracted = extractPublishedCompatibility(parsed.source, capture.extractorVersion);
  const historyPrefix = 'packages/lyra-ui/scripts/fixtures/compatibility-history/';
  const historyIndexPath = historyPrefix + 'index.json';
  let compatibilityContext = null;
  if (sourceHistory.size) {
    ensure(sourceHistory.has(historyIndexPath), 'Compatibility history evidence has no index');
    const historyIndex = JSON.parse(sourceHistory.get(historyIndexPath).toString('utf8'));
    ensure(historyIndex?.schemaVersion === 1 && Array.isArray(historyIndex.captures) && historyIndex.captures.length > 0 && Array.isArray(historyIndex.retirements), 'Unsupported source compatibility history');
    ensure(historyIndex.captures.length <= 32, 'Source compatibility history exceeds the capture limit');
    const expectedHistoryPaths = new Set([historyIndexPath]); const historicalFacts = [];
    const compareVersions = (left, right) => {
      const parts = value => { const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.exec(value); ensure(match, 'Invalid compatibility history version'); return match.slice(1).map(Number); };
      const a = parts(left); const b = parts(right); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0;
    };
    const seenVersions = new Set();
    for (const entry of historyIndex.captures) {
      ensure(entry && typeof entry.directory === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/u.test(entry.directory) && /^[a-f0-9]{64}$/u.test(entry.captureSha256) && !seenVersions.has(entry.directory), 'Invalid or duplicate source history capture pin');
      seenVersions.add(entry.directory);
      ensure(compareVersions(entry.directory, capture.sourceVersion) < 0, 'Source history contains a current or future capture');
      const dir = entry.directory;
      const paths = Object.fromEntries(['capture.json', 'facts.json', 'evidence.json.gz'].map(file => [file, historyPrefix + dir + '/' + file]));
      for (const path of Object.values(paths)) expectedHistoryPaths.add(path);
      ensure(Object.values(paths).every(path => sourceHistory.has(path)), 'Source history capture is incomplete');
      const descriptorBytes = sourceHistory.get(paths['capture.json']);
      ensure(sha256(descriptorBytes) === entry.captureSha256, 'Source history capture differs from its index pin');
      const priorCapture = JSON.parse(descriptorBytes.toString('utf8'));
      ensure(priorCapture.sourceVersion === dir, 'Source history directory/version mismatch');
      const priorFacts = JSON.parse(sourceHistory.get(paths['facts.json']).toString('utf8'));
      const priorEvidence = decodeCaptureEvidence(priorCapture, sourceHistory.get(paths['evidence.json.gz']));
      const prior = validatePublishedCapture(priorCapture, priorFacts, priorEvidence);
      ensure(prior.facts.sourceVersion === dir, 'Validated source history version mismatch');
      historicalFacts.push(prior.facts);
    }
    ensure(expectedHistoryPaths.size === sourceHistory.size && [...expectedHistoryPaths].every(path => sourceHistory.has(path)), 'Source history file inventory differs from its index');
    const currentExportSurface = [];
    for (const entry of compatibilityExportCandidates(parsed.source.metadata, historicalFacts)) {
      const fact = inspectExportContract(entry, { packageJson: parsed.source.packageJson,
        readSource: path => parsed.source.exportSources[path], exportDeprecations: parsed.source.metadata.exportDeprecations });
      ensure(fact.status !== 'invalid', 'Cannot inspect historical export ' + entry.name + ': ' + (fact.findings?.join('; ') ?? 'invalid contract'));
      if (fact.status === 'present') currentExportSurface.push({ key: policyKey(entry, 'export'), ...fact });
    }
    compatibilityContext = assembleCompatibilityContext({ packageVersion: capture.sourceVersion,
      currentInventory: parsed.source.inventory, currentExportDeprecations: parsed.source.metadata.exportDeprecations,
      currentExportSurface, captures: historicalFacts, retirementIndex: historyIndex.retirements });
  } else {
    const major = Number(capture.sourceVersion.split('.')[0]);
    ensure(major < 23, 'Published capture requires pinned compatibility history evidence');
  }
  const projection = projectRenameLedger(parsed.source.renameLedger, parsed.source.inventory, {
    exportDeprecations: parsed.source.metadata.exportDeprecations, compatibilityContext,
    historicalReleaseMajor: Number(capture.sourceVersion.split('.')[0]) });
  ensure(JSON.stringify(projection) === JSON.stringify(parsed.packed.migrationContract.lyraRenames), 'Packed migration projection differs from published source');
  ensure(usedSources.size === Object.keys(sourceValues).length, 'Unrelated export source input');
  ensure(JSON.stringify(extracted) === JSON.stringify(facts) && sha256(jsonBytes(facts)) === capture.factsSha256, 'Published facts differ from exact evidence extraction');
  // Return a detached view only after the manifest's source, packed and Git identities agree.
  return { facts: extracted, publishedMigration: parsed.packed.migrationContract,
    publishedManifest: structuredClone(parsed.source.manifest) };
}

export function readPublishedCaptureSync(directory, { readBytes = readFileSync } = {}) {
  const capture = JSON.parse(readBytes(join(directory, 'capture.json')).toString('utf8'));
  const evidence = readBytes(join(directory, 'evidence.json.gz'));
  const facts = JSON.parse(readBytes(join(directory, 'facts.json')).toString('utf8'));
  return { capture, ...validatePublishedCapture(capture, facts, decodeCaptureEvidence(capture, evidence)) };
}

export async function readPublishedCapture(directory) { return readPublishedCaptureSync(directory); }

/** Published minor-release observations supplement stated since values without rewriting them. */
export function verifyPolicyWitnesses(witnesses, captures, transitions = []) {
  ensure(witnesses?.schemaVersion === 1 && Array.isArray(witnesses.releases), 'Unsupported policy witness schema');
  const byRelease = new Map();
  for (const witness of witnesses.releases) {
    ensure(!byRelease.has(witness.sourceRelease) && witness.sourceRelease === `lyra-ui@${witness.sourceVersion}`, 'Duplicate or invalid policy witness release');
    ensure(witness.input.path === 'packages/lyra-ui/scripts/fixtures/component-metadata.json', 'Invalid policy witness input');
    verifyGitEvidence({ pin: { ...witness.git, tag: witness.sourceRelease }, objects: witness.objects, inputs: [witness.input, ...(witness.publication ? [witness.publication.manifest] : [])] });
    if (witness.publication) {
      const publication = witness.publication;
      ensure(/^[a-f0-9]{64}$/u.test(publication.tarballSha256) && /^sha512-[A-Za-z0-9+/]{86}==$/u.test(publication.registryIntegrity), 'Invalid historical npm pin');
      const identity = JSON.parse(base64(publication.packageJson).toString('utf8'));
      ensure(identity.name === '@aceshooting/lyra-ui' && identity.version === witness.sourceVersion && publication.manifest.path === 'packages/lyra-ui/custom-elements.json' && sha256(base64(publication.manifest.data)) === publication.manifest.sha256, 'Historical publication identity mismatch');
    }
    const bytes = base64(witness.input.data);
    ensure(sha256(bytes) === witness.input.sha256, 'Policy witness metadata hash mismatch');
    const metadata = JSON.parse(bytes.toString('utf8'));
    ensure(metadata.schemaVersion === 2 && metadata.history?.current?.version === witness.sourceVersion, 'Unsupported historical policy schema or identity');
    const policies = [...metadata.deprecations, ...metadata.exportDeprecations];
    const records = new Map(policies.map(policy => [JSON.stringify(policy.tag ? ['member', policy.tag, policy.kind, policy.name] : ['export', policy.kind, policy.module ?? null, policy.name]), policy]));
    ensure(records.size === policies.length, 'Duplicate historical policy identity');
    byRelease.set(witness.sourceRelease, { witness, records });
  }
  const usedReleases = new Set(); const usedTransitions = new Set(); const observed = Object.create(null);
  for (const capture of captures) {
    const facts = capture.facts ?? capture;
    const releases = facts.policyReleaseHistory ?? [];
    for (const release of releases) {
      const prior = byRelease.get(release.tag);
      ensure(prior && prior.witness.git.commit === release.sourceCommit && prior.witness.sourceVersion === release.version, `Missing immutable policy witness ${release.tag}`);
      usedReleases.add(release.tag);
    }
    const major = Number(facts.sourceVersion.split('.')[0]);
    for (const entry of facts.records) {
      if (Number(entry.policy.removalNotBefore.split('.')[0]) !== major + 1 || Number(entry.policy.since.split('.')[0]) >= major) continue;
      const key = JSON.stringify(entry.key.scope === 'member' ? ['member', entry.key.tag, entry.key.kind, entry.key.name] : ['export', entry.key.kind, entry.key.module ?? null, entry.key.name]);
      let first = null; let npmObserved = false;
      for (const release of releases) {
        const old = byRelease.get(release.tag).records.get(key);
        if (!old) { ensure(first === null, `Published notice disappeared during its compatibility window: ${key}`); continue; }
        first ??= release.version;
        npmObserved ||= Boolean(byRelease.get(release.tag).witness.publication);
        ensure(old.since === entry.policy.since && old.removalNotBefore === entry.policy.removalNotBefore, `Published policy window changed: ${key}`);
        if (JSON.stringify(old) !== JSON.stringify(entry.policy)) {
          const from = sha256(jsonBytes(old)); const to = sha256(jsonBytes(entry.policy));
          const matches = transitions.map((transition, index) => ({ transition, index })).filter(({ transition }) => JSON.stringify(transition.key) === JSON.stringify(entry.key) && transition.fromPolicySha256 === from && transition.toPolicySha256 === to && typeof transition.rationale === 'string' && transition.rationale.trim());
          ensure(matches.length === 1, `Unreviewed published guidance transition: ${key}`);
          const withoutGuidance = ({ replacement, rationale, ...policy }) => policy;
          ensure(JSON.stringify(withoutGuidance(old)) === JSON.stringify(withoutGuidance(entry.policy)) && old.replacement.kind === entry.policy.replacement.kind, `Guidance transition changes policy semantics: ${key}`);
          usedTransitions.add(matches[0].index);
        }
      }
      ensure(npmObserved, `No supplied published npm witness before the compatibility major: ${key}`);
      ensure(first && Number(first.split('.')[0]) + 2 <= Number(entry.policy.removalNotBefore.split('.')[0]), `No full later major after observed publication: ${key}`);
      observed[key] = first;
    }
  }
  ensure(usedReleases.size === byRelease.size && usedTransitions.size === transitions.length, 'Unrelated policy witness or transition');
  return observed;
}
