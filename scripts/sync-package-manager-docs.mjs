#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageManager = /^pnpm@((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/u;
const versionPattern = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)';

const manifestPaths = {
  rootPackage: 'package.json',
  lyraUiPackage: 'packages/lyra-ui/package.json',
  lyraFlagsPackage: 'packages/lyra-flags/package.json',
  node20Package: '.github/ci-pnpm10.json',
};

const documentPaths = {
  agentsMd: 'AGENTS.md',
  contributingMd: 'CONTRIBUTING.md',
  ciAndGatesMd: 'docs/agents/ci-and-gates.md',
};

const defaultFileOperations = Object.freeze({ lstat, mkdir, open, readdir, rm });

function exactPnpmVersion(manifest, label) {
  const value = manifest?.packageManager;
  const match = packageManager.exec(String(value ?? ''));
  if (!match) {
    throw new Error(`${label} packageManager must be one exact pnpm patch; found ${JSON.stringify(value)}`);
  }
  return match[1];
}

export function derivePackageManagerVersions({
  rootPackage,
  lyraUiPackage,
  lyraFlagsPackage,
  node20Package,
}) {
  const node22Pnpm = exactPnpmVersion(rootPackage, manifestPaths.rootPackage);
  for (const [key, manifest] of [
    ['lyraUiPackage', lyraUiPackage],
    ['lyraFlagsPackage', lyraFlagsPackage],
  ]) {
    const version = exactPnpmVersion(manifest, manifestPaths[key]);
    if (version !== node22Pnpm) {
      throw new Error(
        `${manifestPaths[key]} packageManager pnpm@${version} does not match root pnpm@${node22Pnpm}`,
      );
    }
  }

  return {
    node22Pnpm,
    node20Pnpm: exactPnpmVersion(node20Package, manifestPaths.node20Package),
  };
}

function replaceExactlyOne(source, pattern, label, replacement) {
  if (typeof source !== 'string') {
    throw new TypeError(`${label} document must be text`);
  }
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`expected exactly one ${label} claim, found ${matches.length}`);
  }
  return source.replace(pattern, replacement);
}

export function synchronizePackageManagerDocumentTexts(
  { agentsMd, contributingMd, ciAndGatesMd },
  { node22Pnpm, node20Pnpm },
) {
  const agentsPattern = new RegExp(
    `(pnpm workspace \\(` +
      '`pnpm-workspace\\.yaml`: `packages/\\*`' +
      `\\), Node ≥ 20, ` +
      '`pnpm@' +
      `)${versionPattern}(` +
      '`\\.' +
      `)`,
    'gu',
  );
  const contributingPattern = new RegExp(
    `(Node ≥ 20, ` +
      '`pnpm@' +
      `)${versionPattern}(` +
      '` \\(pinned via `packageManager` in `package\\.json`' +
      `)`,
    'gu',
  );
  const ciMatrixPattern = new RegExp(
    `(Node 20 uses the pnpm version pinned in ` +
      '`\\.github/ci-pnpm10\\.json` \\(`pnpm@' +
      `)${versionPattern}(` +
      '`\\); Node 22\\s+uses `package\\.json#packageManager` \\(`pnpm@' +
      `)${versionPattern}(` +
      '`\\)\\.' +
      `)`,
    'gu',
  );
  const localPlatformPattern = new RegExp(
    `(Node 20 needs pnpm )${versionPattern}(; Node 22 needs pnpm )${versionPattern}(\\.)`,
    'gu',
  );

  return {
    agentsMd: replaceExactlyOne(
      agentsMd,
      agentsPattern,
      'AGENTS package-manager',
      `$1${node22Pnpm}$2`,
    ),
    contributingMd: replaceExactlyOne(
      contributingMd,
      contributingPattern,
      'CONTRIBUTING package-manager',
      `$1${node22Pnpm}$2`,
    ),
    ciAndGatesMd: replaceExactlyOne(
      replaceExactlyOne(
        ciAndGatesMd,
        ciMatrixPattern,
        'CI matrix package-manager',
        `$1${node20Pnpm}$2${node22Pnpm}$3`,
      ),
      localPlatformPattern,
      'local platform package-manager',
      `$1${node20Pnpm}$2${node22Pnpm}$3`,
    ),
  };
}

function statIdentity(stats) {
  return [
    stats.dev,
    stats.ino,
    stats.nlink,
    stats.mode,
    stats.size,
    stats.mtimeNs ?? stats.mtimeMs,
    stats.ctimeNs ?? stats.ctimeMs,
  ].map(String).join(':');
}

function objectIdentity(stats) {
  return [stats.dev, stats.ino].map(String).join(':');
}

function parentIdentity(stats) {
  return [stats.dev, stats.ino, stats.mode].map(String).join(':');
}

function transactionErrorText(error) {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.map((nested) => `- ${transactionErrorText(nested)}`)].join('\n');
  }
  return error instanceof Error ? error.message : String(error);
}

function decodeUtf8(contents, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(contents);
  } catch (error) {
    throw new Error(`${label} contains invalid UTF-8`, { cause: error });
  }
}

function validateRepoRelativePath(relativePath) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    relativePath.includes('\\') ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath.split('/').some((component) => component === '' || component === '.' || component === '..')
  ) {
    throw new Error(`invalid package-manager documentation repo-relative path ${JSON.stringify(relativePath)}`);
  }
}

export function repoRelativeParentEntries(root, relativePath, pathFlavor = path) {
  validateRepoRelativePath(relativePath);
  if (!pathFlavor || typeof pathFlavor.join !== 'function') {
    throw new TypeError('package-manager documentation path flavor must provide join()');
  }
  const parent = path.posix.dirname(relativePath);
  const components = parent === '.' ? [] : parent.split('/');
  const entries = [{ absolutePath: root, relativePath: '.' }];
  let absolutePath = root;
  let parentRelativePath = '';
  for (const component of components) {
    absolutePath = pathFlavor.join(absolutePath, component);
    parentRelativePath = parentRelativePath === ''
      ? component
      : path.posix.join(parentRelativePath, component);
    entries.push({ absolutePath, relativePath: parentRelativePath });
  }
  return entries;
}

function assertDirectoryStats(stats, label) {
  if (stats.isSymbolicLink()) {
    throw new Error(`${label} must be a directory, not a symbolic link`);
  }
  if (!stats.isDirectory()) throw new Error(`${label} must be a directory`);
}

function hasOwnerOnlyDirectoryMode(stats) {
  if (process.platform === 'win32') return true;
  const privacyMode = Number(stats.mode & 0o777n);
  return (privacyMode & 0o700) === 0o700 && (privacyMode & 0o077) === 0;
}

export function hasPrivateEvidenceFileMode(stats, platform = process.platform) {
  // Node's Windows stat/chmod implementation exposes only the platform's
  // writable/read-only mapping, not meaningful POSIX owner/group/other bits.
  if (platform === 'win32') return (stats.mode & 0o200n) === 0o200n;
  return Number(stats.mode & 0o7777n) === 0o600;
}

