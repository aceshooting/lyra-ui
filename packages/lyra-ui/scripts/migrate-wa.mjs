#!/usr/bin/env node

// Contract-aware migration CLI and its public programmatic entry point.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LYRA_RENAME_ORIGINS, compareVersions } from './lyra-rename-ledger.mjs';
import {
  MIGRATION_ORIGINS,
  buildMigrationContract,
  invariant,
  inventoryPath,
  packagedRuntime,
  readExportDeprecations,
  readRenameLedger,
} from './migration-contract.mjs';
import { migrateText } from './migration-transforms.mjs';
import { buildProjectDomFactoryBindings } from './migration-analysis.mjs';
export {
  MIGRATION_RUNTIME_SCHEMA_VERSION,
  MIGRATION_ORIGINS,
  buildMigrationContract,
  createMigrationRuntimeInventory,
  readRenameLedger,
  readExportDeprecations,
  buildMirrorMap,
} from './migration-contract.mjs';
export { scanUnrewrittenUpstreamReferences, migrateText } from './migration-transforms.mjs';


export const MIGRATION_REPORT_SCHEMA_VERSION = 1;

const DEFAULT_EXTENSIONS = new Set([
  'html',
  'htm',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'css',
  'vue',
  'svelte',
  'mdx',
  'md',
]);
const IGNORE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.cache']);

// ---------------------------------------------------------------------------------------------
// Unified diff output for `--diff`.
// ---------------------------------------------------------------------------------------------

function diffLines(text) {
  const lines = text.split('\n');
  const eol = lines.at(-1) === '';
  if (eol) lines.pop();
  // The final line's terminator is part of its identity, so adding or removing the newline at the
  // end of a file is a change rather than an invisible no-op.
  return lines.map((line, index) => {
    const terminated = index < lines.length - 1 || eol;
    return { line, eol: terminated, key: terminated ? line : `${line}\u0000` };
  });
}

/**
 * Myers' O(ND) line diff. Each step's frontier holds only the diagonals that step can reach, so
 * the retained trace is O(D^2) in the number of changed lines rather than O(D * file length).
 */
function diffOperations(before, after) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix].key === after[prefix].key) prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix].key === after[after.length - 1 - suffix].key
  ) {
    suffix += 1;
  }
  const a = before.slice(prefix, before.length - suffix);
  const b = after.slice(prefix, after.length - suffix);
  const goesDown = (frontier, diagonal, depth) =>
    diagonal === -depth || (diagonal !== depth && frontier.get(diagonal - 1) < frontier.get(diagonal + 1));

  const trace = [];
  let frontier = new Map([[1, 0]]);
  search: for (let depth = 0; depth <= a.length + b.length; depth += 1) {
    trace.push(frontier);
    const next = new Map();
    for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
      let x = goesDown(frontier, diagonal, depth) ? frontier.get(diagonal + 1) : frontier.get(diagonal - 1) + 1;
      let y = x - diagonal;
      while (x < a.length && y < b.length && a[x].key === b[y].key) {
        x += 1;
        y += 1;
      }
      next.set(diagonal, x);
      if (x >= a.length && y >= b.length) break search;
    }
    frontier = next;
  }

  const middle = [];
  let x = a.length;
  let y = b.length;
  for (let depth = trace.length - 1; depth >= 0; depth -= 1) {
    const previous = trace[depth];
    const diagonal = x - y;
    const previousDiagonal = goesDown(previous, diagonal, depth) ? diagonal + 1 : diagonal - 1;
    const previousX = previous.get(previousDiagonal);
    const previousY = previousX - previousDiagonal;
    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      middle.push({ type: ' ', before: prefix + x, after: prefix + y });
    }
    if (depth > 0) {
      if (x === previousX) middle.push({ type: '+', after: prefix + y - 1 });
      else middle.push({ type: '-', before: prefix + x - 1 });
    }
    x = previousX;
    y = previousY;
  }
  middle.reverse();
  const operations = [];
  for (let index = 0; index < prefix; index += 1) operations.push({ type: ' ', before: index, after: index });
  operations.push(...middle);
  for (let index = suffix; index > 0; index -= 1) {
    operations.push({ type: ' ', before: before.length - index, after: after.length - index });
  }
  return operations;
}

