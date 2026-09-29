import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { decodeEvidence, encodeEvidence, gitObjectId, jsonBytes, parseGitTree, readPublishedCaptureSync, sha256 } from './published-compatibility-io.mjs';
import { buildFieldEvidenceIndex, derivePublishedFieldFacts, expectedFieldInputPaths, REQUIRED_FIELD_RELEASES, validateFieldEvidenceIndex, validatePublishedFieldAttachment, verifyPublishedFieldContinuity } from './published-field-compatibility.mjs';
import { isMainModule } from './is-main-module.mjs';

const maxTarListBytes = 8 * 1024 * 1024;
const maxOutputBytes = 16 * 1024 * 1024;
const maxTarballBytes = 64 * 1024 * 1024;
const oidPattern = /^[a-f0-9]{40}$/u;
const sha512Pattern = /^sha512-[A-Za-z0-9+/]{86}==$/u;

function ensure(condition, message) { if (!condition) throw new Error(message); }
function git(repository, args, maxBuffer = 32 * 1024 * 1024) {
  return execFileSync('git', ['-C', repository, ...args], { maxBuffer });
}
function regularTarMembers(tarball) {
  const listing = execFileSync('tar', ['-tzf', resolve(tarball)], { encoding: 'utf8', maxBuffer: maxTarListBytes });
  const members = listing.replace(/\n$/u, '').split('\n');
  ensure(members.length > 0 && members.length <= 20000 && new Set(members).size === members.length, 'Tarball has duplicate or excessive members');
  for (const name of members) {
    const normalized = name.endsWith('/') ? name.slice(0, -1) : name;
    ensure(typeof normalized === 'string' && normalized.length > 0 && !normalized.startsWith('/') && !normalized.includes('\\') && !/[\u0000-\u001f]/u.test(normalized) && normalized.split('/').every(part => part && part !== '.' && part !== '..'), 'Tarball contains an unsafe member path');
  }
  const verbose = execFileSync('tar', ['-tvzf', resolve(tarball)], { encoding: 'utf8', maxBuffer: maxTarListBytes });
  const types = new Map();
  for (const line of verbose.trimEnd().split('\n')) {
    const type = line[0]; const member = line.split(/\s+/u).slice(5).join(' ');
    if (member) types.set(member, type);
  }
  return { members, types };
}

function gitTreePath(repository, rootTree, path, objects) {
  let current = rootTree; let entry;
  const parts = path.split('/');
  for (const [index, part] of parts.entries()) {
    ensure(part && part !== '.' && part !== '..' && !part.includes('\\'), `Unsafe Git path ${path}`);
    const treeBytes = git(repository, ['cat-file', 'tree', current]);
    objects.set(current, { type: 'tree', oid: current, data: treeBytes.toString('base64') });
    entry = parseGitTree(treeBytes).get(part);
    ensure(entry, `Missing Git source path ${path}`);
    if (index < parts.length - 1) {
      ensure(entry.mode === '40000', `Git path ancestor is not a tree: ${path}`);
      current = entry.oid;
    }
  }
  ensure(['100644', '100755'].includes(entry.mode), `Git source path is not a regular file: ${path}`);
  // The verifier binds each inline source payload to this tree entry's blob OID; a detached blob
  // object would be unreferenced evidence and adds no proof beyond that path plus byte hash.
  const bytes = git(repository, ['cat-file', 'blob', entry.oid]);
  return { bytes, oid: entry.oid };
}