function assertRegularStats(stats, label) {
  if (stats.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file, not a symbolic link`);
  }
  if (!stats.isFile()) throw new Error(`${label} must be a regular file`);
}

function assertSingleLinkStats(stats, label) {
  if (stats.nlink !== 1n) {
    throw new Error(`${label} must have a link count of exactly one; refusing to mutate a hard-linked inode`);
  }
}

export function directoryHandleFlags(constants = fsConstants, platform = process.platform) {
  if (platform === 'win32' || !Number.isInteger(constants?.O_DIRECTORY)) return undefined;
  return constants.O_RDONLY |
    constants.O_DIRECTORY |
    (Number.isInteger(constants.O_NOFOLLOW) ? constants.O_NOFOLLOW : 0);
}

async function inspectRepoRelativeParents(root, relativePath, operations) {
  const entries = repoRelativeParentEntries(root, relativePath);

  const snapshots = [];
  const flags = directoryHandleFlags();
  for (const entry of entries) {
    const label = `package-manager documentation repo-relative parent ${entry.relativePath}`;
    let before;
    let handle;
    let bound;
    let after;
    let primaryError;
    try {
      before = await operations.lstat(entry.absolutePath, { bigint: true });
      assertDirectoryStats(before, label);
      if (flags !== undefined) {
        handle = await operations.open(entry.absolutePath, flags);
        bound = await handle.stat({ bigint: true });
        assertDirectoryStats(bound, label);
      } else {
        // Windows does not portably support opening a directory with O_RDONLY.
        // Retain the strongest portable fallback there: two non-following path
        // snapshots around the traversal. Public files themselves remain bound
        // to O_NOFOLLOW FileHandles below.
        bound = before;
      }
      after = await operations.lstat(entry.absolutePath, { bigint: true });
      assertDirectoryStats(after, label);
    } catch (error) {
      primaryError = error;
    }
    if (handle) {
      try {
        await handle.close();
      } catch (closeError) {
        primaryError = primaryError
          ? new AggregateError(
            [primaryError, closeError],
            `${label} inspection and directory-handle close both failed`,
          )
          : closeError;
      }
    }
    if (primaryError) {
      throw new Error(`cannot bind ${label}: ${transactionErrorText(primaryError)}`, {
        cause: primaryError,
      });
    }
    if (
      statIdentity(before) !== statIdentity(bound) ||
      statIdentity(bound) !== statIdentity(after)
    ) {
      throw new Error(`${label} changed while its directory handle was being bound`);
    }
    snapshots.push(Object.freeze({
      ...entry,
      identity: parentIdentity(bound),
    }));
  }
  return Object.freeze(snapshots);
}

function assertSameParentSnapshots(expected, actual, relativePath) {
  if (expected.length !== actual.length) {
    throw new Error(`repo-relative parents for package-manager documentation target ${relativePath} changed`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (
      expected[index].absolutePath !== actual[index].absolutePath ||
      expected[index].identity !== actual[index].identity
    ) {
      throw new Error(
        `package-manager documentation repo-relative parent ${expected[index].relativePath} changed while processing ${relativePath}`,
      );
    }
  }
}

async function readBoundFileSnapshot(
  root,
  absolutePath,
  relativePath,
  operations,
  label = `target ${relativePath}`,
) {
  const parentsBefore = await inspectRepoRelativeParents(root, relativePath, operations);
  const pathLabel = `package-manager documentation ${label}`;
  let pathBefore;
  let handle;
  let handleBefore;
  let handleAfter;
  let contents;
  let primaryError;
  try {
    pathBefore = await operations.lstat(absolutePath, { bigint: true });
    assertRegularStats(pathBefore, pathLabel);
    handle = await operations.open(
      absolutePath,
      fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
    );
    handleBefore = await handle.stat({ bigint: true });
    assertRegularStats(handleBefore, pathLabel);
    if (statIdentity(pathBefore) !== statIdentity(handleBefore)) {
      throw new Error(`${pathLabel} handle binding changed before the read`);
    }
    contents = await readHandleContentsAtZero(handle, handleBefore, pathLabel);
    handleAfter = await handle.stat({ bigint: true });
    assertRegularStats(handleAfter, pathLabel);
  } catch (error) {
    primaryError = error;
  }
  if (handle) {
    try {
      await handle.close();
    } catch (closeError) {
      primaryError = primaryError
        ? new AggregateError(
          [primaryError, closeError],
          `${pathLabel} read and close both failed`,
        )
        : closeError;
    }
  }
  if (primaryError) {
    throw new Error(`cannot read bound ${pathLabel}: ${transactionErrorText(primaryError)}`, {
      cause: primaryError,
    });
  }

  const pathAfter = await operations.lstat(absolutePath, { bigint: true });
  assertRegularStats(pathAfter, pathLabel);
  const parentsAfter = await inspectRepoRelativeParents(root, relativePath, operations);
  assertSameParentSnapshots(parentsBefore, parentsAfter, relativePath);
  if (
    statIdentity(handleBefore) !== statIdentity(handleAfter) ||
    statIdentity(handleAfter) !== statIdentity(pathAfter) ||
    BigInt(contents.byteLength) !== handleAfter.size
  ) {
    throw new Error(`${pathLabel} changed or lost its handle binding while it was being snapshotted`);
  }
  return Object.freeze({
    absolutePath,
    contents,
    identity: statIdentity(handleAfter),
    linkCount: handleAfter.nlink,
    mode: Number(handleAfter.mode & 0o7777n),
    objectIdentity: objectIdentity(handleAfter),
    parents: parentsAfter,
    relativePath,
    root,
  });
}

function assertEquivalentSnapshot(expected, actual, label, { identity = 'exact' } = {}) {
  assertSameParentSnapshots(expected.parents, actual.parents, expected.relativePath);
  let identityChanged;
  if (identity === 'exact') {
    identityChanged = actual.identity !== expected.identity;
  } else if (identity === 'object') {
    identityChanged = actual.objectIdentity !== expected.objectIdentity;
  } else if (identity === 'content') {
    identityChanged = false;
  } else {
    throw new Error(`unsupported package-manager documentation snapshot identity ${JSON.stringify(identity)}`);
  }
  if (
    identityChanged ||
    actual.mode !== expected.mode ||
    !actual.contents.equals(expected.contents)
  ) {
    throw new Error(`${label} changed from its trusted snapshot`);
  }
}

async function assertSnapshotCurrent(snapshot, operations, label = `target ${snapshot.relativePath}`) {
  const current = await readBoundFileSnapshot(
    snapshot.root,
    snapshot.absolutePath,
    snapshot.relativePath,
    operations,
    label,
  );
  assertEquivalentSnapshot(snapshot, current, `package-manager documentation ${label}`);
  return current;
}

async function assertAllSnapshotsCurrent(snapshots, operations, groupLabel) {
  const results = await Promise.allSettled(
    snapshots.map((snapshot) => assertSnapshotCurrent(snapshot, operations)),
  );
  const failures = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, `multiple ${groupLabel} changed`);
}

async function readHandleContentsAtZero(handle, stats, label) {
  if (stats.size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large to snapshot safely`);
  }
  const contents = Buffer.alloc(Number(stats.size));
  let offset = 0;
  while (offset < contents.byteLength) {
    const { bytesRead } = await handle.read(
      contents,
      offset,
      contents.byteLength - offset,
      offset,
    );
    if (bytesRead === 0) throw new Error(`${label} ended before its snapshotted size`);
    offset += bytesRead;
  }
  return contents;
}

