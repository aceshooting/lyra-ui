#!/usr/bin/env node
// The published package.json omits contributor-only fields (the internal `scripts`, including
// lifecycle hooks such as `pretest`, `devDependencies` and package-manager pins).
//
// Every published package ends its `prepack` with `strip` and declares `restore` as `postpack`.
// pnpm reads package.json again after `prepack`, so the archive (and therefore the published
// manifest) carries the stripped copy while the checkout gets its original bytes back. The
// original lives under node_modules/, which no archive ever includes. `pnpm pack --dry-run` runs
// `prepack` without `postpack`, and a failed pack skips it too, so `strip` also leaves a detached
// guard that restores the checkout once the packing pnpm process exits.
//
//   node packed-manifest.mjs strip [--dir <package>]
//   node packed-manifest.mjs restore [--dir <package>]
//   node packed-manifest.mjs check --tarball <archive.tgz> [--source <package.json>]
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';

/** Fields only contributors and the workspace read; none reaches a consumer install or tool. */
export const DEV_ONLY_FIELDS = Object.freeze(['scripts', 'devDependencies', 'packageManager', 'devEngines', 'pnpm']);

/** Fields every published package declares; their absence means the strip went too far. */
export const REQUIRED_PUBLISHED_FIELDS = Object.freeze([
  'name', 'version', 'description', 'license', 'type', 'repository', 'engines', 'exports', 'files',
]);

/** Dependency maps whose `workspace:` specifiers pnpm rewrites while packing; compared by name. */
const REWRITTEN_DEPENDENCY_FIELDS = new Set(['dependencies', 'peerDependencies', 'optionalDependencies']);

const BACKUP_DIRECTORY = join('node_modules', '.cache', 'lyra-packed-manifest');
const GUARD_POLL_MS = 250;
const GUARD_MAXIMUM_MS = 6 * 60 * 60 * 1000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The consumer manifest: the source manifest minus contributor-only fields, key order kept. */
export function publishedManifest(manifest) {
  if (!isRecord(manifest)) throw new TypeError('A package manifest must be a JSON object.');
  return Object.fromEntries(Object.entries(manifest).filter(([key]) => !DEV_ONLY_FIELDS.includes(key)));
}

export function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Findings for a packed package/package.json. With the source manifest, every consumer field it
 * declares must survive unchanged (dependency maps by name, as pnpm resolves `workspace:` ranges).
 */
export function packedManifestFindings(packed, source) {
  if (!isRecord(packed)) return ['The packed package/package.json is not a JSON object.'];
  const label = typeof packed.name === 'string' ? packed.name : 'packed package';
  const findings = [];
  for (const field of DEV_ONLY_FIELDS) {
    if (Object.hasOwn(packed, field)) findings.push(`${label}: the packed manifest still carries contributor-only '${field}'.`);
  }
  for (const field of REQUIRED_PUBLISHED_FIELDS) {
    if (!Object.hasOwn(packed, field)) findings.push(`${label}: the packed manifest lacks required '${field}'.`);
  }
  if (source !== undefined) {
    if (!isRecord(source)) return [...findings, `${label}: the source package.json is not a JSON object.`];
    for (const [field, value] of Object.entries(publishedManifest(source))) {
      if (!Object.hasOwn(packed, field)) {
        findings.push(`${label}: the packed manifest dropped consumer field '${field}'.`);
      } else if (REWRITTEN_DEPENDENCY_FIELDS.has(field)) {
        const expected = Object.keys(value ?? {}).sort().join(',');
        const actual = Object.keys(packed[field] ?? {}).sort().join(',');
        if (expected !== actual) findings.push(`${label}: the packed '${field}' names differ from the source manifest.`);
      } else if (JSON.stringify(packed[field]) !== JSON.stringify(value)) {
        findings.push(`${label}: the packed '${field}' differs from the source manifest.`);
      }
    }
  }
  return findings;
}

export function backupPath(packageDir) {
  return join(packageDir, BACKUP_DIRECTORY, 'package.json');
}

/** Records which packing process owns the kept original, so a late guard never undoes a newer pack. */
function ownerPath(packageDir) {
  return join(packageDir, BACKUP_DIRECTORY, 'owner');
}

/** Whether `current` is exactly what `strip` writes for the `original` bytes. */
function isStrippedCopy(current, original) {
  try {
    return current === serializeManifest(publishedManifest(JSON.parse(original)));
  } catch {
    return false;
  }
}