function quoteDiffPath(file) {
  if (/^[\x21-\x7e]+$/.test(file) && !/["\\]/.test(file)) return file;
  // Git's quoted paths use byte-wise C escapes, including octal UTF-8 bytes.
  let quoted = '"';
  for (const byte of Buffer.from(file, 'utf8')) {
    if (byte === 0x22 || byte === 0x5c) quoted += `\\${String.fromCharCode(byte)}`;
    else if (byte >= 0x20 && byte <= 0x7e) quoted += String.fromCharCode(byte);
    else quoted += `\\${byte.toString(8).padStart(3, '0')}`;
  }
  return `${quoted}"`;
}

/** A `git apply`-compatible unified diff of one file, with three lines of context. */
export function unifiedDiff(file, original, content, context = 3) {
  if (original === content) return '';
  const before = diffLines(original);
  const after = diffLines(content);
  const operations = diffOperations(before, after);
  const beforeSeen = [0];
  const afterSeen = [0];
  for (const operation of operations) {
    beforeSeen.push(beforeSeen.at(-1) + (operation.type === '+' ? 0 : 1));
    afterSeen.push(afterSeen.at(-1) + (operation.type === '-' ? 0 : 1));
  }
  const hunks = [];
  operations.forEach((operation, index) => {
    if (operation.type === ' ') return;
    const last = hunks.at(-1);
    if (last && index - last.end <= context * 2 + 1) last.end = index;
    else hunks.push({ start: index, end: index });
  });
  const output = [`--- ${quoteDiffPath(`a/${file}`)}\n`, `+++ ${quoteDiffPath(`b/${file}`)}\n`];
  for (const hunk of hunks) {
    const start = Math.max(0, hunk.start - context);
    const end = Math.min(operations.length, hunk.end + context + 1);
    const beforeCount = beforeSeen[end] - beforeSeen[start];
    const afterCount = afterSeen[end] - afterSeen[start];
    const beforeStart = beforeSeen[start] + (beforeCount ? 1 : 0);
    const afterStart = afterSeen[start] + (afterCount ? 1 : 0);
    output.push(`@@ -${beforeStart},${beforeCount} +${afterStart},${afterCount} @@\n`);
    for (const operation of operations.slice(start, end)) {
      const record = operation.type === '+' ? after[operation.after] : before[operation.before];
      output.push(`${operation.type}${record.line}\n`);
      if (!record.eol) output.push('\\ No newline at end of file\n');
    }
  }
  return output.join('');
}

function reportPathName(file, cwd) {
  return (path.relative(cwd, file) || path.basename(file)).split(path.sep).join('/');
}

/**
 * Migrates `files` in place (unless `dryRun`) and returns the stable JSON report. `renameLedger`
 * is the authored ledger for a repository inventory; `lyraVersion` is the installed
 * @aceshooting/lyra-ui version, when known. With `collectDiff`, the returned object also carries a
 * unified `diff` of every changed file; the written report never includes it.
 */
export function migrateFiles({
  files,
  inventory,
  dryRun = false,
  reportPath = null,
  cwd = process.cwd(),
  origin = null,
  renameLedger = null,
  exportDeprecations = [],
  lyraVersion = null,
  collectDiff = false,
  compatibilityContext = null,
}) {
  if (collectDiff) {
    // `git apply` rejects `a/../x`, so a patch is only produced for files below the working
    // directory, whose relative paths it can apply (with --directory from a repository root).
    const outside = files.filter((file) => {
      const relative = path.relative(cwd, file);
      return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
    });
    if (outside.length) {
      throw new Error(`--diff needs every target inside the working directory; run it from a common parent of ${outside.join(', ')}.`);
    }
  }
  const contract = buildMigrationContract(inventory, { renameLedger, exportDeprecations, lyraVersion, compatibilityContext });
  const originals = new Map(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));
  const diffs = [];
  const noteDiff = (file, original, content) => {
    if (collectDiff && content !== original) diffs.push(unifiedDiff(reportPathName(file, cwd), original, content));
  };
  const finish = (report) => {
    if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return collectDiff ? { ...report, diff: diffs.join('') } : report;
  };
  if (origin !== null) {
    const renameProfile = contract.renameProfiles.has(origin);
    invariant(
      contract.localMigrations.has(origin) || renameProfile,
      `unknown local migration origin ${String(origin)}`,
    );
    const blockedLocalMigrations = new Set();
    const constructedEvents = new Set();
    for (const [file, original] of originals) {
      const analysis = migrateText(original, contract, {
        file: reportPathName(file, cwd),
        origin,
      });
      for (const key of analysis.blockedLocalMigrations) blockedLocalMigrations.add(key);
      for (const name of analysis.constructedEvents ?? []) constructedEvents.add(name);
    }

    const changes = [];
    const warnings = [];
    let filesChanged = 0;
    let acknowledged = 0;
    for (const [file, original] of originals) {
      const result = migrateText(original, contract, {
        file: reportPathName(file, cwd),
        origin,
        blockedLocalMigrations,
        constructedEvents,
      });
      changes.push(...result.changes);
      warnings.push(...result.warnings);
      acknowledged += result.acknowledged ?? 0;
      if (result.content !== original) {
        filesChanged += 1;
        noteDiff(file, original, result.content);
        if (!dryRun) fs.writeFileSync(file, result.content, 'utf8');
      }
    }
    const sortEntries = (entries) => entries.sort((left, right) =>
      left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column ||
      left.action.localeCompare(right.action));
    sortEntries(changes);
    sortEntries(warnings);
    const summary = { rewrites: changes.length, warnings: warnings.length };
    if (renameProfile) {
      summary.acknowledged = acknowledged;
      if (lyraVersion !== null) summary.skipped = contract.renameProfiles.get(origin).skipped.length;
    }
    return finish({
      schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
      origin,
      dryRun,
      filesScanned: files.length,
      filesChanged,
      changes,
      warnings,
      summary,
    });
  }
  const domFactoryBindings = buildProjectDomFactoryBindings(originals);
  const blockedMappings = new Set();
  const blockedEcosystems = new Set();
  const bareImportPackages = new Set();
  const automaticMappings = new Set();
  const deepRegistrationMappings = new Set();
  const usage = {
    webawesome: { automatic: 0, manual: 0 },
    shoelace: { automatic: 0, manual: 0 },
  };
  for (const [file, original] of originals) {
    const analysis = migrateText(original, contract, {
      file: reportPathName(file, cwd),
      rewriteBarePackages: new Set(),
      domFactoryBindings: domFactoryBindings.get(path.resolve(file)),
    });
    for (const ecosystem of Object.keys(usage)) {
      usage[ecosystem].automatic += analysis.usage[ecosystem].automatic;
      usage[ecosystem].manual += analysis.usage[ecosystem].manual;
    }
    for (const upstreamTag of analysis.blockedMappings) blockedMappings.add(upstreamTag);
    for (const ecosystem of analysis.blockedEcosystems) blockedEcosystems.add(ecosystem);
    for (const packageName of analysis.bareImportPackages) bareImportPackages.add(packageName);
    for (const upstreamTag of analysis.automaticMappings) automaticMappings.add(upstreamTag);
    for (const upstreamTag of analysis.deepRegistrationMappings) deepRegistrationMappings.add(upstreamTag);
  }
  for (const packageName of bareImportPackages) {
    const identity = contract.packageIdentities.get(packageName);
    if (identity && usage[identity.ecosystem].manual > 0) blockedEcosystems.add(identity.ecosystem);
  }
  const rewriteBarePackages = new Set(
    [...bareImportPackages].filter((packageName) => {
      const identity = contract.packageIdentities.get(packageName);
      if (!identity) return false;
      const counts = usage[identity.ecosystem];
      return counts.automatic > 0 && counts.manual === 0 && !blockedEcosystems.has(identity.ecosystem);
    }),
  );
  const rootRegistrationMappings = new Map(
    [...bareImportPackages].map((packageName) => {
      const identity = contract.packageIdentities.get(packageName);
      const relevant = new Set(
        [...automaticMappings].filter((upstreamTag) => {
          const mapping = contract.mappings.get(upstreamTag);
          return Boolean(
            identity &&
            mapping?.upstream === identity.ecosystem &&
            (!mapping.source?.tier || identity.tiers.has(mapping.source.tier)),
          );
        }),
      );
      return [packageName, relevant];
    }),
  );
  const provenRegistrationMappings = new Set(deepRegistrationMappings);
  for (const packageName of rewriteBarePackages) {
    for (const upstreamTag of rootRegistrationMappings.get(packageName) ?? []) {
      provenRegistrationMappings.add(upstreamTag);
    }
  }
  const registrationBlockedMappings = new Set(
    [...automaticMappings].filter((upstreamTag) => !provenRegistrationMappings.has(upstreamTag)),
  );

  const changes = [];
  const warnings = [];
  let filesChanged = 0;
  for (const [file, original] of originals) {
    const result = migrateText(original, contract, {
      file: reportPathName(file, cwd),
      rewriteBarePackages,
      rootRegistrationMappings,
      blockedMappings,
      blockedEcosystems,
      registrationBlockedMappings,
      domFactoryBindings: domFactoryBindings.get(path.resolve(file)),
    });
    changes.push(...result.changes);
    warnings.push(...result.warnings);
    if (result.content !== original) {
      filesChanged += 1;
      noteDiff(file, original, result.content);
      if (!dryRun) fs.writeFileSync(file, result.content, 'utf8');
    }
  }
  const sortEntries = (entries) => entries.sort((left, right) =>
    left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column ||
    left.action.localeCompare(right.action));
  sortEntries(changes);
  sortEntries(warnings);
  return finish({
    schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
    origin: null,
    dryRun,
    filesScanned: files.length,
    filesChanged,
    changes,
    warnings,
    summary: {
      rewrites: changes.length,
      warnings: warnings.length,
    },
  });
}

export function parseArgs(argv) {
  const options = {
    check: false,
    diff: false,
    dryRun: false,
    help: false,
    extensions: DEFAULT_EXTENSIONS,
    lyraVersion: null,
    origin: null,
    report: null,
    targets: [],
  };
  let positional = false;
  for (const argument of argv) {
    if (!positional && argument === '--') {
      positional = true;
    } else if (!positional && (argument === '--dry-run' || argument === '-n')) {
      options.dryRun = true;
    } else if (!positional && argument === '--check') {
      options.check = true;
      options.dryRun = true;
    } else if (!positional && argument === '--diff') {
      options.diff = true;
      options.dryRun = true;
    } else if (!positional && (argument === '--help' || argument === '-h')) {
      options.help = true;
    } else if (!positional && argument.startsWith('--ext=')) {
      options.extensions = new Set(
        argument
          .slice('--ext='.length)
          .split(',')
          .map((extension) => extension.trim().replace(/^\./, '').toLowerCase())
          .filter(Boolean),
      );
    } else if (!positional && argument.startsWith('--report=')) {
      options.report = argument.slice('--report='.length);
      if (!options.report) throw new Error('--report requires a path');
    } else if (!positional && argument.startsWith('--lyra-version=')) {
      options.lyraVersion = argument.slice('--lyra-version='.length);
      if (compareVersions(options.lyraVersion, options.lyraVersion) !== 0) {
        throw new Error(`--lyra-version needs a version such as 22.0.0, got ${options.lyraVersion || 'nothing'}`);
      }
    } else if (!positional && argument.startsWith('--origin=')) {
      options.origin = argument.slice('--origin='.length);
      if (!options.origin) throw new Error('--origin requires a value');
      if (!MIGRATION_ORIGINS.includes(options.origin)) {
        throw new Error(`Unknown migration origin: ${options.origin}`);
      }
    } else if (!positional && argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      options.targets.push(argument);
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage: lyra-ui-migrate [--check] [--dry-run] [--diff] [--origin=${MIGRATION_ORIGINS.join('|')}] [--lyra-version=x.y.z] [--report=path] [--ext=html,ts,...] targets...

Only exact and fully rewritten inventory mappings change automatically. Conceptual, unsafe,
unsupported, unknown, and unresolved deep-import uses remain unchanged with source-located
warnings. The optional JSON report has a stable schema for CI and review tooling.

Without --origin, only Web Awesome and Shoelace migrations run. --origin=lyra-v21 migrates
deprecated Lyra 21 member names
(attributes, properties, events, parts, custom properties and slots) where the rewrite cannot
change what a site reaches, preserves changed defaults, and reports everything else, including
listeners of events whose detail changed. --origin=lyra-v22 reports deprecated theme APIs,
stylesheets, window events and root attributes; review their replacement semantics explicitly.
Lyra profiles never rewrite tags or imports. Run a Lyra profile with the CLI of the installed
release, after upgrading.

  --dry-run, -n        report changes without writing source files
  --check              exit nonzero when rewrites or warnings remain; never write source files
  --diff               print a unified diff of the changes instead of writing source files
  --origin=lyra-v21    migrate names and defaults that change from Lyra 21 to Lyra 22
  --origin=lyra-v22    review Lyra 22 module contracts retained through Lyra 23
  --lyra-version=x.y.z apply only rename entries available in this release (default: the
                       @aceshooting/lyra-ui installed under the working directory, when found)
  --report=path        write the stable JSON migration report
  --ext=a,b,c          extensions scanned for directory targets
  --help, -h           show this message

A reviewed rename-profile warning is acknowledged by a "lyra-migrate-reviewed: CODE:name" comment
(for example DETAIL_SHAPE_REVIEW:lr-close) on the reported line, alone on the line above it, or
directly before the reported element's opening tag.`);
}

/** The version of the @aceshooting/lyra-ui installed at or above `directory`, or null. */
export function detectInstalledLyraVersion(directory = process.cwd()) {
  let current = path.resolve(directory);
  for (;;) {
    const manifest = path.join(current, 'node_modules', '@aceshooting', 'lyra-ui', 'package.json');
    if (fs.existsSync(manifest)) {
      try {
        const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
        return compareVersions(version, version) === 0 ? version : null;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function walkDir(directory, filter) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIR_NAMES.has(entry.name)) files.push(...walkDir(target, filter));
    } else if (entry.isFile() && filter(target, entry.name)) files.push(target);
  }
  return files;
}

function globToRegExp(segments) {
  let source = '^';
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === '**') source += '(?:.*/)?';
    else {
      source += segment
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
      if (index < segments.length - 1) source += '/';
    }
  }
  return new RegExp(`${source}$`);
}

function expandGlob(pattern) {
  const segments = pattern.split(path.sep).join('/').split('/');
  let split = 0;
  while (split < segments.length && !/[*?]/.test(segments[split])) split += 1;
  const base = path.resolve(segments.slice(0, split).join('/') || '.');
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) return [];
  const regex = globToRegExp(segments.slice(split));
  return walkDir(base, () => true).filter((file) => regex.test(path.relative(base, file).split(path.sep).join('/')));
}