async function writeHandleContentsAtZero(
  handle,
  contents,
  mode,
  label,
) {
  let offset = 0;
  while (offset < contents.byteLength) {
    const { bytesWritten } = await handle.write(
      contents,
      offset,
      contents.byteLength - offset,
      offset,
    );
    if (bytesWritten === 0) throw new Error(`${label} made no progress while writing`);
    offset += bytesWritten;
  }
  await handle.truncate(contents.byteLength);
  await handle.chmod(mode);
  await handle.sync();
}

function snapshotFromBoundStats(snapshot, stats, contents) {
  return Object.freeze({
    absolutePath: snapshot.absolutePath,
    contents,
    identity: statIdentity(stats),
    linkCount: stats.nlink,
    mode: Number(stats.mode & 0o7777n),
    objectIdentity: objectIdentity(stats),
    parents: snapshot.parents,
    relativePath: snapshot.relativePath,
    root: snapshot.root,
  });
}

async function snapshotBoundPublicTarget(transaction, operations, label) {
  const pathLabel = `package-manager documentation ${label}`;
  const parentsBefore = await inspectRepoRelativeParents(
    transaction.snapshot.root,
    transaction.snapshot.relativePath,
    operations,
  );
  assertSameParentSnapshots(
    transaction.snapshot.parents,
    parentsBefore,
    transaction.snapshot.relativePath,
  );
  const pathBefore = await operations.lstat(transaction.snapshot.absolutePath, { bigint: true });
  assertRegularStats(pathBefore, pathLabel);
  const handleBefore = await transaction.handle.stat({ bigint: true });
  assertRegularStats(handleBefore, pathLabel);
  if (statIdentity(pathBefore) !== statIdentity(handleBefore)) {
    transaction.publicBindingLost = true;
    throw new Error(`${pathLabel} no longer names the retained public FileHandle`);
  }
  assertSingleLinkStats(pathBefore, pathLabel);
  assertSingleLinkStats(handleBefore, pathLabel);
  const contents = await readHandleContentsAtZero(transaction.handle, handleBefore, pathLabel);
  const handleAfter = await transaction.handle.stat({ bigint: true });
  assertRegularStats(handleAfter, pathLabel);
  const pathAfter = await operations.lstat(transaction.snapshot.absolutePath, { bigint: true });
  assertRegularStats(pathAfter, pathLabel);
  const parentsAfter = await inspectRepoRelativeParents(
    transaction.snapshot.root,
    transaction.snapshot.relativePath,
    operations,
  );
  assertSameParentSnapshots(parentsBefore, parentsAfter, transaction.snapshot.relativePath);
  if (
    statIdentity(handleBefore) !== statIdentity(handleAfter) ||
    statIdentity(handleAfter) !== statIdentity(pathAfter) ||
    BigInt(contents.byteLength) !== handleAfter.size
  ) {
    if (objectIdentity(handleAfter) !== objectIdentity(pathAfter)) {
      transaction.publicBindingLost = true;
    }
    throw new Error(`${pathLabel} changed or lost its retained FileHandle binding`);
  }
  assertSingleLinkStats(handleAfter, pathLabel);
  assertSingleLinkStats(pathAfter, pathLabel);
  return snapshotFromBoundStats(transaction.snapshot, handleAfter, contents);
}

async function openBoundPublicTarget(transaction, operations) {
  const flags = fsConstants.O_RDWR |
    (Number.isInteger(fsConstants.O_NOFOLLOW) ? fsConstants.O_NOFOLLOW : 0);
  transaction.handle = await operations.open(transaction.snapshot.absolutePath, flags);
  const current = await snapshotBoundPublicTarget(
    transaction,
    operations,
    `retained target ${transaction.snapshot.relativePath}`,
  );
  assertEquivalentSnapshot(
    transaction.snapshot,
    current,
    `retained target ${transaction.snapshot.relativePath}`,
  );
}

async function assertRetainedWritableHandleReady(transaction, label) {
  const stats = await transaction.handle.stat({ bigint: true });
  assertRegularStats(stats, label);
  assertSingleLinkStats(stats, label);
  if (objectIdentity(stats) !== transaction.snapshot.objectIdentity) {
    transaction.publicBindingLost = true;
    throw new Error(`${label} no longer has the retained public inode identity`);
  }
}

async function createPrivateEvidenceFile({ contents, evidence, label, operations, pathname }) {
  const state = {
    label,
    objectIdentity: undefined,
    owned: false,
    path: pathname,
    pathBindingAmbiguous: false,
    cleanupIdentity: undefined,
    verifiedIdentity: undefined,
  };
  let handle;
  let handleClosed = false;
  let primaryError;
  try {
    handle = await operations.open(pathname, 'wx+', 0o600);
    state.owned = true;
    // Exclusive creation proves initial ownership but does not prove the path
    // will keep naming that inode. Treat every subsequent failure as ambiguous
    // until a post-close path snapshot explicitly re-establishes custody.
    state.pathBindingAmbiguous = true;
    await assertPrivateEvidenceDirectoryCustody(
      evidence,
      operations,
      `after exclusively creating ${label} and before writing its contents`,
    );
    const ownershipStats = await handle.stat({ bigint: true });
    assertRegularStats(ownershipStats, label);
    assertSingleLinkStats(ownershipStats, label);
    state.objectIdentity = objectIdentity(ownershipStats);
    await assertPrivateEvidenceDirectoryCustody(
      evidence,
      operations,
      `immediately before writing ${label}`,
    );
    // Recovery evidence is never renamed into the public path, so it does not
    // need the public target's mode. Keeping every child owner-only prevents a
    // later directory-custody failure from exposing its bytes while the
    // transaction is being preserved for manual recovery.
    await writeHandleContentsAtZero(handle, contents, 0o600, label);
    await assertPrivateEvidenceDirectoryCustody(
      evidence,
      operations,
      `after populating ${label}`,
    );
    const finalStats = await handle.stat({ bigint: true });
    assertRegularStats(finalStats, label);
    assertSingleLinkStats(finalStats, label);
    const verifiedContents = await readHandleContentsAtZero(handle, finalStats, label);
    const pathStats = await operations.lstat(pathname, { bigint: true });
    assertRegularStats(pathStats, label);
    assertSingleLinkStats(pathStats, label);
    if (
      objectIdentity(finalStats) !== state.objectIdentity ||
      statIdentity(finalStats) !== statIdentity(pathStats) ||
      finalStats.size !== BigInt(contents.byteLength) ||
      !hasPrivateEvidenceFileMode(finalStats) ||
      !verifiedContents.equals(contents)
    ) {
      throw new Error(`${label} changed while its owned FileHandle was populated`);
    }
    state.verifiedIdentity = statIdentity(finalStats);
  } catch (error) {
    primaryError = error;
  }
  if (handle) {
    try {
      await handle.close();
      handleClosed = true;
    } catch (error) {
      primaryError = primaryError
        ? new AggregateError([primaryError, error], `${label} write and close both failed`)
        : error;
    }
  }
  if (state.owned && state.objectIdentity && handleClosed) {
    try {
      const current = await operations.lstat(pathname, { bigint: true });
      assertRegularStats(current, label);
      assertSingleLinkStats(current, label);
      if (objectIdentity(current) !== state.objectIdentity) {
        throw new Error(`${label} path no longer names its exclusively created inode`);
      }
      if (!primaryError && statIdentity(current) !== state.verifiedIdentity) {
        throw new Error(`${label} changed after its owned FileHandle was closed`);
      }
      state.cleanupIdentity = statIdentity(current);
      state.pathBindingAmbiguous = false;
    } catch (bindingError) {
      primaryError = primaryError
        ? new AggregateError(
          [primaryError, bindingError],
          `${label} failure and error-path binding verification both failed`,
        )
        : bindingError;
    }
  }
  if (primaryError) {
    const visible = new Error(`${label} at ${pathname} failed: ${transactionErrorText(primaryError)}`, {
      cause: primaryError instanceof Error ? primaryError : undefined,
    });
    Object.defineProperties(visible, {
      evidenceOwnershipAmbiguous: {
        enumerable: false,
        value: !state.owned || state.pathBindingAmbiguous,
      },
      privateEvidenceState: {
        enumerable: false,
        value: state,
      },
    });
    throw visible;
  }
  return state;
}