function packageJsonFromCapture(ordinaryCaptureDirectory, ordinaryCapture) {
  const archiveBytes = readFileSync(join(ordinaryCaptureDirectory, 'evidence.json.gz'));
  ensure(sha256(archiveBytes) === ordinaryCapture.capture.evidenceArchiveSha256, 'Ordinary capture evidence archive hash mismatch');
  const archive = decodeEvidence(archiveBytes);
  const packedPackageInput = ordinaryCapture.capture.inputs.find(input => input.origin === 'packed' && input.role === 'packageJson');
  const sourcePackageInput = ordinaryCapture.capture.inputs.find(input => input.origin === 'source' && input.role === 'packageJson');
  ensure(packedPackageInput && sourcePackageInput, 'Ordinary capture has no package identity inputs');
  const packedBytes = Buffer.from(archive.payloads[packedPackageInput.sha256], 'base64');
  const sourceBytes = Buffer.from(archive.payloads[sourcePackageInput.sha256], 'base64');
  const packageJson = JSON.parse(packedBytes.toString('utf8'));
  const sourcePackage = JSON.parse(sourceBytes.toString('utf8'));
  ensure(packageJson.name === sourcePackage.name && packageJson.version === sourcePackage.version && JSON.stringify(packageJson.exports) === JSON.stringify(sourcePackage.exports), 'Published package routes differ from pinned source');
  return packageJson;
}

/** Capture one immutable release attachment from supplied tag, ordinary capture and npm tarball. */
function capturePublishedFieldCompatibility({ repository, sourceRelease, tagObject, commit, tarball, tarballSha256, registryIntegrity, ordinaryCaptureDirectory, output }) {
  ensure(/^lyra-ui@(22\.0\.0|22\.1\.0|23\.0\.0)$/u.test(sourceRelease), 'Unsupported field evidence release');
  ensure(oidPattern.test(tagObject) && oidPattern.test(commit), 'Invalid field release Git pins');
  ensure(typeof tarballSha256 === 'string' && /^[a-f0-9]{64}$/u.test(tarballSha256) && sha512Pattern.test(registryIntegrity), 'Invalid field release npm pins');
  ensure(!existsSync(output), 'Field evidence output already exists; published evidence is immutable');
  const ordinaryCapture = readPublishedCaptureSync(ordinaryCaptureDirectory);
  const ordinaryBytes = readFileSync(join(ordinaryCaptureDirectory, 'capture.json'));
  ensure(ordinaryCapture.capture.sourceRelease === sourceRelease && ordinaryCapture.capture.git.tagObject === tagObject && ordinaryCapture.capture.git.commit === commit, 'Field evidence release does not match ordinary capture');
  ensure(ordinaryCapture.capture.package.tarballSha256 === tarballSha256 && ordinaryCapture.capture.package.registryIntegrity === registryIntegrity, 'Field evidence npm pins do not match ordinary capture');
  const packageJson = packageJsonFromCapture(ordinaryCaptureDirectory, ordinaryCapture);
  const tarballSize = statSync(tarball).size;
  ensure(tarballSize > 0 && tarballSize <= maxTarballBytes, 'Npm tarball is empty or exceeds the capture limit');
  const tarBytes = readFileSync(tarball);
  ensure(sha256(tarBytes) === tarballSha256 && `sha512-${createHash('sha512').update(tarBytes).digest('base64')}` === registryIntegrity, 'Field evidence tarball integrity mismatch');
  const { members, types } = regularTarMembers(tarball);
  const expectedInputs = expectedFieldInputPaths(packageJson);
  const objectMap = new Map(); const payloads = Object.create(null); const inputs = [];
  const commitBytes = git(repository, ['cat-file', 'commit', commit]);
  const tagBytes = git(repository, ['cat-file', 'tag', tagObject]);
  ensure(gitObjectId('commit', commitBytes) === commit && gitObjectId('tag', tagBytes) === tagObject, 'Git tag or commit object hash mismatch');
  objectMap.set(commit, { type: 'commit', oid: commit, data: commitBytes.toString('base64') });
  objectMap.set(tagObject, { type: 'tag', oid: tagObject, data: tagBytes.toString('base64') });
  const commitTree = /^tree ([a-f0-9]{40})$/mu.exec(commitBytes.toString('utf8'))?.[1];
  ensure(commitTree, 'Pinned field release commit has no tree');
  for (const expected of expectedInputs) {
    let bytes; let gitBlob = null;
    if (expected.origin === 'source') {
      const found = gitTreePath(repository, commitTree, expected.path, objectMap);
      bytes = found.bytes; gitBlob = found.oid;
    } else {
      ensure(members.filter(path => path === expected.path).length === 1 && types.get(expected.path) === '-', `Missing, duplicate, or non-file npm member ${expected.path}`);
      bytes = execFileSync('tar', ['-xOzf', resolve(tarball), '--', expected.path], { maxBuffer: 8 * 1024 * 1024 });
    }
    ensure(bytes.length > 0 && bytes.length <= 8 * 1024 * 1024, `Field evidence input exceeds member limit: ${expected.path}`);
    const digest = sha256(bytes);
    payloads[digest] = bytes.toString('base64');
    inputs.push({ ...expected, sha256: digest, bytes: bytes.length, gitBlob });
  }
  const sourceFiles = Object.create(null); const packedFiles = Object.create(null);
  for (const input of inputs) {
    const bytes = Buffer.from(payloads[input.sha256], 'base64');
    (input.origin === 'source' ? sourceFiles : packedFiles)[input.path] = bytes;
  }
  const facts = derivePublishedFieldFacts({ sourceRelease, sourceVersion: ordinaryCapture.capture.sourceVersion, packageJson, sourceFiles, packedFiles });
  const evidence = { schemaVersion: 1, payloads, gitObjects: [...objectMap.values()], tarMembers: [...members].sort() };
  const archive = encodeEvidence(evidence);
  ensure(archive.length <= maxOutputBytes, 'Field evidence archive exceeds size limit');
  const attachment = {
    schemaVersion: 1,
    sourceRelease,
    sourceVersion: ordinaryCapture.capture.sourceVersion,
    git: { tagObject, commit },
    captureDescriptorSha256: sha256(ordinaryBytes),
    package: { ...ordinaryCapture.capture.package },
    extractorVersion: 1,
    inputs,
    tarball: { memberCount: members.length, membersSha256: sha256(jsonBytes([...members].sort())) },
    evidenceArchiveSha256: sha256(archive),
    factsSha256: sha256(jsonBytes(facts)),
  };
  const descriptorSha256 = sha256(jsonBytes(attachment));
  validatePublishedFieldAttachment({ attachment, facts, evidence, evidenceArchiveBytes: archive, ordinaryCapture: ordinaryCapture.capture, ordinaryCaptureBytes: ordinaryBytes, tarMembers: evidence.tarMembers, packageJson });
  mkdirSync(dirname(output), { recursive: true });
  const staging = `${output}.pending-${process.pid}`;
  mkdirSync(staging);
  try {
    writeFileSync(join(staging, 'attachment.json'), jsonBytes(attachment));
    writeFileSync(join(staging, 'facts.json'), jsonBytes(facts));
    writeFileSync(join(staging, 'evidence.json.gz'), archive);
    if (existsSync(output)) throw new Error('Field attachment output appeared during capture');
    renameSync(staging, output);
  } finally { rmSync(staging, { recursive: true, force: true }); }
  return { sourceRelease, declarations: facts.declarations.length, exposures: facts.exposures.length, archiveBytes: archive.length, descriptorSha256 };
}