export function collectFiles(targets, extensions) {
  const files = new Set();
  for (const target of targets) {
    if (/[*?]/.test(target)) {
      for (const file of expandGlob(target)) files.add(file);
      continue;
    }
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`warning: path not found, skipping: ${target}`);
      continue;
    }
    if (fs.statSync(resolved).isDirectory()) {
      for (const file of walkDir(resolved, (_file, name) => extensions.has(path.extname(name).slice(1).toLowerCase()))) {
        files.add(file);
      }
    } else files.add(resolved);
  }
  return [...files].sort();
}

export function run(argv, { compatibilityContext = null, currentExportDeprecations = null } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
  if (options.help || !options.targets.length) {
    printUsage();
    return options.help ? 0 : 1;
  }
  const files = collectFiles(options.targets, options.extensions);
  if (!files.length) {
    console.error('No files matched the given path(s)/pattern(s).');
    return 1;
  }
  try {
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const renameOrigin = LYRA_RENAME_ORIGINS.includes(options.origin);
    const lyraVersion = renameOrigin ? options.lyraVersion ?? detectInstalledLyraVersion() : null;
    const report = migrateFiles({
      files,
      inventory,
      dryRun: options.dryRun,
      origin: options.origin,
      renameLedger: packagedRuntime ? null : readRenameLedger(),
      exportDeprecations: packagedRuntime ? [] : currentExportDeprecations ?? readExportDeprecations(),
      compatibilityContext,
      lyraVersion,
      reportPath: options.report ? path.resolve(options.report) : null,
      collectDiff: options.diff,
    });
    // With --diff, stdout carries only the patch so it can be redirected into a file or `git apply`.
    const log = options.diff ? console.error : console.log;
    if (options.diff) process.stdout.write(report.diff);
    if (renameOrigin) {
      log(
        lyraVersion === null
          ? 'No installed @aceshooting/lyra-ui found under the working directory; applying every entry of the profile.'
          : `Applying entries available in @aceshooting/lyra-ui ${lyraVersion}` +
            (report.summary.skipped ? `; ${report.summary.skipped} entr${report.summary.skipped === 1 ? 'y needs' : 'ies need'} a later release.` : '.'),
      );
    }
    for (const entry of report.changes) {
      log(`${entry.file}:${entry.line}:${entry.column}  ${entry.action}: ${entry.message}`);
    }
    for (const entry of report.warnings) {
      log(`${entry.file}:${entry.line}:${entry.column}  warning ${entry.warningCode}: ${entry.message}`);
    }
    log(
      `${report.filesScanned} file(s) scanned, ${report.filesChanged} changed, ` +
        `${report.summary.rewrites} rewrite(s), ${report.summary.warnings} warning(s)` +
        (Object.hasOwn(report.summary, 'acknowledged') ? `, ${report.summary.acknowledged} acknowledged.` : '.'),
    );
    if (options.dryRun && report.filesChanged) log('Dry run only -- no source files were written.');
    if (options.report) log(`JSON report written to ${options.report}.`);
    if (options.check) {
      const remaining = report.filesChanged > 0 || report.summary.warnings > 0;
      log(
        remaining
          ? `Migration check failed: ${report.filesChanged} file(s) need changes and ${report.summary.warnings} warning(s) require review.`
          : 'Migration check passed: no rewrites or warnings remain.',
      );
      return remaining ? 1 : 0;
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

/**
 * Whether this module was invoked as the CLI rather than imported as a library.
 *
 * Compares REALPATHS. Under pnpm, `node_modules/.bin/lyra-ui-migrate` resolves into a package
 * directory that is a symlink into the virtual store, so the path the shim passes as `argv[1]`
 * (`<cwd>/node_modules/@aceshooting/lyra-ui/dist/cli/migrate-wa.mjs`) and this module's own
 * `import.meta.url` (`<cwd>/node_modules/.pnpm/@aceshooting+lyra-ui@<version>_<peer-suffix>/...`)
 * never match literally. The former raw comparison therefore evaluated false on every pnpm install:
 * `run()` never executed, so the CLI printed nothing, rewrote nothing, wrote no report -- and exited
 * 0. That made the documented `--check` CI gate pass unconditionally, which is worse than having no
 * gate, because it is trusted. npm and yarn were unaffected, which is how it survived.
 *
 * Falls back to the literal comparison only if a realpath cannot be taken (a deleted or
 * permission-denied entry), which keeps the import-as-a-library case correct either way.
 */
function invokedAsCli() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const here = fileURLToPath(import.meta.url);
  try {
    return fs.realpathSync(invoked) === fs.realpathSync(here);
  } catch {
    return path.resolve(invoked) === here;
  }
}

if (invokedAsCli()) {
  // Build-only history is never imported by the packed CLI, whose inventory is prevalidated.
  if (packagedRuntime || process.argv.includes('--help') || process.argv.length < 3) {
    process.exitCode = run(process.argv.slice(2));
  } else {
    const { readCurrentCompatibilityContext } = await import('./check-published-compatibility.mjs');
    const { readComponentMetadataSources, assembleComponentMetadata } = await import('./component-metadata-source.mjs');
    const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const compatibilityContext = await readCurrentCompatibilityContext(packageRoot);
    process.exitCode = run(process.argv.slice(2), { compatibilityContext,
      currentExportDeprecations: assembleComponentMetadata(readComponentMetadataSources(packageRoot)).exportDeprecations });
  }
}