async function createTrackedPrivateEvidenceFile(options, childStates, evidence) {
  let state;
  let primaryError;
  try {
    await assertPrivateEvidenceDirectoryCustody(
      evidence,
      options.operations,
      `before creating ${options.label}`,
    );
    state = await createPrivateEvidenceFile({ ...options, evidence });
    childStates.push(state);
  } catch (error) {
    if (error?.privateEvidenceState) childStates.push(error.privateEvidenceState);
    primaryError = error;
  }
  try {
    await assertPrivateEvidenceDirectoryCustody(
      evidence,
      options.operations,
      `after creating ${options.label}`,
    );
  } catch (custodyError) {
    primaryError = primaryError
      ? new AggregateError(
        [primaryError, custodyError],
        `${options.label} creation and evidence-directory custody verification both failed`,
      )
      : custodyError;
  }
  if (primaryError) throw primaryError;
  return state;
}

async function restorePrivateEvidenceDirectoryPrivacy(evidence, operations, label) {
  const pathBefore = await operations.lstat(evidence.path, { bigint: true });
  assertDirectoryStats(pathBefore, label);
  if (objectIdentity(pathBefore) !== evidence.identity) {
    throw new Error(`${label} path no longer names the owned evidence directory`);
  }

  let handle = evidence.directoryHandle;
  let openedForRestoration = false;
  let primaryError;
  try {
    if (!handle) {
      const flags = directoryHandleFlags();
      if (flags === undefined) {
        throw new Error(`${label} has no safe directory-handle flags for privacy restoration`);
      }
      handle = await operations.open(evidence.path, flags);
      openedForRestoration = true;
    }
    const boundBefore = await handle.stat({ bigint: true });
    assertDirectoryStats(boundBefore, label);
    if (objectIdentity(boundBefore) !== evidence.identity) {
      throw new Error(`${label} restoration handle bound the wrong inode`);
    }
    await handle.chmod(0o700);
    const boundAfter = await handle.stat({ bigint: true });
    const pathAfter = await operations.lstat(evidence.path, { bigint: true });
    if (
      objectIdentity(boundAfter) !== evidence.identity ||
      objectIdentity(pathAfter) !== evidence.identity ||
      !hasOwnerOnlyDirectoryMode(boundAfter) ||
      !hasOwnerOnlyDirectoryMode(pathAfter)
    ) {
      throw new Error(`${label} could not prove restored owner-only mode`);
    }
  } catch (error) {
    primaryError = error;
  }
  if (openedForRestoration && handle) {
    try {
      await handle.close();
    } catch (closeError) {
      primaryError = primaryError
        ? new AggregateError(
          [primaryError, closeError],
          `${label} restoration and recovery-handle close both failed`,
        )
        : closeError;
    }
    if (!primaryError) {
      try {
        const afterClose = await operations.lstat(evidence.path, { bigint: true });
        if (
          objectIdentity(afterClose) !== evidence.identity ||
          !hasOwnerOnlyDirectoryMode(afterClose)
        ) {
          throw new Error(`${label} lost owner-only mode after its recovery handle closed`);
        }
      } catch (error) {
        primaryError = error;
      }
    }
  }
  if (primaryError) throw primaryError;
}

async function createPrivateEvidenceDirectory(root, operations) {
  const pathname = path.join(root, `.package-manager-docs-transaction-${randomUUID()}`);
  const evidence = {
    directoryHandle: undefined,
    identity: undefined,
    owned: false,
    path: pathname,
    preserved: false,
  };
  let primaryError;
  try {
    await operations.mkdir(pathname, { mode: 0o700 });
    evidence.owned = true;
    const stats = await operations.lstat(pathname, { bigint: true });
    assertDirectoryStats(stats, `private transaction evidence ${pathname}`);
    evidence.identity = objectIdentity(stats);
    const privacyMode = Number(stats.mode & 0o777n);
    if (
      process.platform !== 'win32' &&
      ((privacyMode & 0o700) !== 0o700 || (privacyMode & 0o077) !== 0)
    ) {
      throw new Error(`private transaction evidence ${pathname} must grant only its owner mode 0700 access`);
    }
    const flags = directoryHandleFlags();
    if (flags !== undefined) {
      evidence.directoryHandle = await operations.open(pathname, flags);
      const bound = await evidence.directoryHandle.stat({ bigint: true });
      assertDirectoryStats(bound, `private transaction evidence ${pathname}`);
      if (objectIdentity(bound) !== evidence.identity) {
        throw new Error(`private transaction evidence ${pathname} changed while binding its handle`);
      }
    }
    return evidence;
  } catch (error) {
    primaryError = error;
  }
  if (evidence.directoryHandle) {
    try {
      await evidence.directoryHandle.close();
      evidence.directoryHandle = undefined;
    } catch (closeError) {
      primaryError = new AggregateError(
        [primaryError, closeError],
        `private transaction evidence creation and handle close both failed at ${pathname}`,
      );
    }
  }
  if (evidence.identity) {
    try {
      const current = await operations.lstat(pathname, { bigint: true });
      if (
        objectIdentity(current) === evidence.identity &&
        !hasOwnerOnlyDirectoryMode(current)
      ) {
        await restorePrivateEvidenceDirectoryPrivacy(
          evidence,
          operations,
          `private transaction evidence ${pathname} after creation failure`,
        );
      }
    } catch (restorationError) {
      primaryError = new AggregateError(
        [primaryError, restorationError],
        `private transaction evidence creation and privacy restoration both failed at ${pathname}`,
      );
    }
  }
  // mkdir/open/stat wrappers can succeed and then throw, and an unknown child
  // may appear before a failed directory bind is observable. Without a proven
  // empty namespace, recursively deleting here could destroy another writer's
  // evidence. Preserve the random directory (if it exists) and always expose
  // the possible recovery path.
  evidence.preserved = true;
  const recovery = `; possible manual recovery path: preserve and inspect ${pathname}`;
  throw new Error(
    `could not create private package-manager documentation transaction evidence ${pathname}: ${transactionErrorText(primaryError)}${recovery}`,
    { cause: primaryError },
  );
}

