import assert from 'node:assert/strict';
import { constants as fsConstants } from 'node:fs';
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, win32 } from 'node:path';
import test from 'node:test';

import {
  derivePackageManagerVersions,
  repoRelativeParentEntries,
  directoryHandleFlags,
  hasPrivateEvidenceFileMode,
  synchronizePackageManagerDocumentTexts,
  synchronizePackageManagerDocsAtRoot,
} from './sync-package-manager-docs.mjs';

function fixtureManifests() {
  return {
    rootPackage: { packageManager: 'pnpm@11.25.0' },
    lyraUiPackage: { packageManager: 'pnpm@11.25.0' },
    lyraFlagsPackage: { packageManager: 'pnpm@11.25.0' },
    node20Package: { packageManager: 'pnpm@10.34.5' },
  };
}

function fixtureDocuments({ node22 = '11.24.0', node20 = '10.34.4' } = {}) {
  return {
    agentsMd:
      `pnpm workspace (\`pnpm-workspace.yaml\`: \`packages/*\`), Node ≥ 20, \`pnpm@${node22}\`.\n`,
    contributingMd:
      `Node ≥ 20, \`pnpm@${node22}\` (pinned via \`packageManager\` in \`package.json\` — check that file if this\n` +
      'drifts again).\n',
    ciAndGatesMd:
      `Node 20 uses the pnpm version pinned in \`.github/ci-pnpm10.json\` (\`pnpm@${node20}\`); Node 22\n` +
      `uses \`package.json#packageManager\` (\`pnpm@${node22}\`).\n` +
      `Node 20 needs pnpm ${node20}; Node 22 needs pnpm ${node22}.\n`,
  };
}