/** Replace package.json with its published form, keeping the original bytes for `restore`. */
export function stripManifest(packageDir, owner = '') {
  const file = join(packageDir, 'package.json');
  const backup = backupPath(packageDir);
  const current = readFileSync(file, 'utf8');
  // A pack that never reached `postpack` (and whose guard could not run) left a stripped
  // package.json behind; the kept original is still the source of truth then.
  const stale = existsSync(backup) ? readFileSync(backup, 'utf8') : undefined;
  const original = stale !== undefined && isStrippedCopy(current, stale) ? stale : current;
  const manifest = JSON.parse(original);
  if (!isRecord(manifest.scripts)) {
    throw new Error(`${file} has no scripts to strip; refusing to replace a manifest that is already published-shaped.`);
  }
  mkdirSync(dirname(backup), { recursive: true });
  writeFileSync(`${backup}.tmp`, original);
  renameSync(`${backup}.tmp`, backup);
  writeFileSync(ownerPath(packageDir), String(owner));
  writeFileSync(`${file}.tmp`, serializeManifest(publishedManifest(manifest)));
  renameSync(`${file}.tmp`, file);
  return { file, backup };
}

/** Put the original package.json bytes back. Returns false when there was nothing to restore. */
export function restoreManifest(packageDir) {
  const file = join(packageDir, 'package.json');
  const backup = backupPath(packageDir);
  if (!existsSync(backup)) {
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    if (isRecord(manifest.scripts)) return false;
    throw new Error(`${file} is stripped but its original is missing from ${backup}; restore it from version control.`);
  }
  const current = readFileSync(file, 'utf8');
  const original = readFileSync(backup, 'utf8');
  if (current !== original && !isStrippedCopy(current, original)) {
    throw new Error(`${file} changed while packing; keeping ${backup} for manual comparison.`);
  }
  renameSync(backup, file);
  rmSync(ownerPath(packageDir), { force: true });
  return true;
}

function processRow(pid) {
  const row = execFileSync('ps', ['-o', 'ppid=', '-o', 'args=', '-p', String(pid)], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const match = /^(\d+)\s+(.*)$/su.exec(row);
  return match ? { ppid: Number(match[1]), args: match[2].split(/\s+/u) } : undefined;
}

/** The nearest ancestor that is a package-manager `pack`/`publish` invocation, if any. */
export function findPackingProcess(startPid = process.ppid, readRow = processRow) {
  let pid = startPid;
  for (let depth = 0; depth < 12 && pid > 1; depth += 1) {
    let row;
    try {
      row = readRow(pid);
    } catch {
      return undefined;
    }
    if (!row) return undefined;
    const program = basename(row.args[0] ?? '');
    const shell = ['sh', 'bash', 'dash', 'zsh'].includes(program) || row.args.includes('-c');
    if (!shell && row.args.slice(1).some((argument) => argument === 'pack' || argument === 'publish')) return pid;
    pid = row.ppid;
  }
  return undefined;
}

function startGuard(packageDir, pid) {
  if (!pid) return;
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'guard', '--pid', String(pid), '--dir', packageDir], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function guard(pid, packageDir) {
  const started = Date.now();
  const timer = setInterval(() => {
    if (isAlive(pid) && Date.now() - started < GUARD_MAXIMUM_MS) return;
    clearInterval(timer);
    try {
      const owner = readFileSync(ownerPath(packageDir), 'utf8');
      if (owner === String(pid) && existsSync(backupPath(packageDir))) restoreManifest(packageDir);
    } catch {
      // A changed package.json keeps its backup for the next strip or a manual comparison.
    }
  }, GUARD_POLL_MS);
}

function readArchiveManifest(tarball) {
  return JSON.parse(execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  }));
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!['--dir', '--pid', '--tarball', '--source'].includes(flag) || typeof value !== 'string' || value.startsWith('--')) {
      throw new TypeError(`Usage: packed-manifest.mjs strip|restore [--dir <package>] | check --tarball <archive.tgz> [--source <package.json>]`);
    }
    options[flag.slice(2)] = value;
  }
  return { command, options };
}

export function runCli(argv = process.argv.slice(2)) {
  const { command, options } = parseArguments(argv);
  const packageDir = resolve(options.dir ?? process.cwd());
  switch (command) {
    case 'strip': {
      const pid = findPackingProcess();
      stripManifest(packageDir, pid ?? '');
      startGuard(packageDir, pid);
      return;
    }
    case 'restore':
      restoreManifest(packageDir);
      return;
    case 'guard':
      guard(Number(options.pid), packageDir);
      return;
    case 'check': {
      if (!options.tarball) throw new TypeError('check requires --tarball <archive.tgz>.');
      const source = options.source ? JSON.parse(readFileSync(options.source, 'utf8')) : undefined;
      const packed = readArchiveManifest(options.tarball);
      const findings = packedManifestFindings(packed, source);
      if (findings.length > 0) throw new Error(findings.join('\n'));
      console.log(`${packed.name}@${packed.version}: published manifest omits ${DEV_ONLY_FIELDS.join(', ')}.`);
      return;
    }
    default:
      throw new TypeError(`Unknown packed-manifest command '${command}'.`);
  }
}

if (isMainModule(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