async function closePrivateEvidenceHandle(evidence, operations) {
  if (!evidence?.directoryHandle) return;
  let primaryError;
  try {
    await evidence.directoryHandle.close();
  } catch (error) {
    primaryError = error;
  }
  evidence.directoryHandle = undefined;

  if (evidence.owned) {
    let pathStats;
    try {
      pathStats = await operations.lstat(evidence.path, { bigint: true });
      assertDirectoryStats(pathStats, `private transaction evidence ${evidence.path} after handle close`);
      if (objectIdentity(pathStats) !== evidence.identity) {
        throw new Error(`private transaction evidence ${evidence.path} changed after its handle closed`);
      }
    } catch (error) {
      primaryError = primaryError
        ? new AggregateError([primaryError, error], 'private evidence handle close and path verification both failed')
        : error;
    }

    if (pathStats && !hasOwnerOnlyDirectoryMode(pathStats)) {
      const privacyError = new Error(
        `private transaction evidence ${evidence.path} lost owner-only mode while its handle closed`,
      );
      let recoveryHandle;
      let restorationError;
      try {
        const flags = directoryHandleFlags();
        if (flags === undefined) {
          throw new Error('no safe directory-handle flags are available for privacy restoration');
        }
        recoveryHandle = await operations.open(evidence.path, flags);
        const recoveryStats = await recoveryHandle.stat({ bigint: true });
        assertDirectoryStats(recoveryStats, `private transaction evidence ${evidence.path} recovery handle`);
        if (objectIdentity(recoveryStats) !== evidence.identity) {
          throw new Error(`private transaction evidence ${evidence.path} recovery handle bound the wrong inode`);
        }
        await recoveryHandle.chmod(0o700);
        const restoredHandleStats = await recoveryHandle.stat({ bigint: true });
        const restoredPathStats = await operations.lstat(evidence.path, { bigint: true });
        if (
          objectIdentity(restoredHandleStats) !== evidence.identity ||
          objectIdentity(restoredPathStats) !== evidence.identity ||
          !hasOwnerOnlyDirectoryMode(restoredHandleStats) ||
          !hasOwnerOnlyDirectoryMode(restoredPathStats)
        ) {
          throw new Error(`private transaction evidence ${evidence.path} privacy restoration was not durable`);
        }
      } catch (error) {
        restorationError = error;
      }
      if (recoveryHandle) {
        try {
          await recoveryHandle.close();
        } catch (error) {
          restorationError = restorationError
            ? new AggregateError(
              [restorationError, error],
              'private evidence privacy restoration and recovery-handle close both failed',
            )
            : error;
        }
      }
      if (!restorationError) {
        try {
          const afterRecoveryClose = await operations.lstat(evidence.path, { bigint: true });
          if (
            objectIdentity(afterRecoveryClose) !== evidence.identity ||
            !hasOwnerOnlyDirectoryMode(afterRecoveryClose)
          ) {
            throw new Error(`private transaction evidence ${evidence.path} lost privacy after recovery close`);
          }
        } catch (error) {
          restorationError = error;
        }
      }
      const privacyFailure = restorationError
        ? new AggregateError(
          [privacyError, restorationError],
          `private transaction evidence ${evidence.path} post-close privacy restoration failed`,
        )
        : privacyError;
      primaryError = primaryError
        ? new AggregateError(
          [primaryError, privacyFailure],
          `private transaction evidence ${evidence.path} close and privacy checks failed`,
        )
        : privacyFailure;
    }
  }
  if (primaryError) {
    evidence.preserved = evidence.owned;
    throw primaryError;
  }
}

async function assertPrivateEvidenceDirectoryCustody(evidence, operations, phase) {
  const label = `private transaction evidence ${evidence.path} ${phase}`;
  let pathStats;
  let boundStats;
  try {
    pathStats = await operations.lstat(evidence.path, { bigint: true });
    assertDirectoryStats(pathStats, label);
    if (objectIdentity(pathStats) !== evidence.identity) {
      throw new Error(`${label} lost its path identity`);
    }
    if (evidence.directoryHandle) {
      boundStats = await evidence.directoryHandle.stat({ bigint: true });
      assertDirectoryStats(boundStats, label);
      if (objectIdentity(boundStats) !== evidence.identity) {
        throw new Error(`${label} lost its retained handle identity`);
      }
    } else {
      boundStats = pathStats;
    }
  } catch (error) {
    evidence.preserved = true;
    throw error;
  }

  if (hasOwnerOnlyDirectoryMode(pathStats) && hasOwnerOnlyDirectoryMode(boundStats)) return;

  evidence.preserved = true;
  const privacyError = new Error(`${label} lost its owner-only directory mode`);
  if (!evidence.directoryHandle) {
    throw new AggregateError(
      [privacyError, new Error(`${label} has no retained directory handle for safe mode restoration`)],
      `${label} privacy restoration failed`,
    );
  }
  try {
    await evidence.directoryHandle.chmod(0o700);
    const restoredBound = await evidence.directoryHandle.stat({ bigint: true });
    const restoredPath = await operations.lstat(evidence.path, { bigint: true });
    assertDirectoryStats(restoredBound, label);
    assertDirectoryStats(restoredPath, label);
    if (
      objectIdentity(restoredBound) !== evidence.identity ||
      objectIdentity(restoredPath) !== evidence.identity ||
      !hasOwnerOnlyDirectoryMode(restoredBound) ||
      !hasOwnerOnlyDirectoryMode(restoredPath)
    ) {
      throw new Error(`${label} could not prove owner-only mode after restoration`);
    }
  } catch (restorationError) {
    throw new AggregateError(
      [privacyError, restorationError],
      `${label} privacy restoration failed`,
    );
  }
  throw privacyError;
}

async function assertPrivateEvidenceInventory(evidence, childStates, operations) {
  const expectedByName = new Map();
  for (const state of childStates) {
    if (
      !state?.owned ||
      state.pathBindingAmbiguous ||
      !state.objectIdentity ||
      !state.cleanupIdentity ||
      path.dirname(state.path) !== evidence.path
    ) {
      throw new Error(`private transaction evidence ${evidence.path} has an unverified child; refusing cleanup`);
    }
    const name = path.basename(state.path);
    if (expectedByName.has(name)) {
      throw new Error(`private transaction evidence ${evidence.path} has duplicate expected child ${name}`);
    }
    expectedByName.set(name, state);
  }

  const actualNames = await operations.readdir(evidence.path);
  if (!Array.isArray(actualNames) || actualNames.some((name) => typeof name !== 'string')) {
    throw new Error(`private transaction evidence ${evidence.path} returned an invalid namespace inventory`);
  }
  const expectedNames = [...expectedByName.keys()].sort();
  const sortedActualNames = [...actualNames].sort();
  if (
    expectedNames.length !== sortedActualNames.length ||
    expectedNames.some((name, index) => name !== sortedActualNames[index])
  ) {
    throw new Error(
      `private transaction evidence ${evidence.path} namespace inventory changed; ` +
      `expected ${JSON.stringify(expectedNames)}, found ${JSON.stringify(sortedActualNames)}`,
    );
  }

  for (const [name, state] of expectedByName) {
    const stats = await operations.lstat(path.join(evidence.path, name), { bigint: true });
    assertRegularStats(stats, `private transaction evidence child ${name}`);
    assertSingleLinkStats(stats, `private transaction evidence child ${name}`);
    if (
      objectIdentity(stats) !== state.objectIdentity ||
      statIdentity(stats) !== state.cleanupIdentity
    ) {
      throw new Error(`private transaction evidence child ${name} changed before cleanup`);
    }
  }

  const parentAfter = await operations.lstat(evidence.path, { bigint: true });
  assertDirectoryStats(parentAfter, `private transaction evidence ${evidence.path}`);
  if (objectIdentity(parentAfter) !== evidence.identity) {
    throw new Error(`private transaction evidence ${evidence.path} changed during inventory validation`);
  }
}