/** Read one attachment hermetically and cross-check it against its ordinary immutable capture. */
export function readPublishedFieldAttachmentSync(directory, ordinaryCaptureDirectory) {
  const attachmentBytes = readFileSync(join(directory, 'attachment.json'));
  const attachment = JSON.parse(attachmentBytes.toString('utf8'));
  const archiveBytes = readFileSync(join(directory, 'evidence.json.gz'));
  ensure(sha256(archiveBytes) === attachment.evidenceArchiveSha256, 'Field evidence archive hash mismatch');
  const evidence = decodeEvidence(archiveBytes, maxOutputBytes);
  ensure(evidence.tarMembers?.length === attachment.tarball?.memberCount && sha256(jsonBytes(evidence.tarMembers)) === attachment.tarball.membersSha256, 'Field tar member inventory mismatch');
  const facts = JSON.parse(readFileSync(join(directory, 'facts.json'), 'utf8'));
  const ordinaryCapture = readPublishedCaptureSync(ordinaryCaptureDirectory);
  const ordinaryCaptureBytes = readFileSync(join(ordinaryCaptureDirectory, 'capture.json'));
  const packageJson = packageJsonFromCapture(ordinaryCaptureDirectory, ordinaryCapture);
  const verified = validatePublishedFieldAttachment({ attachment, facts, evidence, evidenceArchiveBytes: archiveBytes, ordinaryCapture: ordinaryCapture.capture, ordinaryCaptureBytes, tarMembers: evidence.tarMembers, packageJson });
  return { attachment, facts: verified.facts, evidence, descriptorSha256: sha256(attachmentBytes), verified: true };
}

