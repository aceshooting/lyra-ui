import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fullSha = value => typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/u.test(value);
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }).trim();
const protectedPath = (file, mode = '') => /^(?:scripts\/|packages\/lyra-ui\/scripts\/)/u.test(file) &&
  (/\.(?:mjs|cjs|js|ts|sh|py)$/u.test(file) || ['100755', '120000'].includes(mode));

export function validateCandidateSource(root, { workflowSha, candidateSha }) {
  assert.ok(fullSha(workflowSha) && fullSha(candidateSha), 'Preparation requires complete lowercase commit SHAs');
  assert.equal(git(root, ['cat-file', '-t', candidateSha]), 'commit', 'Candidate must be a commit');
  assert.equal(git(root, ['rev-parse', `${candidateSha}^{commit}`]), candidateSha);
  assert.equal(git(root, ['rev-parse', 'refs/lyra-preparation-origin/main']), workflowSha, 'Main advanced; dispatch again');
  git(root, ['merge-base', '--is-ancestor', workflowSha, candidateSha]);
  assert.ok(git(root, ['for-each-ref', '--contains', candidateSha, '--format=%(refname)', 'refs/lyra-preparation-origin/']),
    'Candidate must be reachable from a freshly fetched origin branch');
  return candidateSha;
}

function authorityTree(root, commit) {
  assert.ok(fullSha(commit), 'Authority requires a complete commit SHA');
  return new Map(git(root, ['ls-tree', '-rz', commit]).split('\0').filter(Boolean).flatMap(line => {
    const [header, file] = line.split('\t');
    const [mode, kind, oid] = header.split(' ');
    if (!protectedPath(file, mode)) return [];
    assert.equal(kind, 'blob');
    assert.ok(['100644', '100755'].includes(mode), `Non-regular preparation authority ${file}`);
    return [[file, { mode, oid }]];
  }));
}

export function assertPreparationAuthority(root, workflowSha, sourceSha) {
  assert.equal(git(root, ['rev-parse', 'HEAD']), sourceSha, 'Preparation source HEAD changed');
  const trusted = authorityTree(root, workflowSha);
  const candidate = authorityTree(root, sourceSha);
  assert.deepEqual(candidate, trusted, 'Candidate changes trusted preparation tooling');
  const actual = [];
  function walk(relative) {
    const directory = join(root, relative);
    if (!lstatSync(directory, { throwIfNoEntry: false })) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else {
        const stat = lstatSync(join(root, file));
        const mode = stat.isSymbolicLink() ? '120000' : stat.mode & 0o111 ? '100755' : '100644';
        if (protectedPath(file, mode)) actual.push(file);
      }
    }
  }
  walk('scripts'); walk('packages/lyra-ui/scripts');
  assert.deepEqual(actual.sort(), [...trusted.keys()].sort(), 'Preparation tooling file inventory changed');
  for (const [file, expected] of trusted) {
    const stat = lstatSync(join(root, file));
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Non-regular preparation tooling ${file}`);
    assert.equal(stat.mode & 0o111 ? '100755' : '100644', expected.mode, `Preparation tooling mode changed ${file}`);
    const original = execFileSync('git', ['cat-file', 'blob', expected.oid], { cwd: root });
    assert.ok(readFileSync(join(root, file)).equals(original), `Preparation tooling bytes changed ${file}`);
  }
}

export function preparationReceipt({ workflowSha, sourceSha, candidateSha = '', sourceContracts = '' }) {
  assert.ok(fullSha(workflowSha) && fullSha(sourceSha));
  assert.equal(sourceSha, candidateSha === '' ? workflowSha : candidateSha, 'Preparation receipt source identity differs from selected source');
  return {
    workflowCommit: workflowSha, workflowRef: 'refs/heads/main', sourceCommit: sourceSha,
    candidateCommit: candidateSha || null, mode: 'source',
    sourceContractsSha256: createHash('sha256').update(sourceContracts).digest('hex'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Use the hosted generation workflow');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Generation requires main');
  const [command, root, workflowSha, sourceSha] = process.argv.slice(2);
  if (command === 'validate') {
    validateCandidateSource(root, { workflowSha, candidateSha: sourceSha });
    // Before switching HEAD, compare committed authority without trusting candidate code.
    assert.deepEqual(authorityTree(root, sourceSha), authorityTree(root, workflowSha), 'Candidate changes trusted preparation tooling');
  } else if (command === 'verify') assertPreparationAuthority(root, workflowSha, sourceSha);
  else throw new Error('Expected validate or verify');
}