async function cleanupPrivateEvidence(evidence, operations, childStates) {
  if (!evidence?.owned || evidence.preserved) return;
  try {
    await assertPrivateEvidenceDirectoryCustody(evidence, operations, 'before cleanup');
    const pathStats = await operations.lstat(evidence.path, { bigint: true });
    assertDirectoryStats(pathStats, `private transaction evidence ${evidence.path}`);
    if (objectIdentity(pathStats) !== evidence.identity) {
      evidence.preserved = true;
      throw new Error(`private transaction evidence ${evidence.path} lost its directory identity; refusing cleanup`);
    }
    if (evidence.directoryHandle) {
      const bound = await evidence.directoryHandle.stat({ bigint: true });
      if (objectIdentity(bound) !== evidence.identity) {
        evidence.preserved = true;
        throw new Error(`private transaction evidence ${evidence.path} lost its retained handle identity`);
      }
    }
    await assertPrivateEvidenceInventory(evidence, childStates, operations);
    await assertPrivateEvidenceDirectoryCustody(evidence, operations, 'after child inventory');
    // Retain the bound directory handle through recursive removal. If removal
    // fails after observable custody drift, the error path can still restore
    // owner-only mode through that inode instead of preserving exposed files.
    await operations.rm(evidence.path, { force: false, recursive: true });
    evidence.owned = false;
    await closePrivateEvidenceHandle(evidence, operations);
  } catch (error) {
    evidence.preserved = true;
    let cleanupError = error;
    try {
      await assertPrivateEvidenceDirectoryCustody(
        evidence,
        operations,
        'after failed cleanup and before closing its retained handle',
      );
    } catch (custodyError) {
      cleanupError = new AggregateError(
        [cleanupError, custodyError],
        `private transaction evidence ${evidence.path} cleanup and custody recovery both failed`,
      );
    }
    try {
      await closePrivateEvidenceHandle(evidence, operations);
    } catch (closeError) {
      cleanupError = new AggregateError(
        [cleanupError, closeError],
        `private transaction evidence ${evidence.path} cleanup and handle close both failed`,
      );
    }
    throw cleanupError;
  }
}

async function closeBoundPublicTargets(transactions) {
  const failures = [];
  for (const transaction of transactions) {
    if (!transaction.handle) continue;
    try {
      await transaction.handle.close();
    } catch (error) {
      failures.push({
        action: `close retained FileHandle for ${transaction.snapshot.absolutePath}`,
        error,
      });
    } finally {
      transaction.handle = undefined;
    }
  }
  return failures;
}

async function rollbackBoundPublicTargets(transactions, operations) {
  const failures = [];
  for (const transaction of [...transactions].reverse()) {
    if (!transaction.mutationStarted || !transaction.handle) continue;
    try {
      await snapshotBoundPublicTarget(
        transaction,
        operations,
        `pre-rollback target ${transaction.snapshot.relativePath}`,
      );
      await assertRetainedWritableHandleReady(
        transaction,
        `package-manager documentation pre-rollback target ${transaction.snapshot.relativePath}`,
      );
      await writeHandleContentsAtZero(
        transaction.handle,
        transaction.snapshot.contents,
        transaction.snapshot.mode,
        `rollback target ${transaction.snapshot.relativePath}`,
      );
      const restored = await snapshotBoundPublicTarget(
        transaction,
        operations,
        `rolled-back target ${transaction.snapshot.relativePath}`,
      );
      assertEquivalentSnapshot(
        transaction.snapshot,
        restored,
        `rolled-back target ${transaction.snapshot.relativePath}`,
        { identity: 'object' },
      );
      transaction.mutationStarted = false;
    } catch (error) {
      failures.push({
        action: `restore ${transaction.snapshot.absolutePath} through its retained FileHandle`,
        error,
      });
    }
  }
  return failures;
}

function buildBoundTransactionError(primaryError, {
  cleanupFailures = [],
  evidence,
  rollbackFailures = [],
}) {
  const lines = [transactionErrorText(primaryError)];
  if (rollbackFailures.length > 0) {
    lines.push('Rollback failed:');
    lines.push(...rollbackFailures.map((failure) => `- ${failure.action}: ${transactionErrorText(failure.error)}`));
  }
  if (cleanupFailures.length > 0) {
    lines.push('Cleanup failed:');
    lines.push(...cleanupFailures.map((failure) => `- ${failure.action}: ${transactionErrorText(failure.error)}`));
  }
  if (evidence?.owned || evidence?.preserved) {
    lines.push('Manual recovery paths:');
    lines.push(`- preserve and inspect private transaction evidence ${evidence.path}`);
  }
  const visible = new Error(lines.join('\n'), {
    cause: primaryError instanceof Error ? primaryError : undefined,
  });
  Object.defineProperties(visible, {
    cleanupErrors: {
      enumerable: false,
      value: Object.freeze(cleanupFailures.map((failure) => failure.error)),
    },
    rollbackErrors: {
      enumerable: false,
      value: Object.freeze(rollbackFailures.map((failure) => failure.error)),
    },
  });
  return visible;
}