async function writeJson(root, relativePath, value) {
  const absolutePath = join(root, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFixtureRoot(root, { documents = fixtureDocuments(), manifests = fixtureManifests() } = {}) {
  await writeJson(root, 'package.json', manifests.rootPackage);
  await writeJson(root, 'packages/lyra-ui/package.json', manifests.lyraUiPackage);
  await writeJson(root, 'packages/lyra-flags/package.json', manifests.lyraFlagsPackage);
  await writeJson(root, '.github/ci-pnpm10.json', manifests.node20Package);
  await writeFile(join(root, 'AGENTS.md'), documents.agentsMd);
  await writeFile(join(root, 'CONTRIBUTING.md'), documents.contributingMd);
  await mkdir(join(root, 'docs/agents'), { recursive: true });
  await writeFile(join(root, 'docs/agents/ci-and-gates.md'), documents.ciAndGatesMd);
}

async function replaceWithByteIdenticalInode(target) {
  const contents = await readFile(target);
  const mode = Number((await lstat(target, { bigint: true })).mode & 0o7777n);
  const replacement = `${target}.byte-identical-replacement`;
  await writeFile(replacement, contents, { flag: 'wx', mode: 0o600 });
  await chmod(replacement, mode);
  await rename(replacement, target);
}

test('derives Node 22 and Node 20 pnpm versions from their authorities', () => {
  assert.deepEqual(derivePackageManagerVersions(fixtureManifests()), {
    node22Pnpm: '11.25.0',
    node20Pnpm: '10.34.5',
  });

  for (const [manifestName, packageManager] of [
    ['rootPackage', 'npm@11.25.0'],
    ['lyraUiPackage', 'pnpm@11.24.0'],
    ['lyraFlagsPackage', 'pnpm@11.25'],
    ['node20Package', 'pnpm@10'],
  ]) {
    const manifests = fixtureManifests();
    manifests[manifestName] = { packageManager };
    assert.throws(
      () => derivePackageManagerVersions(manifests),
      /packageManager/u,
      `${manifestName}: ${packageManager}`,
    );
  }
});

test('canonical POSIX repo-relative keys traverse nested parents with a win32 path flavor', () => {
  assert.deepEqual(
    repoRelativeParentEntries(
      'C:\\work\\lyra-ui',
      'docs/agents/ci-and-gates.md',
      win32,
    ),
    [
      { absolutePath: 'C:\\work\\lyra-ui', relativePath: '.' },
      { absolutePath: 'C:\\work\\lyra-ui\\docs', relativePath: 'docs' },
      { absolutePath: 'C:\\work\\lyra-ui\\docs\\agents', relativePath: 'docs/agents' },
    ],
  );
  for (const invalid of [
    'docs\\agents\\ci-and-gates.md',
    'docs//agents/ci-and-gates.md',
    'docs/../AGENTS.md',
    '/docs/agents/ci-and-gates.md',
  ]) {
    assert.throws(
      () => repoRelativeParentEntries('C:\\work\\lyra-ui', invalid, win32),
      /invalid .* repo-relative path/iu,
    );
  }
});

test('updates all four anchored documentation claims from the authorities', () => {
  const synchronized = synchronizePackageManagerDocumentTexts(
    fixtureDocuments(),
    derivePackageManagerVersions(fixtureManifests()),
  );

  assert.match(synchronized.agentsMd, /`pnpm@11\.25\.0`/u);
  assert.match(synchronized.contributingMd, /`pnpm@11\.25\.0`/u);
  assert.match(
    synchronized.ciAndGatesMd,
    /`pnpm@10\.34\.5`\); Node 22\nuses `package\.json#packageManager` \(`pnpm@11\.25\.0`\)/u,
  );
  assert.match(
    synchronized.ciAndGatesMd,
    /Node 20 needs pnpm 10\.34\.5; Node 22 needs pnpm 11\.25\.0\./u,
  );
  assert.doesNotMatch(synchronized.agentsMd, /11\.24\.0/u);
  assert.doesNotMatch(synchronized.contributingMd, /11\.24\.0/u);
  assert.doesNotMatch(synchronized.ciAndGatesMd, /11\.24\.0|10\.34\.4/u);
});

test('fails closed when any documentation anchor is missing or ambiguous', () => {
  const versions = derivePackageManagerVersions(fixtureManifests());
  const documents = fixtureDocuments();

  for (const key of ['agentsMd', 'contributingMd']) {
    assert.throws(
      () => synchronizePackageManagerDocumentTexts({ ...documents, [key]: 'anchor removed\n' }, versions),
      /expected exactly one .* claim, found 0/iu,
      key,
    );
    assert.throws(
      () => synchronizePackageManagerDocumentTexts({ ...documents, [key]: documents[key].repeat(2) }, versions),
      /expected exactly one .* claim, found 2/iu,
      key,
    );
  }

  const primaryClaim = documents.ciAndGatesMd.split('\nNode 20 needs pnpm')[0];
  assert.throws(
    () => synchronizePackageManagerDocumentTexts(
      { ...documents, ciAndGatesMd: `${primaryClaim}\n${primaryClaim}\nNode 20 needs pnpm 10.34.4; Node 22 needs pnpm 11.24.0.\n` },
      versions,
    ),
    /expected exactly one CI matrix package-manager claim, found 2/u,
  );
  assert.throws(
    () => synchronizePackageManagerDocumentTexts(
      { ...documents, ciAndGatesMd: primaryClaim },
      versions,
    ),
    /expected exactly one local platform package-manager claim, found 0/u,
  );
});

test('check mode rejects stale same-major claims without writing; write mode is idempotent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-docs-test-'));
  try {
    await writeFixtureRoot(root);
    const staleAgents = await readFile(join(root, 'AGENTS.md'), 'utf8');

    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, { mode: 'check' }),
      /package-manager documentation is stale: AGENTS\.md, CONTRIBUTING\.md, docs\/agents\/ci-and-gates\.md/u,
    );
    assert.equal(await readFile(join(root, 'AGENTS.md'), 'utf8'), staleAgents);

    assert.deepEqual(
      await synchronizePackageManagerDocsAtRoot(root, { mode: 'write' }),
      ['AGENTS.md', 'CONTRIBUTING.md', 'docs/agents/ci-and-gates.md'],
    );
    assert.deepEqual(await synchronizePackageManagerDocsAtRoot(root, { mode: 'write' }), []);
    assert.deepEqual(await synchronizePackageManagerDocsAtRoot(root, { mode: 'check' }), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function overrideHandle(handle, overrides) {
  return new Proxy(handle, {
    get(target, property) {
      if (Object.hasOwn(overrides, property)) return overrides[property];
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function isWritablePublicOpen(flags) {
  return typeof flags === 'number' && (flags & fsConstants.O_RDWR) === fsConstants.O_RDWR;
}

async function transactionDebris(root) {
  return (await readdir(root)).filter((entry) => (
    entry === '.package-manager-docs.lock' ||
    entry.startsWith('.package-manager-docs-transaction-')
  ));
}

test('directory handle selection has a Windows-safe lstat fallback', () => {
  assert.equal(directoryHandleFlags({ O_NOFOLLOW: 0x10, O_RDONLY: 0 }), undefined);
  assert.equal(
    directoryHandleFlags(
      { O_DIRECTORY: 0x20, O_NOFOLLOW: 0x10, O_RDONLY: 0x01 },
      'win32',
    ),
    undefined,
  );
  assert.equal(
    directoryHandleFlags(
      { O_DIRECTORY: 0x20, O_NOFOLLOW: 0x10, O_RDONLY: 0x01 },
      'linux',
    ),
    0x31,
  );
});

test('private evidence mode validation follows platform permission semantics', () => {
  assert.equal(hasPrivateEvidenceFileMode({ mode: 0o100600n }, 'linux'), true);
  assert.equal(hasPrivateEvidenceFileMode({ mode: 0o100644n }, 'linux'), false);
  assert.equal(hasPrivateEvidenceFileMode({ mode: 0o100600n }, 'darwin'), true);
  assert.equal(hasPrivateEvidenceFileMode({ mode: 0o100666n }, 'win32'), true);
  assert.equal(hasPrivateEvidenceFileMode({ mode: 0o100444n }, 'win32'), false);
});

test('snapshot checks reject symbolic-link targets and unsafe repo-relative parents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-path-safety-'));
  try {
    await writeFixtureRoot(root);
    const agents = join(root, 'AGENTS.md');
    await rename(agents, `${agents}.real`);
    await symlink(`${agents}.real`, agents);
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, { mode: 'check' }),
      /AGENTS\.md.*symbolic link|symbolic link.*AGENTS\.md/iu,
    );
    await rm(agents);
    await rename(`${agents}.real`, agents);

    const docs = join(root, 'docs');
    await rename(docs, `${docs}.real`);
    await symlink(`${docs}.real`, docs, 'dir');
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, { mode: 'check' }),
      /repo-relative parent docs.*symbolic link|symbolic link.*repo-relative parent docs/iu,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a writable public document hard link is rejected without modifying its sibling inode', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'lyra-package-manager-hard-link-custody-'));
  const root = join(fixture, 'repo');
  const sentinel = join(fixture, 'sentinel.txt');
  try {
    await mkdir(root);
    await writeFixtureRoot(root);
    const agents = join(root, 'AGENTS.md');
    const sentinelContents = Buffer.from(fixtureDocuments().agentsMd, 'utf8');
    await rm(agents);
    await writeFile(sentinel, sentinelContents);
    await link(sentinel, agents);

    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, { mode: 'write' }),
      /hard link|link count|nlink/iu,
    );

    assert.deepEqual(await readFile(sentinel), sentinelContents);
    assert.deepEqual(await readFile(agents), sentinelContents);
    assert.deepEqual(await transactionDebris(root), []);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('malformed UTF-8 in authorities or documents fails closed without lossy rewriting', async (t) => {
  for (const [target, malformedContents] of [
    [
      'package.json',
      Buffer.concat([
        Buffer.from('{"packageManager":"pnpm@11.25.0","note":"', 'utf8'),
        Buffer.from([0xff]),
        Buffer.from('"}\n', 'utf8'),
      ]),
    ],
    [
      'AGENTS.md',
      Buffer.concat([Buffer.from(fixtureDocuments().agentsMd, 'utf8'), Buffer.from([0xff])]),
    ],
  ]) {
    for (const mode of ['check', 'write']) {
      await t.test(`${mode}: ${target}`, async () => {
        const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-invalid-utf8-'));
        try {
          await writeFixtureRoot(root);
          const absoluteTarget = join(root, target);
          await writeFile(absoluteTarget, malformedContents);

          await assert.rejects(
            synchronizePackageManagerDocsAtRoot(root, { mode }),
            /invalid UTF-8/iu,
          );

          assert.deepEqual(await readFile(absoluteTarget), malformedContents);
          assert.deepEqual(await transactionDebris(root), []);
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      });
    }
  }
});

test('a retained-handle write failure rolls every already-mutated document back', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-bound-rollback-'));
  try {
    await writeFixtureRoot(root);
    const targets = ['AGENTS.md', 'CONTRIBUTING.md', 'docs/agents/ci-and-gates.md'];
    const before = Object.fromEntries(
      await Promise.all(targets.map(async (target) => [target, await readFile(join(root, target))])),
    );
    let injected = false;
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (openedPath !== join(root, 'CONTRIBUTING.md') || !isWritablePublicOpen(flags)) {
              return handle;
            }
            return overrideHandle(handle, {
              write: async (...writeArgs) => {
                if (!injected) {
                  injected = true;
                  throw new Error('injected retained-handle commit failure');
                }
                return handle.write(...writeArgs);
              },
            });
          },
        },
      }),
      /injected retained-handle commit failure/u,
    );
    assert.equal(injected, true);
    for (const target of targets) assert.deepEqual(await readFile(join(root, target)), before[target]);
    assert.deepEqual(await transactionDebris(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a concurrent public replacement is never written, removed, or rolled back', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-bound-replacement-'));
  try {
    await writeFixtureRoot(root);
    const agents = join(root, 'AGENTS.md');
    const concurrentContents = 'concurrent public replacement\n';
    let installed = false;
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (openedPath !== agents || !isWritablePublicOpen(flags)) return handle;
            return overrideHandle(handle, {
              sync: async () => {
                await handle.sync();
                if (!installed) {
                  installed = true;
                  const replacement = `${agents}.concurrent`;
                  await writeFile(replacement, concurrentContents, { flag: 'wx' });
                  await rename(replacement, agents);
                }
              },
            });
          },
        },
      }),
      /retained public FileHandle|FileHandle binding|no longer names/iu,
    );
    assert.equal(installed, true);
    assert.equal(await readFile(agents, 'utf8'), concurrentContents);
    assert.ok(
      (await readdir(root)).some((entry) => entry.startsWith('.package-manager-docs-transaction-')),
      'ambiguous transaction evidence must remain visible',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rollback failures surface both the action and the private recovery path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-rollback-visible-'));
  try {
    await writeFixtureRoot(root);
    let agentsWrites = 0;
    let primaryInjected = false;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (!isWritablePublicOpen(flags)) return handle;
            if (openedPath === join(root, 'AGENTS.md')) {
              return overrideHandle(handle, {
                write: async (...writeArgs) => {
                  agentsWrites += 1;
                  if (agentsWrites > 1) throw new Error('injected retained-handle rollback failure');
                  return handle.write(...writeArgs);
                },
              });
            }
            if (openedPath === join(root, 'CONTRIBUTING.md')) {
              return overrideHandle(handle, {
                write: async (...writeArgs) => {
                  if (!primaryInjected) {
                    primaryInjected = true;
                    throw new Error('injected second-document failure');
                  }
                  return handle.write(...writeArgs);
                },
              });
            }
            return handle;
          },
        },
      });
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /injected second-document failure/u);
    assert.match(thrown.message, /Rollback failed:/u);
    assert.match(thrown.message, /injected retained-handle rollback failure/u);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.ok(thrown.rollbackErrors.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('cleanup failures surface the owned private evidence path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-cleanup-visible-'));
  try {
    await writeFixtureRoot(root);
    let failedPath;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          rm: async (removedPath, options) => {
            if (String(removedPath).includes('.package-manager-docs-transaction-')) {
              failedPath = removedPath;
              throw new Error('injected private evidence cleanup failure');
            }
            return rm(removedPath, options);
          },
        },
      });
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown instanceof Error);
    assert.ok(failedPath);
    assert.match(thrown.message, /Cleanup failed:/u);
    assert.match(thrown.message, /injected private evidence cleanup failure/u);
    assert.match(thrown.message, new RegExp(failedPath.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
    assert.equal((await lstat(failedPath)).isDirectory(), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('no-op write finally revalidates every authority and every unchanged document identity', async (context) => {
  const synchronizedDocuments = fixtureDocuments({ node22: '11.25.0', node20: '10.34.5' });
  for (const relativePath of [
    'package.json',
    'packages/lyra-ui/package.json',
    'packages/lyra-flags/package.json',
    '.github/ci-pnpm10.json',
    'AGENTS.md',
    'CONTRIBUTING.md',
    'docs/agents/ci-and-gates.md',
  ]) {
    await context.test(relativePath, async () => {
      const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-final-snapshot-'));
      try {
        await writeFixtureRoot(root, { documents: synchronizedDocuments });
        const target = join(root, relativePath);
        let opens = 0;
        await assert.rejects(
          synchronizePackageManagerDocsAtRoot(root, {
            mode: 'write',
            fileOperations: {
              open: async (openedPath, flags, ...args) => {
                if (openedPath === target && typeof flags === 'number' && !isWritablePublicOpen(flags)) {
                  opens += 1;
                  if (opens === 2) await replaceWithByteIdenticalInode(target);
                }
                return open(openedPath, flags, ...args);
              },
            },
          }),
          /changed|snapshot|binding/iu,
        );
        assert.ok(opens >= 2);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});

test('final validation rejects a byte-identical replacement of a committed document', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-committed-identity-'));
  try {
    await writeFixtureRoot(root);
    let replaced = false;
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          rm: async (removedPath, options) => {
            const result = await rm(removedPath, options);
            if (!replaced && String(removedPath).includes('.package-manager-docs-transaction-')) {
              replaced = true;
              await replaceWithByteIdenticalInode(join(root, 'AGENTS.md'));
            }
            return result;
          },
        },
      }),
      /AGENTS\.md.*changed from its trusted snapshot/u,
    );
    assert.equal(replaced, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the bound transaction never uses public rename, hard-link, or individual-stage cleanup seams', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-no-path-seams-'));
  try {
    await writeFixtureRoot(root);
    let linkAttempts = 0;
    let renameAttempts = 0;
    let individualStageRemovals = 0;
    await synchronizePackageManagerDocsAtRoot(root, {
      mode: 'write',
      fileOperations: {
        link: async () => {
          linkAttempts += 1;
          const error = new Error('hard links unsupported');
          error.code = 'EPERM';
          throw error;
        },
        rename: async () => {
          renameAttempts += 1;
          throw new Error('public rename seam must not run');
        },
        rm: async (removedPath, options) => {
          if (String(removedPath).includes('.package-manager-docs-stage-')) {
            individualStageRemovals += 1;
          }
          return rm(removedPath, options);
        },
      },
    });
    assert.equal(linkAttempts, 0);
    assert.equal(renameAttempts, 0);
    assert.equal(individualStageRemovals, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('owned wx stage failures report ENOSPC and clean only their private namespace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-stage-enospc-'));
  try {
    await writeFixtureRoot(root);
    const original = await readFile(join(root, 'AGENTS.md'));
    let stagePath;
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (!stagePath && flags === 'wx+' && String(openedPath).includes('.package-manager-docs-stage-')) {
              stagePath = openedPath;
              return overrideHandle(handle, {
                write: async () => {
                  const error = new Error('injected ENOSPC after exclusive stage ownership');
                  error.code = 'ENOSPC';
                  throw error;
                },
              });
            }
            return handle;
          },
        },
      }),
      /staged file.*package-manager-docs-stage-.*ENOSPC/su,
    );
    assert.ok(stagePath);
    assert.deepEqual(await readFile(join(root, 'AGENTS.md')), original);
    assert.deepEqual(await transactionDebris(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an exclusive stage collision preserves the unknown file inside visible private evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-stage-collision-'));
  try {
    await writeFixtureRoot(root);
    const original = await readFile(join(root, 'AGENTS.md'));
    let collisionPath;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            if (!collisionPath && flags === 'wx+' && String(openedPath).includes('.package-manager-docs-stage-')) {
              collisionPath = openedPath;
              await writeFile(collisionPath, 'unknown concurrent evidence\n', {
                flag: 'wx',
                mode: 0o600,
              });
            }
            return open(openedPath, flags, ...args);
          },
        },
      });
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /EEXIST/u);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.equal(await readFile(collisionPath, 'utf8'), 'unknown concurrent evidence\n');
    assert.deepEqual(await readFile(join(root, 'AGENTS.md')), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an owned evidence path replacement preserves both inodes and exposes recovery evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-evidence-replacement-'));
  try {
    await writeFixtureRoot(root);
    const originalAgents = await readFile(join(root, 'AGENTS.md'));
    const unknownContents = Buffer.from('UNKNOWN SENTINEL\n', 'utf8');
    let stagePath;
    let parkedPath;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          lstat: async (inspectedPath, options) => {
            if (!stagePath && String(inspectedPath).includes('.package-manager-docs-stage-AGENTS.md')) {
              stagePath = String(inspectedPath);
              parkedPath = `${stagePath}.owned`;
              await rename(stagePath, parkedPath);
              await writeFile(stagePath, unknownContents, { flag: 'wx', mode: 0o600 });
            }
            return lstat(inspectedPath, options);
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /changed while its owned FileHandle was populated/u);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.ok(stagePath);
    assert.ok(parkedPath);
    assert.deepEqual(await readFile(stagePath), unknownContents);
    assert.match(await readFile(parkedPath, 'utf8'), /`pnpm@11\.25\.0`/u);
    assert.deepEqual(await readFile(join(root, 'AGENTS.md')), originalAgents);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a partial stage write cannot make an unknown path replacement eligible for cleanup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-partial-stage-replacement-'));
  try {
    await writeFixtureRoot(root);
    const originalAgents = await readFile(join(root, 'AGENTS.md'));
    const unknownContents = Buffer.from('UNKNOWN PARTIAL-WRITE SENTINEL\n', 'utf8');
    let stagePath;
    let parkedPath;
    let injected = false;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (flags !== 'wx+' || !String(openedPath).includes('.package-manager-docs-stage-AGENTS.md')) {
              return handle;
            }
            stagePath = String(openedPath);
            parkedPath = `${stagePath}.owned`;
            return overrideHandle(handle, {
              write: async (buffer, offset, length, position) => {
                if (!injected) {
                  injected = true;
                  await handle.write(buffer, offset, Math.min(length, 3), position);
                  await rename(stagePath, parkedPath);
                  await writeFile(stagePath, unknownContents, { flag: 'wx', mode: 0o600 });
                  const error = new Error('injected ENOSPC after partial stage write and path replacement');
                  error.code = 'ENOSPC';
                  throw error;
                }
                return handle.write(buffer, offset, length, position);
              },
            });
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.equal(injected, true);
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /ENOSPC/u);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.deepEqual(await readFile(stagePath), unknownContents);
    assert.equal((await readFile(parkedPath)).subarray(0, 3).byteLength, 3);
    assert.deepEqual(await readFile(join(root, 'AGENTS.md')), originalAgents);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('pre-cleanup inventory preserves a stage replaced after its successful verification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-late-stage-replacement-'));
  try {
    await writeFixtureRoot(root);
    const unknownContents = Buffer.from('UNKNOWN LATE SENTINEL\n', 'utf8');
    let stagePath;
    let parkedPath;
    let replacementInstalled = false;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            if (
              !replacementInstalled &&
              flags === 'wx+' &&
              String(openedPath).includes('.package-manager-docs-backup-CONTRIBUTING.md')
            ) {
              stagePath = join(dirname(String(openedPath)), '.package-manager-docs-stage-AGENTS.md');
              parkedPath = `${stagePath}.owned`;
              await rename(stagePath, parkedPath);
              await writeFile(stagePath, unknownContents, { flag: 'wx', mode: 0o600 });
              replacementInstalled = true;
            }
            return open(openedPath, flags, ...args);
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.equal(replacementInstalled, true);
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /transaction evidence.*(?:inventory|identity|changed)/isu);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.deepEqual(await readFile(stagePath), unknownContents);
    assert.match(await readFile(parkedPath, 'utf8'), /`pnpm@11\.25\.0`/u);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('private evidence directory mode drift is restored and reported before public mutation', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-evidence-mode-drift-'));
  try {
    await writeFixtureRoot(root);
    const originalAgents = await readFile(join(root, 'AGENTS.md'));
    let evidencePath;
    let drifted = false;
    let writeMode;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            if (
              !drifted &&
              flags === 'wx+' &&
              String(openedPath).includes('.package-manager-docs-transaction-')
            ) {
              evidencePath = dirname(String(openedPath));
              await chmod(evidencePath, 0o777);
              drifted = true;
              const handle = await open(openedPath, flags, ...args);
              return overrideHandle(handle, {
                write: async (...writeArgs) => {
                  writeMode = Number((await lstat(evidencePath, { bigint: true })).mode & 0o777n);
                  return handle.write(...writeArgs);
                },
              });
            }
            return open(openedPath, flags, ...args);
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.equal(drifted, true);
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /private transaction evidence.*(?:owner|mode|privacy)/isu);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.deepEqual(await readFile(join(root, 'AGENTS.md')), originalAgents);
    assert.equal(writeMode, undefined, 'no evidence bytes may be written while directory custody is widened');
    assert.equal(Number((await lstat(evidencePath, { bigint: true })).mode & 0o777n), 0o700);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('mode drift during private child chmod re-hardens the child before preservation', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-child-chmod-drift-'));
  try {
    await writeFixtureRoot(root);
    const originalAgents = await readFile(join(root, 'AGENTS.md'));
    let childPath;
    let evidencePath;
    let drifted = false;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (
              childPath ||
              flags !== 'wx+' ||
              !String(openedPath).includes('.package-manager-docs-transaction-')
            ) {
              return handle;
            }
            childPath = String(openedPath);
            evidencePath = dirname(childPath);
            return overrideHandle(handle, {
              chmod: async (mode) => {
                if (!drifted) {
                  await chmod(evidencePath, 0o777);
                  drifted = true;
                }
                return handle.chmod(mode);
              },
            });
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.equal(drifted, true);
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /private transaction evidence.*owner-only directory mode/isu);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.deepEqual(await readFile(join(root, 'AGENTS.md')), originalAgents);
    assert.equal(Number((await lstat(evidencePath, { bigint: true })).mode & 0o777n), 0o700);
    assert.equal(Number((await lstat(childPath, { bigint: true })).mode & 0o777n), 0o600);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('private child chmod succeeded-then-threw re-hardens both child and directory', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-child-chmod-throw-'));
  try {
    await writeFixtureRoot(root);
    const originalAgents = await readFile(join(root, 'AGENTS.md'));
    let childPath;
    let evidencePath;
    let injected = false;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (
              childPath ||
              flags !== 'wx+' ||
              !String(openedPath).includes('.package-manager-docs-transaction-')
            ) {
              return handle;
            }
            childPath = String(openedPath);
            evidencePath = dirname(childPath);
            return overrideHandle(handle, {
              chmod: async (mode) => {
                if (!injected) {
                  await handle.chmod(mode);
                  await chmod(evidencePath, 0o777);
                  injected = true;
                  throw new Error('injected child chmod succeeded-then-threw');
                }
                return handle.chmod(mode);
              },
            });
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.equal(injected, true);
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /injected child chmod succeeded-then-threw/u);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.deepEqual(await readFile(join(root, 'AGENTS.md')), originalAgents);
    assert.equal(Number((await lstat(evidencePath, { bigint: true })).mode & 0o777n), 0o700);
    assert.equal(Number((await lstat(childPath, { bigint: true })).mode & 0o777n), 0o600);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('pre-mutation custody rejects evidence mode drift after every child verified', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-prewrite-mode-drift-'));
  try {
    await writeFixtureRoot(root);
    const originalAgents = await readFile(join(root, 'AGENTS.md'));
    let evidencePath;
    let drifted = false;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            if (
              !evidencePath &&
              flags === 'wx+' &&
              String(openedPath).includes('.package-manager-docs-transaction-')
            ) {
              evidencePath = dirname(String(openedPath));
            } else if (
              evidencePath &&
              !drifted &&
              openedPath === join(root, 'package.json') &&
              typeof flags === 'number'
            ) {
              await chmod(evidencePath, 0o777);
              drifted = true;
            }
            return open(openedPath, flags, ...args);
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.equal(drifted, true);
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /private transaction evidence.*owner-only directory mode/isu);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.deepEqual(await readFile(join(root, 'AGENTS.md')), originalAgents);
    assert.equal(Number((await lstat(evidencePath, { bigint: true })).mode & 0o777n), 0o700);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('unsafe mode observed immediately after evidence mkdir is restored before preservation', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-initial-mode-drift-'));
  try {
    await writeFixtureRoot(root);
    let evidencePath;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          mkdir: async (createdPath, options) => {
            await mkdir(createdPath, options);
            if (String(createdPath).includes('.package-manager-docs-transaction-')) {
              evidencePath = String(createdPath);
              await chmod(evidencePath, 0o777);
            }
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /owner mode 0700/iu);
    assert.match(thrown.message, /manual recovery path.*package-manager-docs-transaction-/isu);
    assert.equal(Number((await lstat(evidencePath, { bigint: true })).mode & 0o777n), 0o700);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('closing the retained evidence handle happens only after its namespace is removed', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-close-mode-drift-'));
  try {
    await writeFixtureRoot(root);
    let evidencePath;
    let postRemovalChmodCode;
    let wrapped = false;
    await synchronizePackageManagerDocsAtRoot(root, {
      mode: 'write',
      fileOperations: {
        open: async (openedPath, flags, ...args) => {
          const handle = await open(openedPath, flags, ...args);
          if (
            !wrapped &&
            typeof flags === 'number' &&
            String(openedPath).includes('.package-manager-docs-transaction-')
          ) {
            evidencePath = String(openedPath);
            wrapped = true;
            return overrideHandle(handle, {
              close: async () => {
                await handle.close();
                try {
                  await chmod(evidencePath, 0o777);
                } catch (error) {
                  postRemovalChmodCode = error?.code;
                }
              },
            });
          }
          return handle;
        },
      },
    });

    assert.equal(wrapped, true);
    assert.equal(postRemovalChmodCode, 'ENOENT');
    assert.equal((await transactionDebris(root)).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('cleanup retains the bound evidence-directory handle through recursive removal', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-cleanup-handle-custody-'));
  try {
    await writeFixtureRoot(root);
    let directoryClosed = false;
    let evidencePath;
    let removalObservedOpenHandle = false;
    await synchronizePackageManagerDocsAtRoot(root, {
      mode: 'write',
      fileOperations: {
        open: async (openedPath, flags, ...args) => {
          const handle = await open(openedPath, flags, ...args);
          if (
            !evidencePath &&
            typeof flags === 'number' &&
            String(openedPath).includes('.package-manager-docs-transaction-')
          ) {
            evidencePath = String(openedPath);
            return overrideHandle(handle, {
              close: async () => {
                await handle.close();
                directoryClosed = true;
              },
            });
          }
          return handle;
        },
        rm: async (removedPath, options) => {
          if (String(removedPath) === evidencePath) {
            removalObservedOpenHandle = !directoryClosed;
          }
          return rm(removedPath, options);
        },
      },
    });

    assert.equal(removalObservedOpenHandle, true);
    assert.equal(directoryClosed, true);
    assert.equal((await transactionDebris(root)).length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('failed recursive evidence cleanup restores owner-only mode before preservation', {
  skip: process.platform === 'win32',
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-cleanup-mode-failure-'));
  try {
    await writeFixtureRoot(root);
    let evidencePath;
    let injected = false;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            if (
              !evidencePath &&
              flags === 'wx+' &&
              String(openedPath).includes('.package-manager-docs-transaction-')
            ) {
              evidencePath = dirname(String(openedPath));
            }
            return open(openedPath, flags, ...args);
          },
          rm: async (removedPath, options) => {
            if (!injected && String(removedPath) === evidencePath) {
              await chmod(evidencePath, 0o777);
              injected = true;
              throw new Error('injected recursive evidence cleanup failure after mode drift');
            }
            return rm(removedPath, options);
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.equal(injected, true);
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /injected recursive evidence cleanup failure after mode drift/u);
    assert.match(thrown.message, /Manual recovery paths:.*package-manager-docs-transaction-/su);
    assert.equal(Number((await lstat(evidencePath, { bigint: true })).mode & 0o777n), 0o700);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('evidence-directory creation failure preserves an unexpected child and recovery path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-evidence-directory-child-'));
  try {
    await writeFixtureRoot(root);
    const unknownContents = Buffer.from('UNKNOWN DIRECTORY CHILD\n', 'utf8');
    let evidencePath;
    let unknownPath;
    let injected = false;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (
              injected ||
              typeof flags !== 'number' ||
              !String(openedPath).includes('.package-manager-docs-transaction-')
            ) {
              return handle;
            }
            evidencePath = String(openedPath);
            unknownPath = join(evidencePath, 'UNKNOWN-SENTINEL');
            return overrideHandle(handle, {
              stat: async () => {
                injected = true;
                await writeFile(unknownPath, unknownContents, { flag: 'wx', mode: 0o600 });
                throw new Error('injected evidence-directory bind failure after unknown child');
              },
            });
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.equal(injected, true);
    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /injected evidence-directory bind failure/iu);
    assert.match(thrown.message, /manual recovery path.*package-manager-docs-transaction-/isu);
    assert.deepEqual(await readFile(unknownPath), unknownContents);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('mkdir succeeded-then-threw reports its possible evidence recovery path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-evidence-mkdir-throw-'));
  try {
    await writeFixtureRoot(root);
    let evidencePath;
    let thrown;
    try {
      await synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          mkdir: async (createdPath, options) => {
            if (!String(createdPath).includes('.package-manager-docs-transaction-')) {
              return mkdir(createdPath, options);
            }
            evidencePath = String(createdPath);
            await mkdir(createdPath, options);
            throw new Error('injected mkdir succeeded-then-threw');
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    assert.ok(thrown instanceof Error);
    assert.match(thrown.message, /injected mkdir succeeded-then-threw/u);
    assert.match(thrown.message, /manual recovery path.*package-manager-docs-transaction-/isu);
    assert.equal((await lstat(evidencePath)).isDirectory(), true);
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('private evidence creation aggregates bind and close failures with visible recovery evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-evidence-bind-close-'));
  try {
    await writeFixtureRoot(root);
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (!String(openedPath).includes('.package-manager-docs-transaction-') || typeof flags !== 'number') {
              return handle;
            }
            return overrideHandle(handle, {
              close: async () => {
                await handle.close();
                throw new Error('injected evidence-directory close failure');
              },
              stat: async () => {
                throw new Error('injected evidence-directory bind failure');
              },
            });
          },
        },
      }),
      /injected evidence-directory bind failure[\s\S]*injected evidence-directory close failure/u,
    );
    assert.equal((await transactionDebris(root)).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lock acquisition aggregates write and close failures and preserves its recovery path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-lock-acquire-errors-'));
  try {
    await writeFixtureRoot(root);
    const lockPath = join(root, '.package-manager-docs.lock');
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (openedPath !== lockPath) return handle;
            return overrideHandle(handle, {
              close: async () => {
                await handle.close();
                throw new Error('injected lock close failure');
              },
              write: async () => {
                throw new Error('injected lock write failure');
              },
            });
          },
        },
      }),
      /injected lock write failure[\s\S]*injected lock close failure[\s\S]*manual recovery path/iu,
    );
    assert.equal((await lstat(lockPath)).isFile(), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('public writes start at offset zero, loop partial writes, and preserve all permission bits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-positional-write-'));
  try {
    await writeFixtureRoot(root);
    const agents = join(root, 'AGENTS.md');
    await chmod(agents, 0o7755);
    const positions = [];
    let readsBeforeWrite = 0;
    await synchronizePackageManagerDocsAtRoot(root, {
      mode: 'write',
      fileOperations: {
        open: async (openedPath, flags, ...args) => {
          const handle = await open(openedPath, flags, ...args);
          if (openedPath !== agents || !isWritablePublicOpen(flags)) return handle;
          return overrideHandle(handle, {
            read: async (...readArgs) => {
              if (positions.length === 0) readsBeforeWrite += 1;
              return handle.read(...readArgs);
            },
            write: async (buffer, offset, length, position) => {
              positions.push(position);
              return handle.write(buffer, offset, Math.min(length, 3), position);
            },
          });
        },
      },
    });
    assert.ok(readsBeforeWrite > 0, 'fixture must advance through a prewrite snapshot first');
    assert.equal(positions[0], 0);
    assert.ok(positions.length > 1, 'partial writes must be retried');
    for (let index = 1; index < positions.length; index += 1) {
      assert.ok(positions[index] > positions[index - 1]);
    }
    assert.equal(Number((await lstat(agents, { bigint: true })).mode & 0o7777n), 0o7755);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a primary bound-read failure and handle-close failure are both visible', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-dual-close-error-'));
  try {
    await writeFixtureRoot(root);
    const agents = join(root, 'AGENTS.md');
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, {
        mode: 'check',
        fileOperations: {
          open: async (openedPath, flags, ...args) => {
            const handle = await open(openedPath, flags, ...args);
            if (openedPath !== agents || isWritablePublicOpen(flags)) return handle;
            return overrideHandle(handle, {
              close: async () => {
                await handle.close();
                throw new Error('injected close failure after read failure');
              },
              read: async () => {
                throw new Error('injected primary read failure');
              },
            });
          },
        },
      }),
      /injected primary read failure[\s\S]*injected close failure after read failure/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the cooperative lock is acquired before snapshots and retained through final validation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-lock-scope-'));
  try {
    await writeFixtureRoot(root, {
      documents: fixtureDocuments({ node22: '11.25.0', node20: '10.34.5' }),
    });
    const lockPath = join(root, '.package-manager-docs.lock');
    let lockOpened = false;
    let agentsOpens = 0;
    await synchronizePackageManagerDocsAtRoot(root, {
      mode: 'write',
      fileOperations: {
        open: async (openedPath, flags, ...args) => {
          if (openedPath === lockPath && flags === 'wx+') lockOpened = true;
          if (openedPath === join(root, 'package.json')) {
            assert.equal(lockOpened, true, 'the lock must precede authority snapshots');
          }
          if (openedPath === join(root, 'AGENTS.md')) {
            agentsOpens += 1;
            if (agentsOpens >= 2) {
              assert.equal((await lstat(lockPath)).isFile(), true, 'final validation must retain the lock');
            }
          }
          return open(openedPath, flags, ...args);
        },
      },
    });
    assert.equal(lockOpened, true);
    assert.ok(agentsOpens >= 2);
    await assert.rejects(lstat(lockPath), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('an existing cooperative lock fails closed without changing documents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-lock-collision-'));
  try {
    await writeFixtureRoot(root);
    const agents = join(root, 'AGENTS.md');
    const before = await readFile(agents);
    const lockPath = join(root, '.package-manager-docs.lock');
    await writeFile(lockPath, 'foreign lock\n', { flag: 'wx', mode: 0o600 });
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, { mode: 'write' }),
      /could not acquire.*package-manager-docs\.lock/iu,
    );
    assert.deepEqual(await readFile(agents), before);
    assert.equal(await readFile(lockPath, 'utf8'), 'foreign lock\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lock cleanup refuses to unlink a replacement lock inode', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-package-manager-lock-replacement-'));
  try {
    await writeFixtureRoot(root, {
      documents: fixtureDocuments({ node22: '11.25.0', node20: '10.34.5' }),
    });
    const lockPath = join(root, '.package-manager-docs.lock');
    const parkedPath = `${lockPath}.owned`;
    let lockStats = 0;
    let replaced = false;
    await assert.rejects(
      synchronizePackageManagerDocsAtRoot(root, {
        mode: 'write',
        fileOperations: {
          lstat: async (inspectedPath, options) => {
            if (inspectedPath === lockPath) {
              lockStats += 1;
              if (lockStats === 3) {
                await rename(lockPath, parkedPath);
                await writeFile(lockPath, 'replacement lock\n', { flag: 'wx', mode: 0o600 });
                replaced = true;
              }
            }
            return lstat(inspectedPath, options);
          },
        },
      }),
      /lock .*changed before cleanup; refusing to remove it/iu,
    );
    assert.equal(replaced, true);
    assert.equal(await readFile(lockPath, 'utf8'), 'replacement lock\n');
    assert.equal((await lstat(parkedPath)).isFile(), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('setgid inheritance cannot make the private evidence directory unusable', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'lyra-package-manager-setgid-parent-'));
  const root = join(parent, 'repo');
  try {
    await chmod(parent, 0o2775);
    await mkdir(root);
    await writeFixtureRoot(root);
    assert.deepEqual(
      await synchronizePackageManagerDocsAtRoot(root, { mode: 'write' }),
      ['AGENTS.md', 'CONTRIBUTING.md', 'docs/agents/ci-and-gates.md'],
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
