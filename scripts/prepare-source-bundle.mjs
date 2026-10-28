import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertGeneratedAddition, assertSourcePath } from './prepare-artifacts-paths.mjs';
import { preparationReceipt } from './prepare-candidate-source.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export function bundlePreparedSource(root, environment = process.env) {
  const preparationMode = environment.PREPARATION_MODE ?? 'source';
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 128 * 1024 * 1024 });
  const commit = git(['rev-parse', 'HEAD']).toString().trim();
  assert.equal(commit, environment.PREPARATION_SOURCE_SHA ?? environment.GITHUB_SHA);
  const preparation = preparationReceipt({ workflowSha: environment.GITHUB_SHA, sourceSha: commit,
    candidateSha: environment.PREPARATION_CANDIDATE_SHA ?? '', sourceContracts: environment.SOURCE_CONTRACTS_JSON ?? '' });
  preparation.mode = preparationMode;
  const tracked = new Map(git(['ls-tree', '-rz', 'HEAD']).toString().split('\0').filter(Boolean).map(line => {
    const [header, file] = line.split('\t');
    const [mode, kind, oid] = header.split(' ');
    return [file, { mode, kind, oid }];
  }));
  const modified = git(['diff', 'HEAD', '--name-only', '-z']).toString().split('\0').filter(Boolean);
  const added = git(['ls-files', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
  for (const file of added) assertGeneratedAddition(file);
  const output = join(environment.RUNNER_TEMP, 'lyra-generated-source');
  assert.ok(!existsSync(output));
  mkdirSync(join(output, 'blobs'), { recursive: true });
  const changes = [];
  for (const file of [...new Set([...modified, ...added])].sort()) {
    const old = tracked.get(file);
    if (old) assert.equal(old.kind, 'blob');
    if (old) assert.ok(['100644', '100755'].includes(old.mode));
    const before = old ? { sha256: sha256(git(['cat-file', 'blob', old.oid])), gitBlob: old.oid, mode: old.mode } : null;
    const target = resolve(root, file);
    // lstat detects dangling symlinks too; they cannot masquerade as a consumed changeset.
    const stat = lstatSync(target, { throwIfNoEntry: false });
    assertSourcePath(file, { mode: preparationMode, tracked: old, deleted: stat === undefined });
    let after = null;
    if (stat) {
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
  const manifest = { schemaVersion: 1, repository: environment.GITHUB_REPOSITORY, baseCommit: commit,
    runId: environment.GITHUB_RUN_ID, runAttempt: environment.GITHUB_RUN_ATTEMPT, preparation, changes };
  const bytes = jsonBytes(manifest);
  writeFileSync(join(output, 'manifest.json'), bytes);
  writeFileSync(join(output, 'manifest.sha256'), `${sha256(bytes)}  manifest.json\n`);
  writeFileSync(join(output, 'changes.patch'), git(['diff', 'HEAD', '--binary', '--full-index']));
  writeFileSync(join(output, 'README.txt'), 'Review manifest.json and every changed path before applying. Verify the repository/baseCommit and all current before hashes/modes (null means absent), then every blob hash/length before any write. A null after means deletion. Apply regular files with the recorded modes. changes.patch previews tracked changes only; the manifest also includes new files. This artifact is generated source, not release qualification.\n');
  console.log(`Prepared ${changes.length} source changes against ${commit}`);
}
