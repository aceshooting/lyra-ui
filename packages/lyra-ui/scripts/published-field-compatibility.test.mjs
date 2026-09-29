import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPublishedFieldHistorySync, readPublishedFieldAttachmentSync } from './published-field-compatibility-io.mjs';
import {
  buildFieldEvidenceIndex,
  derivePublishedFieldFacts,
  expectedFieldInputPaths,
  FIELD_DECLARATION_KEYS,
  FIELD_EXPOSURE_KEYS,
  fieldDeclarationKey,
  fieldExposureKey,
  REQUIRED_FIELD_RELEASES,
  validateFieldEvidenceIndex,
  verifyPublishedFieldContinuity,
} from './published-field-compatibility.mjs';
import { decodeCaptureEvidence, encodeEvidence, gitObjectId, jsonBytes, parseGitTree, readPublishedCaptureSync, sha256 } from './published-compatibility-io.mjs';
import { validatePublishedFieldAttachment } from './published-field-compatibility.mjs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const historyDir = join(scriptsDir, 'fixtures/compatibility-history');

function historyCaptures() {
  return REQUIRED_FIELD_RELEASES.map(sourceRelease => readPublishedCaptureSync(join(historyDir, sourceRelease.slice('lyra-ui@'.length))));
}

function withHistoryView({ omitIndex = false, omitAttachment = null, pinMismatch = false } = {}, callback) {
  const directory = mkdtempSync(join(tmpdir(), 'lyra-field-history-'));
  try {
    const fieldDirectory = join(directory, 'field-evidence');
    mkdirSync(fieldDirectory);
    for (const sourceRelease of REQUIRED_FIELD_RELEASES) {
      const version = sourceRelease.slice('lyra-ui@'.length);
      symlinkSync(join(historyDir, version), join(directory, version), 'dir');
      if (version !== omitAttachment) symlinkSync(join(historyDir, 'field-evidence', version), join(fieldDirectory, version), 'dir');
    }
    if (!omitIndex) {
      const index = JSON.parse(readFileSync(join(historyDir, 'field-evidence/index.json'), 'utf8'));
      if (pinMismatch) index.attachments[0].descriptorSha256 = 'f'.repeat(64);
      writeFileSync(join(fieldDirectory, 'index.json'), JSON.stringify(index));
    }
    return callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function published23FieldFixture() {
  const ordinaryDirectory = join(historyDir, '23.0.0');
  const capture = readPublishedCaptureSync(ordinaryDirectory);
  const ordinaryEvidence = decodeCaptureEvidence(capture.capture, readFileSync(join(ordinaryDirectory, 'evidence.json.gz')));
  const packageInput = capture.capture.inputs.find(input => input.origin === 'packed' && input.role === 'packageJson');
  assert.ok(packageInput, 'verified 23.0.0 capture has a packed package identity');
  const packageJson = JSON.parse(Buffer.from(ordinaryEvidence.payloads[packageInput.sha256], 'base64').toString('utf8'));
  const attachment = readPublishedFieldAttachmentSync(join(historyDir, 'field-evidence', '23.0.0'), ordinaryDirectory);
  const sourceFiles = Object.create(null);
  const packedFiles = Object.create(null);
  for (const input of attachment.attachment.inputs) {
    const bytes = Buffer.from(attachment.evidence.payloads[input.sha256], 'base64').toString('utf8');
    (input.origin === 'source' ? sourceFiles : packedFiles)[input.path] = bytes;
  }
  return { packageJson, sourceFiles, packedFiles };
}

const publishedFieldFixture = published23FieldFixture();

function fixtureFiles(rewriteSource = () => {}, version = '23.0.0') {
  const packageJson = structuredClone(publishedFieldFixture.packageJson);
  packageJson.version = version;
  const sourceFiles = { ...publishedFieldFixture.sourceFiles };
  const packedFiles = { ...publishedFieldFixture.packedFiles };
  rewriteSource(sourceFiles);
  return { packageJson, sourceFiles, packedFiles };
}

function derive(files = fixtureFiles(), release = 'lyra-ui@23.0.0') {
  return derivePublishedFieldFacts({
    sourceRelease: release,
    sourceVersion: release.slice('lyra-ui@'.length),
    ...files,
  });
}

function makeGitProof(sourceInputs) {
  const objects = new Map();
  const root = { children: new Map() };
  const sourceBytes = new Map();
  for (const input of sourceInputs) {
    const bytes = Buffer.from(input.data, 'base64');
    const oid = gitObjectId('blob', bytes);
    objects.set(oid, { type: 'blob', oid, data: bytes.toString('base64') });
    sourceBytes.set(input.path, { oid, bytes });
    let node = root;
    const parts = input.path.split('/');
    for (const part of parts.slice(0, -1)) {
      if (!node.children.has(part)) node.children.set(part, { children: new Map() });
      node = node.children.get(part);
    }
    node.children.set(parts.at(-1), { blob: oid });
  }
  const writeTree = node => {
    const entries = [];
    for (const [name, child] of node.children) {
      if (child.blob) entries.push({ name, mode: '100644', oid: child.blob, directory: false });
      else entries.push({ name, mode: '40000', oid: writeTree(child), directory: true });
    }
    entries.sort((left, right) => Buffer.compare(Buffer.from(`${left.name}${left.directory ? '/' : ''}`), Buffer.from(`${right.name}${right.directory ? '/' : ''}`)));
    const data = Buffer.concat(entries.flatMap(({ name, mode, oid }) => [Buffer.from(`${mode} ${name}\0`), Buffer.from(oid, 'hex')]));
    const oid = gitObjectId('tree', data);
    objects.set(oid, { type: 'tree', oid, data: data.toString('base64') });
    return oid;
  };
  const tree = writeTree(root);
  const commit = Buffer.from(`tree ${tree}\nauthor Test <test@example.invalid> 0 +0000\ncommitter Test <test@example.invalid> 0 +0000\n\nfield fixture\n`);
  const commitOid = gitObjectId('commit', commit);
  objects.set(commitOid, { type: 'commit', oid: commitOid, data: commit.toString('base64') });
  const tag = Buffer.from(`object ${commitOid}\ntype commit\ntag lyra-ui@22.1.0\ntagger Test <test@example.invalid> 0 +0000\n\nfield fixture\n`);
  const tagOid = gitObjectId('tag', tag);
  objects.set(tagOid, { type: 'tag', oid: tagOid, data: tag.toString('base64') });
  const used = new Set([tagOid, commitOid]);
  const treeId = /^tree ([a-f0-9]{40})$/mu.exec(commit.toString('utf8'))[1];
  for (const input of sourceInputs) {
    let tree = treeId;
    const parts = input.path.split('/');
    for (const [index, part] of parts.entries()) {
      used.add(tree);
      const entry = parseGitTree(Buffer.from(objects.get(tree).data, 'base64')).get(part);
      assert.ok(entry, `fixture Git tree is missing ${input.path}`);
      if (index < parts.length - 1) tree = entry.oid;
    }
  }
  return { objects: [...objects.values()].filter(object => used.has(object.oid)), git: { commit: commitOid, tagObject: tagOid }, sourceBytes };
}

function attachmentFixture() {
  const files = fixtureFiles(() => {}, '22.1.0');
  const facts = derive(files, 'lyra-ui@22.1.0');
  const inputs = expectedFieldInputPaths(files.packageJson).map(({ origin, role, path }) => {
    const bytes = Buffer.from((origin === 'source' ? files.sourceFiles : files.packedFiles)[path]);
    return { origin, role, path, sha256: sha256(bytes), bytes: bytes.length, gitBlob: origin === 'source' ? gitObjectId('blob', bytes) : null, data: bytes.toString('base64') };
  });
  const proof = makeGitProof(inputs.filter(input => input.origin === 'source'));
  const tagObject = proof.git.tagObject;
  const commit = proof.git.commit;
  const npmPin = { tarballSha256: 'a'.repeat(64), registryIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}` };
  const ordinaryCapture = {
    sourceRelease: 'lyra-ui@22.1.0',
    sourceVersion: '22.1.0',
    git: { tagObject, commit },
    package: { name: '@aceshooting/lyra-ui', version: '22.1.0', ...npmPin },
  };
  const ordinaryCaptureBytes = jsonBytes(ordinaryCapture);
  const payloads = Object.fromEntries(inputs.map(({ sha256: digest, data }) => [digest, data]));
  const tarMembers = [...new Set(['package/', ...inputs.filter(input => input.origin === 'packed').map(input => input.path)])].sort();
  const evidence = { schemaVersion: 1, payloads, gitObjects: proof.objects, tarMembers };
  const evidenceArchiveBytes = encodeEvidence(evidence);
  const attachment = {
    schemaVersion: 1,
    extractorVersion: 1,
    sourceRelease: 'lyra-ui@22.1.0',
    sourceVersion: '22.1.0',
    git: { tagObject, commit },
    captureDescriptorSha256: sha256(ordinaryCaptureBytes),
    package: ordinaryCapture.package,
    inputs: inputs.map(({ data, ...input }) => input),
    tarball: { memberCount: tarMembers.length, membersSha256: sha256(jsonBytes(tarMembers)) },
    evidenceArchiveSha256: sha256(evidenceArchiveBytes),
    factsSha256: sha256(jsonBytes(facts)),
  };
  return { attachment, facts, evidence, evidenceArchiveBytes, ordinaryCapture, ordinaryCaptureBytes, packageJson: files.packageJson, tarMembers };
}

test('field and exposure identities preserve tuple boundaries and the exact 10/20 inventory', () => {
  assert.equal(FIELD_DECLARATION_KEYS.length, 10);
  assert.equal(new Set(FIELD_DECLARATION_KEYS.map(fieldDeclarationKey)).size, 10);
  assert.equal(FIELD_EXPOSURE_KEYS.length, 20);
  assert.equal(new Set(FIELD_EXPOSURE_KEYS.map(fieldExposureKey)).size, 20);
  assert.notEqual(
    fieldDeclarationKey({ module: 'a/b', detailType: 'C', field: 'd' }),
    fieldDeclarationKey({ module: 'a', detailType: 'B_C', field: 'd' }),
  );
  assert.ok(FIELD_EXPOSURE_KEYS.some(item => item.tag === 'lr-code-block' && item.event === 'lr-toggle'));
  assert.ok(FIELD_EXPOSURE_KEYS.some(item => item.tag === 'lr-code-block-core' && item.event === 'lr-toggle'));
});

test('source and packed module facts retain equal/inverse mapping, exact notice, and optional thread-list expanded', () => {
  const facts = derive();
  assert.equal(facts.declarations.length, 10);
  assert.equal(facts.exposures.length, 20);
  const thread = facts.declarations.find(item => item.key.detailType === 'ThreadGroupToggleDetail');
  assert.equal(thread.deprecatedField.optional, false);
  assert.equal(thread.expandedField.optional, true);
  assert.equal(thread.relation, 'inverse');
  assert.equal(thread.noticeFloor, '23.0.0');
  assert.match(thread.notice, /@deprecated Read `expanded` instead; removal not before 23\.0\.0\./u);
  assert.equal(facts.declarations.filter(item => item.relation === 'equal').length, 6);
  assert.equal(facts.declarations.filter(item => item.relation === 'inverse').length, 4);
  assert.ok(facts.exposures.every(item => item.staticBehaviorEvidence === 'source-and-packed-emitter-bytes-only'));
});

test('field extraction fails closed for a changed notice, optionality, or emitted value relation', () => {
  const noticeChange = fixtureFiles(source => {
    const path = 'packages/lyra-ui/src/components/layout/details/details.class.ts';
    source[path] = source[path].replace('removal not before 23.0.0', 'removal not before 24.0.0');
  });
  assert.throws(() => derive(noticeChange), /notice changed/u);

  const optionalChange = fixtureFiles(source => {
    const path = 'packages/lyra-ui/src/components/conversation/thread-list/thread-list.class.ts';
    source[path] = source[path].replace('expanded?: boolean;', 'expanded: boolean;');
  });
  assert.throws(() => derive(optionalChange), /Expanded field shape changed/u);

  const relationChange = fixtureFiles(source => {
    const path = 'packages/lyra-ui/src/components/layout/details/details.class.ts';
    source[path] = source[path].replace('expanded: this._open', 'expanded: !this._open');
  });
  assert.throws(() => derive(relationChange), /Runtime payload does not preserve equal/u);
});

test('field extraction fails closed when full/core type reach or one public route changes', () => {
  const changedCoreRoute = fixtureFiles(source => {
    const path = 'packages/lyra-ui/src/components/conversation/code-block/code-block-core.class.ts';
    source[path] = source[path].replace('export type { LyraCodeBlockToggleDetail }', 'export type { LyraCodeBlockCopyAppearance }');
  });
  assert.throws(() => derive(changedCoreRoute), /Code-block type route changed/u);

  const missingExport = fixtureFiles();
  delete missingExport.packageJson.exports['./components/lr-details.js'];
  assert.throws(() => derive(missingExport), /Missing public package route/u);
});

test('field continuity requires all three published witnesses and rejects changed semantics', () => {
  const baseline = derive();
  const captures = REQUIRED_FIELD_RELEASES.map((sourceRelease, index) => {
    const sourceVersion = sourceRelease.slice('lyra-ui@'.length);
    const capture = {
      sourceRelease,
      sourceVersion,
      git: { tagObject: `${index + 1}`.repeat(40), commit: `${index + 2}`.repeat(40) },
      package: { name: '@aceshooting/lyra-ui', version: sourceVersion, tarballSha256: `${index + 1}`.repeat(64), registryIntegrity: `sha512-${'A'.repeat(86)}==` },
    };
    return { capture };
  });
  const attachments = captures.map(({ capture }, index) => {
    const facts = structuredClone(baseline);
    facts.sourceRelease = capture.sourceRelease;
    facts.sourceVersion = capture.sourceVersion;
    const attachment = {
      sourceRelease: capture.sourceRelease,
      sourceVersion: capture.sourceVersion,
      git: capture.git,
      package: capture.package,
      captureDescriptorSha256: sha256(jsonBytes(capture)),
    };
    return { attachment, facts };
  });
  assert.equal(verifyPublishedFieldContinuity({ captures, attachments }).length, 3);
  assert.throws(() => verifyPublishedFieldContinuity({ captures: captures.slice(0, 2), attachments: attachments.slice(0, 2) }), /requires every published release/u);
  const changed = structuredClone(attachments);
  changed[1].facts.declarations[0].relation = 'inverse';
  assert.throws(() => verifyPublishedFieldContinuity({ captures, attachments: changed }), /contract changed/u);
});

test('the field-evidence index pins every exact release descriptor and rejects a gap', () => {
  const attachments = REQUIRED_FIELD_RELEASES.map((sourceRelease, index) => ({
    attachment: { sourceRelease },
    descriptorSha256: `${index + 1}`.repeat(64),
  }));
  const index = buildFieldEvidenceIndex(attachments);
  assert.equal(validateFieldEvidenceIndex(index, attachments), true);
  assert.throws(() => buildFieldEvidenceIndex(attachments.slice(0, 2)), /every required release/u);
  assert.throws(() => validateFieldEvidenceIndex({ ...index, attachments: index.attachments.slice(0, 2) }, attachments), /missing a required release/u);
});

test('the field-history reader validates the checked-in attachments, index pins, and three-release continuity', () => {
  const captures = historyCaptures();
  const result = checkPublishedFieldHistorySync(historyDir, { captures });
  assert.equal(result.captures, captures);
  assert.deepEqual(result.index.requiredReleases, REQUIRED_FIELD_RELEASES);
  assert.deepEqual(result.attachments.map(item => item.attachment.sourceRelease), REQUIRED_FIELD_RELEASES);
  assert.ok(result.attachments.every(item => item.verified));
  assert.deepEqual(result.continuity.map(item => [item.sourceRelease, item.declarationCount, item.exposureCount]),
    REQUIRED_FIELD_RELEASES.map(release => [release, 10, 20]));
});

test('the field-history reader fails closed for a missing index, attachment, or descriptor pin mismatch', () => {
  const captures = historyCaptures();
  assert.throws(() => checkPublishedFieldHistorySync(historyDir), /requires ordinary captures/u);
  assert.throws(() => withHistoryView({ omitIndex: true }, directory =>
    checkPublishedFieldHistorySync(directory, { captures })), /ENOENT/u);
  assert.throws(() => withHistoryView({ omitAttachment: '22.1.0' }, directory =>
    checkPublishedFieldHistorySync(directory, { captures })), /ENOENT/u);
  assert.throws(() => withHistoryView({ pinMismatch: true }, directory =>
    checkPublishedFieldHistorySync(directory, { captures })), /disagree with index/u);
});

test('attachment validation binds exact Git blobs, source/packed contracts, and the ordinary capture', () => {
  const fixture = attachmentFixture();
  assert.equal(validatePublishedFieldAttachment(fixture).verified, true);

  const missingInput = structuredClone(fixture);
  missingInput.attachment.inputs.pop();
  assert.throws(() => validatePublishedFieldAttachment(missingInput), /input inventory is incomplete/u);

  const changedRole = structuredClone(fixture);
  changedRole.attachment.inputs[0].role = 'packed-runtime';
  assert.throws(() => validatePublishedFieldAttachment(changedRole), /input role changed/u);

  const changedLength = structuredClone(fixture);
  changedLength.attachment.inputs[0].bytes += 1;
  assert.throws(() => validatePublishedFieldAttachment(changedLength), /bytes disagree/u);

  const changedArchive = structuredClone(fixture);
  changedArchive.evidenceArchiveBytes[0] ^= 1;
  assert.throws(() => validatePublishedFieldAttachment(changedArchive), /archive hash mismatch/u);

  const orphanPayload = structuredClone(fixture);
  orphanPayload.evidence.payloads['f'.repeat(64)] = Buffer.from('unrelated').toString('base64');
  orphanPayload.evidenceArchiveBytes = encodeEvidence(orphanPayload.evidence);
  orphanPayload.attachment.evidenceArchiveSha256 = sha256(orphanPayload.evidenceArchiveBytes);
  assert.throws(() => validatePublishedFieldAttachment(orphanPayload), /unrelated payloads/u);

  const orphanGitObject = structuredClone(fixture);
  orphanGitObject.evidence.gitObjects.push(structuredClone(orphanGitObject.evidence.gitObjects[0]));
  orphanGitObject.evidenceArchiveBytes = encodeEvidence(orphanGitObject.evidence);
  orphanGitObject.attachment.evidenceArchiveSha256 = sha256(orphanGitObject.evidenceArchiveBytes);
  assert.throws(() => validatePublishedFieldAttachment(orphanGitObject), /Duplicate or corrupt Git object/u);

  const duplicateTarMember = structuredClone(fixture);
  duplicateTarMember.tarMembers.push('package/');
  duplicateTarMember.evidence.tarMembers = duplicateTarMember.tarMembers;
  duplicateTarMember.evidenceArchiveBytes = encodeEvidence(duplicateTarMember.evidence);
  duplicateTarMember.attachment.evidenceArchiveSha256 = sha256(duplicateTarMember.evidenceArchiveBytes);
  duplicateTarMember.attachment.tarball.memberCount = duplicateTarMember.tarMembers.length;
  duplicateTarMember.attachment.tarball.membersSha256 = sha256(jsonBytes(duplicateTarMember.tarMembers));
  assert.throws(() => validatePublishedFieldAttachment(duplicateTarMember), /Duplicate tar member/u);

  const unsafeTarMember = structuredClone(fixture);
  unsafeTarMember.tarMembers.push('../escape');
  unsafeTarMember.evidence.tarMembers = unsafeTarMember.tarMembers;
  unsafeTarMember.evidenceArchiveBytes = encodeEvidence(unsafeTarMember.evidence);
  unsafeTarMember.attachment.evidenceArchiveSha256 = sha256(unsafeTarMember.evidenceArchiveBytes);
  unsafeTarMember.attachment.tarball.memberCount = unsafeTarMember.tarMembers.length;
  unsafeTarMember.attachment.tarball.membersSha256 = sha256(jsonBytes(unsafeTarMember.tarMembers));
  assert.throws(() => validatePublishedFieldAttachment(unsafeTarMember), /Unsafe evidence path/u);

  const wrongGitTag = structuredClone(fixture);
  wrongGitTag.attachment.git.tagObject = 'e'.repeat(40);
  assert.throws(() => validatePublishedFieldAttachment(wrongGitTag), /Git release differs/u);

  const wrongCapture = structuredClone(fixture);
  wrongCapture.ordinaryCapture.package.tarballSha256 = 'c'.repeat(64);
  wrongCapture.attachment.package = { ...wrongCapture.attachment.package, tarballSha256: 'a'.repeat(64) };
  wrongCapture.ordinaryCaptureBytes = jsonBytes(wrongCapture.ordinaryCapture);
  wrongCapture.attachment.captureDescriptorSha256 = sha256(wrongCapture.ordinaryCaptureBytes);
  assert.throws(() => validatePublishedFieldAttachment(wrongCapture), /npm identity differs/u);
});