// Node has no portable openat/renameat2 compare-and-swap primitive. Keep every
// public inode retained and mutate it sequentially instead: a path replacement
// is never touched, and an ordinary later failure restores already-written
// inodes through those same handles. Process-crash multi-file atomicity is not
// claimed by this maintenance helper.
async function writeDocumentsWithBoundHandles({ entries, operations, stableSnapshots }) {
  let evidence;
  const evidenceChildren = [];
  const transactions = entries.map(({ key, contents, snapshot }) => ({
    backup: undefined,
    committedSnapshot: undefined,
    contents: Buffer.from(contents, 'utf8'),
    handle: undefined,
    key,
    mutationStarted: false,
    publicBindingLost: false,
    snapshot,
    stage: undefined,
  }));

  try {
    for (const transaction of transactions) {
      await openBoundPublicTarget(transaction, operations);
    }
    evidence = await createPrivateEvidenceDirectory(entries[0].snapshot.root, operations);
    for (const transaction of transactions) {
      const basename = path.basename(transaction.snapshot.absolutePath);
      transaction.backup = await createTrackedPrivateEvidenceFile({
        contents: transaction.snapshot.contents,
        label: `backup for ${transaction.snapshot.relativePath}`,
        operations,
        pathname: path.join(evidence.path, `.package-manager-docs-backup-${basename}`),
      }, evidenceChildren, evidence);
      transaction.stage = await createTrackedPrivateEvidenceFile({
        contents: transaction.contents,
        label: `staged file for ${transaction.snapshot.relativePath}`,
        operations,
        pathname: path.join(evidence.path, `.package-manager-docs-stage-${basename}`),
      }, evidenceChildren, evidence);
    }
    await assertAllSnapshotsCurrent(
      [...stableSnapshots, ...transactions.map((transaction) => transaction.snapshot)],
      operations,
      'transaction inputs',
    );
    for (const transaction of transactions) {
      await assertAllSnapshotsCurrent(
        [
          ...stableSnapshots,
          ...transactions.map((candidate) => candidate.committedSnapshot ?? candidate.snapshot),
        ],
        operations,
        'package-manager authorities and documentation targets before mutation',
      );
      await assertPrivateEvidenceDirectoryCustody(
        evidence,
        operations,
        `before public mutation of ${transaction.snapshot.relativePath}`,
      );
      const before = await snapshotBoundPublicTarget(
        transaction,
        operations,
        `pre-mutation target ${transaction.snapshot.relativePath}`,
      );
      assertEquivalentSnapshot(
        transaction.snapshot,
        before,
        `pre-mutation target ${transaction.snapshot.relativePath}`,
      );
      await assertRetainedWritableHandleReady(
        transaction,
        `package-manager documentation pre-mutation target ${transaction.snapshot.relativePath}`,
      );
      transaction.mutationStarted = true;
      await writeHandleContentsAtZero(
        transaction.handle,
        transaction.contents,
        transaction.snapshot.mode,
        `target ${transaction.snapshot.relativePath}`,
      );
      const committed = await snapshotBoundPublicTarget(
        transaction,
        operations,
        `committed target ${transaction.snapshot.relativePath}`,
      );
      if (
        committed.objectIdentity !== transaction.snapshot.objectIdentity ||
        committed.mode !== transaction.snapshot.mode ||
        !committed.contents.equals(transaction.contents)
      ) {
        throw new Error(`committed target ${transaction.snapshot.relativePath} differs from its staged bytes`);
      }
      transaction.committedSnapshot = committed;
      await assertPrivateEvidenceDirectoryCustody(
        evidence,
        operations,
        `after public mutation of ${transaction.snapshot.relativePath}`,
      );
    }
    await assertAllSnapshotsCurrent(
      [
        ...stableSnapshots,
        ...transactions.map((transaction) => transaction.committedSnapshot),
      ],
      operations,
      'committed package-manager authorities and documentation targets',
    );
    await assertPrivateEvidenceDirectoryCustody(
      evidence,
      operations,
      'after committed document revalidation',
    );
  } catch (error) {
    const rollbackFailures = await rollbackBoundPublicTargets(transactions, operations);
    const closeFailures = await closeBoundPublicTargets(transactions);
    const cleanupFailures = [...closeFailures];
    const preserveEvidence = evidence?.preserved === true ||
      error?.evidenceOwnershipAmbiguous === true ||
      rollbackFailures.length > 0 ||
      closeFailures.length > 0 ||
      transactions.some((transaction) => transaction.publicBindingLost);
    if (evidence) {
      evidence.preserved = preserveEvidence;
      if (preserveEvidence) {
        try {
          await closePrivateEvidenceHandle(evidence, operations);
        } catch (cleanupError) {
          cleanupFailures.push({
            action: `close private transaction evidence handle ${evidence.path}`,
            error: cleanupError,
          });
        }
      } else {
        try {
          await cleanupPrivateEvidence(evidence, operations, evidenceChildren);
        } catch (cleanupError) {
          cleanupFailures.push({
            action: `remove private transaction evidence ${evidence.path}`,
            error: cleanupError,
          });
        }
      }
    }
    throw buildBoundTransactionError(error, {
      cleanupFailures,
      evidence,
      rollbackFailures,
    });
  }

  const closeFailures = await closeBoundPublicTargets(transactions);
  if (closeFailures.length > 0) {
    evidence.preserved = true;
    try {
      await closePrivateEvidenceHandle(evidence, operations);
    } catch (error) {
      closeFailures.push({
        action: `close private transaction evidence handle ${evidence.path}`,
        error,
      });
    }
    throw buildBoundTransactionError(
      new Error('could not close retained package-manager documentation FileHandles'),
      { cleanupFailures: closeFailures, evidence },
    );
  }
  try {
    await cleanupPrivateEvidence(evidence, operations, evidenceChildren);
  } catch (error) {
    throw buildBoundTransactionError(
      new Error(`could not clean package-manager documentation transaction evidence: ${transactionErrorText(error)}`),
      {
        cleanupFailures: [{
          action: `remove private transaction evidence ${evidence.path}`,
          error,
        }],
        evidence,
      },
    );
  }
  return Object.fromEntries(
    transactions.map((transaction) => [transaction.key, transaction.committedSnapshot]),
  );
}

async function acquireWriteLock(root, operations) {
  const lockPath = path.join(root, '.package-manager-docs.lock');
  const token = Buffer.from(`${randomUUID()}\n`, 'utf8');
  let handle;
  let identity;
  let owned = false;
  let primaryError;
  try {
    handle = await operations.open(lockPath, 'wx+', 0o600);
    owned = true;
    const ownershipStats = await handle.stat({ bigint: true });
    assertRegularStats(ownershipStats, `package-manager documentation lock ${lockPath}`);
    identity = objectIdentity(ownershipStats);
    await writeHandleContentsAtZero(
      handle,
      token,
      0o600,
      `package-manager documentation lock ${lockPath}`,
    );
    const finalStats = await handle.stat({ bigint: true });
    const pathStats = await operations.lstat(lockPath, { bigint: true });
    const contents = await readHandleContentsAtZero(handle, finalStats, lockPath);
    if (
      objectIdentity(finalStats) !== identity ||
      statIdentity(finalStats) !== statIdentity(pathStats) ||
      !contents.equals(token)
    ) {
      throw new Error(`package-manager documentation lock ${lockPath} lost its identity while acquired`);
    }
    return { handle, identity, owned: true, path: lockPath, token };
  } catch (error) {
    primaryError = error;
  }
  if (handle) {
    try {
      await handle.close();
    } catch (closeError) {
      primaryError = new AggregateError(
        [primaryError, closeError],
        `package-manager documentation lock acquisition and close both failed at ${lockPath}`,
      );
    }
  }
  // Once exclusive creation succeeds, an acquisition failure preserves the
  // lock as recovery evidence. Path-based cleanup here would introduce a
  // check-then-unlink window in which a replacement inode could be removed.
  const recovery = owned
    ? `; manual recovery path: preserve and inspect ${lockPath}`
    : '';
  throw new Error(
    `could not acquire package-manager documentation lock ${lockPath}: ${transactionErrorText(primaryError)}${recovery}`,
    { cause: primaryError },
  );
}