/** Write the index only after every exact required release attachment is present and verified. */
function writeFieldEvidenceIndex(fieldEvidenceDirectory, ordinaryCaptureDirectories, requiredReleases = REQUIRED_FIELD_RELEASES) {
  const indexPath = join(fieldEvidenceDirectory, 'index.json');
  ensure(!existsSync(indexPath), 'Field evidence index already exists; its release descriptor pins are immutable');
  ensure(ordinaryCaptureDirectories && typeof ordinaryCaptureDirectories === 'object' && !Array.isArray(ordinaryCaptureDirectories) &&
    Object.keys(ordinaryCaptureDirectories).length === requiredReleases.length && requiredReleases.every(release => typeof ordinaryCaptureDirectories[release] === 'string'), 'Index writing requires the exact ordinary capture directory set');
  const attachments = requiredReleases.map(sourceRelease => {
    const version = sourceRelease.slice('lyra-ui@'.length);
    const directory = join(fieldEvidenceDirectory, version);
    const validated = readPublishedFieldAttachmentSync(directory, ordinaryCaptureDirectories[sourceRelease]);
    ensure(validated.attachment.sourceRelease === sourceRelease, `Wrong field attachment release at ${directory}`);
    return { attachment: validated.attachment, descriptorSha256: validated.descriptorSha256 };
  });
  const index = buildFieldEvidenceIndex(attachments, requiredReleases);
  validateFieldEvidenceIndex(index, attachments);
  const staging = `${indexPath}.pending-${process.pid}`;
  try {
    writeFileSync(staging, jsonBytes(index), { flag: 'wx' });
    if (existsSync(indexPath)) throw new Error('Field evidence index appeared during capture');
    renameSync(staging, indexPath);
  } finally { rmSync(staging, { force: true }); }
  return index;
}

function readFieldEvidenceIndex(fieldEvidenceDirectory, attachments) {
  const index = JSON.parse(readFileSync(join(fieldEvidenceDirectory, 'index.json'), 'utf8'));
  validateFieldEvidenceIndex(index, attachments);
  return index;
}

/** Read the exact published field history set and bind it to the ordinary release captures. */
export function checkPublishedFieldHistorySync(ordinaryDirectory, { captures } = {}) {
  ensure(Array.isArray(captures), 'Published field history requires ordinary captures');
  const fieldEvidenceDirectory = join(ordinaryDirectory, 'field-evidence');
  const attachments = REQUIRED_FIELD_RELEASES.map(sourceRelease => {
    const version = sourceRelease.slice('lyra-ui@'.length);
    return readPublishedFieldAttachmentSync(join(fieldEvidenceDirectory, version), join(ordinaryDirectory, version));
  });
  const index = readFieldEvidenceIndex(fieldEvidenceDirectory, attachments);
  const continuity = verifyPublishedFieldContinuity({ captures, attachments });
  return { captures, attachments, index, continuity };
}

if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({ options: Object.fromEntries(['repository', 'release', 'tag-object', 'commit', 'tarball', 'tarball-sha256', 'registry-integrity', 'capture-dir', 'output'].map(name => [name, { type: 'string' }])) });
  ensure(Object.keys(values).length === 9, 'All field capture arguments are required');
  const result = capturePublishedFieldCompatibility({ repository: values.repository, sourceRelease: values.release, tagObject: values['tag-object'], commit: values.commit, tarball: values.tarball, tarballSha256: values['tarball-sha256'], registryIntegrity: values['registry-integrity'], ordinaryCaptureDirectory: values['capture-dir'], output: values.output });
  console.log(JSON.stringify(result, null, 2));
}
