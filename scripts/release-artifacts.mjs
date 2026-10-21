import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const regularFile = (file) => {
  if (!lstatSync(file).isFile()) throw new Error(`Expected a regular release asset: ${path.basename(file)}.`);
};

/** Read asset policy and bytes from the immutable commit, never the mutable checkout. */
export function releaseArtifactSpec({ expected, sourceSha, repositoryRoot }) {
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
    show,
  };
}

/** Add the canonical source distribution and committed standalone assets to the pack directory. */
export function collectReleaseAssets({ expected, sourceSha, repositoryRoot, directory }) {
  const spec = releaseArtifactSpec({ expected, sourceSha, repositoryRoot });
  mkdirSync(directory, { recursive: true });
  execFileSync('git', ['-c', 'core.attributesFile=/dev/null', 'archive', '--format=tar',
    `--prefix=lyra-ui-${sourceSha}/`, `--output=${path.resolve(directory, spec.sourceName)}`, sourceSha],
  { cwd: repositoryRoot });
  for (const name of spec.standalone) {
    writeFileSync(path.join(directory, name), spec.show(`${expected.directory}/${name}`));
  }
  return spec;
}

/** Check every download before any signing credentials are available. */
export function verifyReleaseAssets({ expected, sourceSha, repositoryRoot, directory, outputDirectory }) {
  if (path.resolve(directory) === path.resolve(outputDirectory)) {
    throw new Error('Release download and verified asset directories must differ.');
  }
  const spec = releaseArtifactSpec({ expected, sourceSha, repositoryRoot });
  const additionalNames = [spec.sourceName, ...spec.standalone].sort();
  const payloadNames = [spec.tarballName, ...additionalNames];
  const allowedNames = new Set(payloadNames.flatMap((name) => [name, `${name}.sigstore.json`, `${name}.intoto.jsonl`]));
  for (const name of readdirSync(directory)) {
    if (!allowedNames.has(name)) throw new Error(`Unexpected release asset: ${name}.`);
    regularFile(path.join(directory, name));
  }
  for (const name of payloadNames) regularFile(path.join(directory, name));
  mkdirSync(outputDirectory, { recursive: true });
  if (readdirSync(outputDirectory).length) throw new Error('Verified asset directory must be empty.');
  collectReleaseAssets({ expected, sourceSha, repositoryRoot, directory: outputDirectory });
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