async function releaseWriteLock(lock, operations) {
  let primaryError;
  try {
    const handleStats = await lock.handle.stat({ bigint: true });
    const pathStats = await operations.lstat(lock.path, { bigint: true });
    const contents = await readHandleContentsAtZero(lock.handle, handleStats, lock.path);
    if (
      objectIdentity(handleStats) !== lock.identity ||
      objectIdentity(pathStats) !== lock.identity ||
      !contents.equals(lock.token)
    ) {
      throw new Error(`package-manager documentation lock ${lock.path} changed; refusing cleanup`);
    }
  } catch (error) {
    primaryError = error;
  }
  try {
    await lock.handle.close();
  } catch (closeError) {
    primaryError = primaryError
      ? new AggregateError(
        [primaryError, closeError],
        `package-manager documentation lock verification and close both failed at ${lock.path}`,
      )
      : closeError;
  }
  if (primaryError) {
    throw new Error(
      `could not release package-manager documentation lock ${lock.path}; preserve it for inspection: ${transactionErrorText(primaryError)}`,
      { cause: primaryError },
    );
  }
  const afterClose = await operations.lstat(lock.path, { bigint: true });
  if (objectIdentity(afterClose) !== lock.identity) {
    throw new Error(`package-manager documentation lock ${lock.path} changed before cleanup; refusing to remove it`);
  }
  await operations.rm(lock.path, { force: false });
  lock.owned = false;
}

async function synchronizePackageManagerDocsUnlocked(absoluteRoot, { mode, operations }) {

  const authoritySnapshotEntries = [];
  const manifestEntries = [];
  for (const [key, relativePath] of Object.entries(manifestPaths)) {
    const snapshot = await readBoundFileSnapshot(
      absoluteRoot,
      path.join(absoluteRoot, relativePath),
      relativePath,
      operations,
      `package-manager authority ${relativePath}`,
    );
    authoritySnapshotEntries.push([key, snapshot]);
    manifestEntries.push([
      key,
      JSON.parse(decodeUtf8(snapshot.contents, `package-manager authority ${relativePath}`)),
    ]);
  }
  const authoritySnapshots = Object.fromEntries(authoritySnapshotEntries);
  const versions = derivePackageManagerVersions(Object.fromEntries(manifestEntries));
  const snapshotEntries = [];
  for (const [key, relativePath] of Object.entries(documentPaths)) {
    snapshotEntries.push([
      key,
      await readBoundFileSnapshot(
        absoluteRoot,
        path.join(absoluteRoot, relativePath),
        relativePath,
        operations,
      ),
    ]);
  }
  const snapshots = Object.fromEntries(snapshotEntries);
  const documents = Object.fromEntries(
    Object.entries(snapshots).map(([key, snapshot]) => [
      key,
      decodeUtf8(snapshot.contents, `package-manager documentation target ${documentPaths[key]}`),
    ]),
  );
  const synchronized = synchronizePackageManagerDocumentTexts(documents, versions);
  const changedKeys = Object.keys(documentPaths).filter(
    (key) => documents[key] !== synchronized[key],
  );
  const changedPaths = changedKeys.map((key) => documentPaths[key]);

  let committedSnapshots = {};
  if (mode === 'write' && changedKeys.length > 0) {
    for (const key of changedKeys) {
      if (snapshots[key].linkCount !== 1n) {
        throw new Error(
          `package-manager documentation target ${documentPaths[key]} must have a link count of exactly one; ` +
          'refusing to mutate a hard-linked inode',
        );
      }
    }
    committedSnapshots = await writeDocumentsWithBoundHandles({
      entries: changedKeys.map((key) => ({
        contents: synchronized[key],
        key,
        snapshot: snapshots[key],
      })),
      operations,
      stableSnapshots: [
        ...Object.values(authoritySnapshots),
        ...Object.entries(snapshots)
          .filter(([key]) => !changedKeys.includes(key))
          .map(([, snapshot]) => snapshot),
      ],
    });
  }

  const finalDocumentSnapshots = [];
  for (const [key, relativePath] of Object.entries(documentPaths)) {
    const snapshot = await readBoundFileSnapshot(
      absoluteRoot,
      path.join(absoluteRoot, relativePath),
      relativePath,
      operations,
    );
    const expectedContents = mode === 'write' ? synchronized[key] : documents[key];
    if (
      decodeUtf8(snapshot.contents, `package-manager documentation target ${relativePath}`) !==
      expectedContents
    ) {
      throw new Error(`package-manager documentation target ${relativePath} changed before final validation`);
    }
    const trustedSnapshot = mode === 'write' && changedKeys.includes(key)
      ? committedSnapshots[key]
      : snapshots[key];
    assertEquivalentSnapshot(
      trustedSnapshot,
      snapshot,
      `package-manager documentation target ${relativePath} before final validation`,
    );
    finalDocumentSnapshots.push(snapshot);
  }
  await assertAllSnapshotsCurrent(
    [...Object.values(authoritySnapshots), ...finalDocumentSnapshots],
    operations,
    'package-manager authorities or documentation targets',
  );
  if (mode === 'check' && changedPaths.length > 0) {
    throw new Error(`package-manager documentation is stale: ${changedPaths.join(', ')}`);
  }
  return changedPaths;
}

export async function synchronizePackageManagerDocsAtRoot(root, { mode, fileOperations = {} }) {
  if (mode !== 'write' && mode !== 'check') {
    throw new Error('package-manager documentation mode must be "write" or "check"');
  }
  if (!fileOperations || typeof fileOperations !== 'object' || Array.isArray(fileOperations)) {
    throw new TypeError('package-manager documentation fileOperations must be an object');
  }
  const operations = { ...defaultFileOperations, ...fileOperations };
  for (const name of Object.keys(defaultFileOperations)) {
    if (typeof operations[name] !== 'function') {
      throw new TypeError(`package-manager documentation file operation ${name} must be a function`);
    }
  }

  const absoluteRoot = path.resolve(root);
  const rootStats = await operations.lstat(absoluteRoot, { bigint: true });
  assertDirectoryStats(rootStats, `package-manager documentation root ${absoluteRoot}`);
  let lock;
  let result;
  let primaryError;
  try {
    if (mode === 'write') lock = await acquireWriteLock(absoluteRoot, operations);
    result = await synchronizePackageManagerDocsUnlocked(absoluteRoot, { mode, operations });
  } catch (error) {
    primaryError = error;
  }
  if (lock) {
    try {
      await releaseWriteLock(lock, operations);
    } catch (releaseError) {
      primaryError = primaryError
        ? new Error(
          `package-manager documentation synchronization and lock cleanup both failed:\n` +
          `- synchronization: ${transactionErrorText(primaryError)}\n` +
          `- lock cleanup: ${transactionErrorText(releaseError)}\n` +
          `- lock recovery path: preserve and inspect ${lock.path}`,
          {
            cause: new AggregateError([primaryError, releaseError]),
          },
        )
        : releaseError;
    }
  }
  if (primaryError) throw primaryError;
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || (args[0] !== '--write' && args[0] !== '--check')) {
    throw new Error('usage: node scripts/sync-package-manager-docs.mjs --write|--check');
  }
  const mode = args[0].slice(2);
  const changedPaths = await synchronizePackageManagerDocsAtRoot(repoRoot, { mode });
  if (mode === 'check') {
    console.log('Package-manager documentation is current.');
  } else if (changedPaths.length === 0) {
    console.log('Package-manager documentation was already current.');
  } else {
    console.log(`Updated package-manager documentation: ${changedPaths.join(', ')}`);
  }
}

if (isMainModule(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(
      `Package-manager documentation synchronization failed: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
  }
}
