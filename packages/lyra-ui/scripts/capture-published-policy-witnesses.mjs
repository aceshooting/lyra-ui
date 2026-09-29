import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isMainModule } from './is-main-module.mjs';
import { encodeEvidence, parseGitTree, sha256, verifyGitEvidence } from './published-compatibility-io.mjs';

export function capturePolicyWitnesses({ repository, facts, tagObjects, output, publications = {} }) {
  const releases = [];
  for (const release of facts.policyReleaseHistory) {
    const commit = release.sourceCommit; const tagObject = tagObjects[release.tag];
    if (!/^[a-f0-9]{40}$/u.test(commit) || !/^[a-f0-9]{40}$/u.test(tagObject)) throw new Error(`Missing immutable tag/commit pin for ${release.tag}`);
    const objects = new Map();
    const object = (oid, type) => {
      const bytes = execFileSync('git', ['-C', repository, 'cat-file', type, oid], { maxBuffer: 16 * 1024 * 1024 });
      objects.set(oid, { oid, type, data: bytes.toString('base64') }); return bytes;
    };
    object(tagObject, 'tag');
    let tree = /^tree ([a-f0-9]{40})$/mu.exec(object(commit, 'commit').toString('utf8'))?.[1];
    const path = 'packages/lyra-ui/scripts/fixtures/component-metadata.json'; let entry;
    for (const part of path.split('/')) {
      entry = parseGitTree(object(tree, 'tree')).get(part);
      if (!entry) throw new Error(`Missing historical policy input ${release.tag}`);
      tree = entry.oid;
    }
    const bytes = execFileSync('git', ['-C', repository, 'cat-file', 'blob', entry.oid], { maxBuffer: 16 * 1024 * 1024 });
    let publication = null;
    const supplied = publications[release.tag];
    if (supplied) {
      const tar = readFileSync(supplied.tarball);
      if (sha256(tar) !== supplied.tarballSha256 || `sha512-${createHash('sha512').update(tar).digest('base64')}` !== supplied.registryIntegrity) throw new Error('Historical npm integrity mismatch');
      const packedPackage = execFileSync('tar', ['-xOzf', resolve(supplied.tarball), '--', 'package/package.json'], { maxBuffer: 4 * 1024 * 1024 });
      const packedManifest = execFileSync('tar', ['-xOzf', resolve(supplied.tarball), '--', 'package/custom-elements.json'], { maxBuffer: 16 * 1024 * 1024 });
      let parentTree = /^tree ([a-f0-9]{40})$/mu.exec(object(commit, 'commit').toString('utf8'))[1]; let manifestEntry;
      const manifestPath = 'packages/lyra-ui/custom-elements.json';
      for (const part of manifestPath.split('/')) { manifestEntry = parseGitTree(object(parentTree, 'tree')).get(part); if (!manifestEntry) throw new Error('Missing historical manifest'); parentTree = manifestEntry.oid; }
      const manifest = execFileSync('git', ['-C', repository, 'cat-file', 'blob', manifestEntry.oid], { maxBuffer: 16 * 1024 * 1024 });
      const identity = JSON.parse(packedPackage);
      if (!manifest.equals(packedManifest) || identity.name !== '@aceshooting/lyra-ui' || identity.version !== release.version) throw new Error('Historical npm/source contract mismatch');
      publication = { tarballSha256: supplied.tarballSha256, registryIntegrity: supplied.registryIntegrity, packageJson: packedPackage.toString('base64'),
        manifest: { path: manifestPath, gitBlob: manifestEntry.oid, sha256: sha256(manifest), data: manifest.toString('base64') } };
    }
    releases.push({ sourceRelease: release.tag, sourceVersion: release.version, git: { commit, tagObject }, objects: [...objects.values()], publication,
      input: { path, gitBlob: entry.oid, sha256: sha256(bytes), data: bytes.toString('base64') } });
  }
  for (const release of releases) verifyGitEvidence({ pin: { ...release.git, tag: release.sourceRelease }, objects: release.objects, inputs: [release.input, ...(release.publication ? [release.publication.manifest] : [])] });
  const archive = encodeEvidence({ schemaVersion: 1, releases });
  writeFileSync(output, archive, { flag: 'wx' });
  return { bytes: archive.length, sha256: sha256(archive) };
}
if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({ options: { repository: { type: 'string' }, facts: { type: 'string' }, pins: { type: 'string' }, output: { type: 'string' }, publications: { type: 'string' } } });
  if (!['repository', 'facts', 'pins', 'output'].every(key => values[key])) throw new Error('repository, facts, pins and output are required');
  console.log(JSON.stringify(capturePolicyWitnesses({ ...values, facts: JSON.parse(readFileSync(values.facts, 'utf8')), tagObjects: JSON.parse(readFileSync(values.pins, 'utf8')), publications: values.publications ? JSON.parse(readFileSync(values.publications, 'utf8')) : {} }), null, 2));
}
